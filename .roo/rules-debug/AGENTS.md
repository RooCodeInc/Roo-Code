# Project Debug Rules (Non-Obvious Only)

- Extension logs only visible in "Extension Host" output channel, NOT Debug Console
- Webview dev tools accessed via Command Palette > "Developer: Open Webview Developer Tools" (not F12)
- Database migrations MUST run from `packages/evals/` directory: `cd packages/evals && pnpm db:migrate`
- IPC messages fail silently if not wrapped in try/catch in webview message handlers
- Two separate mock systems: `src/__mocks__/vscode.js` for extension, `webview-ui/src/__mocks__/vscode.ts` for UI
