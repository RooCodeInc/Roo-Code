---
"roo-cline": minor
---

Add image support for VS Code LM API provider

- Upgraded @types/vscode to ^1.106.0 to support LanguageModelDataPart
- Modified vscode-lm-format to convert image blocks to LanguageModelDataPart.image()
- Updated VsCodeLmHandler.getModel() to detect image-capable models based on model family
- Updated useSelectedModel to use model's supportsImages capability instead of always false
- Added tests for image conversion functionality

This enables users of the VS Code LM API provider to upload images when using vision-capable models like GPT-4o, Claude 3.5 Sonnet, and Gemini models through GitHub Copilot.
