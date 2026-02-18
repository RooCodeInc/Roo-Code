<!--
Sync Impact Report:
Version: 1.0.0 → 1.1.0 (MINOR: Added clean code and TDD principles)
Modified principles: N/A
Added principles: XI. Clean Code, XII. Test-Driven Development (NON-NEGOTIABLE)
Added sections: N/A
Removed sections: N/A
Templates requiring updates:
  ✅ plan-template.md - Constitution Check section exists (no changes needed)
  ✅ spec-template.md - No constitution-specific references (no changes needed)
  ✅ tasks-template.md - Already includes test tasks structure (no changes needed)
Follow-up TODOs: None
-->

# AI-Native IDE Governance Constitution

# TRP1 Challenge: Intent-Code Traceability System

## Core Principles

### I. Intent-First Architecture (NON-NEGOTIABLE)

**MUST**: All code modifications MUST be linked to a declared Intent ID. No code can be written without first calling `select_active_intent`.

**Rationale**: Traditional Git tracks "what" and "when" but is blind to "why". By enforcing Intent declaration before code changes, we create a cryptographic link between business requirements and code modifications, enabling true traceability and preventing "Vibe Coding."

**Enforcement**:

- Pre-Hook MUST block all destructive tool calls (write_to_file, execute_command) if no active intent is declared
- System prompt MUST instruct AI to call `select_active_intent` before any code modifications
- Violations MUST return error: "You must cite a valid active Intent ID before writing code"

### II. Spatial Independence via Content Hashing

**MUST**: Every code modification MUST be tracked with a SHA-256 content hash of the modified code block, not just line numbers.

**Rationale**: Line numbers are fragile—code moves, files are refactored. Content hashes provide spatial independence: the same logical change has the same hash regardless of where it appears in the file.

**Enforcement**:

- Post-Hook MUST calculate content hash for all modified code ranges
- `agent_trace.jsonl` entries MUST include `content_hash` in ranges
- Hash calculation MUST use SHA-256 of normalized code content (whitespace-normalized, comment-preserved)

### III. Scope Enforcement and Isolation

**MUST**: Each Intent MUST declare an `owned_scope` (file patterns). Tools attempting to modify files outside scope MUST be blocked.

**Rationale**: Prevents scope creep and accidental modifications. Enables parallel work by isolating agent responsibilities.

**Enforcement**:

- Pre-Hook MUST validate file path against active intent's `owned_scope`
- Scope violations MUST return: "Scope Violation: INT-XXX is not authorized to edit [filename]. Request scope expansion."
- Scope expansion requires Human-in-the-Loop approval

### IV. Deterministic Hook Middleware Boundary

**MUST**: All tool execution MUST pass through a strict middleware boundary (Hook Engine) that enforces governance rules.

**Rationale**: Hooks provide a single point of control for all mutating operations. This enables consistent enforcement of rules, logging, and parallel orchestration.

**Enforcement**:

- Hook Engine MUST intercept ALL tool calls before execution (Pre-Hook)
- Hook Engine MUST intercept ALL tool results after execution (Post-Hook)
- Hooks MUST be isolated, composable, and fail-safe (errors in hooks don't crash extension)
- Hook logic MUST NOT be embedded in tool implementations

### V. Intent-Code Traceability (The Golden Thread)

**MUST**: Every code modification MUST be logged in `agent_trace.jsonl` with explicit linkage to Intent ID.

**Rationale**: Enables answering "Why was this code changed?" and "What code implements requirement X?" Creates audit trail for compliance and debugging.

**Enforcement**:

- Post-Hook MUST append to `agent_trace.jsonl` after every file write
- Trace entries MUST include: intent_id, content_hash, file path, line ranges, mutation_class (AST_REFACTOR vs INTENT_EVOLUTION)
- Trace entries MUST link to VCS revision (git SHA)
- Trace file MUST be append-only (never modified, only appended)

### VI. Parallel Orchestration via Optimistic Locking

**MUST**: When multiple agents work in parallel, file modifications MUST use optimistic locking to prevent overwrites.

**Rationale**: Enables "Master Thinker" workflow where Architect, Builder, and Tester agents work simultaneously without conflicts.

**Enforcement**:

- Before write: Calculate hash of current file on disk
- Compare to hash when agent started reading
- If hashes differ: Block write, return "Stale File" error, force re-read
- Agent MUST re-read file and recalculate before retry

### VII. Human-in-the-Loop for Intent Evolution

**MUST**: When code changes represent Intent Evolution (new feature) rather than AST_REFACTOR (syntax change), Human approval MUST be requested.

**Rationale**: Intent Evolution changes the system's purpose and scope. These are architectural decisions requiring human judgment.

**Enforcement**:

- Post-Hook MUST classify mutations as AST_REFACTOR or INTENT_EVOLUTION
- INTENT_EVOLUTION mutations MUST trigger `vscode.window.showWarningMessage` with "Approve/Reject"
- Rejection MUST send standardized JSON error to LLM for self-correction
- Approval MUST update intent status in `active_intents.yaml`

### VIII. Shared Brain (Lessons Learned)

**MUST**: When verification loops fail (tests, linters), lessons MUST be recorded in `AGENT.md` or `CLAUDE.md` for future sessions.

**Rationale**: Prevents repeated mistakes across parallel sessions. Creates institutional memory that survives agent restarts.

**Enforcement**:

- Post-Hook MUST detect verification failures (test failures, linter errors)
- Failures MUST trigger append to `AGENT.md` with: timestamp, intent_id, error message, resolution
- Future sessions MUST load `AGENT.md` into system prompt context

### IX. Context Engineering (Prevent Context Rot)

**MUST**: Intent context MUST be dynamically injected, not statically dumped. Only relevant constraints and scope for active intent MUST be included.

**Rationale**: Prevents "Context Rot" where irrelevant information pollutes the context window. Enables focused, efficient AI reasoning.

**Enforcement**:

- Pre-Hook for `select_active_intent` MUST load only the selected intent's constraints
- System prompt MUST include `<intent_context>` XML block with active intent details
- Context MUST exclude inactive intents and unrelated history
- Context size MUST be minimized (curated, not dumped)

### X. Formal Intent Specification

**MUST**: Intents MUST be formally specified with: ID, name, status, owned_scope, constraints, acceptance_criteria.

**Rationale**: Enables machine-readable governance. Supports automated validation and parallel orchestration.

**Enforcement**:

- `active_intents.yaml` MUST follow strict schema
- Intent IDs MUST be unique and stable (INT-001, INT-002, etc.)
- Status MUST be one of: PENDING, IN_PROGRESS, COMPLETED, BLOCKED
- Constraints MUST be explicit, testable statements
- Acceptance criteria MUST define "Definition of Done"

### XI. Clean Code (NON-NEGOTIABLE)

**MUST**: All code MUST follow clean code principles: meaningful names, small functions, single responsibility, minimal complexity, clear intent.

**Rationale**: Clean code is maintainable, readable, and reduces cognitive load. It enables effective collaboration, reduces bugs, and makes the codebase easier to understand and modify.

**Enforcement**:

- Functions MUST be small and do one thing (Single Responsibility Principle)
- Names MUST be descriptive and reveal intent (no abbreviations, no magic numbers)
- Code MUST be self-documenting (minimal comments needed)
- Complexity MUST be minimized (cyclomatic complexity < 10 per function)
- Code MUST follow SOLID principles
- Duplication MUST be eliminated (DRY - Don't Repeat Yourself)
- Code reviews MUST verify clean code compliance

### XII. Test-Driven Development (NON-NEGOTIABLE)

**MUST**: All code MUST be written using Test-Driven Development (TDD) methodology: Red-Green-Refactor cycle.

**Rationale**: TDD ensures code correctness, enables safe refactoring, provides living documentation, and catches regressions early. Tests written first clarify requirements and design.

**Enforcement**:

- Tests MUST be written BEFORE implementation code
- Red-Green-Refactor cycle MUST be followed:
    1. Write failing test (Red)
    2. Write minimal code to pass (Green)
    3. Refactor while keeping tests green (Refactor)
- All public APIs MUST have unit tests
- Integration tests MUST cover critical paths
- Test coverage MUST be maintained (minimum 80% for new code)
- Tests MUST be fast, independent, repeatable, and self-validating
- Tests MUST be part of the definition of done for every task

## Technical Constraints

### Hook Architecture

- Hooks MUST be in `src/hooks/` directory
- Hook Engine MUST be a middleware pattern (not embedded in tools)
- Hooks MUST support async/await for file I/O and approvals
- Hook errors MUST be caught and logged, not crash extension

### Data Model Requirements

- `.orchestration/` directory MUST be in workspace root
- `active_intents.yaml` MUST be YAML format
- `agent_trace.jsonl` MUST be JSONL (one JSON object per line)
- `intent_map.md` MUST be Markdown for human readability
- All files MUST be machine-readable and human-editable

### Performance Standards

- Hook execution MUST add <100ms latency per tool call
- Content hash calculation MUST be non-blocking
- File I/O for trace logging MUST be async
- Parallel agent coordination MUST not create deadlocks

### Security Requirements

- Intent scope validation MUST prevent path traversal attacks
- Content hashes MUST use cryptographically secure SHA-256
- Trace files MUST not expose secrets (sanitize before logging)
- Human approval dialogs MUST be non-bypassable

## Development Workflow

### Code Review Requirements

- All PRs MUST verify hook system compliance
- Hook implementations MUST include unit tests
- Integration tests MUST verify end-to-end intent flow
- Architecture decisions MUST be documented in `ARCHITECTURE_NOTES.md`

### Testing Gates

- Pre-Hook tests: Verify intent enforcement blocks unauthorized writes
- Post-Hook tests: Verify trace logging captures all mutations
- Parallel orchestration tests: Verify optimistic locking prevents conflicts
- Scope enforcement tests: Verify path validation works correctly

### Quality Standards

- Hook code MUST follow existing Roo Code TypeScript conventions
- Error messages MUST be user-friendly and actionable
- Logging MUST be structured and searchable
- Documentation MUST be kept in sync with implementation
- Code MUST follow clean code principles (Principle XI)
- All code MUST be written using TDD (Principle XII)
- Code reviews MUST verify clean code and test coverage compliance

## Governance

### Amendment Procedure

1. Constitution amendments MUST be proposed in GitHub Issue
2. Amendments MUST be reviewed by project maintainers
3. Amendments MUST be documented with rationale
4. Breaking changes (MAJOR version) require migration plan
5. Amendments MUST be reflected in `active_intents.yaml` schema if needed

### Compliance Review

- All code changes MUST be verified against constitution principles
- Violations MUST be caught in pre-commit hooks or CI/CD
- Constitution compliance MUST be checked in code review
- Non-compliance MUST block merge until resolved

### Version Control

- Constitution versioning: MAJOR.MINOR.PATCH
- MAJOR: Backward-incompatible principle changes
- MINOR: New principles or significant expansions
- PATCH: Clarifications, wording improvements
- Version MUST be updated on every amendment

### Supremacy Clause

**This Constitution supersedes all other development practices, coding standards, and architectural decisions within the scope of the Intent-Code Traceability system.**

- If a practice conflicts with a MUST principle, the principle takes precedence
- If a tool behavior conflicts with hook enforcement, hooks take precedence
- If a user request violates intent scope, scope enforcement takes precedence
- Exceptions require explicit constitutional amendment

### Runtime Guidance

- For day-to-day development: Follow `ARCHITECTURE_NOTES.md` for implementation details
- For architectural decisions: Refer to this Constitution
- For tool usage: See `.orchestration/AGENT.md` for lessons learned
- For intent definitions: See `.orchestration/active_intents.yaml` schema

## Definitions

**Intent**: A formalized business requirement or task with defined scope, constraints, and acceptance criteria.

**AST_REFACTOR**: A code change that modifies syntax/structure but preserves the same intent (e.g., renaming variables, extracting functions).

**INTENT_EVOLUTION**: A code change that adds new functionality or changes the system's purpose (e.g., adding a new feature, changing behavior).

**Content Hash**: SHA-256 hash of normalized code content, providing spatial independence from line numbers.

**Spatial Independence**: Property where the same logical change has the same identifier (hash) regardless of file location or line numbers.

**Hook Engine**: Middleware system that intercepts tool execution to enforce governance rules.

**Pre-Hook**: Interceptor that runs before tool execution, used for validation and context injection.

**Post-Hook**: Interceptor that runs after tool execution, used for logging and state updates.

**Optimistic Locking**: Concurrency control where file modifications check if file changed since read, preventing overwrites.

**Context Rot**: Degradation of AI reasoning quality due to irrelevant information in context window.

**Vibe Coding**: Blind acceptance of AI-generated code without architectural constraints or verification.

---

**Version**: 1.1.0 | **Ratified**: 2026-02-16 | **Last Amended**: 2026-02-16

**Status**: Active - Governing TRP1 Challenge Week 1 Implementation
