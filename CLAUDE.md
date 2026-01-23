# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**For human developers**: See [DEVELOPMENT.md](DEVELOPMENT.md) for complete build instructions, environment setup, and release procedures.

## Project Overview

Klaus Code is an AI-powered VS Code extension that assists with coding tasks. It's a TypeScript monorepo using pnpm workspaces and Turborepo.

## Build and Development Commands

```bash
# Install dependencies
pnpm install

# Run all linting
pnpm lint

# Run all type checking
pnpm check-types

# Run all tests
pnpm test

# Format code
pnpm format

# Build all packages
pnpm build

# Build and package VSIX
pnpm vsix

# Clean all build artifacts
pnpm clean
```

### Running Individual Tests

Tests use Vitest. Run tests from within the correct workspace directory:

```bash
# Backend tests (src/)
cd src && npx vitest run path/to/test-file.test.ts

# Webview UI tests
cd webview-ui && npx vitest run src/path/to/test-file.test.ts
```

Do NOT run `npx vitest run src/...` from the project root - this causes "vitest: command not found" errors.

### Development Mode

Press F5 in VS Code to launch the extension in debug mode. Changes hot reload automatically.

## Repository Structure

- `src/` - Main VS Code extension (backend)
  - `api/providers/` - LLM provider integrations (Anthropic, OpenAI, Gemini, Bedrock, etc.)
  - `core/` - Agent core logic
    - `task/Task.ts` - Main agent task orchestration
    - `tools/` - Tool implementations (ReadFile, WriteToFile, ExecuteCommand, etc.)
    - `webview/ClineProvider.ts` - Bridge between extension and webview
    - `config/ContextProxy.ts` - State management for settings
    - `prompts/` - System prompt construction
  - `services/` - Supporting services (MCP, code indexing, checkpoints, etc.)
  - `integrations/` - VS Code integrations (terminal, editor, workspace)
- `webview-ui/` - React frontend (Vite, Tailwind, Radix UI)
- `packages/` - Shared packages
  - `types/` - Shared TypeScript types
  - `core/` - Core utilities
  - `cloud/` - Cloud service integration
  - `telemetry/` - Telemetry service
- `apps/` - Additional applications (CLI, e2e tests, web apps)

## Architecture Notes

### Settings View Pattern

When working on `SettingsView`, inputs must bind to the local `cachedState`, NOT the live `useExtensionState()`. The `cachedState` acts as a buffer for user edits, isolating them from the `ContextProxy` source-of-truth until the user explicitly clicks "Save". Wiring inputs directly to the live state causes race conditions.

### JSON File Writing

Use `safeWriteJson(filePath, data)` from `src/utils/safeWriteJson.ts` instead of `JSON.stringify` with file-write operations. This utility:
- Creates parent directories automatically
- Prevents data corruption via atomic writes with locking
- Streams writes to minimize memory footprint

Test files are exempt from this rule.

### Styling

Use Tailwind CSS classes instead of inline style objects. VSCode CSS variables must be added to `webview-ui/src/index.css` before using them in Tailwind classes.

## Code Quality Rules

- Never disable lint rules without explicit user approval
- Ensure all tests pass before submitting changes
- The `vi`, `describe`, `test`, `it` functions from Vitest are globally available (defined in tsconfig.json) - no need to import them
