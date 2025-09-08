# Project Documentation Rules (Non-Obvious Only)

- `src/` contains VSCode extension code, NOT general source (counterintuitive naming)
- `webview-ui/` is React UI in VSCode webview with severe restrictions (no localStorage, limited APIs)
- Two separate i18n systems: `locales/` for extension, `webview-ui/src/i18n/` for UI
- Monorepo workspace roots are `"src"` and `"webview-ui"` (not standard `packages/` structure)
- Extension bundled with custom `esbuild.mjs`, webview uses Vite
