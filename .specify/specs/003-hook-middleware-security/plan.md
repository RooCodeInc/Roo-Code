# Implementation plan: Hook Middleware & Security Boundary

**Feature:** 003-hook-middleware-security  
**Spec:** [spec.md](./spec.md)  
**Constitution:** [.specify/memory/constitution.md](../../memory/constitution.md)

This plan covers the **security boundary layer** that enforces scope validation and provides UI-blocking authorization for destructive operations. It builds on Phase 1 (The Handshake) which implemented intent selection via `select_active_intent`.

---

## Architecture Overview

We'll implement a middleware layer that intercepts tool execution in `presentAssistantMessage.ts`, with pre-hooks for validation and UI integration. The flow:

1. **Pre-hook execution**: Before tool execution, pre-hooks validate scope and classify tools
2. **UI authorization**: If blocked or destructive, show modal dialogs for user approval
3. **Error formatting**: Return structured JSON errors that the LLM can parse and recover from
4. **Caching**: Cache `owned_scope` after intent selection to avoid repeated YAML reads

---

## Phase 0: Prerequisites and Dependencies

### 0.1 Verify dependencies

- **glob package**: Already installed (`glob@^11.1.0` in `package.json`). For pattern matching, we can use:
  - Option A: Install `minimatch` package (recommended for glob pattern matching)
  - Option B: Use `glob` package's built-in matching if available
  - Option C: Use a simple regex-based matcher for basic patterns
- **vscode API**: Already available in extension context. Use `vscode.window.showWarningMessage` for modal dialogs.
- **yamlLoader**: Already exists at `src/hooks/utils/yamlLoader.ts` with `findIntentById` function.

**Note**: The plan uses `minimatch` for glob pattern matching. If `minimatch` is not installed, either install it (`npm install minimatch`) or adapt the implementation to use an alternative pattern matching library.

### 0.2 Task class extension

- **Location**: `src/core/task/Task.ts` (already has `currentIntentId: string | null` at line 393)
- **Add**: `currentIntentScope: string[] | null = null` property to cache `owned_scope` after intent selection
- **Purpose**: Avoid repeated YAML reads for scope validation

---

## Phase 1: Path Matcher Utility

### 1.1 Create path matcher module

- **File**: `src/hooks/utils/pathMatcher.ts`
- **Purpose**: Handle glob pattern matching with Windows/Unix path normalization and negation support

### 1.2 Implementation

```typescript
import { minimatch } from "minimatch"
import * as path from "path"

/**
 * Normalize a file path relative to workspace root
 * Handles Windows/Unix path separators and resolves relative paths
 */
export function normalizePath(filePath: string, workspaceRoot: string): string {
  // Resolve relative paths
  const resolved = path.isAbsolute(filePath) 
    ? filePath 
    : path.resolve(workspaceRoot, filePath)
  
  // Normalize separators and relative segments
  const normalized = path.normalize(resolved)
  
  // Make relative to workspace root (use forward slashes for glob matching)
  const relative = path.relative(workspaceRoot, normalized)
  return relative.split(path.sep).join("/") // Normalize to forward slashes
}

/**
 * Check if a file path matches a glob pattern
 * Supports negation patterns (starting with !)
 */
export function matchesGlobPattern(
  filePath: string, 
  pattern: string, 
  workspaceRoot: string
): boolean {
  const normalizedPath = normalizePath(filePath, workspaceRoot)
  const isNegation = pattern.startsWith("!")
  const actualPattern = isNegation ? pattern.slice(1) : pattern
  
  // Use minimatch for glob pattern matching
  const match = minimatch(normalizedPath, actualPattern, {
    dot: true, // Match hidden files
    nocase: false, // Case-sensitive matching
  })
  
  return isNegation ? !match : match
}

/**
 * Check if a file path matches any pattern in an array
 * Handles inclusion and exclusion patterns (exclusions override inclusions)
 */
export function matchesAnyGlobPattern(
  filePath: string,
  patterns: string[],
  workspaceRoot: string
): boolean {
  if (patterns.length === 0) {
    return false // No patterns = no match
  }
  
  const inclusionPatterns = patterns.filter(p => !p.startsWith("!"))
  const exclusionPatterns = patterns.filter(p => p.startsWith("!"))
  
  // Check exclusions first (if excluded, never matches)
  for (const exclusionPattern of exclusionPatterns) {
    if (matchesGlobPattern(filePath, exclusionPattern, workspaceRoot)) {
      return false
    }
  }
  
  // If no inclusions, only exclusions matter (and we've already checked)
  if (inclusionPatterns.length === 0) {
    return true // No inclusions means "allow everything except exclusions"
  }
  
  // Check if matches any inclusion pattern
  for (const inclusionPattern of inclusionPatterns) {
    if (matchesGlobPattern(filePath, inclusionPattern, workspaceRoot)) {
      return true
    }
  }
  
  return false
}
```

### 1.3 Tests

- **File**: `src/hooks/utils/pathMatcher.test.ts` (or `.spec.ts` depending on test framework)
- **Test cases**:
  - Inclusion patterns (e.g. `"src/**/*.ts"` matches `src/utils/file.ts`)
  - Exclusion patterns (e.g. `"!**/*.test.ts"` excludes `src/utils/file.test.ts`)
  - Combined inclusion/exclusion (inclusion + exclusion = excluded)
  - Windows path normalization (backslashes → forward slashes)
  - Relative path resolution
  - Edge cases (empty patterns, root paths, hidden files)

---

## Phase 2: Command Classification Utility

### 2.1 Create command classifier module

- **File**: `src/hooks/utils/commandClassification.ts`
- **Purpose**: Classify tools as SAFE (read-only) or DESTRUCTIVE (write/delete/execute)

### 2.2 Implementation

```typescript
export enum CommandType {
  SAFE = "SAFE",
  DESTRUCTIVE = "DESTRUCTIVE",
}

/**
 * Known SAFE (read-only) tools
 */
const SAFE_TOOLS = new Set([
  "read_file",
  "search_files",
  "list_files",
  "read_directory",
  "grep",
  "select_active_intent", // Intent selection is safe
] as const)

/**
 * Known DESTRUCTIVE (write/delete/execute) tools
 */
const DESTRUCTIVE_TOOLS = new Set([
  "write_to_file",
  "delete_file",
  "execute_command",
  "apply_patch",
  "edit_file", // If exists
] as const)

/**
 * Classify a tool as SAFE or DESTRUCTIVE
 * Unknown tools default to DESTRUCTIVE (fail-safe)
 */
export function classifyCommand(toolName: string): CommandType {
  if (SAFE_TOOLS.has(toolName as any)) {
    return CommandType.SAFE
  }
  if (DESTRUCTIVE_TOOLS.has(toolName as any)) {
    return CommandType.DESTRUCTIVE
  }
  // Unknown tools default to DESTRUCTIVE (fail-safe)
  return CommandType.DESTRUCTIVE
}

/**
 * Check if a tool is destructive
 */
export function isDestructiveCommand(toolName: string): boolean {
  return classifyCommand(toolName) === CommandType.DESTRUCTIVE
}

/**
 * Determine if a tool requires user approval
 * Requires approval if:
 * - Tool is destructive AND not already blocked by scope
 * - OR scope violation occurred (user can approve anyway)
 */
export function requiresApproval(
  toolName: string,
  blocked: boolean,
  scopeViolation: boolean
): boolean {
  // If already blocked by scope, approval handled separately
  if (blocked && scopeViolation) {
    return true // Scope violation requires approval dialog
  }
  // Destructive commands require approval
  return isDestructiveCommand(toolName)
}
```

### 2.3 Tests

- **File**: `src/hooks/utils/commandClassification.test.ts`
- **Test cases**:
  - SAFE tools return `CommandType.SAFE`
  - DESTRUCTIVE tools return `CommandType.DESTRUCTIVE`
  - Unknown tools return `CommandType.DESTRUCTIVE` (fail-safe)
  - `requiresApproval` logic for various combinations

---

## Phase 3: YAML Loader Enhancement with Caching

### 3.1 Update yamlLoader with caching

- **File**: `src/hooks/utils/yamlLoader.ts` (update existing)
- **Add**: Module-level cache for intent scope

### 3.2 Implementation

```typescript
// Add to existing yamlLoader.ts

/**
 * Cache for intent scope (owned_scope)
 * Key: intentId, Value: owned_scope array
 */
const intentScopeCache = new Map<string, string[]>()

/**
 * Get cached intent scope
 */
export function getCachedIntentScope(intentId: string): string[] | null {
  return intentScopeCache.get(intentId) || null
}

/**
 * Set cached intent scope
 */
export function setCachedIntentScope(intentId: string, scope: string[]): void {
  intentScopeCache.set(intentId, scope)
}

/**
 * Clear cached intent scope (call when intent changes)
 */
export function clearCachedIntentScope(intentId?: string): void {
  if (intentId) {
    intentScopeCache.delete(intentId)
  } else {
    intentScopeCache.clear()
  }
}

/**
 * Enhanced findIntentById that caches scope
 */
export async function findIntentByIdWithCache(
  workspaceRoot: string,
  intentId: string
): Promise<ActiveIntent | null> {
  // Check cache first
  const cachedScope = getCachedIntentScope(intentId)
  if (cachedScope !== null) {
    // Return cached intent (we need full intent, so still load but use cached scope)
    const intent = await findIntentById(workspaceRoot, intentId)
    if (intent) {
      return { ...intent, owned_scope: cachedScope }
    }
  }
  
  // Load from YAML
  const intent = await findIntentById(workspaceRoot, intentId)
  if (intent) {
    // Cache the scope
    setCachedIntentScope(intentId, intent.owned_scope)
  }
  
  return intent
}
```

### 3.3 Update selectActiveIntentPreHook

- **File**: `src/hooks/preHooks/selectActiveIntent.ts`
- **Update**: After loading intent, cache the scope:
  ```typescript
  // After finding intent, cache scope
  if (intent) {
    setCachedIntentScope(intent_id, intent.owned_scope)
  }
  ```

---

## Phase 4: Write File Pre-Hook Implementation

### 4.1 Update writeFilePreHook

- **File**: `src/hooks/preHooks/writeFile.ts` (update existing)
- **Purpose**: Implement scope validation logic

### 4.2 Implementation

```typescript
import { findIntentByIdWithCache, getCachedIntentScope } from "../utils/yamlLoader"
import { matchesAnyGlobPattern } from "../utils/pathMatcher"
import { formatStructuredError } from "../utils/errorFormatter"

export async function writeFilePreHook(
  args: WriteFilePreHookArgs,
  context: WriteFilePreHookContext,
): Promise<WriteFilePreHookResult> {
  const { path: filePath, content } = args
  const { intentId, workspaceRoot } = context
  
  // 1. Check if intent is active
  if (!intentId) {
    return {
      blocked: true,
      error: formatStructuredError(
        "MISSING_INTENT",
        "No active intent selected. You must call select_active_intent with a valid intent ID (INT-XXX) before writing files.",
        "Call select_active_intent first to select an intent.",
        true
      ),
    }
  }
  
  if (!workspaceRoot) {
    return {
      blocked: true,
      error: formatStructuredError(
        "MISSING_WORKSPACE_ROOT",
        "Workspace root not provided. Cannot validate file path.",
        "Ensure workspace root is available in context.",
        false
      ),
    }
  }
  
  // 2. Load intent scope (use cache if available)
  let ownedScope: string[] | null = null
  
  // Try cache first
  ownedScope = getCachedIntentScope(intentId)
  
  // If cache miss, load from YAML
  if (ownedScope === null) {
    const intent = await findIntentByIdWithCache(workspaceRoot, intentId)
    if (!intent) {
      return {
        blocked: true,
        error: formatStructuredError(
          "INTENT_NOT_FOUND",
          `Intent "${intentId}" not found in .orchestration/active_intents.yaml.`,
          "Select a different intent or ensure the intent exists in active_intents.yaml.",
          true
        ),
      }
    }
    ownedScope = intent.owned_scope
  }
  
  // 3. Validate path against scope
  const isInScope = matchesAnyGlobPattern(filePath, ownedScope, workspaceRoot)
  
  if (!isInScope) {
    return {
      blocked: true,
      error: formatStructuredError(
        "SCOPE_VIOLATION",
        `File "${filePath}" is outside the scope of intent "${intentId}". Scope patterns: ${ownedScope.join(", ")}`,
        `Select a different intent that includes "${filePath}" or request scope expansion for intent "${intentId}".`,
        true
      ),
    }
  }
  
  // 4. Path is in scope, allow execution
  return { blocked: false }
}
```

### 4.3 Update WriteFilePreHookResult interface

- **Update**: `WriteFilePreHookResult` to include `scopeViolation?: boolean` flag:
  ```typescript
  export interface WriteFilePreHookResult {
    blocked: boolean
    error?: string
    scopeViolation?: boolean // true if blocked due to scope violation
  }
  ```

---

## Phase 5: Error Formatter Utility

### 5.1 Create error formatter module

- **File**: `src/hooks/utils/errorFormatter.ts`
- **Purpose**: Format structured JSON errors that LLM can parse

### 5.2 Implementation

```typescript
export interface StructuredError {
  error: string
  reason: string
  suggestion: string
  recoverable: boolean
}

/**
 * Format a structured error as JSON string
 * LLM can parse this and attempt recovery
 */
export function formatStructuredError(
  error: string,
  reason: string,
  suggestion: string = "",
  recoverable: boolean = true
): string {
  const structured: StructuredError = {
    error,
    reason,
    suggestion: suggestion || "Review the error and try again.",
    recoverable,
  }
  
  return JSON.stringify(structured, null, 2)
}

/**
 * Parse a structured error from JSON string
 */
export function parseStructuredError(errorString: string): StructuredError | null {
  try {
    return JSON.parse(errorString) as StructuredError
  } catch {
    return null
  }
}
```

---

## Phase 6: UI Integration - Dialog Utilities

### 6.1 Create dialog utility module

- **File**: `src/hooks/utils/dialogs.ts`
- **Purpose**: Show modal approval dialogs for scope violations and destructive actions

### 6.2 Implementation

```typescript
import * as vscode from "vscode"

export type DialogChoice = "approve" | "reject"

/**
 * Show approval dialog for scope violation
 * Returns "approve" if user clicks "Approve Anyway", "reject" otherwise
 */
export async function showScopeViolationDialog(
  filePath: string,
  intentId: string,
  scopePatterns: string[]
): Promise<DialogChoice> {
  const message = `Scope Violation: Intent "${intentId}" is not authorized to edit "${filePath}".\n\nScope patterns: ${scopePatterns.join(", ")}\n\nDo you want to approve this action anyway?`
  
  const choice = await vscode.window.showWarningMessage(
    message,
    { modal: true },
    "Approve Anyway",
    "Reject"
  )
  
  return choice === "Approve Anyway" ? "approve" : "reject"
}

/**
 * Show approval dialog for destructive action
 * Returns "approve" if user clicks "Approve", "reject" otherwise
 */
export async function showDestructiveActionDialog(
  toolName: string,
  description: string
): Promise<DialogChoice> {
  const message = `Destructive Action: ${toolName}\n\n${description}\n\nDo you want to proceed?`
  
  const choice = await vscode.window.showWarningMessage(
    message,
    { modal: true },
    "Approve",
    "Reject"
  )
  
  return choice === "Approve" ? "approve" : "reject"
}
```

---

## Phase 7: Integration in presentAssistantMessage

### 7.1 Update presentAssistantMessage for write_to_file

- **File**: `src/core/assistant-message/presentAssistantMessage.ts`
- **Location**: `case "write_to_file":` block (around line 719)

### 7.2 Implementation

```typescript
case "write_to_file": {
  await checkpointSaveAndMark(cline)
  const writeParams = (block.nativeArgs ?? block.params) as { path?: string; content?: string }
  
  // Run pre-hook for scope validation
  const writePreResult = await writeFilePreHook(
    { path: writeParams?.path ?? "", content: writeParams?.content ?? "" },
    {
      intentId: cline.currentIntentId,
      workspaceRoot: cline.cwd,
      ownedScope: cline.currentIntentScope, // Pass cached scope if available
    },
  )
  
  // If blocked, show approval dialog for scope violations
  if (writePreResult.blocked) {
    if (writePreResult.scopeViolation) {
      // Show scope violation dialog
      const scopePatterns = cline.currentIntentScope || []
      const dialogChoice = await showScopeViolationDialog(
        writeParams?.path ?? "",
        cline.currentIntentId ?? "",
        scopePatterns
      )
      
      if (dialogChoice === "reject") {
        // User rejected, return structured error
        pushToolResult(formatResponse.toolError(writePreResult.error ?? "Action rejected by user."))
        break
      }
      // User approved anyway, continue to tool execution
    } else {
      // Other blocking reason (e.g. missing intent), return error
      pushToolResult(formatResponse.toolError(writePreResult.error ?? "Action blocked."))
      break
    }
  }
  
  // Check if destructive (for approval dialog)
  const isDestructive = isDestructiveCommand("write_to_file")
  if (isDestructive && !writePreResult.blocked) {
    const dialogChoice = await showDestructiveActionDialog(
      "write_to_file",
      `Write to file: ${writeParams?.path}`
    )
    
    if (dialogChoice === "reject") {
      pushToolResult(formatResponse.toolError(
        formatStructuredError(
          "DESTRUCTIVE_ACTION_REJECTED",
          "User rejected the destructive action.",
          "The file write operation was cancelled.",
          false
        )
      ))
      break
    }
  }
  
  // Proceed with tool execution (existing code)
  // ... rest of write_to_file handling
  break
}
```

### 7.3 Update select_active_intent case to cache scope

- **File**: `src/core/assistant-message/presentAssistantMessage.ts`
- **Location**: `case "select_active_intent":` block (around line 692)

```typescript
case "select_active_intent": {
  // ... existing code ...
  
  cline.currentIntentId = intentId
  
  // Cache the scope after successful intent selection
  if (preHookResult.context) {
    // Parse intent from context or load it
    const intent = await findIntentByIdWithCache(cline.cwd, intentId)
    if (intent) {
      cline.currentIntentScope = intent.owned_scope
    }
  }
  
  // ... rest of existing code ...
  break
}
```

### 7.4 Add Task class property

- **File**: `src/core/task/Task.ts`
- **Location**: Near `currentIntentId` property (around line 393)

```typescript
/** Set by select_active_intent pre-hook; used by gatekeeper and write_file scope enforcement. */
currentIntentId: string | null = null
/** Cached owned_scope from active intent; avoids repeated YAML reads. */
currentIntentScope: string[] | null = null
```

---

## Phase 8: Destructive Command Pre-Hooks

### 8.1 Create deleteFilePreHook

- **File**: `src/hooks/preHooks/deleteFile.ts` (new file)
- **Purpose**: Check classification and show approval dialog

```typescript
import { isDestructiveCommand } from "../utils/commandClassification"

export interface DeleteFilePreHookArgs {
  path: string
}

export interface DeleteFilePreHookResult {
  blocked: boolean
  error?: string
}

export interface DeleteFilePreHookContext {
  intentId: string | null
  workspaceRoot?: string
}

export async function deleteFilePreHook(
  args: DeleteFilePreHookArgs,
  context: DeleteFilePreHookContext,
): Promise<DeleteFilePreHookResult> {
  // Destructive commands require approval (handled in presentAssistantMessage)
  // This pre-hook just marks it as destructive
  return { blocked: false }
}
```

### 8.2 Create executeCommandPreHook

- **File**: `src/hooks/preHooks/executeCommand.ts` (new file)
- **Similar structure to deleteFilePreHook**

### 8.3 Create applyPatchPreHook

- **File**: `src/hooks/preHooks/applyPatch.ts` (new file)
- **Purpose**: Validate all affected paths against scope

```typescript
import { findIntentByIdWithCache } from "../utils/yamlLoader"
import { matchesAnyGlobPattern } from "../utils/pathMatcher"
import { formatStructuredError } from "../utils/errorFormatter"

export interface ApplyPatchPreHookArgs {
  // Patch format depends on your implementation
  // Example: { file: string, patch: string } or { files: Array<{path: string, ...}> }
  [key: string]: unknown
}

export interface ApplyPatchPreHookResult {
  blocked: boolean
  error?: string
  scopeViolation?: boolean
}

export interface ApplyPatchPreHookContext {
  intentId: string | null
  workspaceRoot?: string
}

export async function applyPatchPreHook(
  args: ApplyPatchPreHookArgs,
  context: ApplyPatchPreHookContext,
): Promise<ApplyPatchPreHookResult> {
  // Extract affected file paths from patch
  // Validate each path against scope
  // Return blocked if any path is out of scope
  // Implementation depends on patch format
}
```

### 8.4 Integrate in presentAssistantMessage

- Add cases for `delete_file`, `execute_command`, `apply_patch`
- Follow same pattern as `write_to_file`: pre-hook → dialog → execute or reject

---

## Phase 9: Testing and Integration

### 9.1 Unit tests

- **Path matcher**: Test glob patterns, negation, Windows paths
- **Command classifier**: Test SAFE/DESTRUCTIVE classification
- **Error formatter**: Test JSON structure and parsing
- **Pre-hooks**: Test scope validation, error cases, caching

### 9.2 Integration tests

- **End-to-end flow**: Intent selection → scope validation → dialog → execution
- **Error recovery**: Verify LLM can parse structured errors
- **Performance**: Verify caching works (no repeated YAML reads)

### 9.3 Manual testing checklist

- [ ] Scope violation shows approval dialog
- [ ] Destructive command shows approval dialog
- [ ] Rejected actions return structured errors
- [ ] Approved actions proceed to execution
- [ ] Scope caching works (check YAML read count)
- [ ] Windows paths work correctly
- [ ] Negation patterns work correctly

---

## File creation/modification summary

### New files

1. `src/hooks/utils/pathMatcher.ts` - Glob pattern matching
2. `src/hooks/utils/commandClassification.ts` - Tool classification
3. `src/hooks/utils/errorFormatter.ts` - Structured error formatting
4. `src/hooks/utils/dialogs.ts` - VS Code dialog utilities
5. `src/hooks/preHooks/deleteFile.ts` - Delete file pre-hook
6. `src/hooks/preHooks/executeCommand.ts` - Execute command pre-hook
7. `src/hooks/preHooks/applyPatch.ts` - Apply patch pre-hook

### Modified files

1. `src/hooks/utils/yamlLoader.ts` - Add caching functions
2. `src/hooks/preHooks/writeFile.ts` - Implement scope validation
3. `src/hooks/preHooks/selectActiveIntent.ts` - Cache scope after selection
4. `src/core/task/Task.ts` - Add `currentIntentScope` property
5. `src/core/assistant-message/presentAssistantMessage.ts` - Integrate pre-hooks and dialogs

---

## Implementation sequence

1. **Phase 1**: Path matcher utility + tests
2. **Phase 2**: Command classifier + tests
3. **Phase 3**: YAML loader caching + update selectActiveIntentPreHook
4. **Phase 5**: Error formatter (needed by Phase 4)
5. **Phase 4**: Write file pre-hook implementation
6. **Phase 6**: Dialog utilities
7. **Phase 7**: Integration in presentAssistantMessage
8. **Phase 8**: Other destructive pre-hooks
9. **Phase 9**: Testing and integration

---

## Technical decisions

- **glob package**: Use `glob@^11.1.0` (already installed) for pattern matching
- **Caching strategy**: Cache `owned_scope` in `Task.currentIntentScope` and module-level cache in `yamlLoader`
- **Dialog API**: Use `vscode.window.showWarningMessage` with `{ modal: true }` for blocking dialogs
- **Error format**: Structured JSON with `{ error, reason, suggestion, recoverable }` fields
- **Fail-safe defaults**: Unknown tools default to DESTRUCTIVE

---

_This plan implements the security boundary layer that enforces scope validation and provides UI-blocking authorization, building on Phase 1's intent selection foundation._
