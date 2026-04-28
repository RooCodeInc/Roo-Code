---
"roo-cline": patch
---

apply_diff: detect a malformed `-------` separator in the SEARCH section (e.g. `-------import { ... }` with no trailing newline) and surface a clear "Malformed separator" error instead of the generic "63% similar" mismatch. Smaller models that occasionally emit this shape can now self-correct on the next attempt instead of looping. Closes #12210.
