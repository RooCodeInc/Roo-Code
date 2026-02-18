# Data Model: Intent-Governed Hook Middleware

**Feature**: Intent-Governed Hook Middleware  
**Date**: 2026-02-16  
**Phase**: 1 - Design & Contracts

## Entities

### 1. ActiveIntent

**Purpose**: Represents the currently selected intent that governs tool operations.

**Fields**:

- `id: string` - Unique intent identifier (e.g., "INT-001")
- `name: string` - Human-readable intent name
- `description: string` - Detailed description of the intent
- `status: IntentStatus` - Current status (PENDING | IN_PROGRESS | COMPLETED | BLOCKED)
- `ownedScope: string[]` - Array of glob patterns defining authorized file paths
- `constraints: string[]` - Array of explicit constraints or requirements
- `acceptanceCriteria: string[]` - Array of acceptance criteria defining "Definition of Done"
- `metadata?: Record<string, unknown>` - Optional additional metadata

**Relationships**:

- One-to-many with TraceLogEntry (one intent can have many trace entries)
- One-to-one with Task (one active intent per task at a time)

**Validation Rules**:

- `id` must be unique and stable (format: INT-XXX)
- `status` must be one of the defined enum values
- `ownedScope` must contain at least one valid glob pattern
- `ownedScope` patterns must be valid glob syntax

**State Transitions**:

- PENDING → IN_PROGRESS (when selected as active intent)
- IN_PROGRESS → COMPLETED (when acceptance criteria met)
- IN_PROGRESS → BLOCKED (when blocked by dependency or issue)
- BLOCKED → IN_PROGRESS (when unblocked)

**Storage**: Loaded from `.orchestration/active_intents.yaml`

---

### 2. TraceLogEntry

**Purpose**: Records a file write operation with full traceability metadata.

**Fields**:

- `intentId: string` - ID of the active intent that authorized this operation
- `contentHash: string` - SHA256 hash of the file content (hex string)
- `filePath: string` - Relative path from workspace root
- `mutationClass: MutationClass` - Type of mutation (CREATE | MODIFY)
- `lineRanges?: LineRange[]` - Optional array of affected line ranges
- `timestamp: string` - ISO 8601 timestamp of the operation
- `toolName: string` - Name of the tool that performed the operation (e.g., "write_to_file")
- `gitSha?: string` - Optional Git commit SHA if available

**Relationships**:

- Many-to-one with ActiveIntent (many trace entries link to one intent)

**Validation Rules**:

- `intentId` must reference a valid intent ID
- `contentHash` must be a valid SHA256 hex string (64 characters)
- `filePath` must be relative to workspace root (no absolute paths)
- `timestamp` must be valid ISO 8601 format
- `mutationClass` must be CREATE or MODIFY

**Storage**: Appended to `.orchestration/agent_trace.jsonl` (append-only)

---

### 3. IntentScopePattern

**Purpose**: Defines file path patterns for scope validation.

**Fields**:

- `pattern: string` - Glob pattern (e.g., "src/components/\*\*")
- `description?: string` - Optional human-readable description

**Validation Rules**:

- Pattern must be valid glob syntax
- Supports `*` (single segment) and `**` (recursive) wildcards
- Patterns are matched against workspace-relative file paths

**Usage**: Used in `ActiveIntent.ownedScope` array

---

### 4. FileStateLock

**Purpose**: Tracks expected file state for optimistic locking.

**Fields**:

- `filePath: string` - Relative path from workspace root
- `expectedHash: string` - SHA256 hash of file content when operation started
- `operationId: string` - Unique identifier for the operation
- `timestamp: string` - ISO 8601 timestamp when lock was created

**Relationships**:

- One-to-one with file write operation (one lock per operation)

**Validation Rules**:

- `expectedHash` must be valid SHA256 hex string
- `filePath` must be relative to workspace root
- Lock expires after operation completes or fails

**Storage**: In-memory (not persisted, per-operation)

---

### 5. IntentContext

**Purpose**: Dynamic information injected into system prompts.

**Fields**:

- `intentId: string` - ID of the active intent
- `description: string` - Intent description
- `scope: string[]` - Array of scope patterns
- `constraints: string[]` - Array of constraints
- `status: IntentStatus` - Current intent status

**Relationships**:

- Derived from ActiveIntent (constructed when intent is selected)

**Usage**: Injected into system prompt as XML block

---

## Enums

### IntentStatus

```typescript
enum IntentStatus {
	PENDING = "PENDING",
	IN_PROGRESS = "IN_PROGRESS",
	COMPLETED = "COMPLETED",
	BLOCKED = "BLOCKED",
}
```

### MutationClass

```typescript
enum MutationClass {
	CREATE = "CREATE",
	MODIFY = "MODIFY",
}
```

---

## Type Definitions

### LineRange

```typescript
interface LineRange {
	start: number // 1-based line number
	end: number // 1-based line number (inclusive)
}
```

### active_intents.yaml Schema

```yaml
intents:
    - id: string # INT-XXX format
      name: string
      description: string
      status: IntentStatus
      owned_scope:
          - string # Glob pattern
      constraints:
          - string
      acceptance_criteria:
          - string
      metadata?: object
```

### agent_trace.jsonl Format

Each line is a JSON object:

```json
{
	"intent_id": "INT-001",
	"content_hash": "abc123...",
	"file_path": "src/components/Button.tsx",
	"mutation_class": "MODIFY",
	"line_ranges": [{ "start": 10, "end": 25 }],
	"timestamp": "2026-02-16T10:30:00Z",
	"tool_name": "write_to_file",
	"git_sha": "abc123def456..."
}
```

---

## Data Flow

### Intent Selection Flow

1. User/AI calls `select_active_intent` tool with intent ID
2. `IntentManager` loads intent from `active_intents.yaml`
3. Validates intent exists and is valid
4. Sets as active intent in `Task` state
5. Updates system prompt with intent context

### File Write Flow

1. Tool execution initiated (e.g., `write_to_file`)
2. Pre-Hook: `HookEngine` intercepts
3. Pre-Hook: Validates active intent exists
4. Pre-Hook: Validates file path against intent scope
5. Pre-Hook: Creates `FileStateLock` with expected hash
6. Tool executes (if validation passes)
7. Post-Hook: Computes content hash of written file
8. Post-Hook: Compares hash with expected (optimistic locking)
9. Post-Hook: Creates `TraceLogEntry` with metadata
10. Post-Hook: Appends to `agent_trace.jsonl`

### Trace Logging Flow

1. File write operation completes
2. `TraceManager` creates `TraceLogEntry` object
3. Validates all required fields
4. Formats as JSON
5. Appends to `agent_trace.jsonl` file (async)
6. Handles errors gracefully (logs but doesn't fail operation)

---

## Validation Rules Summary

### ActiveIntent Validation

- ID format: `INT-XXX` where XXX is numeric
- Status must be valid enum value
- At least one scope pattern required
- All scope patterns must be valid glob syntax

### TraceLogEntry Validation

- Intent ID must reference existing intent
- Content hash must be 64-character hex string
- File path must be workspace-relative
- Timestamp must be valid ISO 8601

### Scope Pattern Validation

- Must be valid glob syntax
- No absolute paths allowed
- No path traversal patterns (`../`)
- Normalized to workspace-relative before matching

---

## Error Handling

### Missing Intent

- Error: "No active intent selected. Please call select_active_intent first."
- Action: Block operation, return error to user

### Scope Violation

- Error: "Scope Violation: INT-XXX is not authorized to edit [filename]. Request scope expansion."
- Action: Block operation, return error to user

### Optimistic Lock Conflict

- Error: "Stale File: File was modified by another process. Please re-read and retry."
- Action: Block write, return error, allow retry

### Trace Logging Failure

- Error: Logged but operation continues (non-blocking)
- Action: Retry append, if fails log error but don't fail operation

### YAML Parsing Error

- Error: "Invalid active_intents.yaml: [error message]"
- Action: Return error, don't load intents, allow manual fix
