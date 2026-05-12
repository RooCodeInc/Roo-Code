---
description: Replace a uniquely-identified occurrence of text in a file using the search_replace tool in Roo Code.
keywords:
    - search_replace
    - search and replace
    - file editing
    - text replacement
    - Roo Code tools
    - code modifications
---

# search_replace

The `search_replace` tool performs a targeted search-and-replace operation on a file, replacing **exactly one** uniquely-identified occurrence of specified text. If the search string matches multiple locations, the tool returns an error—the search string must be specific enough to identify a single target location.

---

## Parameters

The tool accepts these parameters:

- `file_path` (required): The path of the file to modify relative to the current working directory.
- `old_string` (required): The exact text to search for and replace.
- `new_string` (required): The replacement text.

---

## What It Does

This tool searches for an exact string in a file and replaces **exactly one** occurrence with new text. The search string must uniquely identify the target location in the file. If multiple matches are found, the tool returns an error and requires a more specific search string to proceed. This is an intentional safety design to prevent unintended changes.

---

## When is it used?

- When making a targeted change to a specific, uniquely identifiable location in a file
- When updating a specific string literal or configuration value at a known location
- When fixing a specific instance of a pattern or outdated terminology
- When you need simple, exact string replacement at a unique location
- When you need to ensure only one specific location is changed

---

## Key Features

- Replaces **exactly one** uniquely-identified occurrence per call
- Errors if multiple matches are found (intentional safety design)
- Exact string matching (no regex or fuzzy matching)
- Simple three-parameter interface
- Shows preview of changes before applying
- Preserves file formatting and structure
- User approval required before applying changes

---

## Limitations

- Requires exact string matches (case-sensitive, whitespace-sensitive)
- Errors if the search string matches more than one location (must be unique)
- Cannot use regular expressions or patterns
- Not suitable for replacing all occurrences globally (use scripting for that)
- Less precise than [`apply_diff`](/advanced-usage/available-tools/apply-diff) for complex edits

---

## How It Works

When the `search_replace` tool is invoked, it follows this process:

1. **Parameter Validation**: Validates required `file_path`, `old_string`, and `new_string` parameters.
2. **File Loading**: Reads the target file content.
3. **Uniqueness Check**: Counts occurrences of `old_string` in the file. If more than one match is found, returns an error asking for a more specific search string.
4. **Replacement**: Replaces the single found occurrence with `new_string`.
5. **User Review**: Shows a preview of changes for user approval.
6. **Application**: Applies changes to the file if approved.
7. **Feedback**: Reports the result of the operation.

---

## Relation to Other Tools

- `search_replace`: Replaces **exactly one** uniquely-identified occurrence (this tool)
- [`edit_file`](/advanced-usage/available-tools/edit-file): Also replaces **exactly one** occurrence by default; also supports `old_string=""` for file creation
- [`edit`](/advanced-usage/available-tools/edit): Replaces **first occurrence** by default (unless `replace_all: true`)
- [`apply_diff`](/advanced-usage/available-tools/apply-diff): Use for precise, context-aware edits with fuzzy matching

These are different implementations of search-and-replace functionality with varying capabilities.
