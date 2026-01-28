---
"roo-code": patch
---

fix(code-index): remove deprecated text-embedding-004 model and silently migrate users to gemini-embedding-001

- Removed text-embedding-004 from embedding model profiles as it is deprecated
- Added automatic migration in GeminiEmbedder to silently convert text-embedding-004 to gemini-embedding-001
- Users with text-embedding-004 configured will continue to work without interruption
