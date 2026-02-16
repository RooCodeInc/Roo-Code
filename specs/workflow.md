# Workflow - Deterministic Execution Flow

## State 1 - Request
- User provides a task request (e.g., "Refactor auth middleware.")

## State 2 - Reasoning Intercept (Handshake)

### REQ-WF-001 Mandatory Intent Selection
- The agent MUST analyze the request and call `select_active_intent(intent_id)`.

### REQ-WF-002 Pre-Hook Pause
- The pre-hook MUST intercept `select_active_intent` and pause the execution loop.

### REQ-WF-003 Context Assembly
- The hook SHALL query the data model for:
- selected intent constraints
- owned_scope
- recent trace history

### REQ-WF-004 Context Return
- The hook MUST return `<intent_context>` as the tool result.

## State 3 - Contextualized Action

### REQ-WF-005 Mutation Allowed
- Only after successful context injection, the agent may call write tools.

### REQ-WF-006 Post-Hook Trace
- After write, post-hook MUST compute content_hash and append to `agent_trace.jsonl`.