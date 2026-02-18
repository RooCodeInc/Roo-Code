# Tasks: 001-intent-orchestration

**Spec:** [spec.md](./spec.md)  
**Constitution:** [.specify/memory/constitution.md](../../memory/constitution.md)

Tasks derived from functional requirements and acceptance criteria. Implement in dependency order; 002-intent-system tasks implement the concrete tool and schema.

---

## 1. Orchestration foundation

| ID    | Task                                                                                                                                              | Source   | Status |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| 001-1 | Create `.orchestration/` directory layout (e.g. `active_intents.yaml`, optional `state machine` or metadata file) and document as source of truth | FR-3, AC | ☐      |
| 001-2 | Implement intent selection phase: resolve/select user intent and assign intent ID before any execution                                            | FR-1     | ☐      |
| 001-3 | Implement execution phase: allow agent actions only after intent selection; ensure actions carry intent ID for traceability                       | FR-2     | ☐      |
| 001-4 | Define state machine (states, transitions: selection → execution) and store under `.orchestration/`                                               | FR-3     | ☐      |
| 001-5 | Ensure all agent flows use hook middleware; audit and remove any bypass paths                                                                     | FR-4, AC | ☐      |
| 001-6 | Implement traceability: given an intent ID, determine which actions/artifacts were produced (logs, state, or references)                          | FR-5     | ☐      |

---

## 2. Acceptance criteria verification

| ID     | Task                                                                                           | Source | Status |
| ------ | ---------------------------------------------------------------------------------------------- | ------ | ------ |
| 001-7  | Verify intent selection and execution are distinct phases (two-stage state machine)            | AC     | ☐      |
| 001-8  | Verify every agent action that affects code or UX is associated with an intent ID              | AC     | ☐      |
| 001-9  | Verify `.orchestration/` is the only source of truth for intent definitions and state machine  | AC     | ☐      |
| 001-10 | Verify no ad-hoc paths around hook middleware                                                  | AC     | ☐      |
| 001-11 | Confirm TypeScript strict mode and AGENTS.md (e.g. Settings View cachedState) are not violated | AC     | ☐      |

---

## 3. Dependencies

- **002-intent-system** implements the `select_active_intent` tool, schema for `active_intents.yaml`, and gatekeeper; those tasks satisfy 001-2, 001-3, and feed 001-4, 001-5, 001-6.
- Complete 001-1 and 002 schema/tool tasks first, then 001-2 through 001-6, then 001-7–001-11.

---

_Next: run tasks in 002-intent-system for concrete implementation; use this list to verify 001 acceptance criteria._
