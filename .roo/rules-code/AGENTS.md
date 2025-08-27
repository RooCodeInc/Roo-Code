# Project Coding Rules (Non-Obvious Only)

- Always use `safeWriteJson()` from `src/utils/safeWriteJson.ts` instead of `JSON.stringify` for file writes (prevents corruption)
- Extension code in `src/` directory, NOT in `apps/` (counterintuitive structure)
- Webview UI in `webview-ui/` runs with restricted APIs - no localStorage, limited browser features
- IPC patterns MUST follow `src/core/webview/webviewMessageHandler.ts` structure
- Tests must be in `__tests__` folders or `.spec.ts` files (vitest won't find them otherwise)
- VSCode API mocked differently: `src/__mocks__/vscode.js` vs `webview-ui/src/__mocks__/vscode.ts`
