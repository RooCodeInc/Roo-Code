# Implementation Plan: Intent-Governed Hook Middleware

**Branch**: `001-intent-hook-middleware` | **Date**: 2026-02-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-intent-hook-middleware/spec.md`

## Summary

Implement a middleware/interceptor system that enforces intent-based governance for all destructive tool operations in the Roo Code VS Code extension. The system will intercept tool calls (write_to_file, execute_command) to validate intent selection, enforce scope boundaries, log operations to trace files, compute content hashes, and inject intent context into system prompts. All hook logic will be isolated in `src/hooks/` following a middleware pattern.

## Technical Context

**Language/Version**: TypeScript 5.x (aligned with existing Roo Code codebase)  
**Primary Dependencies**:

- VS Code Extension API (`vscode` package)
- Node.js crypto module (for SHA256 hashing)
- YAML parser (likely `js-yaml` or similar)
- Glob pattern matcher (likely `minimatch` or Node.js `path` with glob support)
- Existing Roo Code infrastructure: `BaseTool`, `Task`, `SYSTEM_PROMPT` function

**Storage**:

- File system (`.orchestration/` directory in workspace root)
- `active_intents.yaml` (YAML format)
- `agent_trace.jsonl` (JSONL format, append-only)
- `intent_map.md` (Markdown format)

**Testing**:

- Vitest (based on existing Roo Code test setup)
- Unit tests for hook components
- Integration tests for end-to-end intent flow
- Mock VS Code API for testing

**Target Platform**: VS Code Extension (Node.js runtime, cross-platform)  
**Project Type**: VS Code Extension (monorepo structure with packages)  
**Performance Goals**:

- Hook execution adds <100ms latency per tool call (per constitution)
- Content hash computation <50ms for files up to 1MB (per spec SC-004)
- Scope validation <10ms per validation (per spec SC-008)
- Intent context injection <100ms (per spec SC-006)

**Constraints**:

- Must not break existing tool execution flow
- Must be backward compatible (graceful degradation if hooks fail)
- Must follow existing Roo Code TypeScript conventions
- Must isolate hooks in `src/hooks/` directory
- Must use middleware pattern (not embedded in tools)
- Must follow Clean Code principles (Constitution Principle XI)
- Must use Test-Driven Development (Constitution Principle XII)

**Scale/Scope**:

- Single workspace per extension instance
- Multiple concurrent tool operations (optimistic locking required)
- Trace log grows unbounded (append-only, no rotation in scope)
- Intent definitions: typically 1-10 active intents per workspace

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### Principle Compliance Verification

#### I. Intent-First Architecture (NON-NEGOTIABLE) ✅

- **Status**: COMPLIANT
- **Verification**:
    - Pre-Hook will block all destructive tool calls if no active intent
    - System prompt will instruct AI to call `select_active_intent` before code modifications
    - Error message: "You must cite a valid active Intent ID before writing code"
- **Implementation**: Pre-Hook validation in `HookEngine.ts`

#### II. Spatial Independence via Content Hashing ✅

- **Status**: COMPLIANT
- **Verification**:
    - Post-Hook will calculate SHA256 content hash for all file writes
    - `agent_trace.jsonl` entries will include `content_hash`
    - Hash uses SHA256 of normalized content
- **Implementation**: `TraceManager.ts` with crypto module

#### III. Scope Enforcement and Isolation ✅

- **Status**: COMPLIANT
- **Verification**:
    - Pre-Hook validates file path against active intent's `owned_scope` using glob patterns
    - Scope violations return clear error message
    - Scope expansion requires HITL approval (future enhancement)
- **Implementation**: `ScopeValidator.ts` with glob pattern matching

#### IV. Deterministic Hook Middleware Boundary ✅

- **Status**: COMPLIANT
- **Verification**:
    - Hook Engine intercepts ALL tool calls before execution (Pre-Hook)
    - Hook Engine intercepts ALL tool results after execution (Post-Hook)
    - Hooks isolated in `src/hooks/`, composable, fail-safe
    - Hook logic NOT embedded in tool implementations
- **Implementation**: `HookEngine.ts` as middleware coordinator

#### V. Intent-Code Traceability ✅

- **Status**: COMPLIANT
- **Verification**:
    - Post-Hook appends to `agent_trace.jsonl` after every file write
    - Trace entries include: intent_id, content_hash, file_path, line_ranges, mutation_class
    - Trace file is append-only (never modified)
- **Implementation**: `TraceManager.ts` with JSONL append operations

#### VI. Parallel Orchestration via Optimistic Locking ✅

- **Status**: COMPLIANT
- **Verification**:
    - Before write: Calculate SHA256 hash of current file
    - Compare to hash when operation started
    - If hashes differ: Block write, return "Stale File" error
- **Implementation**: `OptimisticLockManager.ts` with content hash comparison

#### VII. Human-in-the-Loop for Intent Evolution ⚠️

- **Status**: DEFERRED (not in current spec scope)
- **Verification**:
    - Post-Hook classification (AST_REFACTOR vs INTENT_EVOLUTION) not in current requirements
    - HITL approval workflow out of scope for initial implementation
- **Note**: Can be added in future iteration

#### VIII. Shared Brain (Lessons Learned) ⚠️

- **Status**: DEFERRED (not in current spec scope)
- **Verification**:
    - `AGENT.md` logging not in current requirements
    - Can be added in future iteration
- **Note**: Infrastructure supports this (trace logging exists)

#### IX. Context Engineering ✅

- **Status**: COMPLIANT
- **Verification**:
    - Intent context dynamically injected into system prompt
    - Only active intent's constraints included
    - Context minimized (curated, not dumped)
- **Implementation**: Modify `SYSTEM_PROMPT` function to inject `<intent_context>` XML block

#### X. Formal Intent Specification ✅

- **Status**: COMPLIANT
- **Verification**:
    - `active_intents.yaml` follows strict schema
    - Intent IDs unique and stable
    - Status: PENDING, IN_PROGRESS, COMPLETED, BLOCKED
- **Implementation**: `IntentManager.ts` with YAML parsing and validation

#### XI. Clean Code (NON-NEGOTIABLE) ✅

- **Status**: COMPLIANT
- **Verification**:
    - All code will follow clean code principles
    - Functions small, single responsibility
    - Meaningful names, self-documenting
    - SOLID principles, DRY
- **Implementation**: Code review and linting enforcement

#### XII. Test-Driven Development (NON-NEGOTIABLE) ✅

- **Status**: COMPLIANT
- **Verification**:
    - All code written using TDD (Red-Green-Refactor)
    - Tests written BEFORE implementation
    - Unit tests for public APIs
    - Integration tests for critical paths
    - Minimum 80% test coverage
- **Implementation**: Vitest test suite with TDD workflow

### Gate Evaluation

**Overall Status**: ✅ **PASS** - All critical principles compliant. HITL and Shared Brain deferred but not blocking.

**Violations**: None requiring justification. Deferred features (HITL, Shared Brain) are explicitly out of scope.

## Project Structure

### Documentation (this feature)

```text
specs/001-intent-hook-middleware/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── hooks/                    # NEW: Hook middleware system (isolated)
│   ├── HookEngine.ts         # Main middleware coordinator
│   ├── PreToolHook.ts        # Pre-execution interceptors
│   ├── PostToolHook.ts       # Post-execution interceptors
│   ├── IntentManager.ts      # Manages active_intents.yaml
│   ├── TraceManager.ts       # Manages agent_trace.jsonl
│   ├── IntentMapManager.ts   # Manages intent_map.md
│   ├── OrchestrationStorage.ts # File I/O for .orchestration/
│   ├── ScopeValidator.ts     # Validates file paths against scope
│   └── OptimisticLockManager.ts # Handles optimistic locking
├── core/
│   ├── tools/
│   │   ├── BaseTool.ts       # MODIFY: Add hook integration
│   │   ├── WriteToFileTool.ts # Existing (hooks intercept)
│   │   ├── ExecuteCommandTool.ts # Existing (hooks intercept)
│   │   └── SelectActiveIntentTool.ts # NEW: Intent selection tool
│   ├── prompts/
│   │   └── system.ts          # MODIFY: Inject intent context
│   ├── assistant-message/
│   │   └── presentAssistantMessage.ts # Existing (hooks intercept)
│   └── task/
│       └── Task.ts            # MODIFY: Add activeIntentId state
└── ...

.orchestration/                # NEW: Workspace root directory
├── active_intents.yaml       # Intent specifications
├── agent_trace.jsonl         # Append-only action log
├── intent_map.md             # Spatial map of intents
└── AGENT.md                  # Shared brain (future)

tests/
├── hooks/                    # NEW: Hook system tests
│   ├── HookEngine.test.ts
│   ├── IntentManager.test.ts
│   ├── TraceManager.test.ts
│   ├── ScopeValidator.test.ts
│   └── OptimisticLockManager.test.ts
└── integration/
    └── intent-flow.test.ts   # NEW: End-to-end intent flow
```

**Structure Decision**: Extending existing monorepo structure. New `src/hooks/` directory isolates hook middleware. Modifications to existing files (`BaseTool.ts`, `system.ts`, `Task.ts`) are minimal and non-breaking. New `.orchestration/` directory in workspace root for machine-managed data.

## Complexity Tracking

> **No violations requiring justification**

All architectural decisions align with constitution principles. The middleware pattern is the simplest approach that meets requirements. No unnecessary complexity introduced.

---

## Phase 0: Research Complete ✅

**Output**: `research.md`

All technical unknowns resolved:

- ✅ Glob pattern matching: `minimatch` library
- ✅ SHA256 hashing: Node.js `crypto` module
- ✅ YAML parsing: `js-yaml` library
- ✅ JSONL file handling: Node.js `fs.appendFile`
- ✅ Middleware pattern: Function composition with async/await
- ✅ Optimistic locking: Content hash comparison
- ✅ System prompt injection: XML block in `SYSTEM_PROMPT()`
- ✅ File system access: VS Code `workspace.fs` API

**Dependencies Identified**:

- `minimatch`: ^10.0.0
- `js-yaml`: ^4.1.0
- `@types/js-yaml`: ^4.0.0

---

## Phase 1: Design & Contracts Complete ✅

**Outputs**:

- ✅ `data-model.md` - Entity definitions, relationships, validation rules
- ✅ `contracts/hook-engine.ts` - TypeScript interfaces and API contracts
- ✅ `quickstart.md` - Developer and user quickstart guide

**Agent Context Updated**: ✅ Cursor IDE context file updated with TypeScript 5.x information

---

## Next Steps

**Phase 2**: Task Breakdown

- Run `/speckit.tasks` to generate detailed implementation tasks
- Tasks will be broken down by user story priority (P1, P2, P3)
- Each task will include TDD requirements (tests first)

**Implementation Order**:

1. Foundation (P1): Hook infrastructure, IntentManager, ScopeValidator
2. Core Features (P1): Intent selection tool, pre-hook validation
3. Traceability (P2): TraceManager, content hashing, trace logging
4. Advanced Features (P2-P3): Optimistic locking, intent context injection

**Ready for**: `/speckit.tasks` command
