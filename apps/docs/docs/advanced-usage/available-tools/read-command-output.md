---
description: Retrieve full command output that was truncated in execute_command using the read_command_output tool in Roo Code.
keywords:
    - read_command_output
    - command output
    - truncated output
    - CLI output
    - terminal output
    - Roo Code tools
    - artifact retrieval
---

# read_command_output

The `read_command_output` tool retrieves the full output from commands executed via [`execute_command`](/advanced-usage/available-tools/execute-command) when the output was too large and got truncated. It provides access to stored command output artifacts with advanced filtering and pagination capabilities.

---

## Parameters

The tool accepts these parameters:

- `artifact_id` (required): The artifact filename from the truncated output message (e.g., `cmd-1706119234567.txt`).
- `search` (optional): Pattern to filter lines (supports regex or literal strings). Case-insensitive. Similar to `grep`. **Omit entirely if not needed** (do not pass null or empty string).
- `offset` (optional): Byte offset to start reading from for pagination. Default: 0.
- `limit` (optional): Maximum bytes to return. Default: 40KB (40960 bytes).

---

## What It Does

When [`execute_command`](/advanced-usage/available-tools/execute-command) produces very large output, it gets truncated and saved to an artifact file. This tool retrieves the full output from those artifacts, with support for searching specific patterns (like grep) and paginating through large results.

---

## When is it used?

- When [`execute_command`](/advanced-usage/available-tools/execute-command) output includes the message: `[OUTPUT TRUNCATED - Full output saved to artifact: cmd-XXXX.txt]`
- When you need to search for specific errors or patterns in large command output
- When analyzing verbose build logs, test results, or compilation output
- When paginating through command output that's too large to view at once
- When filtering command output to find relevant lines without reading everything

---

## Key Features

- **Read mode**: Access full output with pagination using `offset` and `limit`
- **Search mode**: Filter lines matching a regex or literal pattern (case-insensitive)
- Handles very large command outputs efficiently
- Similar to `grep` for filtering output
- Byte-level pagination for precise control
- Access to complete untruncated command output

---

## Limitations

- Only works with artifacts created by [`execute_command`](/advanced-usage/available-tools/execute-command)
- Artifacts may be cleaned up after a certain time period
- Search patterns are case-insensitive only
- Returns content as bytes with limits (not entire files at once for very large outputs)
- Requires the exact artifact ID from the truncation message

---

## How It Works

When the `read_command_output` tool is invoked, it follows this process:

1. **Artifact Lookup**: Locates the stored command output artifact by ID.
2. **Mode Selection**:
    - If `search` parameter is provided: operates in **search mode** (filter lines)
    - Otherwise: operates in **read mode** (return raw content with offset/limit)
3. **Search Mode** (if `search` provided):
    - Applies regex or literal pattern matching to each line
    - Returns only lines that match the pattern
    - Case-insensitive matching
4. **Read Mode** (if no `search`):
    - Reads from `offset` byte position
    - Returns up to `limit` bytes
    - Supports pagination through large files
5. **Result Return**: Returns filtered or paginated content.

---

## Usage Examples

Reading truncated output:

```
When execute_command shows:
"[OUTPUT TRUNCATED - Full output saved to artifact: cmd-1706119234567.txt]"

Use:
<read_command_output>
  <artifact_id>cmd-1706119234567.txt</artifact_id>
</read_command_output>
```

Searching for errors:

```
<read_command_output>
  <artifact_id>cmd-1706119234567.txt</artifact_id>
  <search>error|failed|Error</search>
</read_command_output>
```

Paginating through output (reading next chunk):

```
<read_command_output>
  <artifact_id>cmd-1706119234567.txt</artifact_id>
  <offset>40960</offset>
  <limit>40960</limit>
</read_command_output>
```

---

## Relation to Other Tools

- [`execute_command`](/advanced-usage/available-tools/execute-command): Creates the artifacts that this tool reads
- [`search_files`](/advanced-usage/available-tools/search-files): Use for searching project files with regex
- `read_command_output`: Use for searching command output artifacts
