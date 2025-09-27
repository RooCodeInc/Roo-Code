---
description: Learn how to use .rooignore files to control Roo Code's file access, protect sensitive information, and manage which files the AI can read or modify.
keywords:
    - rooignore
    - file access control
    - sensitive data protection
    - gitignore syntax
    - file permissions
    - security
image: /img/social-share.jpg
sidebar_label: .rooignore
---

# Using .rooignore to Control File Access

The `.rooignore` file is a key feature for managing Roo Code's interaction with your project files. It allows you to specify files and directories that Roo should not access or modify, similar to how `.gitignore` works for Git.

---

## What is `.rooignore`?

- **Purpose**: To protect sensitive information, prevent accidental changes to build artifacts or large assets, and generally define Roo's operational scope within your workspace.
- **How to Use**: Create a file named `.rooignore` in the root directory of your VS Code workspace. List patterns in this file to tell Roo which files and directories to ignore.
- **Scope**: `.rooignore` affects both Roo's tools and context mentions (like `@directory` attachments).

Roo actively monitors the `.rooignore` file. Any changes you make are reloaded automatically, ensuring Roo always uses the most current rules. The `.rooignore` file itself is always implicitly ignored, so Roo cannot change its own access rules.

---

## Pattern Syntax

The syntax for `.rooignore` is identical to `.gitignore`. Here are common examples:

- `node_modules/`: Ignores the entire `node_modules` directory.
- `*.log`: Ignores all files ending in `.log`.
- `config/secrets.json`: Ignores a specific file.
- `!important.log`: An exception; Roo will _not_ ignore this specific file, even if a broader pattern like `*.log` exists.
- `build/`: Ignores the `build` directory.
- `docs/**/*.md`: Ignores all Markdown files in the `docs` directory and its subdirectories.

For a comprehensive guide on syntax, refer to the [official Git documentation on .gitignore](https://git-scm.com/docs/gitignore).

---

## How Roo Tools Interact with `.rooignore`

`.rooignore` rules are enforced across various Roo tools:

### Strict Enforcement (Reads & Writes)

These tools directly check `.rooignore` before any file operation. If a file is ignored, the operation is blocked:

- [`read_file`](/advanced-usage/available-tools/read-file): Will not read ignored files.
- [`write_to_file`](/advanced-usage/available-tools/write-to-file): Will not write to or create new ignored files.
- [`apply_diff`](/advanced-usage/available-tools/apply-diff): Will not apply diffs to ignored files.
- [`insert_content`](/advanced-usage/available-tools/insert-content): Will not write to ignored files.
- [`search_and_replace`](/advanced-usage/available-tools/search-and-replace): Will not search and replace within ignored files.
- [`list_code_definition_names`](/advanced-usage/available-tools/list-code-definition-names): Will not parse ignored files for code symbols.

### File Discovery and Listing

- **[`list_files`](/advanced-usage/available-tools/list-files) Tool & `@directory` Attachments**: When Roo lists files or when you use `@directory` attachments, ignored files are omitted or marked with a 🔒 symbol (see "User Experience" below). Both use identical filtering logic.
- **Environment Details**: Information about your workspace (like open tabs and project structure) provided to Roo is filtered to exclude or mark ignored items.

### Context Mentions

- **`@directory` Attachments**: Directory contents respect `.rooignore` patterns. Ignored files are filtered out or marked with `[🔒]` prefix depending on the `showRooIgnoredFiles` setting.
- **Single File Mentions**: Ignored files return "(File is ignored by .rooignore)" instead of content.

### Command Execution

- **[`execute_command`](/advanced-usage/available-tools/execute-command) Tool**: This tool checks if a command (from a predefined list like `cat` or `grep`) targets an ignored file. If so, execution is blocked.

---

## Key Limitations and Scope

- **Workspace-Centric**: `.rooignore` rules apply **only to files and directories within the current VS Code workspace root**. Files outside this scope are not affected.
- **[`execute_command`](/advanced-usage/available-tools/execute-command) Specificity**: Protection for `execute_command` is limited to a predefined list of file-reading commands. Custom scripts or uncommon utilities might not be caught.
- **Not a Full Sandbox**: `.rooignore` is a powerful tool for controlling Roo's file access via its tools, but it does not create a system-level sandbox.

---

## User Experience and Notifications

- **Visual Cue (🔒)**: In file listings and `@directory` attachments, files ignored by `.rooignore` may be marked with a lock symbol (🔒), depending on the `showRooIgnoredFiles` setting (defaults to `true`).
- **Ignore Messages**: Single file mentions return "(File is ignored by .rooignore)" instead of content.
- **Error Messages**: If a tool operation is blocked, Roo receives an error: `"Access to [file_path] is blocked by the .rooignore file settings. You must try to continue in the task without using this file, or ask the user to update the .rooignore file."`
- **Chat Notifications**: You will typically see a notification in the Roo chat interface when an action is blocked due to `.rooignore`.

This guide helps you understand the `.rooignore` feature, its capabilities, and its current limitations, so you can effectively manage Roo's interaction with your codebase.
