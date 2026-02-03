# AGENTS.md

This file provides guidance to agents when debugging code in this repository.

## CLI Debug Logging

- **Never use console.log in CLI code** - it breaks the TUI (Terminal User Interface)
- Use file-based logging instead: `fs.appendFileSync("/tmp/roo-cli-debug.log", message)`
- Clear logs with `echo "" > /tmp/roo-cli-debug.log` before debugging sessions

## Extension Debugging

- Extension logs appear in VSCode "Output" channel named "Cline" or "Roo Code"
- Open via: View > Output > Select "Cline" from dropdown
- Extension .env loading is optional and best-effort - failures are logged but don't crash activation

## Webview Debugging

- Open webview dev tools via Command Palette > "Developer: Open Webview Developer Tools"
- Webview runs in isolated context (no localStorage, limited APIs)

## Evals Debugging

- Redis and PostgreSQL must be running for evals tests: `cd packages/evals && pnpm services:up`
- Container logs: `cd packages/evals && docker compose logs -f`
