#!/bin/bash
# Roo Code CLI Release Script
# 
# Usage:
#   ./apps/cli/scripts/release.sh [version]
#
# Examples:
#   ./apps/cli/scripts/release.sh           # Use version from package.json
#   ./apps/cli/scripts/release.sh 0.1.0     # Specify version
#
# This script:
# 1. Builds the extension and CLI
# 2. Creates a tarball for the current platform
# 3. Creates a GitHub release and uploads the tarball
#
# Prerequisites:
#   - GitHub CLI (gh) installed and authenticated
#   - pnpm installed
#   - Run from the monorepo root directory

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

info() { printf "${GREEN}==>${NC} %s\n" "$1"; }
warn() { printf "${YELLOW}Warning:${NC} %s\n" "$1"; }
error() { printf "${RED}Error:${NC} %s\n" "$1" >&2; exit 1; }
step() { printf "${BLUE}${BOLD}[%s]${NC} %s\n" "$1" "$2"; }

# Get script directory and repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
CLI_DIR="$REPO_ROOT/apps/cli"

# Detect current platform
detect_platform() {
    OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    ARCH=$(uname -m)
    
    case "$OS" in
        darwin) OS="darwin" ;;
        linux) OS="linux" ;;
        *) error "Unsupported OS: $OS" ;;
    esac
    
    case "$ARCH" in
        x86_64|amd64) ARCH="x64" ;;
        arm64|aarch64) ARCH="arm64" ;;
        *) error "Unsupported architecture: $ARCH" ;;
    esac
    
    PLATFORM="${OS}-${ARCH}"
}

# Check prerequisites
check_prerequisites() {
    step "1/7" "Checking prerequisites..."
    
    if ! command -v gh &> /dev/null; then
        error "GitHub CLI (gh) is not installed. Install it with: brew install gh"
    fi
    
    if ! gh auth status &> /dev/null; then
        error "GitHub CLI is not authenticated. Run: gh auth login"
    fi
    
    if ! command -v pnpm &> /dev/null; then
        error "pnpm is not installed."
    fi
    
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed."
    fi
    
    info "Prerequisites OK"
}

# Get version
get_version() {
    if [ -n "$1" ]; then
        VERSION="$1"
    else
        VERSION=$(node -p "require('$CLI_DIR/package.json').version")
    fi
    
    # Validate semver format
    if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$'; then
        error "Invalid version format: $VERSION (expected semver like 0.1.0)"
    fi
    
    TAG="cli-v$VERSION"
    info "Version: $VERSION (tag: $TAG)"
}

# Build everything
build() {
    step "2/7" "Building extension bundle..."
    cd "$REPO_ROOT"
    pnpm bundle
    
    step "3/7" "Building CLI..."
    pnpm --filter @roo-code/cli build
    
    info "Build complete"
}

# Create release tarball
create_tarball() {
    step "4/7" "Creating release tarball for $PLATFORM..."
    
    RELEASE_DIR="$REPO_ROOT/roo-cli-${PLATFORM}"
    TARBALL="roo-cli-${PLATFORM}.tar.gz"
    
    # Clean up any previous build
    rm -rf "$RELEASE_DIR"
    rm -f "$REPO_ROOT/$TARBALL"
    
    # Create directory structure
    mkdir -p "$RELEASE_DIR/bin"
    mkdir -p "$RELEASE_DIR/lib"
    mkdir -p "$RELEASE_DIR/extension"
    
    # Copy CLI dist files
    info "Copying CLI files..."
    cp -r "$CLI_DIR/dist/"* "$RELEASE_DIR/lib/"
    
    # Create package.json for npm install (only runtime dependencies)
    info "Creating package.json..."
    node -e "
      const pkg = require('$CLI_DIR/package.json');
      const newPkg = {
        name: '@roo-code/cli',
        version: pkg.version,
        type: 'module',
        dependencies: {
          commander: pkg.dependencies.commander
        }
      };
      console.log(JSON.stringify(newPkg, null, 2));
    " > "$RELEASE_DIR/package.json"
    
    # Copy extension bundle
    info "Copying extension bundle..."
    cp -r "$REPO_ROOT/src/dist/"* "$RELEASE_DIR/extension/"
    
    # Add package.json to extension directory to mark it as CommonJS
    # This is necessary because the main package.json has "type": "module"
    # but the extension bundle is CommonJS
    echo '{"type": "commonjs"}' > "$RELEASE_DIR/extension/package.json"
    
    # Find and copy ripgrep binary
    # The extension looks for ripgrep at: appRoot/node_modules/@vscode/ripgrep/bin/rg
    # The CLI sets appRoot to the CLI package root, so we need to put ripgrep there
    info "Looking for ripgrep binary..."
    RIPGREP_PATH=$(find "$REPO_ROOT/node_modules" -path "*/@vscode/ripgrep/bin/rg" -type f 2>/dev/null | head -1)
    if [ -n "$RIPGREP_PATH" ] && [ -f "$RIPGREP_PATH" ]; then
        info "Found ripgrep at: $RIPGREP_PATH"
        # Create the expected directory structure for the extension to find ripgrep
        mkdir -p "$RELEASE_DIR/node_modules/@vscode/ripgrep/bin"
        cp "$RIPGREP_PATH" "$RELEASE_DIR/node_modules/@vscode/ripgrep/bin/"
        chmod +x "$RELEASE_DIR/node_modules/@vscode/ripgrep/bin/rg"
        # Also keep a copy in bin/ for direct access
        mkdir -p "$RELEASE_DIR/bin"
        cp "$RIPGREP_PATH" "$RELEASE_DIR/bin/"
        chmod +x "$RELEASE_DIR/bin/rg"
    else
        warn "ripgrep binary not found - users will need ripgrep installed"
    fi
    
    # Create the wrapper script
    info "Creating wrapper script..."
    cat > "$RELEASE_DIR/bin/roo" << 'WRAPPER_EOF'
#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Set environment variables for the CLI
process.env.ROO_EXTENSION_PATH = join(__dirname, '..', 'extension');
process.env.ROO_RIPGREP_PATH = join(__dirname, 'rg');

// Import and run the actual CLI
await import(join(__dirname, '..', 'lib', 'index.js'));
WRAPPER_EOF

    chmod +x "$RELEASE_DIR/bin/roo"
    
    # Create version file
    echo "$VERSION" > "$RELEASE_DIR/VERSION"
    
    # Create tarball
    info "Creating tarball..."
    cd "$REPO_ROOT"
    tar -czvf "$TARBALL" "$(basename "$RELEASE_DIR")"
    
    # Clean up release directory
    rm -rf "$RELEASE_DIR"
    
    # Show size
    TARBALL_PATH="$REPO_ROOT/$TARBALL"
    TARBALL_SIZE=$(ls -lh "$TARBALL_PATH" | awk '{print $5}')
    info "Created: $TARBALL ($TARBALL_SIZE)"
}

# Create checksum
create_checksum() {
    step "5/7" "Creating checksum..."
    cd "$REPO_ROOT"
    
    if command -v sha256sum &> /dev/null; then
        sha256sum "$TARBALL" > "${TARBALL}.sha256"
    elif command -v shasum &> /dev/null; then
        shasum -a 256 "$TARBALL" > "${TARBALL}.sha256"
    else
        warn "No sha256sum or shasum found, skipping checksum"
        return
    fi
    
    info "Checksum: $(cat "${TARBALL}.sha256")"
}

# Check if release already exists
check_existing_release() {
    step "6/7" "Checking for existing release..."
    
    if gh release view "$TAG" &> /dev/null; then
        warn "Release $TAG already exists"
        read -p "Do you want to delete it and create a new one? [y/N] " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            info "Deleting existing release..."
            gh release delete "$TAG" --yes
            # Also delete the tag if it exists
            git tag -d "$TAG" 2>/dev/null || true
            git push origin ":refs/tags/$TAG" 2>/dev/null || true
        else
            error "Aborted. Use a different version or delete the existing release manually."
        fi
    fi
}

# Create GitHub release
create_release() {
    step "7/7" "Creating GitHub release..."
    cd "$REPO_ROOT"
    
    RELEASE_NOTES=$(cat << EOF
## Installation

\`\`\`bash
curl -fsSL https://raw.githubusercontent.com/RooCodeInc/Roo-Code/main/apps/cli/install.sh | sh
\`\`\`

Or install a specific version:
\`\`\`bash
ROO_VERSION=$VERSION curl -fsSL https://raw.githubusercontent.com/RooCodeInc/Roo-Code/main/apps/cli/install.sh | sh
\`\`\`

## Requirements

- Node.js 20 or higher
- macOS (Intel or Apple Silicon) or Linux (x64 or ARM64)

## Usage

\`\`\`bash
# Set your API key
export OPENROUTER_API_KEY=sk-or-v1-...

# Run a task
roo "What is this project?" --workspace ~/my-project

# See all options
roo --help
\`\`\`

## Platform Support

This release includes:
- \`roo-cli-${PLATFORM}.tar.gz\` - Built on $(uname -s) $(uname -m)

> **Note:** Additional platforms will be added as needed. If you need a different platform, please open an issue.

## Checksum

\`\`\`
$(cat "${TARBALL}.sha256" 2>/dev/null || echo "N/A")
\`\`\`
EOF
)

    # Get the current commit SHA for the release target
    COMMIT_SHA=$(git rev-parse HEAD)
    info "Creating release at commit: ${COMMIT_SHA:0:8}"
    
    # Create release (gh will create the tag automatically)
    info "Creating release..."
    RELEASE_FILES="$TARBALL"
    if [ -f "${TARBALL}.sha256" ]; then
        RELEASE_FILES="$RELEASE_FILES ${TARBALL}.sha256"
    fi
    
    gh release create "$TAG" \
        --title "Roo Code CLI v$VERSION" \
        --notes "$RELEASE_NOTES" \
        --prerelease \
        --target "$COMMIT_SHA" \
        $RELEASE_FILES
    
    info "Release created!"
}

# Cleanup
cleanup() {
    info "Cleaning up..."
    cd "$REPO_ROOT"
    rm -f "$TARBALL" "${TARBALL}.sha256"
}

# Print summary
print_summary() {
    echo ""
    printf "${GREEN}${BOLD}✓ Release v$VERSION created successfully!${NC}\n"
    echo ""
    echo "  Release URL: https://github.com/RooCodeInc/Roo-Code/releases/tag/$TAG"
    echo ""
    echo "  Install with:"
    echo "    curl -fsSL https://raw.githubusercontent.com/RooCodeInc/Roo-Code/main/apps/cli/install.sh | sh"
    echo ""
}

# Main
main() {
    echo ""
    printf "${BLUE}${BOLD}"
    echo "  ╭─────────────────────────────────╮"
    echo "  │   Roo Code CLI Release Script   │"
    echo "  ╰─────────────────────────────────╯"
    printf "${NC}"
    echo ""
    
    detect_platform
    check_prerequisites
    get_version "$1"
    build
    create_tarball
    create_checksum
    check_existing_release
    create_release
    cleanup
    print_summary
}

main "$@"
