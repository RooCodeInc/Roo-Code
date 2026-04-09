---
"roo-cline": patch
---

fix: make start_line and end_line parsing more lenient to accept brackets

Some models send `:start_line:[245]` or `:start_line: [245]` instead of `:start_line:245`. This change updates the regex to accept optional brackets around the line number, improving compatibility with models like MiniMax-2.1 and Gemini.

Supported formats:

- `:start_line:253`
- `:start_line: 253`
- `:start_line:[253]`
- `:start_line: [253]`

Fixes #11087
