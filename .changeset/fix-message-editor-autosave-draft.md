---
"roo-cline": patch
---

Fix critical data loss bug in message editor caused by race condition when sending messages while tool responses arrive. This fix includes two complementary solutions:

1. **Race Condition Fix**: Modified message sending logic to preserve user input when messages are queued but not yet sent, preventing data loss during concurrent state updates
2. **Autosave Draft**: Implemented localStorage-based draft persistence with automatic save/restore on webview reloads, conversation isolation, and optimized 100ms debouncing

Both fixes work together to ensure user input is never lost, whether from race conditions or webview reloads.
