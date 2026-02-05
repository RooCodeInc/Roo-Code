# AGENTS.md

This file provides guidance to agents when planning and architecting changes in this repository.

## Monorepo Structure

- **Root**: VSCode extension + workspace orchestration
- **`src/`**: VSCode extension (main extension code, Node 20.19.2)
- **`webview-ui/`**: React webview (Vite, runs in VSCode sidebar)
- **`packages/evals/`**: Next.js evals platform (Dockerized: PostgreSQL + Redis)
- **`apps/vscode-e2e/`**: VSCode E2E tests
- **`packages/`**: Shared packages (types, build, telemetry, vscode-shim)

## Build System

- **Package manager**: pnpm 10.8.1
- **Build orchestration**: turbo
- **Commands**: `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm vsix`

## Key Architectural Patterns

- **IPC Communication**: Extension and webview communicate via VSCode IPC (not HTTP)
- **Stateless Providers**: All LLM providers must be stateless (hidden caching layer assumes this)
- **Webview Isolation**: Webview runs with no access to localStorage, limited APIs
- **Atomic File Writes**: Use `safeWriteJson` for all JSON file operations

## Dependencies

- `@roo-code/types` - Shared types (all packages depend on this)
- `@roo-code/ipc` - IPC communication layer
- VSCode extension API via `vscode` module (mocked in tests via `packages/vscode-shim`)
