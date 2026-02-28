# Phase 5 Implementation: Human-In-The-Loop Approval and Scope Enforcement

**Date**: 2026-02-20  
**Status**: COMPLETE  
**Version**: 1.0

## Overview

Phase 5 introduces human-in-the-loop approval workflows and scope enforcement to prevent agents from drifting outside approved intent boundaries. This phase builds on Phases 1-4 to create a comprehensive orchestration system where:

1. **Agents submit critical changes for human review** before execution
2. **Scope boundaries are enforced** to prevent unintended code modifications
3. **Human overrides are audited** with full decision trails
4. **Approvals are logged** for compliance and ML training

## Goals Achievement

### Goal 1: Require Human Approval for Critical Changes ✅
**Implementation**: `ApprovalManager` with `request_human_approval` tool

- Agent proposes change with summary + diff
- Tool blocks execution pending human approval
- Decisions recorded in `approval_log.jsonl` with metadata
- Supports approval notes and override flags

### Goal 2: Enforce Scope Boundaries ✅
**Implementation**: `ScopeValidator` integrated with `IntentHookEngine`

- Validate proposed changes align with `owned_scope`
- Block out-of-scope changes unless explicitly overridden
- Support exact paths, directory patterns, and glob matching
- Return detailed error information for rejected changes

### Goal 3: Integrate Approval into Orchestration ✅
**Implementation**: Extended `IntentHookEngine` with approval coordination

- Scope validation happens before write operations
- Out-of-scope changes trigger approval workflow
- Override decisions are recorded and auditable
- Full integration with existing intent context system

## Architecture

### Component Hierarchy

```
IntentHookEngine (Orchestrator)
├── gatekeeper() - Restrict tool access to active intents
├── validateScope() - Check files against owned_scope
├── requestApprovalForOutOfScope() - Trigger approval workflow
├── recordApprovalDecision() - Log human decisions
├── getPendingApprovals() - Query approval status
└── isFileInScope() - Single file validation

ApprovalManager (Approval Workflow)
├── createRequest() - Create approval request
├── submitForApproval() - Block until decision (async)
├── recordDecision() - Log human approval
├── getPendingRequests() - Query pending approvals
├── getDecision() - Get decision by request_id
├── isApproved() - Check approval status
├── requiresOverride() - Check if override required
└── Query API (by intent_id, turn_id, all entries)

ScopeValidator (Scope Matching)
├── isPathInScope() - Single file validation
├── arePathsInScope() - Multiple files validation
├── extractFilesFromDiff() - Parse diff for affected files
└── matchesPattern() - Internal glob matching logic
```

## Core Files

### 1. ApprovalManager.ts (~270 lines)
**Location**: `src/core/intent/ApprovalManager.ts`

Manages the complete approval workflow:

```typescript
// Create approval request
const request = ApprovalManager.createRequest(
  changeSummary,
  diff,
  filesAffected,
  intentId,
  turnId
);

// Submit for approval (blocks until decision)
const decision = await approvalManager.submitForApproval(request);

// Record human decision
approvalManager.recordDecision(
  requestId,
  approved,       // true/false
  approver,       // email or name
  notes,          // optional human notes
  requiresOverride // true if scope override needed
);

// Query API
approvalManager.isApproved(requestId);
approvalManager.getApprovalsByIntent(intentId);
approvalManager.getApprovalsByTurn(turnId);
```

**Data Structures**:
- `ApprovalRequest`: Proposal with change details
- `ApprovalDecision`: Human decision with approver info
- `ApprovalLogEntry`: Combined request + decision

**Persistence**: `approval_log.jsonl` (append-only JSONL format)

### 2. ScopeValidator.ts (~180 lines)
**Location**: `src/core/intent/ScopeValidator.ts`

Validates file paths against intent scope patterns:

```typescript
// Single file validation
const result = ScopeValidator.isPathInScope("src/auth/middleware.ts", [
  "src/auth/",
  "src/services/auth.ts"
]);

// Multiple files validation
const result = ScopeValidator.arePathsInScope(files, ownedScope);

// Extract files from diff
const files = ScopeValidator.extractFilesFromDiff(unifiedDiff);

// Supported scope patterns:
// - Exact file: "src/auth/middleware.ts"
// - Directory: "src/auth/" (trailing slash)
// - Single wildcard: "src/*/hooks.ts"
// - Recursive wildcard: "src/**/hooks.ts"
```

**Returns**:
```typescript
interface ScopeValidationResult {
  isWithinScope: boolean;
  reason?: string;
  allowedPaths?: string[];
  attemptedPath?: string;
}
```

### 3. IntentHookEngine.ts (~300 lines)
**Location**: `src/core/intent/IntentHookEngine.ts`

Extended intent orchestrator with approval and scope integration:

```typescript
// Scope validation (pre-hook)
const result = engine.validateScope(["file1.ts", "file2.ts"]);

// Single file check
if (!engine.isFileInScope("src/auth/hooks.ts")) {
  // File is out of scope
}

// Request approval for out-of-scope change
const approval = await engine.requestApprovalForOutOfScope(
  changeSummary,
  diff,
  filesAffected,
  outOfScopeFiles
);

// Record approval decision
engine.recordApprovalDecision(
  requestId,
  approved,
  approver,
  notes,
  requiresOverride
);

// Query approvals
const pending = engine.getPendingApprovals();
const intents = engine.getIntentApprovals("INT-001");
```

### 4. request_human_approval.ts (~100 lines)
**Location**: `src/core/prompts/tools/native-tools/request_human_approval.ts`

Tool schema and implementation for agent use:

```typescript
// Agent calls this tool
await request_human_approval({
  change_summary: "Add emergency bypass",
  diff: "unified diff content",
  files_affected: ["src/security/bypass.ts"],
  intent_id: "INT-001" // optional, for audit trail
});

// Tool blocks execution until human approves
// Result includes request_id for polling approval status
```

**Result**:
```typescript
{
  success: boolean;
  request_id: string;
  status: "pending" | "approved" | "rejected";
  message: string;
}
```

## Data Model

### approval_log.jsonl Structure

```jsonl
{"request_id":"approval-1708425600000-abcd1234","timestamp":"2026-02-20T12:00:00Z","change_summary":"Refactor auth module to use JWT","diff":"--- a/src/auth/middleware.ts\n+++ b/src/auth/middleware.ts","files_affected":["src/auth/middleware.ts","src/services/auth.ts"],"intent_id":"INT-001","turn_id":"turn-123","logged_at":"2026-02-20T12:00:00Z"}
{"request_id":"approval-1708425600000-abcd1234","timestamp":"2026-02-20T12:00:05Z","decision":{"request_id":"approval-1708425600000-abcd1234","approved":true,"approver":"alice@example.com","approver_notes":"Approved after verification","requires_override":false,"timestamp":"2026-02-20T12:00:05Z"},"logged_at":"2026-02-20T12:00:05Z"}
```

**Key Fields**:
- `request_id`: Unique identifier for approval request
- `timestamp`: When request was created (ISO 8601)
- `change_summary`: Human-readable description for approver
- `diff`: Full unified diff of proposed changes
- `files_affected`: Array of file paths to be modified
- `intent_id`: Associated intent (optional, for audit trail)
- `turn_id`: Associated turn/session (optional)
- `decision.approved`: True/false approval status
- `decision.approver`: Email or name of human approver
- `decision.approver_notes`: Optional notes from approver
- `decision.requires_override`: Flag for scope override

## Workflow: Approval Flow

```
Agent Proposes Change (write_file with out-of-scope files)
  ↓
IntentHookEngine.validateScope() → OUT_OF_SCOPE
  ↓
IntentHookEngine.requestApprovalForOutOfScope()
  ↓
Agent calls request_human_approval tool
  ↓
ApprovalManager creates request, logs to approval_log.jsonl
  ↓
Approval Service polls approval_log.jsonl OR receives webhook
  ↓
Human reviews in UI, approves/rejects with notes
  ↓
Approval Service calls recordApprovalDecision()
  ↓
Decision logged to approval_log.jsonl
  ↓
submitForApproval() unblocks, returns decision
  ↓
Agent conditionally proceeds or retries with scope adjustment
  ↓
AgentTrace logs final outcome
```

## Scope Validation Examples

### Example 1: Exact Path Match
```yaml
# active_intents.yaml
owned_scope:
  - src/auth/middleware.ts

# Valid:
✓ src/auth/middleware.ts

# Invalid:
✗ src/auth/handlers.ts
✗ src/auth/middleware.js
```

### Example 2: Directory Pattern
```yaml
# active_intents.yaml
owned_scope:
  - src/auth/
  - tests/auth/

# Valid:
✓ src/auth/...any nested file
✓ tests/auth/hooks.test.ts
✓ src/auth/strategies/jwt.ts

# Invalid:
✗ src/services/auth.ts
✗ src/auth-v2/...
```

### Example 3: Glob Patterns
```yaml
# active_intents.yaml
owned_scope:
  - src/**/hooks.ts    # matches deeply nested
  - tests/*/test.ts    # matches one level

# src/**/hooks.ts Valid:
✓ src/auth/hooks.ts
✓ src/auth/strategies/jwt/hooks.ts
✓ src/config/hooks.ts

# src/**/hooks.ts Invalid:
✗ src/hooks.ts        # Must have at least one directory
✗ src/auth/handler.ts

# tests/*/test.ts Valid:
✓ tests/auth/test.ts
✓ tests/config/test.ts

# tests/*/test.ts Invalid:
✗ tests/auth/unit/test.ts    # Too many levels
✗ tests/test.ts              # No middle directory
```

## Testing

### Test Coverage: 32 Tests (16 approval + 16 scope)

#### Approval Tests (phase5-approval.test.ts)
1. Create approval request with required fields
2. Generate unique request IDs
3. Log approval request to JSONL
4. Store pending approval requests
5. Retrieve all pending requests
6. Record human approval decision
7. Record human rejection decision
8. Record override status in decision
9. Persist decisions to JSONL
10. Query approvals by intent ID
11. Query approvals by turn ID
12. Retrieve all approval log entries
13. Handle concurrency with multiple requests
14. Validate approval request timestamp
15. Validate decision timestamp
16. Clear all approvals properly

#### Scope Tests (phase5-scope.test.ts)
1. Match exact file paths
2. Match directory patterns (trailing slash)
3. Match deeply nested files
4. Reject files outside scope
5. Handle multiple scope entries
6. Validate multiple file paths
7. Reject if any file is out of scope
8. Normalize Windows paths
9. Match wildcard patterns
10. Match recursive wildcard patterns
11. Extract files from unified diff
12. Extract multiple files from diff
13. Handle git-style diff headers
14. Validate files within intent scope
15. Block files outside intent scope
16. Integration: Gatekeeper with scope

**Run Tests**:
```bash
npm test -- phase5-approval.test.ts
npm test -- phase5-scope.test.ts
```

## Integration Points

### 1. With write_to_file Tool
```typescript
// Pre-hook: Validate scope before write
const validation = engine.validateScope(affectedFiles);
if (!validation.isWithinScope) {
  // Trigger approval workflow
  const approval = await engine.requestApprovalForOutOfScope(...);
  if (!approval.approved) {
    throw new Error("OUT_OF_SCOPE: Change rejected by human approver");
  }
}
```

### 2. With System Prompt
Add to system instructions:
```text
**Scope Enforcement**: Before calling write_file or apply_diff:
1. Use request_human_approval if files are outside intent scope
2. Wait for human approval decision
3. If rejected, modify proposal to fit scope boundaries
4. Document any override decisions in change summary
```

### 3. With Active Intents
```yaml
# .orchestration/active_intents.yaml
active_intents:
  - id: INT-001
    name: Refactor Auth Middleware
    status: active
    owned_scope:
      - src/auth/
      - src/services/auth.ts
      - tests/auth/
    constraints: [...]
    acceptance_criteria: [...]
```

## Security Considerations

### Prevention Mechanisms
1. **Scope Gating**: Agents cannot write outside `owned_scope` without explicit approval
2. **Audit Trail**: All approval decisions logged with approver identity and timestamp
3. **Override Tracking**: Explicit flag for scope overrides for compliance review
4. **No Implicit Bypass**: Override requires human decision on record

### Compliance
- **SOC 2**: Approval decisions create audit trail
- **HIPAA**: Human oversight required for critical system changes
- **GDPR**: Approver identity and decision tracked for accountability

## Performance Characteristics

- **Scope Validation**: O(n) where n = number of scope patterns
- **File Extraction from Diff**: O(m) where m = number of diff lines
- **Approval Logging**: O(1) appends to JSONL
- **Query by Intent**: O(k) where k = total entries in approval_log.jsonl

**Typical Latencies**:
- Scope validation: < 1ms (in-memory pattern matching)
- Approval submission: network latency to approval service
- Approval decision polling: configurable poll interval (default 100ms)

## Troubleshooting

### Issue: "Out-of-Scope" blocks legitimate changes
**Solution**: Review `owned_scope` patterns in active_intents.yaml. Ensure glob patterns are correct.

### Issue: Approval requests not appearing in log
**Solution**: Verify `.orchestration/approval_log.jsonl` exists and approvalManager is instantiated.

### Issue: Human approval blocking too long
**Solution**: Implement webhook-based approval instead of polling. Update `submitForApproval()` to use event-driven model.

## Future Enhancements

1. **Approval UI**: Web interface for human reviewers (Phase 6?)
2. **Approval Routing**: Route approvals to specialized teams (auth → security team)
3. **SLA Tracking**: Monitor approval decision latency
4. **ML Integration**: Learn scope patterns from engineer approval patterns
5. **Auto-Approval**: For routine, low-risk changes within high-confidence bounds

## References

- [Phase 1 Handshake](./PHASE_1_IMPLEMENTATION.md)
- [Phase 3 Trace Logging](./PHASE_3_IMPLEMENTATION.md)
- [Phase 4 Concurrency](./PHASE_4_IMPLEMENTATION.md)
- [Intent Hook Engine Architecture](./ARCHITECTURE_NOTES.md)

---

**Implementation Complete**: All components tested and integrated.  
**Ready for**: Phase 6 integration into UI and approval service.
