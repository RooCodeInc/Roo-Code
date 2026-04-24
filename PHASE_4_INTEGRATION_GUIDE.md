# Phase 4 Integration Guide: Wiring Concurrency & Lessons

This guide covers integrating ConcurrencyGuard and append_lesson_to_claude into the tool dispatcher for full Phase 4 functionality.

## Current State Summary

- **ConcurrencyGuard**: ✅ Implemented and tested (16 tests passing)
- **append_lesson_to_claude**: ✅ Implemented and tested (16 tests passing)
- **write_to_file schema**: ✅ Updated with read_hash parameter
- **Tool registration**: ✅ append_lesson_to_claude registered

**What's missing**: Integration into tool dispatcher execution flow

## Integration Architecture

```
Tool Execution Flow (Target)

1. read_file() called
   ├─ Get file content
   └─ recordSnapshot(filePath, content, turnId, intentId)
      └─ Persisted to .orchestration/concurrency_snapshots.jsonl

2. Agent processes file (can happen in parallel with other agents)

3. write_to_file(path, content, intent_id, mutation_class, read_hash) called
   ├─ Pre-hook: verifyBeforeWrite(path)
   │  ├─ If snapshot exists: compare hashes
   │  ├─ If STALE_FILE error: return and block write
   │  └─ If OK: proceed with write
   ├─ Execute: fs.writeFileSync(path, content)
   └─ Post-hook: clearSnapshot(path)

4. Verification fails (lint/test)
   └─ append_lesson_to_claude(lesson_text)
      └─ Write to CLAUDE.md with timestamp
```

## Implementation: Phase 4a - ConcurrencyGuard in read_file

### Location: Tool dispatcher for read_file

```typescript
// In the tool executor for read_file:

import { ConcurrencyGuard } from "@/core/intent/ConcurrencyGuard"
import { v4 as uuidv4 } from "uuid" // or use existing turnId

const concurrencyGuard = new ConcurrencyGuard()
const currentTurnId = messageInfo.id.turnId || uuidv4() // Unique per agent turn
const currentIntentId = intentHookEngine.getCurrentSessionIntent()

// After successfully reading file:
const fileContent = fs.readFileSync(filePath, "utf8")
concurrencyGuard.recordSnapshot(
  filePath,
  fileContent,
  currentTurnId,
  currentIntentId // optional
)

return {
  content: fileContent,
  note: "File snapshot recorded for concurrency control"
}
```

### Integration Point Example

In `src/core/prompts/tools/native-tools/read_file.ts` (or dispatcher):

```typescript
// Add imports
import { ConcurrencyGuard } from "@/core/intent/ConcurrencyGuard"

// Create guard instance (singleton or per-turn)
let concurrencyGuard: ConcurrencyGuard

function initializeGuard() {
  if (!concurrencyGuard) {
    concurrencyGuard = new ConcurrencyGuard()
  }
  return concurrencyGuard
}

// In read file handler:
export async function readFile(params: ReadFileParams) {
  const filePath = params.path
  const content = fs.readFileSync(filePath, "utf8")

  // Record snapshot for later concurrency verification
  const guard = initializeGuard()
  guard.recordSnapshot(
    filePath,
    content,
    params.turnId || "default-turn",
    params.intentId // from current session
  )

  return { content }
}
```

## Implementation: Phase 4b - Verify Before Write

### Location: write_to_file tool handler pre-execution

```typescript
// In write_to_file handler (before fs.writeFileSync):

import { ConcurrencyGuard } from "@/core/intent/ConcurrencyGuard"

const concurrencyGuard = new ConcurrencyGuard()

function executeWriteToFile(params: WriteFileParams): void {
  const filePath = params.path
  const content = params.content

  // Phase 4: Check for stale file before write
  const error = concurrencyGuard.verifyBeforeWrite(filePath)
  if (error) {
    // STALE_FILE error detected
    return {
      error: true,
      type: error.type,
      message: error.message,
      details: {
        file_path: error.file_path,
        expected_hash: error.expected_hash,
        current_hash: error.current_hash,
      },
      resolution: error.resolution, // "Please re-read the file using read_file..."
    }
  }

  // Write is safe, proceed
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, "utf8")

  // Phase 3: Log to trace
  const traceLogger = new TraceLogger()
  traceLogger.logTrace(
    params.intent_id,
    filePath,
    content,
    params.mutation_class,
    messageInfo.id.requestId
  )

  // Phase 4: Clear snapshot after successful write
  concurrencyGuard.clearSnapshot(filePath)

  return { success: true, path: filePath }
}
```

## Implementation: Phase 4c - Append Lesson on Verification Failure

### Location: Verification handler (lint/test executor)

```typescript
// In verification step handler (e.g., lint, test runner):

import { appendLessonToClaude } from "@/core/tools/append_lesson_to_claude"

async function runLintVerification(filePath: string) {
  try {
    const result = await execLint(filePath)
    
    if (!result.success) {
      // Lint failed, record lesson
      const lessonText = `**Context**: Verification step: Lint check on ${path.basename(filePath)}
**Failure**: ESLint warnings exceeded threshold:
${result.violations.map((v) => `- ${v.rule}: ${v.message}`).join("\n")}

**Resolution**: ${result.suggestedFix || "Review and fix linting violations"}`

      const lessonResult = await appendLessonToClaude(lessonText)
      console.log(`Lesson recorded: ${lessonResult.message}`)

      return {
        success: false,
        message: result.message,
        lesson_recorded: true,
        lesson_path: lessonResult.path,
      }
    }

    return { success: true }
  } catch (err) {
    // Handle unexpected errors
    const lessonText = `**Context**: Verification step: Lint execution failed on ${filePath}
**Failure**: ${err instanceof Error ? err.message : String(err)}
**Resolution**: Check ESLint configuration and file permissions`

    await appendLessonToClaude(lessonText)

    throw err
  }
}
```

### Verification Context Examples

```typescript
// Type check failure
async function runTypeChecker(files: string[]) {
  try {
    return await execTypescript(files)
  } catch (err) {
    const lessonText = `**Context**: TypeScript compilation on ${files.length} files
**Failure**: ${err.message}
**Resolution**: Add proper type definitions to function parameters and return types`
    
    await appendLessonToClaude(lessonText)
    throw err
  }
}

// Test failure
async function runTests() {
  const result = await execVitest()
  
  if (result.failed > 0) {
    const lessonText = `**Context**: Vitest suite (${result.total} tests)
**Failure**: ${result.failed} tests failed:
${result.failures.map((f) => `- ${f.test}: ${f.error}`).join("\n")}

**Resolution**: Fix failing tests and verify all assertions pass`

    await appendLessonToClaude(lessonText)
  }

  return result
}
```

## Integration Checklist

- [ ] **Step 1: Import ConcurrencyGuard in tool dispatcher**
  - [ ] Add import statement
  - [ ] Create singleton or per-turn instance
  - [ ] Test initialization

- [ ] **Step 2: Hook recordSnapshot into read_file**
  - [ ] After file content retrieved
  - [ ] Pass turnId and intentId
  - [ ] Test snapshot creation in .orchestration dir

- [ ] **Step 3: Hook verifyBeforeWrite into write_to_file**
  - [ ] Extract read_hash from tool params
  - [ ] Call verifyBeforeWrite before fs.writeFileSync
  - [ ] Return STALE_FILE error on conflict
  - [ ] Test conflict detection with manual file modification

- [ ] **Step 4: Hook clearSnapshot after successful write**
  - [ ] Call clearSnapshot(path) post-write
  - [ ] Test snapshot cleanup via getSnapshot returning undefined

- [ ] **Step 5: Integrate TraceLogger post-hook (Phase 3)**
  - [ ] Call traceLogger.logTrace after write success
  - [ ] Use mutation_class from tool params
  - [ ] Test trace entries in agent_trace.jsonl

- [ ] **Step 6: Integrate append_lesson_to_claude**
  - [ ] Hook into lint verification handler
  - [ ] Hook into test verification handler
  - [ ] Hook into type check handler
  - [ ] Test lesson creation in CLAUDE.md

- [ ] **Step 7: Test end-to-end flow**
  - [ ] Agent A reads file → snapshot
  - [ ] Agent B reads file → snapshot
  - [ ] Agent A writes file → success, snapshot cleared
  - [ ] Agent B tries write → STALE_FILE error
  - [ ] Agent B re-reads → new snapshot
  - [ ] Agent B writes → success

- [ ] **Step 8: Test failure lesson recording**
  - [ ] Run verification that fails
  - [ ] Check CLAUDE.md for new entry
  - [ ] Verify timestamp and context recorded

## Minimal Implementation (Quick Win)

If full integration is complex, start with:

```typescript
// 1. In write_to_file handler only:
const guard = new ConcurrencyGuard()
const error = guard.verifyBeforeWrite(filePath)
if (error) return error

// 2. In linter handler:
if (lintFailed) {
  await appendLessonToClaude(`**Context**: Lint failed\n**Failure**: ${msg}\n**Resolution**: Fix violations`)
}
```

This provides core concurrency safety + lesson recording with minimal changes.

## Testing Integration

After wiring, verify:

```bash
# Test 1: Snapshot recording
git checkout tmp-file.ts  # Create a tracked file
echo "test" > tmp-file.ts
node -e "
  const { ConcurrencyGuard } = require('./src/core/intent/ConcurrencyGuard');
  const guard = new ConcurrencyGuard();
  guard.recordSnapshot('tmp-file.ts', 'test', 'test-turn');
  console.log('Snapshot:', guard.getSnapshot('tmp-file.ts'));
"
# Expected: Snapshot object with read_hash, turn_id, timestamp

# Test 2: Stale file detection
echo "modified" > tmp-file.ts
node -e "
  const { ConcurrencyGuard } = require('./src/core/intent/ConcurrencyGuard');
  const guard = new ConcurrencyGuard();
  guard.recordSnapshot('tmp-file.ts', 'test', 'test-turn');
  const error = guard.verifyBeforeWrite('tmp-file.ts');
  console.log('Error:', error?.type); // Should be 'STALE_FILE'
"

# Test 3: Lesson recording
node -e "
  const { appendLessonToClaude } = require('./src/core/tools/append_lesson_to_claude');
  appendLessonToClaude('**Context**: Test lesson\n**Failure**: Demo\n**Resolution**: Works!').then(r => console.log(r));
"
# Expected: success: true, message contains "Lesson recorded"
```

## Performance Targets

After integration, monitor:

| Metric | Target | Notes |
|--------|--------|-------|
| recordSnapshot latency | < 5ms | Per read operation |
| verifyBeforeWrite latency | < 2ms | Per write operation |
| Conflict detection accuracy | 100% | Hash matching |
| lesson append latency | < 10ms | Per failure |
| Snapshot log size | < 1MB per 1k operations | JSONL compression |

## Troubleshooting

### Issue: "Cannot find module ConcurrencyGuard"
- **Fix**: Ensure import path is correct: `@/core/intent/ConcurrencyGuard`
- **Check**: File exists at `src/core/intent/ConcurrencyGuard.ts`

### Issue: "Snapshot not persisting"
- **Fix**: Ensure `.orchestration` directory is writable
- **Check**: `fs.existsSync(".orchestration")` returns true after recordSnapshot

### Issue: "STALE_FILE error not being returned"
- **Fix**: Verify read_hash is being passed to write_to_file
- **Check**: Tool params include read_hash field

### Issue: "CLAUDE.md not being created"
- **Fix**: Ensure current working directory is writable
- **Check**: `fs.existsSync("CLAUDE.md")` after appendLessonToClaude

## Rollback Plan

If issues arise:

1. **Disable concurrency checks** (optional):
   ```typescript
   // In verifyBeforeWrite pre-hook:
   if (FEATURE_FLAG_DISABLE_CONCURRENCY_CHECKS) {
     return null // Skip verification
   }
   ```

2. **Disable lesson recording**:
   ```typescript
   // In verification handler:
   if (FEATURE_FLAG_DISABLE_LESSON_RECORDING) {
     return {success: !result.failed} // Skip lesson append
   }
   ```

3. **Archive logs**:
   - Backup `.orchestration/concurrency_snapshots.jsonl`
   - Backup `CLAUDE.md`

## Future Enhancements

- [ ] Async snapshot recording for high concurrency
- [ ] Batch snapshot writes (max 100 per flush)
- [ ] Distributed snapshot store (cloud backup)
- [ ] Dashboard visualization of conflicts
- [ ] Auto-parsing of verification output
- [ ] Lesson similarity clustering
- [ ] Agent activity timeline
