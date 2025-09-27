---
description: Learn how Roo Code's Concurrent File Reads feature speeds up development by reading up to 100 files simultaneously for better context understanding.
keywords:
    - concurrent file reads
    - multi-file reads
    - batch file reading
    - context loading
    - workspace efficiency
    - file operations
image: /img/social-share.jpg
sidebar_label: "Multi-File Reads"
---

# Concurrent File Reads (AKA Multi-File Reads)

The Concurrent File Reads feature allows Roo to read multiple files from your workspace in a single step. This significantly improves efficiency when working on tasks that require context from several files, as Roo can gather all the necessary information at once instead of reading files one by one.

### Key Features

- Read up to 100 files in a single request.
- Enabled by default for a faster, more streamlined workflow.
- Configurable limit from 1 to 100 files (setting to 1 effectively disables concurrent reads).

---

## Benefits

- **Increased Speed**: Reduces the time it takes for Roo to understand your code by minimizing the number of back-and-forth steps.
- **Better Context**: Allows Roo to build a more complete mental model of your code, leading to more accurate and relevant responses.
- **Improved Workflow**: Streamlines tasks that require information from multiple files, making you more productive.

---

## Why This Matters

**Faster Context Building**: Previously, when Roo needed to understand your project, you'd see multiple requests like:

- "Can I read `src/app.js`?" → You approve
- "Now can I read `src/utils.js`?" → You approve
- "And can I read `src/config.json`?" → You approve

**With concurrent file reads**: Roo asks once to read all related files together, getting the full picture immediately and providing better assistance faster.

---

## How it Works

When you ask Roo to perform a task that involves multiple files, it will automatically identify the relevant files and read them together. This is especially useful for:

- Understanding the overall structure of a component that is split across multiple files.
- Refactoring code that has dependencies in other parts of the codebase.
- Answering questions that require a broad understanding of your project.

Roo is instructed to use this feature efficiently by prioritizing the most critical files and reading them in a single batch. The [`read_file`](/advanced-usage/available-tools/read-file) tool automatically accepts multiple files in a single request.

When Roo requests to read multiple files, you'll see a batch approval interface that displays:

- List of all files to be read
- File paths with line range indicators (if specified)
- Clickable file headers to open files in your editor
- **Approve All** and **Deny All** buttons for quick decisions

<img src="/img/concurrent-file-reads/concurrent-file-reads-2.png" alt="Batch approval interface for reading multiple files" width="600" />

---

## Configuration

You can configure the Multi-File Read feature by clicking the <Codicon name="gear" /> icon and navigating to the "Context" section of the settings.

<img src="/img/concurrent-file-reads/concurrent-file-reads-1.png" alt="Concurrent file reads settings showing limit slider" width="600" />

1.  **Concurrent File Reads Limit**:
    - **Setting**: `Concurrent file reads limit`
    - **Description**: This setting determines the maximum number of files that Roo can read in a single request. The default is 5, with a range of 1-100 files. Higher values can speed up tasks involving many small files but may use more memory. Setting the value to 1 effectively disables concurrent reads, reverting to single-file reads.
