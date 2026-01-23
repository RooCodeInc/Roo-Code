# Klaus Code Development Guide

> Developer documentation for building and releasing Klaus Code

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Building from Source](#building-from-source)
- [Development Workflow](#development-workflow)
- [Creating a Release](#creating-a-release)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

- **Node.js**: v20.19.2 (specified in `.nvmrc`)
- **pnpm**: v10.8.1 (package manager)
- **Git**: For version control

### Verify Prerequisites

```bash
node --version  # Should be v20.19.2
npm --version   # Should be 10.x or higher
git --version
```

---

## Environment Setup

### 1. Install Node.js

Use Node Version Manager (nvm) for easy Node.js version management:

```bash
# Install nvm (if not already installed)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install and use the correct Node.js version
nvm install 20.19.2
nvm use 20.19.2
```

Alternatively, download Node.js v20.19.2 from [nodejs.org](https://nodejs.org/).

### 2. Install pnpm

```bash
npm install -g pnpm@10.8.1
```

Verify installation:

```bash
pnpm --version  # Should output: 10.8.1
```

### 3. Clone the Repository

```bash
git clone https://github.com/PabloVitasso/Klaus-Code.git
cd Klaus-Code
```

### 4. Install Dependencies

```bash
pnpm install
```

This will:
- Install all workspace dependencies
- Run bootstrap scripts
- Set up husky git hooks

**Note**: The build scripts for some dependencies are ignored by default for security. This is normal.

---

## Building from Source

### Quick Build

```bash
# Build all packages
pnpm build

# Create VSIX package
pnpm vsix
```

The VSIX file will be created in `bin/klaus-code-<version>.vsix`.

### Build Output

```
bin/
└── klaus-code-3.42.0.vsix  (34 MB)
```

---

## Development Workflow

### Run in Development Mode

Press `F5` in VS Code to launch the extension in debug mode:

1. Open the project in VS Code
2. Press `F5` (or **Run** → **Start Debugging**)
3. A new VS Code window opens with Klaus Code loaded
4. Changes to the webview hot-reload automatically
5. Changes to the core extension also hot-reload

### Available Scripts

```bash
# Linting
pnpm lint

# Type checking
pnpm check-types

# Run tests
pnpm test

# Format code
pnpm format

# Clean build artifacts
pnpm clean
```

### Running Individual Tests

Tests use Vitest. Run from the correct workspace:

```bash
# Backend tests
cd src && npx vitest run path/to/test.test.ts

# Webview UI tests
cd webview-ui && npx vitest run src/path/to/test.test.ts
```

**Important**: Do NOT run `npx vitest run src/...` from project root - this causes errors.

---

## Creating a Release

### 1. Build the VSIX

```bash
# Clean previous builds
pnpm clean

# Build everything
pnpm build

# Create VSIX package
pnpm vsix
```

### 2. Test the VSIX Locally

#### Option A: Automated Installation

```bash
pnpm install:vsix
```

This will:
- Uninstall any existing version
- Build the latest VSIX
- Install the new VSIX
- Prompt you to restart VS Code

#### Option B: Manual Installation

```bash
# Install via VS Code CLI
code --install-extension bin/klaus-code-3.42.0.vsix

# Or use the VS Code UI:
# 1. Open VS Code
# 2. Extensions view (Ctrl+Shift+X)
# 3. Click "..." → "Install from VSIX..."
# 4. Select bin/klaus-code-3.42.0.vsix
```

### 3. Verify the Installation

1. Open VS Code
2. Check that "Klaus Code" appears in the activity bar
3. Test core functionality:
   - Create a new task
   - Test the Claude Code provider (if configured)
   - Verify settings panel loads

### 4. Create a GitHub Release

```bash
# Tag the release
git tag -a v3.42.0 -m "Release v3.42.0"

# Push the tag
git push origin v3.42.0
```

Then create a GitHub release:
1. Go to https://github.com/PabloVitasso/Klaus-Code/releases
2. Click "Draft a new release"
3. Select the tag `v3.42.0`
4. Upload `bin/klaus-code-3.42.0.vsix`
5. Write release notes
6. Publish

---

## Troubleshooting

### pnpm not found

```bash
npm install -g pnpm@10.8.1
```

### Build fails with "vitest: command not found"

You're running tests from the wrong directory. See [Running Individual Tests](#running-individual-tests).

### VSIX build warnings about bundle size

This is normal. The extension includes all dependencies. To reduce size:

```bash
# Bundle the extension (advanced)
pnpm bundle
pnpm vsix
```

### Hot reload not working in debug mode

1. Restart the debug session (Ctrl+Shift+F5)
2. Check the VS Code debug console for errors
3. Ensure you're running from the project root

### Dependencies installation issues

```bash
# Clear cache and reinstall
pnpm store prune
rm -rf node_modules
pnpm install
```

### TypeScript errors

```bash
# Check types
pnpm check-types

# Fix common issues
pnpm format
pnpm lint
```

---

## Project Structure

```
Klaus-Code/
├── src/                    # Main VS Code extension
│   ├── api/               # LLM provider integrations
│   ├── core/              # Agent core logic
│   ├── services/          # Supporting services
│   └── integrations/      # VS Code integrations
├── webview-ui/            # React frontend
├── packages/              # Shared packages
│   ├── types/            # Shared TypeScript types
│   ├── core/             # Core utilities
│   ├── cloud/            # Cloud integration
│   └── telemetry/        # Telemetry service
├── bin/                   # Built VSIX packages
└── DEVELOPMENT.md         # This file
```

For more details, see [CLAUDE.md](CLAUDE.md) for AI-specific development guidance.

---

## Additional Resources

- **Project Repository**: https://github.com/PabloVitasso/Klaus-Code
- **Original Fork Source**: https://github.com/RooCodeInc/Roo-Code
- **VS Code Extension API**: https://code.visualstudio.com/api

---

*Last updated: 2026-01-23*
