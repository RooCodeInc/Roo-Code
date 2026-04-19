# Phase 3 Integration Guide: Wiring Post-Hook

This guide covers integrating TraceLogger into the tool dispatcher to enable automatic trace logging for all write operations.

## Current State

- **Gatekeeper** (Pre-Hook): ✅ Active in `presentAssistantMessage.ts`
    - Blocks restricted tools without active intent
    - Returns XML context block
- **TraceLogger** (Utility): ✅ Ready in `src/core/intent/TraceLogger.ts`
    - All methods implemented and tested
    - Requires integration point to be triggered
- **Write Tool Schema**: ✅ Updated with intent_id and mutation_class parameters
    - Tools now include required fields for trace context

## Integration Points

### Option 1: Direct Integration in presentAssistantMessage.ts

1. **Import TraceLogger**:

```typescript
import { TraceLogger } from "@/core/intent/TraceLogger"
const traceLogger = new TraceLogger()
```

2. **Add Post-Hook After Tool Execution**:
   After successful tool result processing (around line where `pushToolResult()` is called):

```typescript
// Extract tool parameters
const toolParams = block.input
const intentId = toolParams.intent_id || intentHookEngine.getCurrentSessionIntent()
const mutationClass = toolParams.mutation_class

// For write_to_file tools specifically:
if (block.name === "write_to_file") {
	const filePath = toolParams.path
	const content = toolParams.content

	// Log to trace
	traceLogger.logTrace(
		intentId,
		filePath,
		content,
		mutationClass,
		messageInfo.id.requestId, // if available
	)
}
```

3. **Location**: After the tool result is successfully pushed, before moving to next tool block

### Option 2: Centralized Tool Dispatcher

Create a new module `src/core/tools/toolDispatcher.ts`:

```typescript
import { TraceLogger } from "@/core/intent/TraceLogger"
import { IntentHookEngine } from "@/core/intent/IntentHookEngine"

export class ToolDispatcher {
	private traceLogger: TraceLogger
	private intentHookEngine: IntentHookEngine

	constructor(intentHookEngine: IntentHookEngine) {
		this.traceLogger = new TraceLogger()
		this.intentHookEngine = intentHookEngine
	}

	async executeTool(toolName: string, toolParams: Record<string, any>) {
		// Pre-hook: gatekeeper validation
		const gate = this.intentHookEngine.gatekeeper(toolName)
		if (!gate.allowed) {
			throw new Error(gate.message)
		}

		// Execute tool...
		const result = await this.executeToolImpl(toolName, toolParams)

		// Post-hook: trace logging
		if (toolName === "write_to_file" && result.success) {
			this.traceLogger.logTrace(
				toolParams.intent_id,
				toolParams.path,
				toolParams.content,
				toolParams.mutation_class,
				this.getRequestId(),
			)
		}

		return result
	}

	private async executeToolImpl(toolName: string, toolParams: Record<string, any>) {
		// ... existing tool execution logic
	}
}
```

## Testing Integration

Once integrated, test with:

```bash
# Run integration test to verify trace logging
pnpm -w exec vitest run tests/phase3-integration.test.ts --run

# Check generated trace file
cat .orchestration/agent_trace.jsonl | jq '.'

# Query traces for specific intent
pnpm -w exec node -e "
  const { TraceLogger } = require('./src/core/intent/TraceLogger');
  const tl = new TraceLogger();
  console.log(JSON.stringify(tl.getTracesByIntent('intent-123'), null, 2))
"
```

## Verification Checklist

- [ ] TraceLogger imported without errors
- [ ] Post-hook executes after write_to_file completes
- [ ] Trace entries appear in `.orchestration/agent_trace.jsonl`
- [ ] content_hash matches SHA-256 of written content
- [ ] intent_id correctly populated from active session
- [ ] mutation_class correctly extracted from tool params
- [ ] Multiple entries append without overwriting
- [ ] Read/query methods work on generated files
- [ ] req_id optional parameter captured when available

## Minimal Integration (Quick Win)

If full dispatcher refactoring is too large, add this snippet to `presentAssistantMessage.ts` right after tool execution:

```typescript
// Add at top of file
import { TraceLogger } from "@/core/intent/TraceLogger"
const traceLogger = new TraceLogger()

// Add in tool block processing loop
if (toolName === "write_to_file" && success) {
	const params = block.input
	traceLogger.logTrace(params.intent_id, params.path, params.content, params.mutation_class)
}
```

## Schema Validation

Ensure tool schema is enforced before dispatch:

```typescript
// Validate intent_id and mutation_class are present
if (!toolParams.intent_id) {
	throw new Error("write_to_file requires intent_id parameter")
}
if (!["AST_REFACTOR", "INTENT_EVOLUTION"].includes(toolParams.mutation_class)) {
	throw new Error("write_to_file requires valid mutation_class")
}
```

## Performance Considerations

- TraceLogger uses synchronous file I/O (fs.appendFileSync)
- For high-volume writes, consider batching trace entries
- JSONL format doesn't require database; scales to millions of entries
- Consider async variant using fs.promises for I/O performance

## Rollback Plan

If issues arise:

1. Disable trace logging: Comment out `traceLogger.logTrace()` call
2. Archive trace file: `mv .orchestration/agent_trace.jsonl .orchestration/agent_trace.jsonl.bak`
3. Verify gatekeeper still works (it's independent of tracing)

## Future Enhancements

- [ ] Async file I/O for better performance
- [ ] Trace batching and flushing
- [ ] Integration with git hooks for verification
- [ ] Dashboard visualization of mutation timeline
- [ ] Trace encryption for sensitive operations
