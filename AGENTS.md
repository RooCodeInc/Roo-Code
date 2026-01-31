# AGENTS.md

This file provides guidance to agents when working with code in this repository.

- **File writing**: Use `safeWriteJson` from `src/utils/safeWriteJson.ts` instead of `JSON.stringify` for file writes. It prevents corruption via atomic writes with locking and streams data to minimize memory footprint.
- **Vitest tests**: Must be run from the same directory as the `package.json` that specifies `vitest` in `devDependencies`. From workspace root: `cd webview-ui && npx vitest run src/path/to/test-file`
