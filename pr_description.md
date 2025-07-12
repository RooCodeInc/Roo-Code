## Description

Fixes #5496

This PR enhances the ToolRepetitionDetector to detect non-continuous repetitive tool call patterns (e.g., ABABAB) to prevent the AI from getting stuck in alternating tool call loops.

## Changes Made

- **Enhanced ToolRepetitionDetector**: Added pattern detection algorithm that identifies repeating sequences of tool calls beyond just consecutive repetitions
- **Pattern Detection Algorithm**: Implements detection for patterns of length 2-6 with configurable minimum repetitions (default: 2)
- **History Tracking**: Maintains a rolling history of the last 20 tool calls for pattern analysis
- **Backward Compatibility**: Preserves existing consecutive repetition detection behavior
- **Comprehensive Testing**: Added 15+ new test cases covering various pattern scenarios

## Technical Implementation

### Key Features:

- Detects patterns like AB-AB, ABC-ABC, ABCD-ABCD, etc.
- Configurable pattern length (2-6 tools) and minimum repetitions (default: 2)
- Efficient pattern matching using sliding window approach
- Proper serialization ensures tools with different parameters are treated as distinct
- State reset after detection to allow recovery

### Algorithm:

1. Maintains history of serialized tool calls
2. For each new tool call, checks for repeating patterns of various lengths
3. Uses backward pattern matching from the end of history
4. Triggers when minimum repetitions threshold is reached

## Testing

- **All existing tests pass**: Ensures backward compatibility
- **New pattern detection tests**: Cover ABAB, ABCABC, and complex patterns
- **Edge cases**: Different parameters, insufficient repetitions, mixed patterns
- **Integration tests**: Verify both consecutive and pattern detection work together

## Verification of Acceptance Criteria

- [x] **Pattern Detection**: Successfully detects non-continuous repetitions like ABABAB
- [x] **Configurable**: Pattern length and repetition thresholds are configurable
- [x] **Performance**: Efficient algorithm with bounded history (20 calls max)
- [x] **No False Positives**: Different tools/parameters don't trigger false detections
- [x] **Recovery**: State resets after detection to allow user guidance

## Example Scenarios Detected

```typescript
// These patterns will now be detected:
toolA -> toolB -> toolA -> toolB  // ABAB pattern
read_file(file1) -> write_file(file2) -> read_file(file1) -> write_file(file2)  // Real-world example
toolA -> toolB -> toolC -> toolA -> toolB -> toolC  // ABCABC pattern
```

## Files Changed

- `src/core/tools/ToolRepetitionDetector.ts` - Enhanced with pattern detection
- `src/core/tools/__tests__/ToolRepetitionDetector.spec.ts` - Added comprehensive tests

## Checklist

- [x] Code follows project style guidelines
- [x] Self-review completed
- [x] Comments added for complex logic
- [x] All existing tests pass
- [x] New tests added for pattern detection
- [x] No breaking changes
- [x] Performance considerations addressed
- [x] Backward compatibility maintained
