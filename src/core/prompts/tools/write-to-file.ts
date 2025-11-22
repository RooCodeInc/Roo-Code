import { ToolArgs } from "./types"

export function getWriteToFileDescription(args: ToolArgs): string {
	return `## write_to_file
Description: Request to write content to a file. This tool is primarily used for **creating new files** or for scenarios where a **complete rewrite of an existing file is intentionally required**. If the file exists, it will be overwritten. If it doesn't exist, it will be created. This tool will automatically create any directories needed to write the file.

**Task-Scoped Files**: You can create temporary markdown files that exist only within the current task by setting task_scoped to true. These files:
- Are stored within the task context, not in the project directory
- Can be accessed using [task-scoped]/filename.md syntax with read_file
- Must be markdown files (.md or .markdown)
- Are perfect for storing notes, analysis, or documentation during complex tasks

Parameters:
- path: (required) The path of the file to write to (relative to the current workspace directory ${args.cwd})
- content: (required) The content to write to the file. When performing a full rewrite of an existing file or creating a new one, ALWAYS provide the COMPLETE intended content of the file, without any truncation or omissions. You MUST include ALL parts of the file, even if they haven't been modified. Do NOT include the line numbers in the content though, just the actual content of the file.
- line_count: (required) The number of lines in the file. Make sure to compute this based on the actual content of the file, not the number of lines in the content you're providing.
- task_scoped: (optional) Set to true to create a task-scoped markdown file that exists only within this task. Only works for .md and .markdown files.
Usage:
<write_to_file>
<path>File path here</path>
<content>
Your file content here
</content>
<line_count>total number of lines in the file, including empty lines</line_count>
</write_to_file>

Example 1: Creating a task-scoped markdown file for notes
<write_to_file>
<path>analysis-notes.md</path>
<content>
# Analysis Notes

## Key Findings
- Found performance bottleneck in data processing
- Identified 3 areas for optimization

## Next Steps
1. Implement caching strategy
2. Optimize database queries
3. Add performance monitoring
</content>
<line_count>10</line_count>
<task_scoped>true</task_scoped>
</write_to_file>

Example 2: Requesting to write to frontend-config.json
<write_to_file>
<path>frontend-config.json</path>
<content>
{
  "apiEndpoint": "https://api.example.com",
  "theme": {
    "primaryColor": "#007bff",
    "secondaryColor": "#6c757d",
    "fontFamily": "Arial, sans-serif"
  },
  "features": {
    "darkMode": true,
    "notifications": true,
    "analytics": false
  },
  "version": "1.0.0"
}
</content>
<line_count>14</line_count>
</write_to_file>`
}
