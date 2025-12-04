---
"roo-cline": patch
---

Fix extension freeze when model calls invalid/unknown native tool

When a model attempted to call a tool that doesn't exist, the extension would freeze because the switch statement handling tool names had no default case. For native protocol, this meant no tool_result was sent back to the API, causing the extension to wait indefinitely.

Added a default case that:

- Pushes an error tool_result back to the API
- Increments consecutiveMistakeCount
- Records the tool error
- Shows an error message to the user
