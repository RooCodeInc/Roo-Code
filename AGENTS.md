# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Critical Non-Obvious Rules

- **MUST** use `safeWriteJson()` from `src/utils/safeWriteJson.ts` for ALL JSON file writes (prevents corruption via atomic writes with locking)
- Test files exempt from safeWriteJson rule

## Project Structure (Non-Standard)

- `src/` contains VSCode extension code (NOT general source - counterintuitive naming)
- `webview-ui/` is the React UI that runs in VSCode webview (separate from extension)
- Two separate i18n systems: root `locales/` for extension, `webview-ui/src/i18n/` for UI
- Monorepo uses pnpm workspaces with unusual paths: `"src"` and `"webview-ui"` as workspace roots

## Testing Specifics

- Tests MUST be in `__tests__` folders or `.spec.ts` files (vitest configured this way)
- VSCode module mocked at `src/__mocks__/vscode.js` and `webview-ui/src/__mocks__/vscode.ts`
- Run single test: `pnpm test -- path/to/test.spec.ts`

## Build Commands (Directory-Sensitive)

- Database operations MUST run from `packages/evals/` directory: `cd packages/evals && pnpm db:migrate`
- Extension bundling uses custom `esbuild.mjs` script, not standard vite/webpack

## Webview Restrictions

- Webview has NO localStorage, limited browser APIs
- IPC communication through specific patterns in `src/core/webview/webviewMessageHandler.ts`
- State management requires React hooks only (external state libraries break isolation)

## Code Style (Non-Standard)

- Tabs not spaces (4-width), no semicolons, bracket same line
- Line width 120 chars (not default 80)
