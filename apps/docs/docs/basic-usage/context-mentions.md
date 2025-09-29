---
description: Learn how to use context mentions (@) in Roo Code to reference files, folders, problems, terminal output, and Git commits for more accurate AI assistance.
keywords:
    - "Roo Code context mentions"
    - "@ mentions"
    - "file references"
    - "folder mentions"
    - "problems panel"
    - "terminal mentions"
    - "Git integration"
image: /img/social-share.jpg
---

# Context Mentions

Context mentions are a powerful way to provide Roo Code with specific information about your project, allowing it to perform tasks more accurately and efficiently. You can use mentions to refer to files, folders, problems, and Git commits. Context mentions start with the `@` symbol.

<img src="/img/context-mentions/context-mentions.png" alt="Context Mentions Overview - showing the @ symbol dropdown menu in the chat interface" width="600" />

_Context mentions overview showing the @ symbol dropdown menu in the chat interface._

---

## Types of Mentions

<img src="/img/context-mentions/context-mentions-1.png" alt="File mention example showing a file being referenced with @ and its contents appearing in the conversation" width="600" />

_File mentions add actual code content into the conversation for direct reference and analysis._

| Mention Type    | Format                 | Description                                                           | Example Usage                            |
| --------------- | ---------------------- | --------------------------------------------------------------------- | ---------------------------------------- |
| **File**        | `@/path/to/file.ts`    | Includes file contents in request context                             | "Explain the function in @/src/utils.ts" |
| **Folder**      | `@/path/to/folder`     | Includes contents of all files directly in the folder (non-recursive) | "Analyze the code in @/src/components"   |
| **Problems**    | `@problems`            | Includes VS Code Problems panel diagnostics                           | "@problems Fix all errors in my code"    |
| **Terminal**    | `@terminal`            | Includes recent terminal command and output                           | "Fix the errors shown in @terminal"      |
| **Git Commit**  | `@a1b2c3d`             | References specific commit by hash                                    | "What changed in commit @a1b2c3d?"       |
| **Git Changes** | `@git-changes`         | Shows uncommitted changes                                             | "Suggest a message for @git-changes"     |
| **URL**         | `@https://example.com` | Imports website content                                               | "Summarize @https://docusaurus.io/"      |

### File Mentions

<img src="/img/context-mentions/context-mentions-1.png" alt="File mention example showing a file being referenced with @ and its contents appearing in the conversation" width="600" />

_File mentions incorporate source code with line numbers for precise references._
| Capability | Details |
|------------|---------|
| **Format** | `@/path/to/file.ts` (always start with `/` from workspace root) |
| **Provides** | Complete file contents with line numbers |
| **Supports** | Text files, PDFs, and DOCX files (with text extraction) |
| **Works in** | Initial requests, feedback responses, and follow-up messages |
| **Limitations** | Very large files may be truncated; binary files not supported |

### Folder Mentions

<img src="/img/context-mentions/context-mentions-2.png" alt="Folder mention example showing directory contents being referenced in the chat" width="600" />

_Folder mentions include the content of all files within the specified directory._
| Capability | Details |
|------------|---------|
| **Format** | `@/path/to/folder` (no trailing slash) |
| **Provides** | Complete contents of all files within the directory |
| **Includes** | Contents of non-binary text files directly within the folder (not recursive) |
| **Best for** | Providing context from multiple files in a directory |
| **Tip** | Be mindful of context window limits when mentioning large directories |

### Problems Mention

<img src="/img/context-mentions/context-mentions-3.png" alt="Problems mention example showing VS Code problems panel being referenced with @problems" width="600" />

_Problems mentions import diagnostics directly from VS Code's problems panel._
| Capability | Details |
|------------|---------|
| **Format** | `@problems` |
| **Provides** | All errors and warnings from VS Code's problems panel |
| **Includes** | File paths, line numbers, and diagnostic messages |
| **Groups** | Problems organized by file for better clarity |
| **Best for** | Fixing errors without manual copying |

For comprehensive details on how Roo Code integrates with VSCode's diagnostics system, see [Diagnostics Integration](/features/diagnostics-integration).

### Terminal Mention

<img src="/img/context-mentions/context-mentions-4.png" alt="Terminal mention example showing terminal output being included in Roo's context" width="600" />

_Terminal mentions capture recent command output for debugging and analysis._

| Capability     | Details                                            |
| -------------- | -------------------------------------------------- |
| **Format**     | `@terminal`                                        |
| **Captures**   | Last command and its complete output               |
| **Preserves**  | Terminal state (doesn't clear the terminal)        |
| **Limitation** | Limited to visible terminal buffer content         |
| **Best for**   | Debugging build errors or analyzing command output |

### Git Mentions

<img src="/img/context-mentions/context-mentions-5.png" alt="Git commit mention example showing commit details being analyzed by Roo" width="600" />

_Git mentions provide commit details and diffs for context-aware version analysis._
| Type | Format | Provides | Limitations |
|------|--------|----------|------------|
| **Commit** | `@a1b2c3d` | Commit message, author, date, and complete diff | Only works in Git repositories |
| **Working Changes** | `@git-changes` | `git status` output and diff of uncommitted changes | Only works in Git repositories |

### URL Mentions

<img src="/img/context-mentions/context-mentions-6.png" alt="URL mention example showing website content being converted to Markdown in the chat" width="600" />

_URL mentions import external web content and convert it to readable Markdown format._

| Capability     | Details                                          |
| -------------- | ------------------------------------------------ |
| **Format**     | `@https://example.com`                           |
| **Processing** | Uses headless browser to fetch content           |
| **Cleaning**   | Removes scripts, styles, and navigation elements |
| **Output**     | Converts content to Markdown for readability     |
| **Limitation** | Complex pages may not convert perfectly          |

---

## How to Use Mentions

1. Type `@` in the chat input to trigger the suggestions dropdown
2. Continue typing to filter suggestions or use arrow keys to navigate
3. Select with Enter key or mouse click
4. Combine multiple mentions in a request: "Fix @problems in @/src/component.ts"

The dropdown automatically suggests:

- Recently opened files
- Visible folders
- Recent git commits
- Special keywords (`problems`, `terminal`, `git-changes`)
- **All currently open files** (regardless of ignore settings or directory filters)

The dropdown automatically filters out common directories like `node_modules`, `.git`, `dist`, and `out` to reduce noise, even though their content could be included if manually typed.

---

## Important Behaviors

### Ignore File Interactions

| Behavior                | Description                                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`.rooignore` bypass** | File and folder `@mentions` bypass `.rooignore` checks when fetching content for context. Content from ignored files will be included if directly mentioned. |
| **`.gitignore` bypass** | Similarly, file and folder `@mentions` do not respect `.gitignore` rules when fetching content.                                                              |
| **Git command respect** | Git-related mentions (`@git-changes`, `@commit-hash`) do respect `.gitignore` since they rely on Git commands.                                               |

---

## Related Features

- [Diagnostics Integration](/features/diagnostics-integration) - Learn about automatic error detection and smart severity filtering
- [Code Actions](/features/code-actions) - Discover quick fixes and AI assistance directly in your editor
- [Shell Integration](/features/shell-integration) - Understand how terminal mentions work with shell integration
