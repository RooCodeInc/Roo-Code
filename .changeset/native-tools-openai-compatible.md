---
"@roo-code/types": minor
"roo-cline": minor
---

Add native tools support for OpenAI-compatible providers (Fireworks, SambaNova, Featherless, IO Intelligence)

- Added `supportsNativeTools: true` to model definitions for Fireworks, SambaNova, Featherless, and IO Intelligence
- Fixed FeatherlessHandler to pass metadata parameter to base class, enabling native tools support for non-DeepSeek models
