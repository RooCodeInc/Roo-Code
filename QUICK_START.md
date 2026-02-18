# Quick Start Guide

## Prerequisites

- Node.js 20.19.2 (currently you have 22.17.0 - see note below)
- pnpm 10.8.1
- VS Code or Cursor

## Step 1: Navigate to Project Directory

```powershell
cd "C:\Users\yohan\OneDrive\Desktop\10Academy\intent_developement\Roo-Code"
```

## Step 2: Install Dependencies

**Note**: There's currently a dependency issue with `node-ipc@12.0.0` from the npm mirror. Try one of these:

### Option A: Use Official npm Registry (Recommended)

```powershell
# Temporarily use official npm registry
pnpm config set registry https://registry.npmjs.org/
pnpm install
```

### Option B: Skip the problematic package temporarily

If Option A doesn't work, you can try installing without the problematic package:

```powershell
pnpm install --ignore-scripts
```

Then manually install node-ipc:

```powershell
pnpm add node-ipc@latest --filter @roo-code/ipc
```

## Step 3: Build the Extension

```powershell
pnpm bundle
```

This builds the extension code. For development with watch mode, the build happens automatically when you press F5.

## Step 4: Run the Extension

### Method 1: Development Mode (F5) - Recommended for Development

1. Open the project in VS Code/Cursor
2. Press **F5** (or go to **Run** → **Start Debugging**)
3. A new VS Code window will open with the extension running
4. Changes to webview will hot-reload automatically
5. Changes to core extension will also hot-reload

### Method 2: Build and Install VSIX

```powershell
# Build VSIX package
pnpm vsix

# Install it (will prompt for editor choice)
pnpm install:vsix
```

Or manually install:

```powershell
code --install-extension bin/roo-cline-<version>.vsix
```

## Troubleshooting

### Node Version Mismatch

The project requires Node.js 20.19.2, but you have 22.17.0. Options:

1. **Use nvm (Node Version Manager)**:

    ```powershell
    # Install nvm-windows if you don't have it
    # Then:
    nvm install 20.19.2
    nvm use 20.19.2
    ```

2. **Continue with current version** (may work, but not guaranteed):
   The warning is just a warning - you can try continuing, but some features might not work correctly.

### Dependency Installation Issues

If `pnpm install` fails:

1. Clear pnpm cache:

    ```powershell
    pnpm store prune
    ```

2. Delete node_modules and lock file:

    ```powershell
    Remove-Item -Recurse -Force node_modules
    Remove-Item pnpm-lock.yaml
    pnpm install
    ```

3. Use official npm registry:
    ```powershell
    pnpm config set registry https://registry.npmjs.org/
    ```

## Development Workflow

1. **Make changes** to the code
2. **Press F5** to test in a new window
3. **Watch mode** automatically rebuilds on file changes
4. **Check output** in the Debug Console for logs

## Project Structure

- `src/` - Main extension code
- `src/hooks/` - Hook system (newly added)
- `webview-ui/` - React webview UI
- `packages/` - Shared packages
- `.vscode/launch.json` - Debug configuration
- `.vscode/tasks.json` - Build tasks

## Useful Commands

```powershell
# Build everything
pnpm build

# Build extension bundle
pnpm bundle

# Watch mode (auto-rebuild)
pnpm watch:bundle

# Type checking
pnpm check-types

# Linting
pnpm lint

# Run tests
pnpm test
```
