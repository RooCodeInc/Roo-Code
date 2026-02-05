# AGENTS.md

This file provides guidance to agents when answering questions about this repository.

## Documentation Structure

- Root `AGENTS.md` - Project-wide guidance for AI assistants
- `.roo/rules-code/` - Coding-specific rules
- `.roo/rules-debug/` - Debugging-specific guidance
- `.roo/rules-architect/` - Architecture and planning guidance
- `packages/evals/ARCHITECTURE.md` - Detailed evals system documentation

## Counterintuitive Organization

- `src/` contains VSCode extension code, not a web app source
- `webview-ui/` is the React webview for the VSCode extension sidebar
- `packages/evals/` is a separate Next.js web application, not extension code
- Root `locales/` is for extension i18n, `webview-ui/src/i18n` is for webview i18n

## Key References

- Provider implementations in `packages/types/src/providers/` are canonical API examples
- Built-in skills documentation in `src/services/skills/built-in/`
