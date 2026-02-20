---
description: "Translate and localize strings in the Roo Code extension"
argument-hint: "[language-code or 'all'] [string-key or file-path]"
mode: translate
---

Perform translation and localization tasks for the Roo Code extension. This command activates the translation workflow with comprehensive i18n guidelines.

## Quick Start

1. **Identify the translation scope:**
   - If a specific language code is provided (e.g., `de`, `zh-CN`), focus on that language
   - If `all` is specified, translate to all supported languages
   - If a string key is provided, locate and translate that specific string
   - If a file path is provided, work with that translation file

2. **Supported languages:** ca, de, en, es, fr, hi, id, it, ja, ko, nl, pl, pt-BR, ru, tr, vi, zh-CN, zh-TW

3. **Translation locations:**
   - Core Extension: `src/i18n/locales/`
   - WebView UI: `webview-ui/src/i18n/locales/`

## Workflow

1. If adding new strings:
   - Add the English string first
   - Ask for confirmation before translating to other languages
   - Use `apply_diff` for efficient file updates

2. If updating existing strings:
   - Identify all affected language files
   - Update English first, then propagate changes

3. Validate your changes:
   ```bash
   node scripts/find-missing-translations.js
   ```

## Key Guidelines

- Use informal speech (e.g., "du" not "Sie" in German)
- Keep technical terms like "token", "Prompt" in English
- Preserve all `{{variable}}` placeholders exactly
- Use `apply_diff` instead of `write_to_file` for existing files

## Examples

- `/roo-translate de` - Focus on German translations
- `/roo-translate all welcome.title` - Translate a specific key to all languages
- `/roo-translate zh-CN src/i18n/locales/zh-CN/core.json` - Work on specific file
