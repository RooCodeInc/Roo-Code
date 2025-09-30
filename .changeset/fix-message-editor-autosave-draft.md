---
"roo-cline": patch
---

Fix critical data loss bug in message editor by implementing autosave draft functionality with localStorage persistence. Messages are now automatically saved as users type and restored after webview reloads, with proper conversation isolation and debouncing for optimal performance.
