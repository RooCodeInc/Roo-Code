---
"roo-cline": patch
---

fix(gemini): upgrade @google/genai to support thinkingLevel for Gemini 3 models

The previous SDK version (1.29.1) did not include the `thinkingLevel` property in
`ThinkingConfig`, causing INVALID_ARGUMENT errors when using Gemini 3 Pro and Flash
models which require effort-based reasoning configuration via `thinkingLevel`.

Updated to @google/genai ^1.30.0 which adds support for `thinkingLevel` with values:
MINIMAL, LOW, MEDIUM, HIGH.
