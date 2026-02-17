<!--
Sync Impact Report
- Version change: N/A -> 1.0.0
- Modified principles:
  - N/A -> I. Intent-First Mutation Control
  - N/A -> II. Deterministic Hook Enforcement
  - N/A -> III. Cryptographic Traceability and Append-Only Ledger
  - N/A -> IV. Scope Ownership and Parallel Safety
  - N/A -> V. Living Documentation as a Side Effect
- Added sections:
  - Architecture Boundaries
  - Delivery Workflow and Quality Gates
- Removed sections:
  - Template placeholder sections and tokens
- Templates requiring updates:
  - .specify/templates/plan-template.md (updated)
  - .specify/templates/spec-template.md (updated)
  - .specify/templates/tasks-template.md (updated)
- Follow-up TODOs:
  - None
-->

# Gonche Roo Code Constitution

## Core Principles

### I. Intent-First Mutation Control

Every mutation-capable task MUST select an active intent before any file write or
destructive command. The active intent MUST exist in
`.orchestration/active_intents.yaml` and provide owned scope, constraints, and
acceptance criteria. Mutations without intent selection are invalid by design.

### II. Deterministic Hook Enforcement

Pre-execution and post-execution hooks MUST run for tool calls and MUST enforce:
intent selection, scope ownership, context injection, and Human-in-the-Loop
authorization for destructive operations. If an invariant fails, execution MUST be
blocked with a structured error.

### III. Cryptographic Traceability and Append-Only Ledger

All successful writes MUST produce SHA-256 content hashes and mutation metadata in
`.orchestration/agent_trace.jsonl`. The ledger is append-only and MUST preserve
linkage from `intent_id` to file-level change ranges and revision identity.

### IV. Scope Ownership and Parallel Safety

Write access MUST be validated against `owned_scope` patterns for the active
intent. Parallel and stale-write safety MUST be enforced using file hash checks and
turn-based freshness checks before mutation. Stale writes MUST be blocked.

### V. Living Documentation as a Side Effect

Intent evolution (new-file or scope-expanding changes) MUST update
`.orchestration/intent_map.md`. Verification failures and cross-turn lessons MUST be
captured in `AGENT.md` or `CLAUDE.md` to prevent repeated failure loops.

## Architecture Boundaries

The system MUST maintain strict separation between:

- Webview/UI presentation concerns.
- Extension host logic, model/tool orchestration, and secrets.
- Hook middleware enforcement for all tool execution boundaries.

No UI layer code may bypass hook enforcement or mutate orchestration state directly.

## Delivery Workflow and Quality Gates

Feature delivery MUST follow Spec-Driven Development:

1. Define or update specs before implementation.
2. Map each implementation task to an explicit intent with declared scope.
3. Run constitution checks during planning and again before merge.
4. Require traceability evidence (intent, hash, ledger record) for write paths.
5. Reject changes that weaken hook enforcement, scope checks, or ledger integrity
   without an approved constitutional amendment.

## Governance

This constitution is the highest-priority engineering policy for this repository.

- Amendments require:
    - A documented rationale.
    - Explicit impact assessment on hooks, traceability, and scope safety.
    - Version bump using semantic versioning:
        - MAJOR: backward-incompatible governance changes.
        - MINOR: new principles or materially expanded mandates.
        - PATCH: clarifications without changing obligations.
- Every plan and PR review MUST include a constitution compliance check.
- Runtime guidance lives in `AGENTS.md`, and shared cross-task learning lives in
  `AGENT.md` (or `CLAUDE.md` if used by the active agent stack).

**Version**: 1.0.0 | **Ratified**: 2026-02-17 | **Last Amended**: 2026-02-17
