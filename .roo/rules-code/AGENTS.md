# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## File Writing

- Use `safeWriteJson` from `src/utils/safeWriteJson.ts` instead of `JSON.stringify` for file writes (prevents corruption via atomic writes with locking)
- `safeWriteJson` automatically creates parent directories - do not call `mkdir` before it
- Test files are exempt from this rule

## Test Execution

- Vitest tests MUST run from the same directory as the `package.json` that specifies `vitest` in `devDependencies`
- Run webview-ui tests: `cd webview-ui && npx vitest run src/path/to/test-file`
- Run extension tests: `cd src && npx vitest run tests/file.test.ts`
- Run evals tests: `cd packages/evals && pnpm _test`

## Import Patterns

- Import `"vscode"` types from `@types/vscode` (devDependency), not from `vscode` module
- Webview-UI imports types from `@roo-code/types` workspace package
