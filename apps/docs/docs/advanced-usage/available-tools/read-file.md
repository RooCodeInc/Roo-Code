---
description: Explore the read_file tool's capabilities for examining file contents, supporting line ranges, PDF/DOCX extraction, image reading, and experimental multi-file concurrent reading.
keywords:
    - read_file
    - Roo Code tools
    - file reading
    - concurrent reads
    - line numbers
    - PDF extraction
    - DOCX support
    - image support
    - OCR workflows
    - code analysis
    - VS Code AI
image: /img/social-share.jpg
---

# read_file

The `read_file` tool examines the contents of files in a project. It allows Roo to understand code, configuration files, documentation, and now images to provide better assistance.

:::info Multi-File Support
The `read_file` tool can read multiple files simultaneously when the `maxConcurrentFileReads` setting is greater than 1. This significantly improves efficiency for tasks requiring analysis of multiple related files.

**Note:** When reading files (even single files), the LLM will see a message encouraging multi-file reads: "Reading multiple files at once is more efficient for the LLM. If other files are relevant to your current task, please read them simultaneously."
:::

---

## Parameters

The tool accepts parameters in two formats depending on your configuration:

### Standard Format (Single File)

- `path` (required): The path of the file to read relative to the current working directory
- `start_line` (optional): The starting line number to read from (1-based indexing)
- `end_line` (optional): The ending line number to read to (1-based, inclusive)

:::note Legacy Format
While the single-file parameters (`path`, `start_line`, `end_line`) are still supported for backward compatibility, we recommend using the newer `args` format for consistency and future compatibility.
:::

### Enhanced Format (Multi-File)

When `maxConcurrentFileReads` is set to a value greater than 1 (found in Settings > Context > "Concurrent file reads limit"), the tool accepts an `args` parameter containing multiple file entries:

- `args` (required): Container for multiple file specifications
    - `file` (required): Individual file specification
        - `path` (required): The path of the file to read
        - `line_range` (optional): Line range specification (e.g., "1-50" or "100-150"). Multiple `line_range` elements can be specified per file.

---

## What It Does

This tool reads the content of a specified file and returns it with line numbers for easy reference. It can read entire files or specific sections, extract text from PDFs and Word documents, and display images in various formats.

---

## When is it used?

- When Roo needs to understand existing code structure
- When Roo needs to analyze configuration files
- When Roo needs to extract information from text files
- When Roo needs to see code before suggesting changes
- When specific line numbers need to be referenced in discussions

---

## Key Features

- Displays file content with line numbers for easy reference
- Can read specific portions of files by specifying line ranges
- Extracts readable text from PDF and DOCX files
- **Image support**: Displays images in multiple formats (PNG, JPG, JPEG, GIF, WebP, SVG, BMP, ICO, TIFF)
- Automatically truncates large text files when no line range is specified, showing the beginning of the file
- Provides method summaries with line ranges for truncated large code files
- Efficiently streams only requested line ranges for better performance
- Makes it easy to discuss specific parts of code with line numbering
- **Multi-file support**: Read multiple files simultaneously with batch approval (when `maxConcurrentFileReads` > 1)

---

## Multi-File Capabilities

When the `maxConcurrentFileReads` setting is greater than 1, the `read_file` tool gains enhanced capabilities:

### Configuration

- **Location**: Settings > Context > "Concurrent file reads limit"
- **Description**: "Maximum number of files the 'read_file' tool can process concurrently. Higher values may speed up reading multiple small files but increase memory usage."
- **Range**: 1-100 (slider control)
- **Default**: 5

### Batch Processing

- Read up to 100 files in a single request (configurable, default 5)
- Parallel processing for improved performance
- Batch approval interface for user consent

### Enhanced User Experience

- Single approval dialog for multiple files
- Individual file override options
- Clear visibility into which files will be accessed
- Graceful handling of mixed success/failure scenarios

### Improved Efficiency

- Reduces interruptions from multiple approval dialogs
- Faster processing through parallel file reading
- Smart batching of related files
- Configurable concurrency limits to match system capabilities

---

## Limitations

- May not handle extremely large files efficiently without using line range parameters
- For binary files (except PDF, DOCX, and supported image formats), may return content that isn't human-readable
- **Multi-file mode**: Requires `maxConcurrentFileReads` > 1 in settings
- **Image files**: Returns base64-encoded data URLs which may be large for high-resolution images
    - Default max single image size: 20MB
    - Default max total image size: 20MB

---

## How It Works

When the `read_file` tool is invoked, it follows this process:

1. **Parameter Validation**: Validates the required `path` parameter and optional parameters
2. **Path Resolution**: Resolves the relative path to an absolute path
3. **Reading Strategy Selection**:
    - The tool uses a strict priority hierarchy (explained in detail below)
    - It chooses between range reading, auto-truncation, or full file reading
4. **Content Processing**:
    - Adds line numbers to the content (e.g., "1 | const x = 13") where `1 |` is the line number.
    - For truncated files, adds truncation notice and method definitions
    - For special formats (PDF, DOCX), extracts readable text
    - For image formats, returns base64-encoded data URLs with MIME type

---

## Reading Strategy Priority

The tool uses a clear decision hierarchy to determine how to read a file:

1. **First Priority: Explicit Line Range**

    - If either `start_line` or `end_line` is provided, the tool always performs a range read
    - The implementation efficiently streams only the requested lines, making it suitable for processing large files
    - This takes precedence over all other options

2. **Second Priority: Automatic Truncation for Large Text Files**

    - This applies only when **all** of the following conditions are met:
        - Neither `start_line` nor `end_line` is specified.
        - The file is identified as a text-based file (not binary like PDF/DOCX).
        - The file's total line count exceeds the `maxReadFileLine` setting (default: 500 lines).
    - When automatic truncation occurs:
        - The tool reads only the _first_ `maxReadFileLine` lines.
        - It appends a notice indicating truncation (e.g., `[Showing only 500 of 1200 total lines...]`).
        - For code files, it may also append a summary of source code definitions found within the truncated portion.
    - **Special Case - Definitions Only Mode**: When `maxReadFileLine` is set to `0`, the tool returns only source code definitions without any file content.

3. **Default Behavior: Read Entire File**
    - If neither an explicit range is given nor automatic truncation applies (e.g., the file is within the line limit, or it's a supported binary type), the tool reads the entire content.
    - For supported formats like PDF and DOCX, it attempts to extract the full text content.
    - For image formats, it returns a base64-encoded data URL that can be displayed in the chat interface.

---

## Examples When Used

- When asked to explain or improve code, Roo first reads the relevant files to understand the current implementation.
- When troubleshooting configuration issues, Roo reads config files to identify potential problems.
- When working with documentation, Roo reads existing docs to understand the current content before suggesting improvements.

---

## Usage Examples

Here are several scenarios demonstrating how the `read_file` tool is used and the typical output you might receive.

### Reading an Entire File

To read the complete content of a file:

**Input:**

```xml
<read_file>
<path>src/app.js</path>
</read_file>
```

**Simulated Output (for a small file like `example_small.txt`):**

```
1 | This is the first line.
2 | This is the second line.
3 | This is the third line.
```

_(Output will vary based on the actual file content)_

### Reading Specific Lines

To read only a specific range of lines (e.g., 46-68):

**Input:**

```xml
<read_file>
<path>src/app.js</path>
<start_line>46</start_line>
<end_line>68</end_line>
</read_file>
```

**Simulated Output (for lines 2-3 of `example_five_lines.txt`):**

```
2 | Content of line two.
3 | Content of line three.
```

_(Output shows only the requested lines with their original line numbers)_

### Reading a Large Text File (Automatic Truncation)

When reading a large text file without specifying a line range, the tool automatically truncates the content if it exceeds the internal line limit (e.g., 500 lines).

**Input:**

```xml
<read_file>
<path>logs/large_app.log</path>
</read_file>
```

**Simulated Output (for a 1500-line log file with a 500-line limit):**

```
1 | Log entry 1...
2 | Log entry 2...
...
500 | Log entry 500...

[Showing only 500 of 1500 total lines. Use start_line and end_line to read specific ranges.]
// Optional: Source code definitions summary might appear here for code files
```

_(Output shows the beginning lines up to the `maxReadFileLine` limit, plus a truncation notice. Use line ranges for full access.)_

### Reading Definitions Only

When `maxReadFileLine` is set to `0` in user settings, the tool returns only source code definitions without file content:

**Input:**

```xml
<!-- Assuming maxReadFileLine is set to 0 in user settings -->
<read_file>
<path>src/services/auth.service.ts</path>
</read_file>
```

**Simulated Output:**

```xml
<file>
  <path>src/services/auth.service.ts</path>
  <list_code_definition_names>
    class AuthService
      method validateUser
      method generateToken
  </list_code_definition_names>
  <notice>Showing only 0 of 150 total lines. Use line_range if you need to read more lines</notice>
</file>
```

_(This mode provides a quick overview of file structure without reading content.)_

### Attempting to Read a Non-Existent File

If the specified file does not exist:

**Input:**

```xml
<read_file>
<path>non_existent_file.txt</path>
</read_file>
```

**Simulated Output (Error):**

```
Error: File not found at path 'non_existent_file.txt'.
```

### Attempting to Read a Blocked File

If the file is excluded by rules in a `.rooignore` file:

**Input:**

```xml
<read_file>
<path>.env</path>
</read_file>
```

**Simulated Output (Error):**

```xml
<file>
  <path>.env</path>
  <error>Access denied by .rooignore rules</error>
</file>
```

---

## Image Reading Examples

The `read_file` tool now supports reading and displaying images directly in the chat interface. This enables powerful visual analysis workflows.

### Reading a Single Image

**Input:**

```xml
<read_file>
<path>assets/logo.png</path>
</read_file>
```

**Output:**

```xml
<image_content>
<path>assets/logo.png</path>
<mime_type>image/png</mime_type>
<dimensions>width: 512, height: 512</dimensions>
<data_url>data:image/png;base64,iVBORw0KGgoAAAANS...</data_url>
</image_content>
```

The image will be displayed directly in the chat interface, allowing Roo to analyze visual content.

### OCR Workflow Example

Reading multiple images from a folder for text extraction:

**Input:**

```xml
<read_file>
<args>
  <file>
    <path>screenshots/page1.png</path>
  </file>
  <file>
    <path>screenshots/page2.png</path>
  </file>
  <file>
    <path>screenshots/page3.png</path>
  </file>
</args>
</read_file>
```

**Usage:**

```
Please extract all text from these screenshot images and compile them into a single markdown document.
```

### Design Review Workflow

Analyzing multiple design mockups:

**Input:**

```xml
<read_file>
<args>
  <file>
    <path>designs/homepage-v1.jpg</path>
  </file>
  <file>
    <path>designs/homepage-v2.jpg</path>
  </file>
  <file>
    <path>designs/mobile-view.png</path>
  </file>
</args>
</read_file>
```

**Usage:**

```
Compare these design mockups and provide feedback on:
1. Visual consistency
2. Mobile responsiveness
3. Accessibility concerns
4. UI/UX improvements
```

### Supported Image Formats

The tool supports the following image formats:

- **PNG** - With dimension extraction
- **JPG/JPEG** - Standard and progressive
- **GIF** - Static and animated
- **WebP** - Modern web format
- **SVG** - Scalable vector graphics
- **BMP** - Bitmap images
- **ICO** - Icon files
- **TIFF** - Tagged image format

### Image Analysis Use Cases

1. **Documentation Screenshots**: Extract text and create documentation from UI screenshots
2. **Error Debugging**: Analyze error screenshots to understand issues
3. **Design Reviews**: Compare mockups and provide visual feedback
4. **Diagram Analysis**: Understand architecture diagrams and flowcharts
5. **Code Screenshots**: Extract code from images when text isn't available
6. **UI Testing**: Verify visual elements and layouts

---

## Multi-File Examples

When `maxConcurrentFileReads` is set to a value greater than 1, you can read multiple files simultaneously using the enhanced XML format.

### Reading Multiple Complete Files

To read several complete files at once:

**Input:**

```xml
<read_file>
<args>
  <file>
    <path>src/app.ts</path>
  </file>
  <file>
    <path>src/utils.ts</path>
  </file>
  <file>
    <path>src/config.json</path>
  </file>
</args>
</read_file>
```

**Simulated Output:**

```xml
<files>
  <file>
    <path>src/app.ts</path>
    <content>
      1 | import React from 'react'
      2 | import { Utils } from './utils'
      3 | // ... rest of file content
    </content>
  </file>
  <file>
    <path>src/utils.ts</path>
    <content>
      1 | export class Utils {
      2 |   static formatDate(date: Date): string {
      3 |     // ... utility functions
    </content>
  </file>
  <file>
    <path>src/config.json</path>
    <content>
      1 | {
      2 |   "apiUrl": "https://api.example.com",
      3 |   "timeout": 5000
      4 | }
    </content>
  </file>
</files>
```

### Reading Specific Line Ranges from Multiple Files

To read specific sections from multiple files:

**Input:**

```xml
<read_file>
<args>
  <file>
    <path>src/app.ts</path>
    <line_range>1-20</line_range>
    <line_range>45-60</line_range>
  </file>
  <file>
    <path>src/utils.ts</path>
    <line_range>10-25</line_range>
  </file>
</args>
</read_file>
```

**Simulated Output:**

```xml
<files>
  <file>
    <path>src/app.ts</path>
    <content>
      1 | import React from 'react'
      2 | import { Utils } from './utils'
      ...
      20 | const App = () => {

      45 |   const handleSubmit = () => {
      46 |     // Handle form submission
      ...
      60 |   }
    </content>
  </file>
  <file>
    <path>src/utils.ts</path>
    <content>
      10 |   static formatDate(date: Date): string {
      11 |     return date.toISOString().split('T')[0]
      ...
      25 |   }
    </content>
  </file>
</files>
```

### Handling Mixed Results (Some Files Denied/Blocked)

When some files are approved and others are denied or blocked:

**Input:**

```xml
<read_file>
<args>
  <file>
    <path>src/app.ts</path>
  </file>
  <file>
    <path>.env</path>
  </file>
  <file>
    <path>src/secret-config.ts</path>
  </file>
</args>
</read_file>
```

**Simulated Output:**

```xml
<files>
  <file>
    <path>src/app.ts</path>
    <content>
      1 | import React from 'react'
      2 | // ... file content successfully read
    </content>
  </file>
  <file>
    <path>.env</path>
    <error>Access denied by .rooignore rules</error>
  </file>
  <file>
    <path>src/secret-config.ts</path>
    <error>User denied access to file</error>
  </file>
</files>
```

### Batch Approval Interface

When requesting multiple files, you'll see a batch approval interface that allows you to:

- **Approve All**: Grant access to all requested files
- **Deny All**: Deny access to all requested files
- **Individual Control**: Override decisions for specific files
- **File Preview**: Click file headers to open them in your editor

The interface displays each file path clearly, making it easy to understand what Roo wants to access before granting permission.

### Mixed Content Types

You can read different types of files in a single request:

**Input:**

```xml
<read_file>
<args>
  <file>
    <path>README.md</path>
  </file>
  <file>
    <path>architecture-diagram.png</path>
  </file>
  <file>
    <path>config.json</path>
  </file>
  <file>
    <path>requirements.pdf</path>
  </file>
</args>
</read_file>
```

This allows Roo to analyze documentation, visual diagrams, configuration, and specifications all in one context.
