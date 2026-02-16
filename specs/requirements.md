# Requirements - Intent-Code Traceability & Governed Agent

## Intent Handshake & Context Injection

### REQ-INT-001 Intent Checkout
- The agent MUST NOT write code before selecting an active intent via `select_active_intent(intent_id)`.

### REQ-INT-002 Mandatory Tool Call
- For every user request that may mutate the workspace, the agent SHALL call `select_active_intent(intent_id)` as the first tool action.

### REQ-INT-003 Gatekeeper Enforcement
- The hook engine MUST block execution if the agent fails to declare a valid `intent_id`.

### REQ-INT-004 Context Loader
- The pre-hook SHALL load intent scope, constraints, and recent trace history for the selected intent.

### REQ-INT-005 Context Injection Format
- The tool result for `select_active_intent` MUST return a bounded context payload formatted as:
- `<intent_context> ... </intent_context>`
- containing only scope, constraints, and relevant recent history.

## Hook Middleware & Security Boundary

### REQ-HOOK-001 Middleware Interception
- The hook engine SHALL intercept all tool execution requests.

### REQ-HOOK-002 Pre/Post Hooks
- The hook engine SHALL support PreToolUse and PostToolUse phases for each tool call.

### REQ-HOOK-003 Command Classification
- The hook engine MUST classify commands as SAFE (read-only) or DESTRUCTIVE (write/delete/execute).

### REQ-HOOK-004 Human-in-the-Loop Authorization
- For DESTRUCTIVE actions, the pre-hook MUST require explicit user approval (Approve/Reject).

### REQ-HOOK-005 Autonomous Recovery
- If rejected, the system MUST return a standardized JSON tool-error to the agent so it can self-correct without crashing.

## Scope Enforcement

### REQ-SCOPE-001 Owned Scope Enforcement
- The pre-hook for write operations MUST verify the target file path matches the `owned_scope` of the active intent.

### REQ-SCOPE-002 Scope Violation Response
- On violation, the system MUST block the write and return:
- `Scope Violation: <intent_id> is not authorized to edit <filename>. Request scope expansion.`

## AI-Native Git Layer (Traceability)

### REQ-TRACE-001 Append-only Ledger
- The system MUST append a trace entry to `.orchestration/agent_trace.jsonl` after each successful write.

### REQ-TRACE-002 Spatial Independence
- The trace MUST store content hashes for modified ranges such that the trace remains valid if code lines move.

### REQ-TRACE-003 Related Requirement Link
- Each trace entry MUST link the change to at least one requirement ID (REQ-*) and the selected intent ID.

### REQ-TRACE-004 Mutation Classification
- Each write MUST be classified as one of:
- `AST_REFACTOR` (intent preserved)
- `INTENT_EVOLUTION` (new feature / intent expansion)

## Parallel Orchestration

### REQ-CONC-001 Optimistic Locking
- Before write, the system MUST compare the on-disk file hash to the hash observed at the start of the agent turn.

### REQ-CONC-002 Stale File Protection
- If hashes differ, the system MUST block the write and return a "Stale File" error requiring re-read.

### REQ-KB-001 Shared Brain Updates
- The system SHALL support appending "Lessons Learned" to `AGENT.md` or `CLAUDE.md` when verification loops fail (tests/lints).