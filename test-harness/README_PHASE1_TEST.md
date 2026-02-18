# Phase 1 Handshake — Manual Test Script

This workspace validates the Intent-Driven Governance Layer (Phase 1: The Handshake).

## Workspace Structure

```
test-harness/
├── .orchestration/
│   └── active_intents.yaml      ← Governance config (2 intents)
├── src/
│   ├── auth/
│   │   ├── login.ts             ← Refactoring target (IN_PROGRESS)
│   │   └── register.ts          ← Refactoring target (IN_PROGRESS)
│   ├── billing/
│   │   └── invoice.ts           ← Scoped under PAUSED intent
│   └── shared/
│       └── utils.ts             ← Safe utility (no intent scope)
└── README_PHASE1_TEST.md        ← This file
```

## Active Intents

| ID                 | Status        | Scope           |
| ------------------ | ------------- | --------------- |
| `refactor-auth`    | `IN_PROGRESS` | `src/auth/*`    |
| `optimize-billing` | `PAUSED`      | `src/billing/*` |

---

## Test Cases

### Test A: No Intent Declared → Destructive Tool Blocked

**Steps:**

1. Open Roo-Code with `test-harness/` as the workspace root
2. Ask the agent: _"Add input sanitization to login.ts"_
3. The agent should attempt `write_to_file` or `apply_diff`

**Expected:**

- ❌ Tool call is **blocked** by the Gatekeeper
- Error message: `"No active Intent selected. You must call select_active_intent(intent_id)..."`
- `consecutiveMistakeCount` increments
- No file modifications occur

---

### Test B: Valid Intent Declared → Auth Files Editable

**Steps:**

1. Ask the agent: _"Select intent refactor-auth, then add input validation to the login function"_
2. The agent should first call `select_active_intent("refactor-auth")`
3. It receives `<intent_context>` XML with constraints and scope
4. Then it calls `write_to_file` or `apply_diff` on `src/auth/login.ts`

**Expected:**

- ✅ `select_active_intent` returns XML with:
    - `<intent_id>refactor-auth</intent_id>`
    - `<goal>Refactor authentication module...</goal>`
    - `<constraint>Do not modify public API</constraint>`
    - `<constraint>Preserve existing function signatures</constraint>`
- ✅ Destructive tool executes successfully
- ✅ Trace event appended to `intentTraceLog` with `outcome: "success"`
- ✅ On the next API call, system prompt includes updated `<intent_context>` with trace

---

### Test C: PAUSED Intent → Rejected

**Steps:**

1. Ask the agent: _"Select intent optimize-billing and refactor invoice.ts"_
2. The agent calls `select_active_intent("optimize-billing")`

**Expected:**

- ❌ Selection **rejected** — status is `PAUSED`, not `IN_PROGRESS`
- Error message includes: `"status "PAUSED" — only IN_PROGRESS intents can be selected"`
- Suggests valid IN_PROGRESS intents: `[refactor-auth]`
- `activeIntentId` remains `undefined`
- No file modifications occur

---

### Test D: YAML Status Changed Mid-Session → Tools Blocked

**Steps:**

1. Complete Test B first (agent has `refactor-auth` selected and has executed a tool)
2. **While the session is active**, edit `.orchestration/active_intents.yaml`:
    - Change `refactor-auth` status from `IN_PROGRESS` to `COMPLETED`
3. Ask the agent to make another edit to `login.ts`

**Expected:**

- ❌ Gatekeeper re-validates against live YAML on every destructive call
- Detects that `refactor-auth` now has status `COMPLETED`
- **Clears** `activeIntentId` and `activeIntentContext`
- Error message includes: `"status "COMPLETED" (must be IN_PROGRESS)"`
- Suggests valid IN_PROGRESS intents (none remain → `"No IN_PROGRESS intents available."`)
- `consecutiveMistakeCount` increments

---

### Test E: Deleting .orchestration Folder → Governance Disabled

**Steps:**

1. Delete the `.orchestration/` directory entirely:
    ```bash
    rm -rf test-harness/.orchestration
    ```
2. Ask the agent to edit any file (e.g., `login.ts`)

**Expected:**

- ✅ `isGovernedWorkspace()` returns `false`
- ✅ Destructive tools execute **freely** without intent enforcement
- ✅ No trace events are recorded
- ✅ No governance errors appear

**Restore afterward:**

```bash
# Re-create the YAML to continue testing
mkdir -p test-harness/.orchestration
# Copy the original YAML back
```

---

### Test F: Safe Tools Run Without Intent

**Steps:**

1. Ensure `.orchestration/active_intents.yaml` exists (governed mode)
2. Do NOT select any intent
3. Ask the agent: _"Read the contents of src/shared/utils.ts"_

**Expected:**

- ✅ `read_file` is in `SAFE_TOOLS` — executes without enforcement
- ✅ No error, no intent required
- ✅ No trace event recorded (SAFE tools are excluded from trace)
- ✅ File contents returned normally

---

## Summary Table

| Test | Action                      | Expected Result                   |
| ---- | --------------------------- | --------------------------------- |
| A    | Destructive tool, no intent | ❌ Blocked                        |
| B    | Valid IN_PROGRESS intent    | ✅ Executes + trace recorded      |
| C    | PAUSED intent selection     | ❌ Rejected                       |
| D    | YAML changed mid-session    | ❌ Stale intent cleared + blocked |
| E    | .orchestration deleted      | ✅ Ungoverned — free execution    |
| F    | Safe tool, no intent        | ✅ Executes freely                |

---

## Out of Scope (Phase 2+)

The following are **NOT** tested in this harness:

- UI approval dialogs
- File-level scope enforcement (agent is not _prevented_ from editing billing files with auth intent)
- `.intentignore` files
- Git integration or commit-level auditing
- Intent expansion or dependency graphs
- Multi-intent orchestration
