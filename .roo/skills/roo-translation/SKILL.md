---
name: roo-translation
description: Provides comprehensive guidelines for translating and localizing Roo Code extension strings. Use when tasks involve i18n, translation, localization, adding new languages, or updating existing translation files. This skill covers both core extension (src/i18n/locales/) and WebView UI (webview-ui/src/i18n/locales/) localization.
---

# Roo Code Translation Skill

## When to Use This Skill

Use this skill when the task involves:

- Adding new translatable strings to the Roo Code extension
- Translating existing strings to new languages
- Updating or fixing translations in existing language files
- Understanding i18n patterns used in the codebase
- Working with localization files in either core extension or WebView UI

## When NOT to Use This Skill

Do NOT use this skill when:

- Working on non-translation code changes
- The task doesn't involve i18n or localization
- You're only reading translation files for reference without modifying them

## Supported Languages and Locations

Localize all strings into the following locale files: ca, de, en, es, fr, hi, id, it, ja, ko, nl, pl, pt-BR, ru, tr, vi, zh-CN, zh-TW

The VSCode extension has two main areas that require localization:

| Component | Path | Purpose |
|-----------|------|---------|
| **Core Extension** | `src/i18n/locales/` | Extension backend strings |
| **WebView UI** | `webview-ui/src/i18n/locales/` | User interface strings |

## Brand Voice, Tone, and Word Choice

For detailed brand voice, tone, and word choice guidance, refer to the guidance file:

- [`.roo/guidance/roo-translator.md`](../../guidance/roo-translator.md)

This guidance file is loaded at runtime and should be consulted for the latest brand and style standards.

## Voice, Style and Tone Guidelines

- Always use informal speech (e.g., "du" instead of "Sie" in German) for all translations
- Maintain a direct and concise style that mirrors the tone of the original text
- Carefully account for colloquialisms and idiomatic expressions in both source and target languages
- Aim for culturally relevant and meaningful translations rather than literal translations
- Preserve the personality and voice of the original content
- Use natural-sounding language that feels native to speakers of the target language

### Terms to Keep in English

- Don't translate the word "token" as it means something specific in English that all languages will understand
- Don't translate domain-specific words (especially technical terms like "Prompt") that are commonly used in English in the target language

## Core Extension Localization (src/)

- Located in `src/i18n/locales/`
- NOT ALL strings in core source need internationalization - only user-facing messages
- Internal error messages, debugging logs, and developer-facing messages should remain in English
- The `t()` function is used with namespaces like `'core:errors.missingToolParameter'`
- Be careful when modifying interpolation variables; they must remain consistent across all translations
- Some strings in `formatResponse.ts` are intentionally not internationalized since they're internal
- When updating strings in `core.json`, maintain all existing interpolation variables
- Check string usages in the codebase before making changes to ensure you're not breaking functionality

## WebView UI Localization (webview-ui/src/)

- Located in `webview-ui/src/i18n/locales/`
- Uses standard React i18next patterns with the `useTranslation` hook
- All user interface strings should be internationalized
- Always use the `Trans` component with named components for text with embedded components

### Trans Component Example

Translation string:
```json
"changeSettings": "You can always change this at the bottom of the <settingsLink>settings</settingsLink>"
```

React component usage:
```tsx
<Trans
  i18nKey="welcome:telemetry.changeSettings"
  components={{
    settingsLink: <VSCodeLink href="#" onClick={handleOpenSettings} />
  }}
/>
```

## Technical Implementation

- Use namespaces to organize translations logically
- Handle pluralization using i18next's built-in capabilities
- Implement proper interpolation for variables using `{{variable}}` syntax
- Don't include `defaultValue`. The `en` translations are the fallback
- Always use `apply_diff` instead of `write_to_file` when editing existing translation files (much faster and more reliable)
- When using `apply_diff`, carefully identify the exact JSON structure to edit to avoid syntax errors
- Placeholders (like `{{variable}}`) must remain exactly identical to the English source to maintain code integration and prevent syntax errors

## Translation Workflow

1. First add or modify English strings, then ask for confirmation before translating to all other languages
2. Use this process for each localization task:
   1. Identify where the string appears in the UI/codebase
   2. Understand the context and purpose of the string
   3. Update English translation first
   4. Use the `search_files` tool to find JSON keys that are near new keys in English translations but do not yet exist in the other language files for `apply_diff` SEARCH context
   5. Create appropriate translations for all other supported languages utilizing the `search_files` result using `apply_diff` without reading every file
   6. Do not output the translated text into the chat, just modify the files
   7. Validate your changes with the missing translations script

3. Flag or comment if an English source string is incomplete ("please see this...") to avoid truncated or unclear translations

4. For UI elements, distinguish between:
   - Button labels: Use short imperative commands ("Save", "Cancel")
   - Tooltip text: Can be slightly more descriptive

5. Preserve the original perspective: If text is a user command directed at the software, ensure the translation maintains this direction

## Validation

Always validate your translation work by running the missing translations script:

```bash
node scripts/find-missing-translations.js
```

Address any missing translations identified by the script to ensure complete coverage across all locales.

## Common Pitfalls to Avoid

- Switching between formal and informal addressing styles - always stay informal ("du" not "Sie")
- Translating or altering technical terms and brand names that should remain in English
- Modifying or removing placeholders like `{{variable}}` - these must remain identical
- Translating domain-specific terms that are commonly used in English in the target language
- Changing the meaning or nuance of instructions or error messages
- Forgetting to maintain consistent terminology throughout the translation

## Translator's Checklist

- ✓ Used informal tone consistently ("du" not "Sie")
- ✓ Preserved all placeholders exactly as in the English source
- ✓ Maintained consistent terminology with existing translations
- ✓ Kept technical terms and brand names unchanged where appropriate
- ✓ Preserved the original perspective (user→system vs system→user)
- ✓ Adapted the text appropriately for UI context (buttons vs tooltips)
- ✓ Ran the missing translations script to validate completeness
