---
"roo-cline": minor
---

Add built-in terminal output filtering to reduce LLM token usage

Introduces a new `TerminalOutputFilter` module that applies command-aware output filtering before terminal output reaches the LLM context. This reduces token consumption by stripping noise (passing tests, progress bars, verbose logs) while preserving actionable information (errors, failures, summaries).

Built-in filters for common commands:

- **Test runners** (jest, vitest, mocha, pytest, cargo test, go test): Extract pass/fail summary + failure details
- **git status**: Compact file-change summary
- **git log**: One-line-per-commit format
- **Package managers** (npm, yarn, pnpm, pip): Strip progress/download noise, keep warnings + summary
- **Build tools** (tsc, cargo build, webpack, etc.): Strip progress, keep errors/warnings

New setting `terminalOutputFilterEnabled` (default: true) with toggle in Terminal Settings UI.
