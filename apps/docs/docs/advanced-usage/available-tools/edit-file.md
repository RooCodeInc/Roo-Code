---
description: Replace a uniquely-identified occurrence of text in files using the edit_file search-and-replace tool in Roo Code.
keywords:
    - edit_file
    - search and replace
    - file editing
    - text replacement
    - Roo Code tools
    - code modifications
---

# edit_file

The `edit_file` tool performs targeted search-and-replace operations on files. By default it replaces **exactly one** uniquely-identified occurrence and errors if multiple matches are found. It also supports a special file-creation mode when `old_string` is empty.

---

## Parameters

The tool accepts these parameters:

- `file_path` (required): The path of the file to modify relative to the current working directory.
- `old_string` (required): The exact text to search for and replace. Pass an empty string (`""`) to create a new file or append to an existing file.
- `new_string` (required): The replacement text.
- `expected_replacements` (optional): Expected number of replacements (defaults to 1). The operation fails if the actual count doesn't match. Use this only when intentionally replacing more than one occurrence.

---

## What It Does

This tool searches for an exact string in a file and replaces **exactly one** occurrence with new text. The search string must uniquely identify the target location. If multiple matches are found, the tool returns an error unless `expected_replacements` is explicitly set to match. When `old_string` is empty, the tool creates a new file or appends `new_string` to an existing file.

---

## When is it used?

- When making a targeted change to a specific, uniquely identifiable location in a file
- When updating a specific string literal or configuration value at a known location
- When fixing a specific instance of a typo or outdated terminology
- When replacing a uniquely-identified occurrence of a deprecated API or import path
- When creating a new file or appending content to an existing file (`old_string=""`)
- When you need to ensure exact match replacement without fuzzy logic

---

## Key Features

- Replaces **exactly one** uniquely-identified occurrence by default
- Errors if multiple matches are found (unless `expected_replacements` is explicitly set)
- `old_string=""` mode: creates a new file or appends content to an existing file
- Exact string matching (no regex or fuzzy matching)
- Optional `expected_replacements` for intentional multi-occurrence replacements
- Shows preview of changes before applying
- Fails safely if actual replacement count doesn't match `expected_replacements`
- Preserves file formatting and structure

---

## Limitations

- Requires exact string matches (case-sensitive, whitespace-sensitive)
- Errors if the search string matches more than one location (unless `expected_replacements` is set)
- Cannot use regular expressions or patterns
- Not suitable for context-dependent replacements
- Less precise than [`apply_diff`](/advanced-usage/available-tools/apply-diff) for complex edits

---

## How It Works

When the `edit_file` tool is invoked, it follows this process:

1. **Parameter Validation**: Validates required `file_path`, `old_string`, and `new_string` parameters.
2. **File Creation Mode**: If `old_string` is empty (`""`), creates the file with `new_string` as content (or appends if the file already exists), then stops.
3. **File Loading**: Reads the target file content.
4. **Uniqueness Check**: Counts occurrences of `old_string`. If the count doesn't match `expected_replacements` (default: 1), returns an error.
5. **Replacement**: Replaces the matched occurrence(s) with `new_string`.
6. **User Review**: Shows a preview of changes for user approval.
7. **Application**: Applies changes to the file if approved.
8. **Feedback**: Reports the number of replacements made.

---

## Relation to Other Tools

- `edit_file`: Replaces **exactly one** uniquely-identified occurrence by default; supports `old_string=""` file creation (this tool)
- [`edit`](/advanced-usage/available-tools/edit): Replaces **first occurrence** only (unless `replace_all: true`)
- [`search_replace`](/advanced-usage/available-tools/search-replace): Also replaces **exactly one** uniquely-identified occurrence
- [`apply_diff`](/advanced-usage/available-tools/apply-diff): Use for precise, context-aware edits with fuzzy matching

These are different implementations of search-and-replace with varying capabilities.
