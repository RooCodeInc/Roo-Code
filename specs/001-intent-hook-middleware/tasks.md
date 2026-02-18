# Tasks: Intent-Governed Hook Middleware

**Input**: Design documents from `/specs/001-intent-hook-middleware/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are REQUIRED per Constitution Principle XII (Test-Driven Development). All tests must be written BEFORE implementation code.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **VS Code Extension**: `src/hooks/` for hook system, `src/core/tools/` for tools, `tests/hooks/` for tests
- All paths relative to repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, dependencies, and basic structure

- [x] T001 Add dependencies to package.json: minimatch@^10.0.0 (yaml@^2.8.0 already available)
- [x] T002 [P] Create src/hooks/ directory structure
- [x] T003 [P] Create tests/hooks/ directory structure
- [x] T004 [P] Create .orchestration/ directory structure documentation in ARCHITECTURE_NOTES.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 [P] Write failing test for OrchestrationStorage in tests/hooks/OrchestrationStorage.test.ts
- [x] T006 [P] Implement OrchestrationStorage class in src/hooks/OrchestrationStorage.ts (file I/O for .orchestration/)
- [x] T007 [P] Write failing test for IntentManager in tests/hooks/IntentManager.test.ts
- [x] T008 [P] Implement IntentManager class in src/hooks/IntentManager.ts (loads active_intents.yaml, manages active intent per task)
- [x] T009 [P] Write failing test for HookEngine in tests/hooks/HookEngine.test.ts
- [x] T010 [P] Implement HookEngine class in src/hooks/HookEngine.ts (main middleware coordinator, registers and executes hooks)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Intent Selection Before Destructive Operations (Priority: P1) 🎯 MVP

**Goal**: Enforce selection of an active intent before allowing any destructive tool operations (write_to_file, execute_command)

**Independent Test**: Attempt a file write operation without selecting an intent first, verify the system blocks the operation and prompts for intent selection. This delivers immediate value by preventing ungoverned changes.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T011 [P] [US1] Write failing unit test for SelectActiveIntentTool in tests/core/tools/SelectActiveIntentTool.test.ts
- [ ] T012 [P] [US1] Write failing integration test for intent selection blocking write operations in tests/integration/intent-selection-flow.test.ts

### Implementation for User Story 1

- [x] T013 [US1] Create SelectActiveIntentTool class in src/core/tools/SelectActiveIntentTool.ts (tool definition and handler)
- [x] T014 [US1] Add select_active_intent tool definition in src/core/prompts/tools/native-tools/select_active_intent.ts
- [x] T015 [US1] Register select_active_intent tool in src/core/prompts/tools/native-tools/index.ts (add to getNativeTools array)
- [x] T016 [US1] Add dispatch case for select_active_intent in src/core/assistant-message/presentAssistantMessage.ts (switch statement)
- [x] T017 [US1] Add activeIntentId property to Task class in src/core/task/Task.ts
- [x] T018 [US1] Write failing test for PreToolHook intent validation in tests/hooks/PreToolHook.test.ts
- [x] T019 [US1] Implement PreToolHook class in src/hooks/PreToolHook.ts (validates active intent exists before destructive operations)
- [x] T020 [US1] Register PreToolHook in HookEngine initialization (in extension.ts or appropriate location)

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently. File writes and command executions are blocked without active intent.

---

## Phase 4: User Story 2 - Scope Validation for File Operations (Priority: P1) 🎯 MVP

**Goal**: Validate file write paths against active intent's owned_scope patterns using glob matching to prevent modifications outside authorized boundaries

**Independent Test**: Select an intent with specific scope (e.g., "src/components/\*\*"), attempt to write to a file within scope (should succeed) and outside scope (should fail). This delivers value by enforcing organizational boundaries.

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T021 [P] [US2] Write failing unit test for ScopeValidator in tests/hooks/ScopeValidator.test.ts (glob pattern matching, multiple patterns, edge cases)
- [ ] T022 [P] [US2] Write failing integration test for scope validation blocking out-of-scope writes in tests/integration/scope-validation-flow.test.ts

### Implementation for User Story 2

- [x] T023 [US2] Implement ScopeValidator class in src/hooks/ScopeValidator.ts (validates file paths against glob patterns using minimatch)
- [x] T024 [US2] Integrate ScopeValidator into PreToolHook in src/hooks/PreToolHook.ts (validate file path against active intent's ownedScope)
- [x] T025 [US2] Add scope validation error messages in src/hooks/PreToolHook.ts (clear error: "Scope Violation: INT-XXX is not authorized to edit [filename]")

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently. File writes are blocked without intent AND blocked if outside scope.

---

## Phase 5: User Story 3 - Traceability Logging for All Write Operations (Priority: P2)

**Goal**: Log all successful file write operations to agent_trace.jsonl with complete metadata (intent_id, content_hash, file_path, mutation_class, timestamp)

**Independent Test**: Perform a file write operation with an active intent, then verify the operation is logged to the trace file with correct intent ID, content hash, and file path. This delivers value by providing audit capabilities.

### Tests for User Story 3

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T026 [P] [US3] Write failing unit test for TraceManager in tests/hooks/TraceManager.test.ts (create trace entry, append to JSONL, validate format)
- [ ] T027 [P] [US3] Write failing integration test for trace logging in tests/integration/trace-logging-flow.test.ts

### Implementation for User Story 3

- [ ] T028 [US3] Implement TraceManager class in src/hooks/TraceManager.ts (creates TraceLogEntry, appends to agent_trace.jsonl)
- [ ] T029 [US3] Write failing test for PostToolHook in tests/hooks/PostToolHook.test.ts
- [ ] T030 [US3] Implement PostToolHook class in src/hooks/PostToolHook.ts (logs operations after successful execution)
- [ ] T031 [US3] Integrate TraceManager into PostToolHook in src/hooks/PostToolHook.ts (call appendTraceEntry after file writes)
- [ ] T032 [US3] Register PostToolHook in HookEngine initialization

**Checkpoint**: At this point, User Stories 1, 2, AND 3 should work. All file writes are logged to trace file.

---

## Phase 6: User Story 4 - Content Hashing for Spatial Independence (Priority: P2)

**Goal**: Compute SHA256 content hash for every file write operation to enable spatial independence (tracking changes by content rather than location)

**Independent Test**: Write the same content to different files and verify they produce the same hash, or modify content and verify the hash changes. This delivers value by enabling content-based change tracking.

### Tests for User Story 4

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T033 [P] [US4] Write failing unit test for content hash computation in tests/hooks/TraceManager.test.ts (SHA256 hash, same content = same hash, different content = different hash)
- [ ] T034 [P] [US4] Write failing integration test for content hashing in trace entries in tests/integration/content-hashing-flow.test.ts

### Implementation for User Story 4

- [ ] T035 [US4] Add content hash computation to TraceManager in src/hooks/TraceManager.ts (use Node.js crypto.createHash('sha256'))
- [ ] T036 [US4] Update TraceLogEntry creation in TraceManager to include contentHash field
- [ ] T037 [US4] Ensure content hash is computed within 50ms for files up to 1MB (performance validation)

**Checkpoint**: At this point, User Stories 1-4 should work. File writes are logged with content hashes.

---

## Phase 7: User Story 6 - Dynamic Intent Context Injection (Priority: P2)

**Goal**: Inject active intent context into system prompt dynamically so AI has awareness of intent's requirements and constraints

**Independent Test**: Select an intent, initiate an AI conversation, and verify the system prompt includes intent context. This delivers value by improving AI response quality and alignment with intent.

### Tests for User Story 6

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T038 [P] [US6] Write failing unit test for intent context formatting in tests/hooks/IntentManager.test.ts (formatIntentContext function)
- [ ] T039 [P] [US6] Write failing integration test for intent context injection in system prompt in tests/integration/intent-context-injection.test.ts

### Implementation for User Story 6

- [ ] T040 [US6] Add formatIntentContext method to IntentManager in src/hooks/IntentManager.ts (formats intent as XML block)
- [ ] T041 [US6] Modify SYSTEM_PROMPT function in src/core/prompts/system.ts (load active intent, inject <intent_context> XML block)
- [ ] T042 [US6] Ensure intent context injection completes within 100ms (performance validation)

**Checkpoint**: At this point, User Stories 1-4 and 6 should work. System prompts include intent context.

---

## Phase 8: User Story 5 - Optimistic Locking to Prevent Stale Writes (Priority: P3)

**Goal**: Detect file state conflicts using SHA256 content hash comparison to prevent overwriting changes made by other processes

**Independent Test**: Simulate concurrent write attempts to the same file and verify the system detects the conflict and prevents the stale write. This delivers value by ensuring data integrity in parallel workflows.

### Tests for User Story 5

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T043 [P] [US5] Write failing unit test for OptimisticLockManager in tests/hooks/OptimisticLockManager.test.ts (create lock, validate lock, detect conflicts)
- [ ] T044 [P] [US5] Write failing integration test for optimistic locking in tests/integration/optimistic-locking-flow.test.ts

### Implementation for User Story 5

- [ ] T045 [US5] Implement OptimisticLockManager class in src/hooks/OptimisticLockManager.ts (creates FileStateLock, validates hash before write)
- [ ] T046 [US5] Integrate OptimisticLockManager into PreToolHook in src/hooks/PreToolHook.ts (create lock when operation starts)
- [ ] T047 [US5] Integrate OptimisticLockManager into PostToolHook in src/hooks/PostToolHook.ts (validate lock before write, release after)
- [ ] T048 [US5] Add conflict error handling in OptimisticLockManager (return "Stale File" error with clear message)

**Checkpoint**: At this point, all user stories should work. System prevents stale writes using optimistic locking.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T049 [P] Add error handling for missing/malformed active_intents.yaml in src/hooks/IntentManager.ts (per FR-015)
- [ ] T050 [P] Add error handling for trace log file errors in src/hooks/TraceManager.ts (non-blocking, per SC-009)
- [ ] T051 [P] Add error handling for .orchestration directory creation in src/hooks/OrchestrationStorage.ts
- [ ] T052 [P] Add comprehensive error messages for all validation failures in src/hooks/PreToolHook.ts (per FR-014)
- [ ] T053 [P] Update ARCHITECTURE_NOTES.md with hook system integration points
- [ ] T054 [P] Add JSDoc comments to all hook classes and methods
- [ ] T055 [P] Run quickstart.md validation and update if needed
- [ ] T056 [P] Add performance benchmarks for hook execution (<100ms per constitution)
- [ ] T057 [P] Code cleanup and refactoring (ensure clean code principles per Constitution Principle XI)
- [ ] T058 [P] Verify all tests pass and coverage is >=80% for new code

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
    - User stories can then proceed in parallel (if staffed)
    - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Depends on US1 (needs active intent from US1)
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Depends on US1 (needs active intent) and US2 (needs scope validation)
- **User Story 4 (P2)**: Can start after Foundational (Phase 2) - Depends on US3 (needs trace logging infrastructure)
- **User Story 5 (P3)**: Can start after Foundational (Phase 2) - Depends on US4 (needs content hashing)
- **User Story 6 (P2)**: Can start after Foundational (Phase 2) - Depends on US1 (needs active intent)

### Within Each User Story

- Tests (REQUIRED per TDD) MUST be written and FAIL before implementation
- Core infrastructure before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, user stories can start in priority order
- All tests for a user story marked [P] can run in parallel
- Different components within a story marked [P] can run in parallel (if no dependencies)
- Polish tasks marked [P] can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task T011: "Write failing unit test for SelectActiveIntentTool in tests/core/tools/SelectActiveIntentTool.test.ts"
Task T012: "Write failing integration test for intent selection blocking write operations in tests/integration/intent-selection-flow.test.ts"

# After tests are written, launch implementation tasks in order:
Task T013: "Create SelectActiveIntentTool class in src/core/tools/SelectActiveIntentTool.ts"
Task T014: "Add select_active_intent tool definition in src/core/prompts/tools/native-tools/select_active_intent.ts"
Task T015: "Register select_active_intent tool in src/core/task/build-tools.ts"
```

---

## Parallel Example: User Story 2

```bash
# Launch all tests for User Story 2 together:
Task T021: "Write failing unit test for ScopeValidator in tests/hooks/ScopeValidator.test.ts"
Task T022: "Write failing integration test for scope validation blocking out-of-scope writes in tests/integration/scope-validation-flow.test.ts"

# After tests are written, launch implementation:
Task T023: "Implement ScopeValidator class in src/hooks/ScopeValidator.ts"
Task T024: "Integrate ScopeValidator into PreToolHook in src/hooks/PreToolHook.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Intent Selection)
4. Complete Phase 4: User Story 2 (Scope Validation)
5. **STOP and VALIDATE**: Test User Stories 1 & 2 independently
6. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (Basic MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo (Full MVP!)
4. Add User Story 3 → Test independently → Deploy/Demo
5. Add User Story 4 → Test independently → Deploy/Demo
6. Add User Story 6 → Test independently → Deploy/Demo
7. Add User Story 5 → Test independently → Deploy/Demo
8. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
    - Developer A: User Story 1 (Intent Selection)
    - Developer B: User Story 2 (Scope Validation) - can start after US1 active intent is working
3. After US1 & US2 complete:
    - Developer A: User Story 3 (Traceability Logging)
    - Developer B: User Story 4 (Content Hashing)
    - Developer C: User Story 6 (Intent Context Injection)
4. After US3, US4, US6 complete:
    - Developer A: User Story 5 (Optimistic Locking)
5. All developers: Polish phase

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- **CRITICAL**: Verify tests fail before implementing (TDD requirement)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- All code must follow Clean Code principles (Constitution Principle XI)
- All code must be written using TDD (Constitution Principle XII) - tests first!

---

## Task Summary

**Total Tasks**: 58

- Phase 1 (Setup): 4 tasks
- Phase 2 (Foundational): 6 tasks
- Phase 3 (US1): 10 tasks
- Phase 4 (US2): 3 tasks
- Phase 5 (US3): 7 tasks
- Phase 6 (US4): 5 tasks
- Phase 7 (US6): 5 tasks
- Phase 8 (US5): 6 tasks
- Phase 9 (Polish): 10 tasks

**MVP Scope**: Phases 1-4 (User Stories 1 & 2) = 23 tasks

**Parallel Opportunities**:

- Setup: 3 tasks can run in parallel
- Foundational: 6 tasks can run in parallel
- Each user story: Tests can run in parallel, some implementation tasks can run in parallel
- Polish: 10 tasks can run in parallel
