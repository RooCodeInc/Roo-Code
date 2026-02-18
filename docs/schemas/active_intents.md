# active_intents.yaml Schema

Single source of truth for active intents. Used by the orchestration layer: `select_active_intent` pre-hook loads context from this file; the write_file pre-hook uses `owned_scope` for scope enforcement. Stored at `.orchestration/active_intents.yaml` (workspace root).

---

## Complete YAML Example

```yaml
# active_intents.yaml
# Root key: list of intents the agent can select and work on.

active_intents:
    # --- Intent 1: Feature work ---
    - id: INT-001
      name: Add dark mode toggle to settings
      status: IN_PROGRESS

      # Glob patterns for files this intent is allowed to modify.
      # Use ! prefix to exclude paths (e.g. !**/vendor/**).
      owned_scope:
          - "src/settings/**"
          - "src/components/SettingsView.*"
          - "!**/node_modules/**"
          - "!**/*.test.*"

      # Business or technical constraints the agent must respect.
      constraints:
          - "Use cachedState for inputs; do not bind directly to useExtensionState()"
          - "Changes must not break existing settings persistence"

      # Definition of Done: criteria that must be met to mark intent completed.
      acceptance_criteria:
          - "Toggle appears in Settings UI and persists across reloads"
          - "AGENTS.md or equivalent documents the Settings View pattern"

      # Optional: link to GitHub (or other) issues for traceability.
      github_issues:
          - "https://github.com/org/repo/issues/42"
          - "org/repo#43"

      # Optional: progress tracking (checklist or high-level status).
      progress:
          checklist:
              - { done: true, label: "Add toggle component" }
              - { done: true, label: "Wire to extension state" }
              - { done: false, label: "Update AGENTS.md" }
          notes: "Blocked on design review for contrast ratios"

    # --- Intent 2: Refactor ---
    - id: INT-002
      name: Extract orchestration types to packages/types
      status: PENDING

      owned_scope:
          - "packages/types/src/**"
          - "src/hooks/models/**"
          - "!**/node_modules/**"

      constraints:
          - "No runtime dependencies in packages/types"
          - "Re-export from src/hooks/models for backward compatibility"

      acceptance_criteria:
          - "ActiveIntent and ActiveIntentsFile live in packages/types"
          - "All imports updated; tests pass"

      github_issues: []

    # --- Intent 3: Bug fix (minimal optional fields) ---
    - id: INT-003
      name: Fix gatekeeper blocking select_active_intent on first turn
      status: COMPLETED

      owned_scope:
          - "src/core/assistant-message/**"

      constraints:
          - "Gatekeeper must allow select_active_intent when currentIntentId is unset"

      acceptance_criteria:
          - "Agent can call select_active_intent before any other tool without error"
```

---

## Field Reference

| Field                        | Type       | Required | Description                                                                                                                                                                |
| ---------------------------- | ---------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **active_intents**           | `array`    | Yes      | Root key. Array of intent objects.                                                                                                                                         |
| **id**                       | `string`   | Yes      | Unique intent ID in `INT-XXX` format (e.g. `INT-001`). Used by `select_active_intent` and the gatekeeper.                                                                  |
| **name**                     | `string`   | Yes      | Human-readable short name for the intent.                                                                                                                                  |
| **status**                   | `string`   | Yes      | One of: `PENDING`, `IN_PROGRESS`, `COMPLETED`, `BLOCKED`. Indicates current lifecycle state.                                                                               |
| **owned_scope**              | `string[]` | Yes      | Glob patterns defining which files this intent may modify. Paths are resolved relative to the workspace root. Used by the write_file pre-hook to block out-of-scope edits. |
| **owned_scope (exclusions)** | —          | —        | Use a leading `!` in a pattern to exclude paths (e.g. `!**/node_modules/**`). Exclusions are applied after inclusions.                                                     |
| **constraints**              | `string[]` | Yes      | Business or technical constraints the agent must follow while working on this intent (e.g. coding rules, invariants).                                                      |
| **acceptance_criteria**      | `string[]` | Yes      | Definition of Done: list of criteria that must be satisfied to consider the intent complete.                                                                               |
| **github_issues**            | `string[]` | No       | Optional links to GitHub (or other) issues. Each entry can be a full URL or `org/repo#N`.                                                                                  |
| **progress**                 | `object`   | No       | Optional progress tracking. Structure is flexible; typical use: checklist and notes.                                                                                       |
| **progress.checklist**       | `array`    | No       | Optional list of `{ done: boolean, label: string }` items for granular progress.                                                                                           |
| **progress.notes**           | `string`   | No       | Optional free-form notes (e.g. blockers, decisions).                                                                                                                       |
