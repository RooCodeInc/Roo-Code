# Real-World Conversation Fixtures

This directory contains real and synthetic conversation fixtures for testing condensation providers against actual usage patterns.

## Overview

The fixtures are organized into two categories:

- **Natural fixtures**: Real conversations from actual Roo usage
- **Synthetic fixtures**: Carefully crafted conversations to test specific scenarios

## Natural Fixtures

### 1. natural-already-condensed

**UUID**: Sourced from real task history  
**Size**: 827.36 KB (ui_messages.json) + 209.37 KB (api_conversation_history.json)  
**Message Count**: ~100+ messages  
**Status**: Already condensed by Native Provider

**Purpose**: Tests provider behavior on pre-condensed conversations.

**Expected Behaviors**:

- **Native Provider**: Should maintain current state (already condensed)
- **Lossless Provider**: Should apply deduplication without loss
- **Truncation Provider**: May truncate if limits exceeded

---

### 2. natural-mini-uncondensed

**UUID**: Sourced from real task history  
**Size**: 187.96 KB (ui_messages.json) + 158.23 KB (api_conversation_history.json)  
**Message Count**: ~50+ messages  
**Status**: Uncondensed (small conversation)

**Purpose**: Tests provider behavior on smaller, uncondensed real conversations.

**Expected Behaviors**:

- **Native Provider**: Should condense using current lossy logic
- **Lossless Provider**: Should preserve all information with deduplication
- **Truncation Provider**: Should pass through unchanged (under limits)

---

### 3. heavy-uncondensed

**UUID**: Sourced from real task history  
**Size**: 595.99 KB (ui_messages.json) + 323.03 KB (api_conversation_history.json)  
**Message Count**: ~150+ messages  
**Status**: Uncondensed (large conversation)

**Purpose**: **CRITICAL FIXTURE** - Demonstrates Native Provider's lossy behavior on heavy conversations.

**Expected Behaviors**:

- **Native Provider**: **EXTREMELY LOSSY** - Drops tool results, truncates content
- **Lossless Provider**: Preserves all content with intelligent deduplication
- **Truncation Provider**: May truncate older messages to meet limits

**Key Test**: This fixture validates our hypothesis that Native Provider is problematic for long conversations.

---

## Synthetic Fixtures

### 4. synthetic-1-heavy-write

**UUID**: c1a56910-6f61-41e4-b670-74bddbb94423  
**Size**: 353.50 KB (ui_messages.json) + 314.80 KB (api_conversation_history.json)  
**Message Count**: 184 messages  
**Tool Pattern**: Heavy write operations (20+ file writes with large content)

**Purpose**: Tests how providers handle large tool USE content (file write parameters).

**Test Scenario**:

- Created 20 test files with varying sizes (1KB to 100KB)
- 5 small files (1-2KB)
- 5 medium files (5-10KB)
- 5 large files (20-30KB)
- 5 extra-large files (50-100KB)

**Expected Behaviors**:

- **Native Provider**: May truncate large file content in tool parameters
- **Lossless Provider**: Should preserve file write content via deduplication
- **Truncation Provider**: May drop older writes when limits exceeded

---

### 5. synthetic-2-heavy-read

**UUID**: ad4ee186-82f6-4be6-9e4d-1206efc209dd  
**Size**: 959.86 KB total  
**Message Count**: 99 messages  
**Tool Pattern**: Heavy read operations (15+ large file reads)

**Purpose**: Tests how providers handle large tool RESULT content (file read responses).

**Test Scenario**:

- Read 15 large source files sequentially
- Files include: package.json, README.md, CHANGELOG.md, TypeScript sources
- Each read followed by analysis/questions

**Expected Behaviors**:

- **Native Provider**: **CRITICAL FAILURE POINT** - Likely drops large results
- **Lossless Provider**: Should deduplicate repeated file reads efficiently
- **Truncation Provider**: May truncate old results but preserve recent ones

**Key Test**: Validates that Lossless Provider handles large tool results better than Native.

---

### 6. synthetic-3-tool-dedup

**UUID**: e6a0e73c-430d-4b6f-b360-103b296268ef  
**Size**: 1.83 MB total  
**Message Count**: 318 messages  
**Tool Pattern**: Repeated tool calls with modified file tracking

**Purpose**: Tests deduplication capabilities and modified file detection.

**Test Scenario**:

- **Part 1**: Read package.json 10 times with different questions
- **Part 2**: Read 3 files (README, CHANGELOG, LICENSE) 5 times each
- **Part 3**: Create, read, modify, re-read cycle (3 iterations)

**Expected Behaviors**:

- **Native Provider**: No deduplication - keeps all repeated content
- **Lossless Provider**: **SHOWCASE FEATURE** - Deduplicates identical reads, tracks modified files
- **Truncation Provider**: No deduplication, truncates old content

**Key Test**: Demonstrates Lossless Provider's core value proposition.

---

### 7. synthetic-4-mixed-ops

**UUID**: 116162bd-21d0-4c55-8655-60d0555fa6de  
**Size**: 187.81 KB total  
**Message Count**: 122 messages  
**Tool Pattern**: Realistic mixed development workflow

**Purpose**: Simulates typical development patterns with diverse operations.

**Test Scenario**:

- **Phase 1**: Create 5 initial files (config, utils, types, index, README)
- **Phase 2**: Read and analyze created files
- **Phase 3**: Modify 2 files (utils.ts, types.ts)
- **Phase 4**: Re-read modified files
- **Phase 5**: Create 3 additional files (tests, CHANGELOG)

**Expected Behaviors**:

- **Native Provider**: Standard behavior across all operations
- **Lossless Provider**: Should optimize the entire workflow efficiently
- **Truncation Provider**: Should handle this moderate conversation easily

**Key Test**: Validates providers work correctly on realistic workflows.

---

## Provider Comparison Matrix

| Fixture                   | Native Behavior      | Lossless Behavior     | Truncation Behavior   |
| ------------------------- | -------------------- | --------------------- | --------------------- |
| natural-already-condensed | Maintains state      | Deduplicates further  | May truncate          |
| natural-mini-uncondensed  | Lossy condensation   | Lossless preservation | Pass-through          |
| heavy-uncondensed         | **VERY LOSSY** ⚠️    | Preserves + dedup     | Truncates old         |
| synthetic-1-heavy-write   | Truncates params     | Preserves via dedup   | Drops old writes      |
| synthetic-2-heavy-read    | **DROPS RESULTS** ⚠️ | Deduplicates reads    | Truncates old results |
| synthetic-3-tool-dedup    | No deduplication     | **OPTIMAL** ✓         | No dedup + truncate   |
| synthetic-4-mixed-ops     | Standard             | Efficient             | Handles well          |

## Testing Strategy

### Validation Goals

1. **Demonstrate Native Provider Problems**

    - Use `heavy-uncondensed` and `synthetic-2-heavy-read`
    - Measure information loss percentage
    - Show dropped tool results

2. **Validate Lossless Provider Benefits**

    - Use `synthetic-3-tool-dedup` for deduplication showcase
    - Compare token counts vs Native Provider
    - Verify zero information loss

3. **Confirm Truncation Provider Trade-offs**
    - Test all fixtures for consistent behavior
    - Verify recent context preservation
    - Measure performance benefits

### Performance Benchmarks

Each test should measure:

- **Token Count**: Before/after condensation
- **Compression Ratio**: % reduction
- **Information Preservation**: % of content retained
- **Processing Time**: Milliseconds per operation
- **Memory Usage**: Peak memory during condensation

### Expected Results

**Native Provider** (Current Baseline):

- ❌ Information loss on large conversations (30-50%)
- ❌ No deduplication (0% optimization)
- ✓ Fast (< 50ms per operation)
- ✓ Low memory (< 10MB)

**Lossless Provider** (Our Solution):

- ✓ Zero information loss (100% preservation)
- ✓ High deduplication (40-60% compression)
- ⚠️ Moderate speed (100-200ms per operation)
- ⚠️ Moderate memory (20-40MB)

**Truncation Provider** (Alternative):

- ⚠️ Controlled loss (keeps recent 80%)
- ❌ No deduplication (0% optimization)
- ✓ Very fast (< 30ms per operation)
- ✓ Very low memory (< 5MB)

## Test Implementation

See [`real-world.test.ts`](../../real-world.test.ts) for the actual test suite implementation that uses these fixtures.

## Maintenance Notes

### Adding New Fixtures

1. Create conversation naturally or synthetically
2. Copy task directory to `real-conversations/`
3. Verify presence of required files:
    - `task_metadata.json`
    - `api_conversation_history.json`
    - `ui_messages.json`
4. Update this FIXTURES.md with fixture details
5. Add test cases in `real-world.test.ts`

### Fixture Validation

All fixtures must have:

- Complete conversation files (no truncation)
- Valid JSON structure
- Realistic message patterns
- Documented purpose and expected behaviors

---

**Last Updated**: 2025-10-03  
**Total Fixtures**: 7 (3 natural + 4 synthetic)  
**Total Size**: ~4.2 MB
