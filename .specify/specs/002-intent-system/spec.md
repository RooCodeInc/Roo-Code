# Spec: Intent system (ID format, scope, constraints, acceptance criteria, storage)

**Feature:** 002-intent-system  
**Status:** Draft  
**Constitution:** [.specify/memory/constitution.md](../../memory/constitution.md)  
**Depends on / extends:** [001-intent-orchestration](../001-intent-orchestration/spec.md) (orchestration layer and `.orchestration/` as source of truth)

---

## 1. Overview

Define a concrete **Intent system**: a canonical format for intent IDs, and for each intent a **scope** (files it may modify), **constraints**, and **acceptance criteria**. Active intents are stored in **`.orchestration/active_intents.yaml`** so the orchestration layer and tool hooks can enforce scope and traceability.

---

## 2. User stories

| ID   | As a…     | I want…                                                                | So that…                                                                    |
| ---- | --------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| US-1 | Developer | every intent to have a stable ID in the form `INT-XXX`                 | I can reference and trace intents consistently in logs and tool results     |
| US-2 | Developer | each intent to declare which files it is allowed to modify (scope)     | The system can block or warn when the agent touches out-of-scope files      |
| US-3 | Developer | each intent to have explicit constraints (e.g. no delete, no run sudo) | Agent actions stay within safe and predictable bounds                       |
| US-4 | Developer | each intent to have acceptance criteria                                | I can verify when an intent is “done” and gate completion on them           |
| US-5 | Developer | active intents to be stored in `.orchestration/active_intents.yaml`    | The orchestration layer and hooks have a single, file-based source of truth |

---

## 3. Functional requirements

### 3.1 Intent ID format

- **FR-1** Intent IDs MUST follow the format **`INT-XXX`** where `XXX` is a unique identifier (e.g. numeric `INT-001`, `INT-002`, or alphanumeric per project convention). The format is case-sensitive; canonical form is uppercase `INT-XXX`.
- **FR-2** Intent IDs are assigned when an intent is created or selected (e.g. in the intent selection phase). Once assigned, the same ID is used for all actions and traceability for that intent until it is closed or superseded.

### 3.2 Scope (files an intent can modify)

- **FR-3** Each intent MUST have a **scope** that defines which files (or paths) the intent is allowed to **modify** (write, edit, patch, delete). Scope may be expressed as:
    - An explicit list of file paths (relative to workspace root), and/or
    - Glob patterns (e.g. `src/**/*.ts`, `docs/*.md`), and/or
    - A single directory and its descendants.
- **FR-4** Tool execution (e.g. `write_to_file`, `edit_file`, `apply_diff`) MUST be checked against the active intent’s scope. Attempts to modify a file outside scope MUST be rejected or require explicit escalation (behavior to be defined in plan: reject vs. warn-and-approve).
- **FR-5** Read-only operations (e.g. `read_file`, `list_files`, `search_files`) may be allowed outside scope for discovery; the plan will define whether reads are scoped or global.

### 3.3 Constraints

- **FR-6** Each intent MUST have a **constraints** section that defines what the agent is not allowed to do for this intent. Examples (to be refined in plan):
    - Disallow certain tools (e.g. `execute_command` with shell, or `delete_file`).
    - Disallow modifying files matching certain patterns (e.g. lockfiles, env files).
    - Rate or count limits (e.g. max number of file writes per intent).
- **FR-7** Constraints are enforced by the hook middleware (pre-tool or validation layer) before the tool executes. Violations MUST produce a clear error and optionally a tool_result explaining the constraint.

### 3.4 Acceptance criteria (per intent)

- **FR-8** Each intent MUST have **acceptance criteria**: a list of conditions that must hold for the intent to be considered **done**. Criteria are human- and/or machine-checkable (e.g. “File X contains function Y”, “Test suite Z passes”, “User confirmed in UI”).
- **FR-9** The system MUST support recording whether each criterion is met (e.g. pending / met / failed). Where and how (e.g. in `active_intents.yaml` or a separate checklist file) is defined in the plan.
- **FR-10** Completion or “attempt_completion” behavior MAY be gated on all acceptance criteria for the current intent being met (optional; to be decided in plan).

### 3.5 Storage: `.orchestration/active_intents.yaml`

- **FR-11** Active intents MUST be stored in **`.orchestration/active_intents.yaml`**. “Active” means intents that are currently in use (e.g. selected for the current task or session).
- **FR-12** The file MUST be the source of truth for the current task/session for: intent ID, scope, constraints, acceptance criteria (and their status if stored there). Schema (YAML structure) is defined in the technical plan.
- **FR-13** The orchestration layer and hooks MUST read from this file (or a validated in-memory view of it) to enforce scope and constraints. Writes to this file MUST go through a single writer or API so the format stays consistent.
- **FR-14** When an intent is closed or superseded, the file is updated (e.g. move to history or remove from active). Retention and archival (e.g. `.orchestration/history/`) are out of scope for this spec unless minimal (e.g. append-only log); the plan may add a simple history.

---

## 4. Acceptance criteria (for this spec)

- [ ] Intent ID format `INT-XXX` is documented and used consistently in code and in `.orchestration/active_intents.yaml`.
- [ ] Each intent has a defined scope (paths/globs) for modifiable files; tool execution is checked against scope.
- [ ] Each intent has a constraints section; constraints are enforced before tool execution (via hooks).
- [ ] Each intent has acceptance criteria; criteria and their status can be stored and updated.
- [ ] `.orchestration/active_intents.yaml` exists and is the single source of truth for active intents (ID, scope, constraints, acceptance criteria).
- [ ] Constitution and 001-intent-orchestration are not violated (`.orchestration/` remains source of truth; two-stage state machine and hook middleware respected).

---

## 5. Constraints (from constitution)

- TypeScript strict mode; follow existing repo patterns.
- Hook middleware pattern for agent flows; scope/constraint checks run in that pipeline.
- `.orchestration/` is source of truth; do not duplicate intent state elsewhere.

---

## 6. Out of scope for this spec

- UI for editing intents (can be a later spec).
- Full intent history, search, or analytics (beyond minimal “closed” state).
- Schema versioning and migration of `active_intents.yaml` (can be added in plan if needed).

---

## 7. Review & acceptance checklist

- [ ] No [NEEDS CLARIFICATION] markers remain.
- [ ] Requirements are testable and unambiguous.
- [ ] Success criteria are measurable.
- [ ] Aligned with constitution and 001-intent-orchestration.

---

_Next: run `/speckit.clarify` to resolve ambiguities, or `/speckit.plan` to produce the technical plan (schema for `active_intents.yaml`, hook integration, scope/constraint enforcement)._
