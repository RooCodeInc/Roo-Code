# Spec: Hook Middleware & Security Boundary for Intent-Code Traceability

**Feature:** 003-hook-middleware-security  
**Status:** Draft  
**Constitution:** [.specify/memory/constitution.md](../../memory/constitution.md)  
**Depends on / extends:** 
- [001-intent-orchestration](../001-intent-orchestration/spec.md) (orchestration layer and `.orchestration/` as source of truth)
- [002-intent-system](../002-intent-system/spec.md) (intent IDs, scope, constraints, `select_active_intent` tool)

---

## 1. Overview

Implement the **security boundary layer** that enforces scope validation and provides UI-blocking authorization for destructive operations. This builds on Phase 1 (The Handshake) which implemented intent selection via `select_active_intent`. Phase 2 adds **pre-hook middleware** that validates file operations against the active intent's `owned_scope`, classifies tools as SAFE or DESTRUCTIVE, and presents modal approval dialogs when violations or destructive actions occur.

---

## 2. User stories

| ID   | As a…     | I want…                                                                 | So that…                                                                              |
| ---- | --------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| US-1 | Developer | file write operations to be validated against the active intent's scope | the agent cannot accidentally modify files outside the declared intent boundaries      |
| US-2 | Developer | clear error messages when scope violations occur                        | I understand why an action was blocked and can decide whether to approve it anyway     |
| US-3 | Developer | destructive operations to require explicit approval                     | I maintain control over risky actions like file deletion or command execution          |
| US-4 | Developer | the system to classify tools as safe or destructive automatically      | read-only operations proceed smoothly while destructive ones require confirmation      |
| US-5 | Developer | structured error responses that the LLM can parse and recover from     | the agent can autonomously handle errors and suggest alternative approaches            |
| US-6 | Developer | scope validation to be performant                                      | the system remains responsive even with complex glob patterns                          |

---

## 3. Functional requirements

### 3.1 Scope Enforcement

- **FR-1** Every file write operation (e.g. `write_to_file`, `edit_file`, `apply_patch`) MUST be validated against the active intent's `owned_scope` before execution. The validation MUST occur in a pre-hook that runs before the tool's `handle()` method.
- **FR-2** Files outside the intent's `owned_scope` MUST be blocked with clear error messages. The error MUST include:
  - The target file path
  - The active intent ID
  - The scope patterns that were checked
  - A suggestion to either select a different intent or request scope expansion
- **FR-3** Scope validation MUST use glob pattern matching for path validation. The system MUST support:
  - Inclusion patterns (e.g. `"src/**/*.ts"` matches all TypeScript files under `src/`)
  - Exclusion patterns (e.g. `"!**/*.test.ts"` excludes test files)
  - Both patterns in the same scope definition
- **FR-4** Path resolution MUST normalize file paths relative to the workspace root before matching against glob patterns. Paths MUST be resolved consistently (e.g. handle Windows vs Unix path separators).
- **FR-5** Read-only operations (e.g. `read_file`, `search_files`, `list_files`, `read_directory`, `grep`) MAY be allowed outside scope for discovery purposes. The plan will define whether reads are scoped or global (recommendation: allow reads globally).

### 3.2 Command Classification

- **FR-6** Tools MUST be classified as either **SAFE** (read-only) or **DESTRUCTIVE** (write/delete/execute). Classification MUST occur before tool execution (e.g. in a classification utility or pre-hook).
- **FR-7** **SAFE tools** include (non-exhaustive list):
  - `read_file`
  - `search_files`
  - `list_files`
  - `read_directory`
  - `grep`
  - Any tool that does not modify files, execute commands, or delete resources
- **FR-8** **DESTRUCTIVE tools** include (non-exhaustive list):
  - `write_to_file`
  - `delete_file`
  - `execute_command`
  - `apply_patch`
  - Any tool that modifies files, deletes resources, or executes system commands
- **FR-9** Unknown tools MUST default to **DESTRUCTIVE** (fail-safe principle). If a tool is not explicitly classified, it MUST be treated as destructive and require approval.
- **FR-10** Tool classification MUST be extensible. The system MUST support adding new tools to the classification without modifying core middleware logic.

### 3.3 UI-Blocking Authorization

- **FR-11** When a scope violation is detected, the system MUST show a VS Code warning dialog that:
  - Displays the violation details (file path, intent ID, scope patterns)
  - Offers options: **"Approve Anyway"** (allows the action) or **"Reject"** (blocks the action)
  - Is modal (blocks execution until the user responds)
  - Returns the user's choice to the pre-hook
- **FR-12** When a destructive command is detected (and not already blocked by scope), the system MUST show a VS Code warning dialog that:
  - Displays the tool name and action description
  - Offers options: **"Approve"** (allows the action) or **"Reject"** (blocks the action)
  - Is modal (blocks execution until the user responds)
  - Returns the user's choice to the pre-hook
- **FR-13** Dialogs MUST be implemented using VS Code's native dialog API (e.g. `vscode.window.showWarningMessage` with modal options). The dialog MUST not be dismissible without selecting an option.
- **FR-14** Rejected actions MUST return structured errors to the LLM (see FR-15). The tool execution MUST be skipped (pre-hook returns `blocked: true`).
- **FR-15** Approved actions (either automatically allowed or user-approved) MUST proceed to tool execution. The pre-hook MUST return `blocked: false`.

### 3.4 Autonomous Recovery

- **FR-16** All errors returned to the LLM MUST be in structured JSON format:
  ```json
  {
    "error": "string",
    "reason": "string",
    "suggestion": "string",
    "recoverable": boolean
  }
  ```
- **FR-17** Error messages MUST include:
  - **error**: A short, machine-parseable error code or type (e.g. `"SCOPE_VIOLATION"`, `"DESTRUCTIVE_ACTION_REJECTED"`)
  - **reason**: A human-readable explanation of why the action was blocked
  - **suggestion**: An actionable suggestion for recovery (e.g. "Select a different intent" or "Request scope expansion")
  - **recoverable**: A boolean indicating whether the LLM can recover from this error autonomously (e.g. `true` for scope violations, `false` for user-rejected destructive actions)
- **FR-18** Structured errors MUST be returned via `pushToolResult` so the LLM receives them in the next turn. The error format MUST be consistent across all pre-hooks.
- **FR-19** The LLM MUST be able to parse these errors and attempt recovery (e.g. by calling `select_active_intent` with a different intent ID, or by requesting scope expansion from the user).

### 3.5 Performance Optimization

- **FR-20** The active intent's `owned_scope` MUST be cached after intent selection to avoid repeated YAML file reads. The cache MUST be invalidated when:
  - A new intent is selected (`select_active_intent` is called)
  - The `active_intents.yaml` file is modified (optional: file watcher)
- **FR-21** The cached scope MUST be passed to write_file pre-hook via the context parameter (e.g. `context.ownedScope`). The pre-hook MUST use the cached value if available, falling back to YAML read only if cache is invalid.
- **FR-22** Glob pattern matching MUST be efficient. The system SHOULD use a well-tested glob library (e.g. `minimatch` or `picomatch`) and SHOULD cache compiled patterns when possible.
- **FR-23** Performance MUST not regress compared to Phase 1. Pre-hook execution time MUST be negligible (< 10ms for typical scope checks).

---

## 4. Acceptance criteria (for this spec)

- [ ] All file write operations are validated against `owned_scope` before execution
- [ ] Scope violations show approval dialogs with "Approve Anyway" / "Reject" options
- [ ] Destructive commands show approval dialogs with "Approve" / "Reject" options
- [ ] Rejected actions return structured JSON errors via `pushToolResult`
- [ ] LLM can parse errors and attempt recovery (e.g. select different intent)
- [ ] Tool classification (SAFE vs DESTRUCTIVE) is implemented and extensible
- [ ] Unknown tools default to DESTRUCTIVE (fail-safe)
- [ ] Scope caching works (no repeated YAML reads for the same intent)
- [ ] No performance regression (pre-hooks execute in < 10ms for typical cases)
- [ ] All tests pass (unit tests for scope validation, classification, error formatting)
- [ ] Constitution and 001/002 specs are not violated (hook middleware pattern, `.orchestration/` as source of truth)

---

## 5. Constraints (from constitution)

- TypeScript strict mode; follow existing repo patterns
- Hook middleware pattern for agent flows; scope/constraint checks run in that pipeline
- `.orchestration/` is source of truth; do not duplicate intent state elsewhere
- Two-stage state machine: intent selection → execution (Phase 1 must be complete)
- Pre-hooks run before tool execution in `presentAssistantMessage` (before `switch (block.name)`)

---

## 6. Out of scope for this spec

- Post-hook traceability (logging to `.orchestration/agent_trace.jsonl`) — this is Phase 3
- Constraint enforcement beyond scope (e.g. disallow_tools, disallow_patterns) — can be added in a follow-up
- Scope expansion workflow (user approval to expand scope) — can be added in a follow-up
- File watchers for `active_intents.yaml` (manual cache invalidation is acceptable)
- UI for editing intents or scope (can be a later spec)
- Multi-intent scenarios (one active intent at a time)

---

## 7. Technical notes

### 7.1 Pre-hook integration points

- **write_to_file**: Pre-hook validates path against `owned_scope`, shows dialog if violation, returns structured error if rejected
- **delete_file**: Pre-hook checks classification (DESTRUCTIVE), shows approval dialog, validates scope if applicable
- **execute_command**: Pre-hook checks classification (DESTRUCTIVE), shows approval dialog
- **apply_patch**: Pre-hook validates all affected paths against `owned_scope`, shows dialog if violation

### 7.2 Scope caching strategy

- Cache key: `currentIntentId` (from `task.currentIntentId`)
- Cache value: `owned_scope` array (glob patterns)
- Cache location: Task-level state or a module-level cache with intent ID as key
- Invalidation: When `select_active_intent` succeeds, clear cache and load new scope

### 7.3 Dialog implementation

- Use `vscode.window.showWarningMessage` with `{ modal: true }` option
- Options array: `["Approve", "Reject"]` or `["Approve Anyway", "Reject"]`
- Return user choice to pre-hook; pre-hook returns `blocked: true/false` accordingly

---

## 8. Review & acceptance checklist

- [ ] No [NEEDS CLARIFICATION] markers remain
- [ ] Requirements are testable and unambiguous
- [ ] Success criteria are measurable
- [ ] Aligned with constitution and 001/002 specs
- [ ] Error format is well-defined and LLM-parseable
- [ ] Performance requirements are realistic

---

_Next: run `/speckit.clarify` to resolve ambiguities, or `/speckit.plan` to produce the technical implementation plan (pre-hook implementations, tool classification, dialog integration, caching strategy)._
