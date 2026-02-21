# Tasks: 003-hook-middleware-security

**Spec:** [spec.md](./spec.md)  
**Plan:** [plan.md](./plan.md)  
**Constitution:** [.specify/memory/constitution.md](../../memory/constitution.md)  
**Depends on:** [002-intent-system](../002-intent-system/spec.md) (Phase 1: select_active_intent must be complete)

Executable tasks for implementing hook middleware and security boundary for Phase 2.

---

## Task 2.1: Create Path Matcher Utility

**File:** `src/hooks/utils/pathMatcher.ts`  
**Status:** ☐ Not started

### Description
Create a utility module for glob pattern matching with support for inclusion/exclusion patterns and Windows/Unix path normalization.

### Implementation Steps
1. Create `pathMatcher.ts` file
2. Install `minimatch` package if not already available (`npm install minimatch`)
3. Implement `normalizePath(filePath: string, workspaceRoot: string): string`
4. Implement `matchesGlobPattern(filePath: string, pattern: string, workspaceRoot: string): boolean`
5. Implement `matchesAnyGlobPattern(filePath: string, patterns: string[], workspaceRoot: string): boolean`
6. Add unit tests

### Acceptance Criteria
- ✅ `matchesGlobPattern` works with all pattern types (wildcards, globstars, etc.)
- ✅ `matchesAnyGlobPattern` works with multiple patterns (inclusion and exclusion)
- ✅ Handles Windows paths correctly (normalizes separators)
- ✅ Handles negation patterns (`!` prefix) correctly
- ✅ Unit tests pass with comprehensive coverage

### Dependencies
- `minimatch` package (may need installation)

---

## Task 2.2: Create Command Classifier Utility

**File:** `src/hooks/utils/commandClassification.ts`  
**Status:** ☐ Not started

### Description
Create a utility module that classifies tools as SAFE (read-only) or DESTRUCTIVE (write/delete/execute).

### Implementation Steps
1. Create `commandClassification.ts` file
2. Define `CommandType` enum (SAFE, DESTRUCTIVE)
3. Define SAFE tools set: `read_file`, `search_files`, `list_files`, `read_directory`, `grep`, `select_active_intent`
4. Define DESTRUCTIVE tools set: `write_to_file`, `delete_file`, `execute_command`, `apply_patch`, `edit_file`
5. Implement `classifyCommand(toolName: string): CommandType`
6. Implement `isDestructiveCommand(toolName: string): boolean`
7. Implement `requiresApproval(toolName: string, blocked: boolean, scopeViolation: boolean): boolean`
8. Add unit tests

### Acceptance Criteria
- ✅ `classifyCommand` returns correct type for all known tools
- ✅ `isDestructiveCommand` helper works correctly
- ✅ `requiresApproval` logic is correct for all scenarios (destructive + not blocked, scope violation, etc.)
- ✅ Unknown tools default to DESTRUCTIVE (fail-safe)
- ✅ Unit tests pass with comprehensive coverage

---

## Task 2.3: Enhance YAML Loader with Caching

**File:** `src/hooks/utils/yamlLoader.ts`  
**Status:** ☐ Not started

### Description
Add caching functionality to the YAML loader to avoid repeated file reads for the same intent's scope.

### Implementation Steps
1. Add module-level cache: `Map<string, string[]>` for intent scope
2. Implement `getCachedIntentScope(intentId: string): string[] | null`
3. Implement `setCachedIntentScope(intentId: string, scope: string[]): void`
4. Implement `clearCachedIntentScope(intentId?: string): void`
5. Create `findIntentByIdWithCache(workspaceRoot: string, intentId: string): Promise<ActiveIntent | null>`
6. Update `selectActiveIntentPreHook` to cache scope after loading
7. Add unit tests

### Acceptance Criteria
- ✅ `findIntentByIdWithCache` caches results after first load
- ✅ `getCachedIntentScope` returns cached scope if available
- ✅ Cache invalidates when intent changes (optional: file watcher)
- ✅ Cache fallback works (reads from YAML if cache miss)
- ✅ Unit tests pass (test caching, cache invalidation, fallback)

---

## Task 2.4: Update writeFilePreHook with Scope Validation

**File:** `src/hooks/preHooks/writeFile.ts`  
**Status:** ☐ Not started

### Description
Implement scope validation logic in the write file pre-hook to block writes outside the intent's `owned_scope`.

### Implementation Steps
1. Import `findIntentByIdWithCache` and `getCachedIntentScope` from `yamlLoader`
2. Import `matchesAnyGlobPattern` from `pathMatcher`
3. Import `formatStructuredError` from `errorFormatter`
4. Check for active intent (`context.intentId`)
5. Load intent scope (use cache if available, fallback to YAML)
6. Validate file path against `owned_scope` using `matchesAnyGlobPattern`
7. Return blocked result with structured error if out of scope
8. Return `blocked: false` if in scope
9. Update `WriteFilePreHookResult` interface to include `scopeViolation?: boolean`
10. Add unit tests

### Acceptance Criteria
- ✅ Checks for active intent (returns error if missing)
- ✅ Loads intent (uses cache if available)
- ✅ Validates file path against `owned_scope`
- ✅ Returns proper blocked result with error message
- ✅ Handles empty `owned_scope` gracefully (treats as no scope = block all)
- ✅ Error messages are structured JSON (via `formatStructuredError`)
- ✅ Unit tests pass (test scope violations, matches, missing intent, cache usage)

### Dependencies
- Task 2.1 (Path Matcher)
- Task 2.3 (YAML Loader Caching)
- Task 2.6 (Error Formatter)

---

## Task 2.5: Add UI Authorization Flow

**File:** `src/core/assistant-message/presentAssistantMessage.ts`  
**Status:** ☐ Not started

### Description
Integrate UI dialogs for user approval of blocked operations and destructive commands in the `write_to_file` case.

### Implementation Steps
1. Import `showScopeViolationDialog` and `showDestructiveActionDialog` from `dialogs`
2. Import `isDestructiveCommand` from `commandClassification`
3. Import `formatStructuredError` from `errorFormatter`
4. In `write_to_file` case, after pre-hook:
   - If blocked and scope violation: show scope violation dialog
   - If user rejects: return structured error via `pushToolResult`
   - If user approves: continue to tool execution
5. If not blocked but destructive: show destructive action dialog
   - If user rejects: return structured error
   - If user approves: continue to tool execution
6. Add integration tests with mocked dialogs

### Acceptance Criteria
- ✅ Shows warning dialog for blocked operations (scope violations)
- ✅ Shows confirmation dialog for destructive operations
- ✅ Dialogs are modal (await user response)
- ✅ User can approve or reject
- ✅ Rejected actions return structured errors via `pushToolResult`
- ✅ Approved actions proceed normally to tool execution
- ✅ Integration tests pass (mock dialogs, test approval/rejection flows)

### Dependencies
- Task 2.2 (Command Classifier)
- Task 2.4 (writeFilePreHook)
- Task 2.6 (Error Formatter)
- Task 2.7 (Dialog Utilities - if separate task)

---

## Task 2.6: Create Error Formatter

**File:** `src/hooks/utils/errorFormatter.ts`  
**Status:** ☐ Not started

### Description
Create a utility module for formatting structured JSON errors that the LLM can parse and recover from.

### Implementation Steps
1. Create `errorFormatter.ts` file
2. Define `StructuredError` interface: `{ error: string, reason: string, suggestion: string, recoverable: boolean }`
3. Implement `formatStructuredError(error: string, reason: string, suggestion?: string, recoverable?: boolean): string`
4. Implement `parseStructuredError(errorString: string): StructuredError | null` (helper for tests)
5. Define error types: `SCOPE_VIOLATION`, `DESTRUCTIVE_ACTION_REJECTED`, `MISSING_INTENT`, `INTENT_NOT_FOUND`, `MISSING_WORKSPACE_ROOT`
6. Add unit tests

### Acceptance Criteria
- ✅ `formatStructuredError` returns valid JSON string
- ✅ Includes `error`, `reason`, `suggestion`, `recoverable` fields
- ✅ Suggestion is optional but included when helpful
- ✅ JSON is parseable by LLM (valid structure)
- ✅ Unit tests pass (test JSON structure, all fields, parsing)

---

## Task 2.7: Update Context to Pass Cached Scope

**Files:** 
- `src/core/assistant-message/presentAssistantMessage.ts` (select_active_intent case)
- `src/hooks/preHooks/writeFile.ts` (update context interface)
- `src/core/task/Task.ts` (add property)

**Status:** ☐ Not started

### Description
Cache the `owned_scope` after intent selection and pass it to pre-hooks via context to avoid repeated YAML reads.

### Implementation Steps
1. Add `currentIntentScope: string[] | null = null` property to `Task` class
2. In `select_active_intent` case in `presentAssistantMessage.ts`:
   - After successful intent selection, load intent and cache scope
   - Set `cline.currentIntentScope = intent.owned_scope`
3. Update `WriteFilePreHookContext` interface to include `ownedScope?: string[]`
4. In `write_to_file` case, pass `ownedScope: cline.currentIntentScope` in context
5. Update `writeFilePreHook` to use cached scope from context if available
6. Add tests to verify caching behavior

### Acceptance Criteria
- ✅ Owned scope cached after intent selection (`Task.currentIntentScope`)
- ✅ Passed to `writeFilePreHook` in context (`context.ownedScope`)
- ✅ `writeFilePreHook` uses cached scope when available (avoids YAML read)
- ✅ Falls back to YAML read if cache not available
- ✅ Tests verify caching reduces YAML reads

### Dependencies
- Task 2.3 (YAML Loader Caching)
- Task 2.4 (writeFilePreHook)

---

## Task 2.8: Write Integration Tests

**File:** `test/phase2/integration/scopeEnforcement.test.ts` (or similar)  
**Status:** ☐ Not started

### Description
Create comprehensive integration tests for the scope enforcement and authorization flow.

### Implementation Steps
1. Create test file for scope enforcement integration tests
2. Mock VS Code dialogs (`vscode.window.showWarningMessage`)
3. Test scenarios:
   - Write in scope → succeeds
   - Write out of scope → blocked with dialog
   - Write without intent → blocked with error (no dialog needed)
   - Destructive command → confirmation dialog
   - User approval → proceeds
   - User rejection → returns structured error
4. Test error formatting and parsing
5. Test caching behavior (verify YAML reads are minimized)

### Acceptance Criteria
- ✅ Tests all scenarios:
  - Write in scope → succeeds
  - Write out of scope → blocked with dialog
  - Write without intent → blocked with error
  - Destructive command → confirmation dialog
  - User approval → proceeds
  - User rejection → returns error
- ✅ Mocks VS Code dialogs correctly
- ✅ Tests error formatting (structured JSON)
- ✅ Tests error parsing (LLM can parse)
- ✅ Tests caching (performance improvement)

### Dependencies
- All previous tasks (2.1-2.7)

---

## Task 2.9: Update Documentation

**Files:**
- `docs/phase2/scope-enforcement.md` (new)
- `README.md` (update)
- `ARCHITECTURE_NOTES.md` (update)

**Status:** ☐ Not started

### Description
Document the scope enforcement system, command classification, and authorization flow.

### Implementation Steps
1. Create `docs/phase2/scope-enforcement.md`:
   - Explain how scope enforcement works
   - Document command classification (SAFE vs DESTRUCTIVE)
   - Show example `active_intents.yaml` with `owned_scope`
   - Include troubleshooting guide
   - Document error recovery flow
2. Update `README.md`:
   - Add section on scope enforcement
   - Link to detailed documentation
3. Update `ARCHITECTURE_NOTES.md`:
   - Document hook middleware pattern
   - Document pre-hook flow
   - Document caching strategy

### Acceptance Criteria
- ✅ Documents how scope enforcement works
- ✅ Explains command classification (SAFE/DESTRUCTIVE)
- ✅ Shows example `active_intents.yaml` with `owned_scope` patterns
- ✅ Includes troubleshooting guide (common issues, solutions)
- ✅ Documents error recovery flow (how LLM handles structured errors)
- ✅ README and ARCHITECTURE_NOTES updated

---

## Implementation Sequence

Recommended order for executing tasks:

1. **Task 2.1** → Path Matcher Utility (foundation)
2. **Task 2.2** → Command Classifier Utility (foundation)
3. **Task 2.6** → Error Formatter (needed by other tasks)
4. **Task 2.3** → YAML Loader Caching (needed by Task 2.4)
5. **Task 2.7** → Context Caching (needed by Task 2.4)
6. **Task 2.4** → writeFilePreHook (core functionality)
7. **Task 2.5** → UI Authorization Flow (integrates with Task 2.4)
8. **Task 2.8** → Integration Tests (verifies everything works)
9. **Task 2.9** → Documentation (final step)

---

## Dependencies Summary

- **Phase 1 (002) must be complete**: `select_active_intent` tool, pre-hook, gatekeeper, and YAML loading must be working
- **active_intents.yaml schema**: Must include `owned_scope` field with glob patterns
- **VS Code API**: `vscode.window.showWarningMessage` must be available
- **minimatch package**: May need installation for glob pattern matching

---

## Status Legend

- ☐ Not started
- ☑ In progress
- ✅ Done

Update task status as you work through implementation.

---

_This implements the security boundary layer that enforces scope validation and provides UI-blocking authorization for destructive operations, building on Phase 1's intent selection foundation._
