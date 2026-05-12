---
description: Replace the first or all occurrences of text using the edit search-and-replace tool in Roo Code.
keywords:
    - edit
    - search and replace
    - file editing
    - text replacement
    - Roo Code tools
    - code modifications
---

# edit

The `edit` tool performs search-and-replace operations on files, replacing either the **first occurrence** (default) or **all occurrences** when explicitly specified. It provides flexible control over replacement scope.

---

## Parameters

The tool accepts these parameters:

- `file_path` (required): The path of the file to modify relative to the current working directory.
- `old_string` (required): The exact text to search for and replace.
- `new_string` (required): The text to replace occurrences with.
- `replace_all` (optional): Boolean flag. When `true`, replaces all occurrences. When `false` or omitted, replaces only the first occurrence.

---

## What It Does

This tool searches for an exact string in a file and replaces either the first occurrence or all occurrences based on the `replace_all` parameter. By default, it replaces only the **first match**, making it suitable for targeted single-instance changes.

---

## When is it used?

- When updating a single specific occurrence of text (default behavior)
- When the first instance requires different handling than subsequent ones
- When you need explicit control over whether to replace once or globally
- When making targeted changes to specific instances without affecting others
- When replacing all instances by setting `replace_all: true`

---

## Key Features

- Replaces **first occurrence only** by default (conservative behavior)
- Optional `replace_all` parameter for global replacement
- Exact string matching (no regex or fuzzy matching)
- Shows preview of changes before applying
- Preserves file formatting and structure
- User approval required before applying changes

---

## Limitations

- Requires exact string matches (case-sensitive, whitespace-sensitive)
- Cannot use regular expressions or patterns
- Not suitable for context-dependent replacements requiring code analysis
- Less precise than [`apply_diff`](/advanced-usage/available-tools/apply-diff) for complex edits
- Cannot specify which specific occurrence to replace (first vs. second vs. third)

---

## How It Works

When the `edit` tool is invoked, it follows this process:

1. **Parameter Validation**: Validates required `file_path`, `old_string`, and `new_string` parameters.
2. **File Loading**: Reads the target file content.
3. **Search Operation**: Searches for occurrences of `old_string` in the file.
4. **Replacement Logic**:
    - If `replace_all` is `false` or omitted: replaces only the first occurrence
    - If `replace_all` is `true`: replaces all occurrences
5. **User Review**: Shows a preview of changes for user approval.
6. **Application**: Applies changes to the file if approved.
7. **Feedback**: Reports the result of the operation.

---

## Relation to Other Tools

- `edit`: Replaces **first occurrence** by default (this tool)
- [`edit_file`](/advanced-usage/available-tools/edit-file): Always replaces **all occurrences**
- [`search_replace`](/advanced-usage/available-tools/search-replace): Always replaces **all occurrences**
- [`apply_diff`](/advanced-usage/available-tools/apply-diff): Use for precise, context-aware edits with fuzzy matching

:::info Deprecated Alias
`SearchAndReplaceTool` is a deprecated internal alias for `EditTool`. They are the same tool.
:::
