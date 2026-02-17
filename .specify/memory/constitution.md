# TRP1 AI-Native IDE Constitution

## Core Principles

### I. Intent-First Development (NON-NEGOTIABLE)
All work must start from an explicitly defined intent, not from ad-hoc code edits.
- Every meaningful change is associated with a formal intent in `.orchestration/active_intents.yaml`.
- The agent must select an `intent_id` before writing code or executing destructive tools.
- Spec Kit specs and REQ-IDs are the primary source of truth for business intent.

### II. Governed Hook Engine & Safety Boundaries
The Roo extension must route all mutating actions through a deterministic Hook Engine.
- The Hook Engine lives in the extension host as a middleware around tool execution.
- Pre-hooks enforce protocol, scope, and human-in-the-loop approvals.
- Post-hooks update `.orchestration/` artifacts and are never bypassed for mutations.

### III. Traceability, Tests, and Verification
We repay cognitive and trust debt through traceability and verification.
- Every mutating action is logged to `.orchestration/agent_trace.jsonl` with intent, model, ranges, and `content_hash`.
- The system distinguishes between `AST_REFACTOR` and `INTENT_EVOLUTION` and records this for each change.
- Where feasible, changes are paired with tests or verification steps; failures feed into the shared brain file.

### IV. Sidecar Orchestration & Living Documentation
The IDE maintains machine-managed sidecar artifacts under `.orchestration/`.
- `active_intents.yaml`, `agent_trace.jsonl`, and `intent_map.md` are treated as first-class runtime state.
- These files are updated automatically by hooks, not edited manually.
- They serve as living documentation for managers and engineers to answer “why” and “where” questions.

### V. Human-in-the-Loop Governance
Humans retain final authority over dangerous or out-of-scope actions.
- Destructive or out-of-scope operations must surface UI prompts (approve / reject) before proceeding.
- Rejections and verification failures are logged and summarized into `AGENT.md` / `CLAUDE.md` as lessons learned.
- Scope expansion for an intent requires explicit human approval and update of `active_intents.yaml`.

## Additional Constraints & Standards

- Respect VS Code / Cursor extension architecture:
  - Webview is a pure presentation layer and must not bypass the Hook Engine.
  - Extension host owns tool execution, file writes, and `.orchestration/` management.
- The Hook Engine design should be simple, composable, and testable in isolation.
- `.orchestration/` contents must be deterministic and reproducible from the trace plus git history.

## Development Workflow & Quality Gates

- Always work from a Spec Kit feature branch / REQ-ID with a clear intent definition.
- For significant changes, first update or create:
  - Spec Kit artifacts (spec, plan, tasks).
  - Corresponding entries in `active_intents.yaml`.
- Code review must check:
  - Hook paths are used for all mutations (no escape hatches).
  - Trace entries are correctly written for new behaviors.
  - Any new commands/tools are classified (Safe vs Destructive) and wired into governance.

## Governance

- This constitution governs all TRP1 work in this fork of Roo Code.
- Amendments must:
  - Be documented in a pull request referencing the motivating REQ-ID and lessons learned.
  - Include updates to this file and, if needed, supporting guidance in `AGENT.md` / `CLAUDE.md`.
- Reviewers and agents must reject changes that:
  - Bypass the Hook Engine for mutations.
  - Introduce undocumented side effects or weaken traceability / governance guarantees.

**Version**: 1.0.0 | **Ratified**: 2026-02-16 | **Last Amended**: 2026-02-16

