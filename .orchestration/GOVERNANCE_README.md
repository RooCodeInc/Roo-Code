# Governance Cycle Artifacts - Complete Reference

**Generated**: 2026-02-20  
**Intent**: INT-001 (Add Feature to hello.js)  
**Status**: COMPLETED  
**Governance Model**: Human-In-The-Loop (HITL) Approval

## Overview

This directory contains the complete governance artifacts demonstrating a full end-to-end orchestration cycle through all 5 phases of the Roo-Code governance framework.

### Directory Contents

```
.orchestration/
├── active_intents.yaml          # Intent definitions & lifecycle
├── agent_trace.jsonl            # Code mutation tracking with hashes
├── approval_log.jsonl          # HITL approval decisions
├── intent_map.md               # Intent-to-implementation mapping
├── status_log.jsonl            # Status transition audit trail
└── GOVERNANCE_README.md        # This file
```

## Artifact Descriptions

### 1. active_intents.yaml

**Purpose**: Central registry of all active intents with scope boundaries

```yaml
active_intents:
  - id: INT-001
    name: Add Feature to hello.js
    status: COMPLETED  # Progressed: PENDING → IN_PROGRESS → COMPLETED
    owned_scope:
      - src/**/*.js                    # Primary scope
      - tests/**/hello.test.js         # Test scope
    constraints:                       # Implementation guardrails
      - Must preserve backward compatibility
      - Add proper JSDoc comments
      - All tests must pass
    acceptance_criteria:               # Definition of done
      - Function executes without errors
      - Lint check passes
      - Unit tests pass
      - No out-of-scope modifications
```

**Key Fields**:
- `id`: Unique intent identifier (INT-001)
- `status`: Current lifecycle state (COMPLETED)
- `owned_scope`: Glob patterns defining modification boundaries
- `constraints`: Implementation requirements
- `acceptance_criteria`: Completeness validation

**Phase Integration**: Phase 1 (Handshake)

---

### 2. agent_trace.jsonl

**Purpose**: Immutable audit trail of code mutations with cryptographic verification

**Sample Entry**:
```json
{
  "intent_id": "INT-001",
  "path": "src/hello.js",
  "sha256": "c4fbb1500d106baea3361c209a200e8f3d7789102a1fa2c0811a58c6c124b8b0",
  "ts": "2026-02-20T20:27:20.667Z",
  "mutation_class": "FEATURE_ADD",
  "description": "Added factorial function"
}
```

**Key Fields**:
- `intent_id`: Links mutation to specific intent
- `path`: File modified
- `sha256`: File content hash (64 hex characters)
- `ts`: ISO 8601 timestamp
- `mutation_class`: Type of change (FEATURE_ADD, REFACTOR, BUG_FIX, etc.)
- `description`: Human-readable change summary

**Key Features**:
- **Cryptographic Verification**: SHA-256 hashes prevent tampering
- **Intent Linkage**: Every mutation tied to an intent
- **Append-Only**: JSONL format prevents history rewriting
- **Timestamp Ordering**: Precise execution timeline

**Phase Integration**: Phase 3 (Trace Logging) + Phase 4 (Concurrency Control)

---

### 3. approval_log.jsonl

**Purpose**: Complete record of human-in-the-loop approval decisions

**Sample Entry** (Request):
```json
{
  "request_id": "approval-1771619240668-001",
  "timestamp": "2026-02-20T20:27:20.668Z",
  "change_summary": "Update documentation in README.md about new features",
  "diff": "--- a/README.md\n+++ b/README.md\n@@ -1,5 +1,8 @@",
  "files_affected": ["README.md"],
  "intent_id": "INT-001",
  "turn_id": "turn-001",
  "reason": "File is outside owned_scope which is src/**/*.js"
}
```

**Sample Entry** (Decision):
```json
{
  "request_id": "approval-1771619240668-001",
  ...request fields...,
  "decision": {
    "request_id": "approval-1771619240668-001",
    "timestamp": "2026-02-20T20:27:25.668Z",
    "approved": true,
    "approver": "alice@example.com",
    "approver_notes": "Documentation update is beneficial for project clarity",
    "requires_override": true
  },
  "logged_at": "2026-02-20T20:27:20.668Z"
}
```

**Key Fields (Request)**:
- `request_id`: Unique approval request identifier
- `timestamp`: When request was created
- `change_summary`: Human-readable description
- `diff`: Full unified diff of changes
- `files_affected`: Array of modified file paths
- `intent_id`: Associated intent
- `turn_id`: Associated agent turn
- `reason`: Why approval was needed

**Key Fields (Decision)**:
- `approved`: Boolean approval decision
- `approver`: Email/identity of human approver
- `approver_notes`: Justification for decision
- `requires_override`: Flag for scope override

**Workflow**:
1. Agent detects out-of-scope change
2. Creates approval request with full context
3. Human reviewer examines diff and summary
4. Decision recorded with approver identity
5. Agent receives decision and proceeds/retries

**Phase Integration**: Phase 5 (HITL Approval & Scope Enforcement)

---

### 4. intent_map.md

**Purpose**: Human-readable mapping of intent to implementation with decision trail

**Contents**:
- Intent metadata (ID, name, status, dates)
- Owned scope declaration
- Implementation artifacts (files, functions, hashes)
- Governance artifact references
- Constraints and criteria tracking table
- Decision trail with 4 milestones
- Cross-phase integration points

**Milestones**:
1. **PENDING**: Intent created with scope boundaries
2. **IN_PROGRESS**: Feature development starts
3. **HITL APPROVAL**: Out-of-scope change requested and approved
4. **COMPLETED**: All criteria met, ready for release

**Value**:
- Single source of truth for intent status
- Links code changes to business intent
- Tracks approval decisions
- Documents constraint compliance
- Enables manual code review

---

### 5. status_log.jsonl

**Purpose**: Timestamped progression of intent through lifecycle states

**Sample Entries**:
```json
{"intent_id":"INT-001","old_status":"NONE","new_status":"PENDING","timestamp":"2026-02-20T20:26:50.669Z","event":"Intent created"}
{"intent_id":"INT-001","old_status":"PENDING","new_status":"IN_PROGRESS","timestamp":"2026-02-20T20:27:00.669Z","event":"Feature development started"}
{"intent_id":"INT-001","old_status":"IN_PROGRESS","new_status":"COMPLETED","timestamp":"2026-02-20T20:27:20.669Z","event":"All criteria met, ready for release"}
```

**Key Fields**:
- `intent_id`: Which intent transitioned
- `old_status`: Previous state
- `new_status`: New state
- `timestamp`: When transition occurred
- `event`: Human-readable description

**Valid States**:
- `PENDING`: Intent created, awaiting activation
- `IN_PROGRESS`: Development underway
- `COMPLETED`: All criteria met
- `BLOCKED`: Awaiting resolution
- `CANCELLED`: Intent abandoned

---

## Cross-Phase Integration

### Phase 1: Intent Handshake ✅
- Agent calls `select_active_intent(INT-001)`
- System loads scope from `active_intents.yaml`
- Gatekeeper validates tool access against scope

### Phase 3: Trace Logging ✅
- Every file modification recorded in `agent_trace.jsonl`
- SHA-256 hash computed for content verification
- Intent linkage preserved for traceability

### Phase 4: Concurrency Control ✅
- File hashes enable stale file detection
- Multiple agents working on different intents won't conflict
- Optimistic locking prevents lost updates

### Phase 5: HITL Approval ✅
- Out-of-scope changes trigger approval request
- Human decisions recorded in `approval_log.jsonl`
- Override decisions auditable and timestamped

## Compliance & Audit

### Data Integrity
- ✅ All timestamps in ISO 8601 format
- ✅ All hashes 64-character hex (SHA-256)
- ✅ JSONL format (one valid JSON object per line)
- ✅ No mutable data (append-only logs)

### Audit Trail
- ✅ Every change linked to an intent
- ✅ Every mutation has cryptographic hash
- ✅ Every approval has approver identity
- ✅ Every status transition timestamped

### Compliance
- **SOC 2**: Complete audit trail with timestamps
- **HIPAA**: Human oversight for critical changes
- **GDPR**: Approver identity and decision tracking
- **Governance**: Scope enforcement prevents drift

## Usage Examples

### Query Intent Status
```bash
grep "INT-001" .orchestration/active_intents.yaml
```

### Verify File Hash Integrity
```bash
sha256sum src/hello.js  # Compare with agent_trace.jsonl sha256 field
```

### Track Approval Decisions
```bash
jq '.decision | select(.approver == "alice@example.com")' .orchestration/approval_log.jsonl
```

### View Status Timeline
```bash
cat .orchestration/status_log.jsonl | jq '.timestamp, .event'
```

### Find Out-of-Scope Requests
```bash
grep "out_of_scope" .orchestration/approval_log.jsonl
```

## Lessons Learned

Education artifacts documenting verification failures and resolutions:

**Entry Example**:
```
## Lesson Learned (2026-02-20)

**Context**: Lint check on hello.js during INT-001 feature implementation
**Failure**: ESLint detected missing semicolons in factorial() function (5 instances)
**Resolution**: Added semicolons to all statements; enabled 'semi' rule in .eslintrc.json
```

**Location**: `CLAUDE.md` (root directory)

## Future Enhancements

- [ ] Approval routing (different teams for different scopes)
- [ ] SLA tracking (approval decision latency)
- [ ] ML-based scope learning (suggest scope boundaries)
- [ ] Auto-approval (for low-risk, high-confidence changes)
- [ ] Metrics dashboard (approval rates, decision times)

## References

- [Phase 1: Intent Handshake](../PHASE_1_IMPLEMENTATION.md)
- [Phase 3: Trace Logging](../PHASE_3_IMPLEMENTATION.md)
- [Phase 4: Concurrency Control](../PHASE_4_IMPLEMENTATION.md)
- [Phase 5: HITL Approval](../PHASE_5_IMPLEMENTATION.md)

---

**Generated By**: Roo-Code Governance Cycle  
**Last Updated**: 2026-02-20T20:27:20Z  
**Intent Status**: COMPLETED ✅
