# Project Architecture Rules (Non-Obvious Only)

- Webview and extension communicate ONLY through `src/core/webview/webviewMessageHandler.ts` patterns
- React hooks required in webview - external state libraries break VSCode webview isolation
- Monorepo has circular dependency on types package (intentional design)
- `safeWriteJson()` mandatory for JSON writes - uses atomic writes with file locking
- Database operations require specific directory: must `cd packages/evals` before running migrations
