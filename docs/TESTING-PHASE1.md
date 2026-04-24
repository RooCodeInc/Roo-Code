# Phase 1 End-to-End Testing Guide

This guide helps you test the complete Phase 1 implementation: Intent Selection with Trace Entry Lookup.

## Automated Tests

Run the unit tests:

```bash
cd src
npx vitest run core/tools/__tests__/selectActiveIntentTool.spec.ts
```

The test suite verifies:

- ✅ Intent loading from `active_intents.yaml`
- ✅ Trace entry lookup from `agent_trace.jsonl`
- ✅ XML context generation with recent history
- ✅ Intent filtering (only relevant traces)
- ✅ Error handling for missing intents

## Manual Testing Workflow

### Step 1: Prepare Test Environment

1. **Ensure you have an intent in `active_intents.yaml`:**

```yaml
active_intents:
    - id: INT-001
      name: Test Intent
      status: IN_PROGRESS
      owned_scope:
          - src/test/**
      constraints:
          - Must follow test patterns
      acceptance_criteria:
          - All tests pass
```

2. **Create a test trace entry in `agent_trace.jsonl`:**

```json
{
	"id": "trace-1",
	"timestamp": "2026-02-18T10:00:00Z",
	"vcs": { "revision_id": "abc123" },
	"files": [
		{
			"relative_path": "src/test/file1.ts",
			"conversations": [
				{
					"url": "task-1",
					"contributor": { "entity_type": "AI", "model_identifier": "claude-3-5-sonnet" },
					"ranges": [{ "start_line": 10, "end_line": 20, "content_hash": "sha256:hash1" }],
					"related": [{ "type": "intent", "value": "INT-001" }]
				}
			]
		}
	]
}
```

### Step 2: Test Intent Selection

1. **Open VS Code with the Roo Code extension**
2. **Start a new chat/task**
3. **Ask the agent to select an intent:**

```
Please select intent INT-001
```

4. **Verify the agent calls `select_active_intent` tool**

### Step 3: Verify Context Injection

After the agent calls `select_active_intent`, check:

1. **The tool result should contain XML context:**

    - `<intent_id>INT-001</intent_id>`
    - `<intent_name>Test Intent</intent_name>`
    - `<owned_scope>`, `<constraints>`, `<acceptance_criteria>`
    - `<recent_history>` with trace entries

2. **The recent history should show:**
    - File paths from trace entries
    - Line ranges
    - Timestamps

### Step 4: Test Code Writing with Intent

1. **After intent selection, ask the agent to write code:**

```
Now create a test file in src/test/example.test.ts
```

2. **Verify:**
    - Agent can write code (intent is selected)
    - Post-hook logs trace entry to `agent_trace.jsonl`
    - New trace entry references INT-001

### Step 5: Test Trace Entry Lookup

1. **Select the same intent again:**

```
Select intent INT-001 again
```

2. **Verify:**
    - The `<recent_history>` now includes the file you just created
    - Shows the new trace entry with file path and line ranges

## Expected Behavior

### ✅ Success Flow

1. Agent calls `select_active_intent("INT-001")`
2. Tool loads intent from YAML ✅
3. Tool fetches trace entries from JSONL ✅
4. Tool returns XML context with intent + history ✅
5. Agent receives context and can write code ✅
6. Post-hook logs new trace entry ✅
7. Next intent selection includes new trace ✅

### ❌ Error Cases

1. **Missing Intent:**

    - Agent calls `select_active_intent("INT-999")`
    - Tool returns error: "Intent not found in active_intents.yaml"

2. **Missing Parameter:**

    - Agent calls `select_active_intent("")`
    - Tool returns missing parameter error

3. **No Trace Entries:**
    - Intent exists but no traces
    - XML shows: "No recent changes found for this intent"

## Verification Checklist

- [ ] Intent loads from `active_intents.yaml`
- [ ] Trace entries are fetched from `agent_trace.jsonl`
- [ ] XML context includes intent specification
- [ ] XML context includes recent history
- [ ] Trace entries are filtered by intent ID
- [ ] Recent entries are sorted (newest first)
- [ ] Task stores `activeIntentId` and `activeIntent`
- [ ] Error handling works for missing intents
- [ ] Code writing works after intent selection
- [ ] Post-hook logs new trace entries
- [ ] New traces appear in next intent selection

## Troubleshooting

### Issue: Trace entries not appearing

**Check:**

- `agent_trace.jsonl` exists and is readable
- Trace entries have `related` array with `type: "intent"` and matching `value`
- JSON is valid (one entry per line)

### Issue: Intent not found

**Check:**

- `active_intents.yaml` exists in `.orchestration/`
- YAML syntax is valid
- Intent ID matches exactly (case-sensitive)

### Issue: XML context missing history

**Check:**

- Trace entries reference the correct intent ID
- `getTraceEntriesForIntent()` is being called
- Trace entries have valid timestamps

## Next Steps

After verifying Phase 1 works:

1. ✅ Phase 1 Complete
2. Generate PDF report for interim submission
3. Document architectural decisions
4. Create diagrams of hook system
