# Skipped Tests Analysis

## Summary

**37 tests are skipped** because their entire test suites are explicitly disabled using `suite.skip()`.

## Breakdown by Test Suite

### 1. Subtasks (1 test)

**File**: [`src/suite/subtasks.test.ts:7`](src/suite/subtasks.test.ts#L7)
**Status**: `suite.skip()`
**Tests**:

- Should handle subtask cancellation and resumption correctly

### 2. write_to_file Tool (2 tests)

**File**: [`src/suite/tools/write-to-file.test.ts:11`](src/suite/tools/write-to-file.test.ts#L11)
**Status**: `suite.skip()`
**Tests**:

- Should create a new file with content
- Should create nested directories when writing file

### 3. use_mcp_tool Tool (6 tests)

**File**: [`src/suite/tools/use-mcp-tool.test.ts:12`](src/suite/tools/use-mcp-tool.test.ts#L12)
**Status**: `suite.skip()` + 3 individual `test.skip()`
**Tests**:

- Should request MCP filesystem read_file tool and complete successfully
- Should request MCP filesystem write_file tool and complete successfully
- Should request MCP filesystem list_directory tool and complete successfully
- Should request MCP filesystem directory_tree tool and complete successfully ⚠️ `test.skip()`
- Should handle MCP server error gracefully and complete task ⚠️ `test.skip()` (requires interactive approval)
- Should validate MCP request message format and complete successfully ⚠️ `test.skip()`

### 4. search_files Tool (8 tests)

**File**: [`src/suite/tools/search-files.test.ts:11`](src/suite/tools/search-files.test.ts#L11)
**Status**: `suite.skip()`
**Tests**:

- Should search for function definitions in JavaScript files
- Should search for TODO comments across multiple file types
- Should search with file pattern filter for TypeScript files
- Should search for configuration keys in JSON files
- Should search in nested directories
- Should handle complex regex patterns
- Should handle search with no matches
- Should search for class definitions and methods

### 5. read_file Tool (7 tests)

**File**: [`src/suite/tools/read-file.test.ts:12`](src/suite/tools/read-file.test.ts#L12)
**Status**: `suite.skip()`
**Tests**:

- Should read a simple text file
- Should read a multiline file
- Should read file with line range
- Should handle reading non-existent file
- Should read XML content file
- Should read multiple files in sequence
- Should read large file efficiently

### 6. list_files Tool (4 tests)

**File**: [`src/suite/tools/list-files.test.ts:11`](src/suite/tools/list-files.test.ts#L11)
**Status**: `suite.skip()`
**Tests**:

- Should list files in a directory (non-recursive)
- Should list files in a directory (recursive)
- Should list symlinked files and directories
- Should list files in workspace root directory

### 7. execute_command Tool (4 tests)

**File**: [`src/suite/tools/execute-command.test.ts:11`](src/suite/tools/execute-command.test.ts#L11)
**Status**: `suite.skip()`
**Tests**:

- Should execute simple echo command
- Should execute command with custom working directory
- Should execute multiple commands sequentially
- Should handle long-running commands

### 8. apply_diff Tool (5 tests)

**File**: [`src/suite/tools/apply-diff.test.ts:11`](src/suite/tools/apply-diff.test.ts#L11)
**Status**: `suite.skip()`
**Tests**:

- Should apply diff to modify existing file content
- Should apply multiple search/replace blocks in single diff
- Should handle apply_diff with line number hints
- Should handle apply_diff errors gracefully
- Should apply multiple search/replace blocks to edit two separate functions

## Why Are They Skipped?

Based on the code analysis, these tests were likely disabled because:

1. **Flakiness**: Tests may have been unreliable or timing-dependent
2. **Environment Issues**: Tests may require specific setup that's hard to maintain
3. **Work in Progress**: Tests may have been written but not fully debugged
4. **Known Bugs**: Tests may expose bugs that haven't been fixed yet
5. **Expensive**: Tests may take too long or use too many API credits

### Specific Reasons Found in Code

**MCP Tool Tests**:

- One test explicitly notes: "Skipped: This test requires interactive approval for non-whitelisted MCP servers"
- This suggests the test infrastructure doesn't support interactive approval flows

**Write-to-File Tests**:

- The test code shows extensive debugging logic trying to find files in multiple locations
- This suggests workspace path confusion was a real issue
- Tests may have been disabled while investigating the root cause

## Recommendations

### Priority 1: Quick Wins (Low Risk)

These tests are likely to work with minimal fixes:

1. **extension.test.ts** - ✅ Already passing
2. **task.test.ts** - ✅ Already passing
3. **modes.test.ts** - ✅ Already passing
4. **markdown-lists.test.ts** - ✅ Already passing

### Priority 2: Tool Tests (Medium Risk)

Re-enable tool tests one at a time:

1. **read_file** - Lowest risk, read-only operations
2. **list_files** - Low risk, read-only operations
3. **search_files** - Low risk, read-only operations
4. **write_to_file** - Medium risk, modifies filesystem
5. **apply_diff** - Medium risk, modifies files
6. **execute_command** - Higher risk, executes arbitrary commands

### Priority 3: Complex Tests (High Risk)

These require more investigation:

1. **subtasks** - Complex task orchestration
2. **use_mcp_tool** - Requires MCP server setup and may need interactive approval

## Action Plan

### Phase 1: Investigate (1-2 hours)

For each skipped test suite:

1. Remove `suite.skip()` temporarily
2. Run the test suite in isolation
3. Document the actual failure
4. Categorize the issue:
    - ✅ Works now (just re-enable)
    - 🔧 Simple fix needed (workspace path, timing, etc.)
    - 🐛 Bug in extension (needs code fix)
    - 🚧 Test needs rewrite (design issue)

### Phase 2: Fix Simple Issues (2-4 hours)

For tests that just need simple fixes:

1. Fix workspace path issues
2. Adjust timeouts
3. Update assertions
4. Re-enable tests

### Phase 3: Address Complex Issues (1-2 weeks)

For tests that need significant work:

1. Create GitHub issues for each category
2. Prioritize based on importance
3. Fix extension bugs if needed
4. Rewrite tests if needed
5. Re-enable incrementally

## Investigation Script

To systematically investigate each skipped test:

```bash
#!/bin/bash
# investigate-skipped-tests.sh

TESTS=(
    "read-file"
    "list-files"
    "search-files"
    "write-to-file"
    "apply-diff"
    "execute-command"
    "use-mcp-tool"
    "subtasks"
)

for test in "${TESTS[@]}"; do
    echo "========================================="
    echo "Testing: $test"
    echo "========================================="

    # Temporarily remove suite.skip() and run
    # (This would need to be done manually or with sed)

    TEST_FILE="$test.test" pnpm test:ci 2>&1 | tee "logs/$test-results.txt"

    echo ""
    echo "Results saved to logs/$test-results.txt"
    echo ""
done
```

## Expected Outcomes

After investigation and fixes:

- **Best case**: 30+ additional tests passing (total ~37 passing)
- **Realistic case**: 20-25 additional tests passing (total ~27-32 passing)
- **Worst case**: 10-15 additional tests passing (total ~17-22 passing)

Some tests may need to remain skipped if they:

- Test features that are deprecated
- Require infrastructure we don't have
- Are too expensive to run regularly
- Are fundamentally flaky

## Next Steps

1. ✅ **DONE**: Document why tests are skipped
2. **TODO**: Create investigation branch
3. **TODO**: Remove `suite.skip()` from one test suite at a time
4. **TODO**: Run and document failures
5. **TODO**: Categorize issues
6. **TODO**: Create GitHub issues for complex problems
7. **TODO**: Fix simple issues
8. **TODO**: Re-enable working tests
9. **TODO**: Update this document with findings

## Tracking Progress

| Test Suite      | Status     | Issue | Notes                       |
| --------------- | ---------- | ----- | --------------------------- |
| read_file       | ⏭️ Skipped | -     | Not yet investigated        |
| list_files      | ⏭️ Skipped | -     | Not yet investigated        |
| search_files    | ⏭️ Skipped | -     | Not yet investigated        |
| write_to_file   | ⏭️ Skipped | -     | Known workspace path issues |
| apply_diff      | ⏭️ Skipped | -     | Not yet investigated        |
| execute_command | ⏭️ Skipped | -     | Not yet investigated        |
| use_mcp_tool    | ⏭️ Skipped | -     | Requires MCP server setup   |
| subtasks        | ⏭️ Skipped | -     | Not yet investigated        |

Legend:

- ⏭️ Skipped
- 🔍 Investigating
- 🔧 Fixing
- ✅ Passing
- ❌ Failing (needs work)
- 🚫 Permanently disabled

## Resources

- [Mocha skip documentation](https://mochajs.org/#inclusive-tests)
- [VSCode test best practices](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- [Test flakiness guide](https://testing.googleblog.com/2016/05/flaky-tests-at-google-and-how-we.html)
