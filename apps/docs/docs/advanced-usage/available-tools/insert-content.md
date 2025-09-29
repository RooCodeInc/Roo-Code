---
description: Insert new content at specific line numbers in existing files without modifying original content using Roo Code's insert_content tool.
keywords:
    - insert_content
    - file insertion
    - add content
    - Roo Code tools
    - code insertion
    - file editing
image: /img/social-share.jpg
---

# insert_content

The `insert_content` tool adds new lines of content into an existing file without modifying the original content. It's ideal for inserting code blocks, configuration entries, or log lines at specific locations.

---

## Parameters

The tool accepts these parameters:

- `path` (required): The relative path (from the workspace root) of the file to insert content into.
- `line` (required): The 1-based line number _before_ which the content should be inserted. Use `0` to append the content to the end of the file.
- `content` (required): The text content to insert.

---

## What It Does

This tool reads the target file, identifies the specified insertion point based on the `line` parameter, and inserts the provided `content` at that location. If `line` is `0`, the content is added to the end. Changes are presented in a diff view for user approval before being saved.

---

## When is it used?

- When adding new import statements at the beginning of a file.
- When inserting new functions or methods into existing code.
- When adding configuration blocks to settings files.
- When appending log entries or data records.
- When adding any multi-line text block without altering existing lines.

---

## Key Features

- **Targeted Insertion**: Adds content precisely at the specified line number or appends to the end.
- **Preserves Existing Content**: Does not modify or delete original file lines.
- **Interactive Approval**: Shows proposed insertions in a diff view, requiring explicit user approval.
- **User Edit Support**: Allows editing the proposed content directly within the diff view before final approval.
- **Handles Line Numbers**: Correctly interprets the `line` parameter (1-based or 0 for append).
- **Context Tracking**: Records the file edit operation for context management.
- **Error Handling**: Checks for missing parameters, invalid line numbers, and file access issues.

---

## Limitations

- **Insert Only**: Cannot replace or delete existing content. Use `apply_diff` or `search_and_replace` for modifications.
- **Requires Existing File**: The target file specified by `path` must exist.
- **Review Overhead**: The mandatory diff view approval adds an interactive step.

---

## How It Works

When the `insert_content` tool is invoked, it follows this process:

1.  **Parameter Validation**: Checks for required `path`, `line`, and `content`. Validates `line` is a non-negative integer.
2.  **File Reading**: Reads the content of the target file specified by `path`.
3.  **Insertion Point Calculation**: Converts the 1-based `line` parameter to a 0-based index for internal processing (`-1` for appending).
4.  **Content Insertion**: Uses an internal utility (`insertGroups`) to merge the original file lines with the new `content` at the calculated index.
5.  **Diff View Interaction**:
    - Opens the file in the diff view (`cline.diffViewProvider.open`).
    - Updates the diff view with the proposed content (`cline.diffViewProvider.update`).
6.  **User Approval**: Presents the change via `askApproval`. Reverts if rejected.
7.  **Saving Changes**: If approved, saves the changes using `cline.diffViewProvider.saveChanges`.
8.  **File Context Tracking**: Tracks the edit using `cline.getFileContextTracker().trackFileContext`.
9.  **Handling User Edits**: If the user edited the content in the diff view, reports the final merged content back.
10. **Result Reporting**: Reports success (including user edits) or failure back to the AI model.

---

## Usage Examples

Inserting import statements at the beginning of a file (`line: 1`):

```xml
<insert_content>
<path>src/utils.ts</path>
<line>1</line>
<content>
// Add imports at start of file
import { sum } from './math';
import { parse } from 'date-fns';
</content>
</insert_content>
```

Appending content to the end of a file (`line: 0`):

```xml
<insert_content>
<path>config/routes.yaml</path>
<line>0</line>
<content>
- path: /new-feature
  component: NewFeatureComponent
  auth_required: true
</content>
</insert_content>
```

Inserting a function before line 50:

```xml
<insert_content>
<path>src/services/api.js</path>
<line>50</line>
<content>
async function fetchUserData(userId) {
  const response = await fetch(`/api/users/${userId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch user data');
  }
  return response.json();
}
</content>
</insert_content>
```
