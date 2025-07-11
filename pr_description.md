## Description

Fixes #5464

This PR resolves a critical bug where MCP tool calls fail when using the qwen2.5-72b-instruct model. The issue occurs because this specific model incorrectly adds complete `</use_mcp_tool>` closing tags to MCP tool parameters, causing JSON parsing failures and preventing MCP tools from executing properly.

## Changes Made

### Enhanced `removeClosingTag` Function

- **File**: `src/core/assistant-message/presentAssistantMessage.ts`
- **Enhancement**: Added specific handling for MCP tools (`use_mcp_tool` and `access_mcp_resource`)
- **Functionality**: Removes complete erroneous closing tags like `</use_mcp_tool>` and `</access_mcp_resource>`
- **Compatibility**: Maintains existing partial tag removal logic for streaming content
- **Robustness**: Handles multiple consecutive erroneous tags and trims trailing whitespace

### Comprehensive Test Coverage

- **File**: `src/core/assistant-message/__tests__/presentAssistantMessage.spec.ts` (new)
- **Coverage**: 14 test cases covering various scenarios:
    - Basic erroneous closing tag removal
    - Multiple consecutive closing tags
    - Mixed scenarios with both complete and partial tags
    - Edge cases and validation
    - Specific qwen2.5-72b-instruct model behavior
    - JSON parsing validation for cleaned arguments

## Testing

- [x] All existing tests pass (54 tests in assistant-message module)
- [x] Added comprehensive test suite with 14 new test cases
- [x] Manual testing completed for qwen2.5-72b-instruct scenarios
- [x] JSON parsing validation for cleaned MCP tool arguments
- [x] Linting checks pass
- [x] No breaking changes or regressions detected

## Verification of Acceptance Criteria

- [x] **MCP tool calls work with qwen2.5-72b-instruct**: The fix removes erroneous `</use_mcp_tool>` tags
- [x] **JSON parsing succeeds**: Cleaned parameters are valid JSON that can be parsed
- [x] **No impact on other models**: Only affects MCP tools and preserves existing functionality
- [x] **Backward compatibility**: All existing partial tag removal logic is preserved
- [x] **Comprehensive testing**: Edge cases and model-specific scenarios are covered

## Technical Details

The root cause was that the `removeClosingTag` function was designed primarily for partial closing tags during streaming, but the qwen2.5-72b-instruct model generates complete erroneous closing tags. The fix:

1. **Detects MCP tool types** (`use_mcp_tool`, `access_mcp_resource`)
2. **Removes complete closing tags** using targeted regex patterns
3. **Trims trailing whitespace** left after tag removal
4. **Preserves existing logic** for partial tag handling during streaming

## Example Fix

**Before** (qwen2.5-72b-instruct output):

```json
{"path": "/path/to/file.txt"}</use_mcp_tool>
```

**After** (cleaned for MCP processing):

```json
{ "path": "/path/to/file.txt" }
```

## Checklist

- [x] Code follows project style guidelines
- [x] Self-review completed
- [x] Comments added for complex logic
- [x] No breaking changes
- [x] Comprehensive test coverage added
- [x] All existing tests pass
- [x] Issue requirements fully addressed
