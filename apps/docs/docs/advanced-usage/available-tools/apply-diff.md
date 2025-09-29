---
description: Master the apply_diff tool for making surgical code changes using fuzzy matching and line hints in Roo Code with multi-file support.
keywords:
    - apply_diff
    - file editing
    - code modifications
    - fuzzy matching
    - diff tool
    - Roo Code tools
    - multi-file edits
image: /img/social-share.jpg
---

# apply_diff

The `apply_diff` tool makes precise, surgical changes to files by specifying exactly what content to replace. It uses a sophisticated strategy for finding and applying changes while maintaining proper code formatting and structure.

---

## Parameters

The tool accepts these parameters:

- `path` (required): The path of the file to modify relative to the current working directory.
- `diff` (required): The search/replace block defining the changes using a format specific to the active diff strategy.
- `start_line` (optional): A hint for where the search content begins. _Note: This top-level parameter appears unused by the current main strategy, which relies on `:start_line:` within the diff content._
- `end_line` (optional): A hint for where the search content ends. _Note: This top-level parameter appears unused by the current main strategy._

---

## What It Does

This tool applies targeted changes to existing files using fuzzy matching guided by line number hints to locate and replace content precisely. Unlike simple search and replace, it identifies the exact block for replacement based on the provided content and location hints.

---

## When is it used?

- When Roo needs to make precise changes to existing code without rewriting entire files.
- When refactoring specific sections of code while maintaining surrounding context.
- When fixing bugs in existing code with surgical precision.
- When implementing feature enhancements that modify only certain parts of a file.

---

## Key Features

- Uses fuzzy matching (Levenshtein distance on normalized strings) guided by a `:start_line:` hint, with configurable confidence thresholds (typically 0.8-1.0).
- Provides context around matches using `BUFFER_LINES` (default 40).
- Performs a middle-out search within a configurable context window (`bufferLines`) around the hinted start line.
- Preserves code formatting and indentation passively by replacing exact blocks.
- Shows changes in a diff view for user review and editing before applying.
- Tracks consecutive errors per file (`consecutiveMistakeCountForApplyDiff`) to prevent repeated failures.
- Validates file access against `.rooignore` rules.
- Handles multi-line edits effectively.

---

## Limitations

- Works best with unique, distinctive code sections for reliable identification.
- Performance can vary with very large files or highly repetitive code patterns.
- Fuzzy matching might occasionally select incorrect locations if content is ambiguous.
- Each diff strategy has specific format requirements.
- Complex edits might require careful strategy selection or manual review.

---

## How It Works

When the `apply_diff` tool is invoked, it follows this process:

1.  **Parameter Validation**: Validates required `path` and `diff` parameters.
2.  **RooIgnore Check**: Validates if the target file path is allowed by `.rooignore` rules.
3.  **File Analysis**: Loads the target file content.
4.  **Match Finding**: Uses a fuzzy matching algorithm (Levenshtein on normalized strings) guided by the `:start_line:` hint within a context window (`BUFFER_LINES`), searching middle-out to locate the target content based on the confidence threshold.
5.  **Change Preparation**: Generates the proposed changes by replacing the identified block.
6.  **User Interaction**:
    - Displays the changes in a diff view.
    - Allows the user to review and potentially edit the proposed changes.
    - Waits for user approval or rejection.
7.  **Change Application**: If approved, applies the changes (potentially including user edits) to the file.
8.  **Error Handling**: If errors occur (e.g., match failure, partial application), increments the `consecutiveMistakeCountForApplyDiff` for the file and reports the failure type.
9.  **Feedback**: Returns the result, including any user feedback or error details.

---

## Diff Format Requirements

The `<diff>` parameter requires a specific format supporting one or more changes in a single request. Each change block requires a line number hint for the original content.

- **Requires**: Exact match for the `SEARCH` block content (within the fuzzy threshold), including whitespace and indentation. The `:start_line:` number hint is mandatory within each block. The `:end_line:` hint is optional (but supported by the parser). Markers like `<<<<<<<` within the file's content must be escaped (`\\`) in the SEARCH block.

Example format for the `<diff>` block:

```diff
<<<<<<< SEARCH
:start_line:10
:end_line:12
-------
    // Old calculation logic
    const result = value * 0.9;
    return result;
=======
    // Updated calculation logic with logging
    console.log(`Calculating for value: ${value}`);
    const result = value * 0.95; // Adjusted factor
    return result;
>>>>>>> REPLACE

<<<<<<< SEARCH
:start_line:25
:end_line:25
-------
    const defaultTimeout = 5000;
=======
    const defaultTimeout = 10000; // Increased timeout
>>>>>>> REPLACE
```

---

## Experimental: Multi-File Edits (`MULTI_FILE_APPLY_DIFF`)

An experimental version of `apply_diff` allows for applying changes to multiple files within a single tool call. This feature is activated by the `MULTI_FILE_APPLY_DIFF` experiment flag.

### Key Features of Experimental Mode

- **Multi-File Operations**: Edit multiple files in one request, streamlining complex refactoring tasks.
- **Batch Approval UI**: When multiple files are targeted, a single UI appears for the user to approve or deny all changes at once, or manage permissions for each file individually.
- **New XML Format**: Introduces a new, more structured XML format using `<args>` and `<file>` tags to handle multiple operations.
- **Backward Compatibility**: The experimental tool remains compatible with the legacy single-file `path` and `diff` parameter format.

### How It Works (Experimental)

1.  **Experiment Check**: The tool first checks if the `MULTI_FILE_APPLY_DIFF` experiment is enabled. If not, it falls back to the legacy `apply_diff` implementation.
2.  **Parameter Parsing**: It parses the new `<args>` XML format to identify all target files and their corresponding diff operations. It can also handle the legacy `path`/`diff` parameters.
3.  **Validation and Approval**:
    - It validates that all target files exist and are accessible (not blocked by `.rooignore`).
    - If multiple files are being modified, it presents a **batch approval** dialog to the user.
4.  **Diff Application**: For each approved file, it applies the specified diffs using the `MultiFileSearchReplaceDiffStrategy`. This strategy can apply multiple, non-overlapping changes to a single file.
5.  **Results**: It returns a consolidated result message summarizing the outcome for all attempted operations.

### New Diff Format (Experimental)

The experimental mode uses a new XML structure within the `<apply_diff>` tool call.

- **`<args>`**: A container for all file operations.
- **`<file>`**: A block for each file to be modified. Contains `<path>` and one or more `<diff>` tags.
- **`<path>`**: The relative path to the file.
- **`<diff>`**: A block containing the change.
    - **`<content>`**: The `SEARCH/REPLACE` block.
    - **`<start_line>`**: (Optional) A line number hint.

**Example: Modifying two files in one call**

```xml
<apply_diff>
  <args>
    <file>
      <path>src/services/auth.service.ts</path>
      <diff>
        <content>
<<<<<<< SEARCH
:start_line:50
-------
    const token_expiration = '15m';
>>>>>>> REPLACE
        </content>
      </diff>
    </file>
    <file>
      <path>src/config/auth.config.ts</path>
      <diff>
        <content>
<<<<<<< SEARCH
:start_line:12
-------
    rateLimit: 5,
=======
    rateLimit: 10,
>>>>>>> REPLACE
        </content>
      </diff>
    </file>
  </args>
</apply_diff>
```
