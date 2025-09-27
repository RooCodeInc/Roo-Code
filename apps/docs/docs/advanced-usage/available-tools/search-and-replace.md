---
description: Master the search_and_replace tool for finding and replacing text or regex patterns in files, with line range support and interactive diff approval.
keywords:
    - search_and_replace
    - Roo Code tools
    - find replace
    - regex patterns
    - text replacement
    - code refactoring
    - diff view
    - line ranges
    - VS Code AI
image: /img/social-share.jpg
---

# search_and_replace

The `search_and_replace` tool finds and replaces text within a file, supporting both literal strings and regular expression patterns. It allows for targeted replacements across multiple locations, optionally within specific line ranges.

---

## Parameters

### Required Parameters

- `path`: The relative path (from the workspace root) of the file to modify.
- `search`: The text string or regex pattern to find.
- `replace`: The text to replace matches with.

### Optional Parameters

- `start_line`: The 1-based line number where the search scope begins.
- `end_line`: The 1-based line number where the search scope ends (inclusive).
- `use_regex`: Set to `"true"` to treat the `search` parameter as a regular expression pattern (default is `false`).
- `ignore_case`: Set to `"true"` to perform a case-insensitive search (default is `false`).

---

## What It Does

This tool reads the specified file and performs a search-and-replace operation based on the provided parameters. It can operate on the entire file or be restricted to a specific range of lines. Changes are presented in a diff view for user review and approval before being saved.

---

## When is it used?

- When renaming variables, functions, or classes across a file.
- When updating specific text strings or values consistently.
- When applying patterned changes using regular expressions.
- When refactoring code requires replacing specific patterns.
- When making targeted changes within a defined section of a file.

---

## Key Features

- **Flexible Searching**: Supports both literal text and regular expression patterns.
- **Case Sensitivity Control**: Option to ignore case during search.
- **Scoped Replacements**: Can limit replacements to a specific range of lines (`start_line`, `end_line`).
- **Global Replacement**: Performs replacements across the entire file (or specified range) by default.
- **Interactive Approval**: Shows proposed changes in a diff view for user review and approval.
- **User Edit Support**: Allows editing the proposed content directly within the diff view.
- **Context Tracking**: Records the file edit operation.
- **Error Handling**: Checks for missing parameters, file access issues, and invalid line numbers.

---

## Limitations

- **Single File Operation**: Operates on only one file at a time. Use `search_files` to find patterns across multiple files first.
- **Review Overhead**: The mandatory diff view approval adds an interactive step.
- **Regex Complexity**: Complex regex patterns might require careful construction and testing.

---

## How It Works

When the `search_and_replace` tool is invoked, it follows this process:

1.  **Parameter Validation**: Checks for required `path`, `search`, `replace`, and validates optional parameters like line numbers and boolean flags.
2.  **File Reading**: Reads the content of the target file specified by `path`.
3.  **Regex Construction**:
    - If `use_regex` is `false`, the `search` string is escaped to treat it as literal text.
    - A `RegExp` object is created with the `g` (global) flag and optionally the `i` (ignore case) flag.
4.  **Replacement Execution**:
    - If `start_line` or `end_line` are provided, the file content is split into lines, the relevant section is isolated, the replacement is performed on that section, and the file content is reconstructed.
    - If no line range is specified, the replacement is performed on the entire file content string.
5.  **Diff View Interaction**:
    - Opens the file in the diff view showing original vs. proposed content.
    - Updates the diff view with the result of the replacement.
6.  **User Approval**: Presents the change via `askApproval`. Reverts if rejected.
7.  **Saving Changes**: If approved, saves the changes (including any user edits made in the diff view).
8.  **File Context Tracking**: Tracks the edit using `cline.getFileContextTracker().trackFileContext`.
9.  **Result Reporting**: Reports success (including user edits) or failure back to the AI model.

---

## Usage Examples

Simple text replacement throughout a file:

```xml
<search_and_replace>
<path>src/config.js</path>
<search>API_KEY_OLD</search>
<replace>API_KEY_NEW</replace>
</search_and_replace>
```

Case-insensitive regex replacement to update function calls:

```xml
<search_and_replace>
<path>src/app.ts</path>
<search>processData\((.*?)\)</search>
<replace>handleData($1)</replace>
<use_regex>true</use_regex>
<ignore_case>true</ignore_case>
</search_and_replace>
```

Replacing text only within lines 10 to 20:

```xml
<search_and_replace>
<path>README.md</path>
<search>Draft</search>
<replace>Final</replace>
<start_line>10</start_line>
<end_line>20</end_line>
</search_and_replace>
```
