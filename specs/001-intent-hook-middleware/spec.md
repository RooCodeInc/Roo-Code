# Feature Specification: Intent-Governed Hook Middleware

**Feature Branch**: `001-intent-hook-middleware`  
**Created**: 2026-02-16  
**Updated**: 2026-02-16  
**Status**: Partially Implemented  
**Input**: User description: "I want to implement an Intent-Governed Hook Middleware for the VS Code extension. The system must: Enforce selection of an active intent before destructive tool calls. Validate file writes against owned_scope in active_intents.yaml. Log all write operations to .orchestration/agent_trace.jsonl. Compute SHA256 content hashes for spatial independence. Implement optimistic locking to prevent stale writes. Inject intent context dynamically into the system prompt. The solution must follow a middleware/interceptor architecture and isolate hooks inside src/hooks/."

## Implementation Status

### ✅ Completed Features

- **User Story 1 - Intent Selection Before Destructive Operations (P1)**: ✅ COMPLETE

    - `select_active_intent` tool implemented and registered
    - PreToolHook validates active intent before destructive operations
    - Task.activeIntentId property added for intent tracking
    - Intent selection blocks write_to_file and execute_command without active intent

- **User Story 2 - Scope Validation for File Operations (P1)**: ✅ COMPLETE

    - ScopeValidator class implemented with glob pattern matching
    - PreToolHook validates file paths against intent's ownedScope
    - Clear error messages for scope violations

- **User Story 6 - Dynamic Intent Context Injection (P2)**: ✅ COMPLETE
    - Intent context injection implemented in system prompt
    - `getIntentGovernanceSection` dynamically loads and formats intent context
    - System prompt includes active intent information when available

### 🚧 Remaining Features

- **User Story 3 - Traceability Logging for All Write Operations (P2)**: ❌ NOT STARTED

    - TraceManager class needs to be implemented
    - PostToolHook needs to be created to log operations after execution
    - agent_trace.jsonl logging infrastructure required

- **User Story 4 - Content Hashing for Spatial Independence (P2)**: ❌ NOT STARTED

    - SHA256 content hash computation needs to be added to TraceManager
    - Content hash must be computed for every file write operation
    - Hash computation performance validation required (<50ms for files up to 1MB)

- **User Story 5 - Optimistic Locking to Prevent Stale Writes (P3)**: ❌ NOT STARTED
    - OptimisticLockManager class needs to be implemented
    - File state lock creation and validation required
    - Conflict detection and error handling needed

## Clarifications

### Session 2026-02-16

- Q: How should users select an active intent? → A: Tool call selection - User/AI calls a `select_active_intent` tool with intent ID
- Q: Can multiple intents be active simultaneously, and if so, how should scope validation work? → A: Single active intent only - Only one intent can be active at a time; selecting a new intent replaces the previous one
- Q: Which state indicator should be used for optimistic locking to detect file conflicts? → A: Content hash (SHA256) - Compare SHA256 hash of file content before and after operation
- Q: What should happen if a user selects a new intent while a tool execution is in progress? → A: Defer to next operation - Intent change is queued and applies to the next tool execution; current operation completes with original intent
- Q: What pattern matching rules should be used for scope validation? → A: Glob patterns - Use glob-style matching with `*` (single segment) and `**` (recursive) wildcards

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Intent Selection Before Destructive Operations (Priority: P1)

A developer using the AI assistant wants to make code changes, but the system ensures they have selected a specific intent that governs what changes are allowed. This prevents accidental modifications outside the intended scope and maintains traceability between business requirements and code changes.

**Why this priority**: This is the foundational governance mechanism. Without intent selection, the system cannot enforce scope boundaries or maintain intent-code traceability. It's the first line of defense against unauthorized changes.

**Independent Test**: Can be fully tested by attempting a file write operation without selecting an intent first, verifying the system blocks the operation and prompts for intent selection. This delivers immediate value by preventing ungoverned changes.

**Acceptance Scenarios**:

1. **Given** a developer initiates a file write operation, **When** no active intent is selected, **Then** the system blocks the operation and requires intent selection via the `select_active_intent` tool before proceeding
2. **Given** a developer has selected an active intent, **When** they attempt a file write operation, **Then** the system validates the file path against the intent's scope and allows or denies based on scope rules
3. **Given** a developer attempts a destructive command execution, **When** no active intent is selected, **Then** the system blocks the command and requires intent selection

---

### User Story 2 - Scope Validation for File Operations (Priority: P1)

A developer working on a specific feature wants to ensure that file modifications only occur within the intended scope defined in the active intent. The system validates every file write against the intent's owned_scope to prevent modifications outside the authorized boundaries.

**Why this priority**: Scope validation is critical for maintaining code organization and preventing unintended side effects. It ensures that changes align with the declared intent boundaries, which is essential for parallel development and code governance.

**Independent Test**: Can be fully tested by selecting an intent with a specific scope (e.g., "src/components/"), attempting to write to a file within scope (should succeed) and outside scope (should fail). This delivers value by enforcing organizational boundaries.

**Acceptance Scenarios**:

1. **Given** an active intent with owned_scope "src/components/**", **When** a developer attempts to write to "src/components/Button.tsx", **Then\*\* the system validates the path matches the scope and allows the operation
2. **Given** an active intent with owned_scope "src/components/**", **When** a developer attempts to write to "src/utils/helpers.ts", **Then\*\* the system validates the path does not match the scope and blocks the operation with a clear error message
3. **Given** an active intent with multiple scope patterns, **When** a developer attempts a file write, **Then** the system checks the path against all patterns and allows if any pattern matches

---

### User Story 3 - Traceability Logging for All Write Operations (Priority: P2)

A developer or project manager wants to maintain a complete audit trail of all file modifications linked to their corresponding intents. Every write operation is logged with intent context, content hashes, and metadata for full traceability.

**Why this priority**: Traceability enables accountability, debugging, and understanding the evolution of code changes. While not blocking operations, it's essential for governance and compliance. Can be implemented after core validation is working.

**Independent Test**: Can be fully tested by performing a file write operation with an active intent, then verifying the operation is logged to the trace file with correct intent ID, content hash, and file path. This delivers value by providing audit capabilities.

**Acceptance Scenarios**:

1. **Given** a file write operation completes successfully, **When** the system logs the operation, **Then** the trace entry includes intent_id, content_hash (SHA256), file_path, mutation_class, and timestamp
2. **Given** multiple file write operations occur, **When** each operation completes, **Then** each operation is appended to the trace log in chronological order
3. **Given** a file write operation fails validation, **When** the system handles the failure, **Then** the failure is optionally logged with reason for audit purposes

---

### User Story 4 - Content Hashing for Spatial Independence (Priority: P2)

A developer working in a distributed or parallel development environment wants changes to be tracked by content rather than location, enabling the system to detect identical changes across different file paths or recognize when the same content appears in multiple contexts.

**Why this priority**: Content hashing enables spatial independence, allowing the system to track changes by what changed rather than where. This is valuable for refactoring, parallel development, and detecting duplicate work. Can be implemented alongside traceability logging.

**Independent Test**: Can be fully tested by writing the same content to different files and verifying they produce the same hash, or by modifying content and verifying the hash changes. This delivers value by enabling content-based change tracking.

**Acceptance Scenarios**:

1. **Given** a file write operation with content "function hello() {}", **When** the system computes the content hash, **Then** the hash is a SHA256 digest of the content bytes
2. **Given** the same content is written to two different file paths, **When** the system computes hashes, **Then** both operations produce identical hash values
3. **Given** file content is modified, **When** the system computes the new hash, **Then** the new hash differs from the previous hash

---

### User Story 5 - Optimistic Locking to Prevent Stale Writes (Priority: P3)

A developer working in a parallel development scenario wants protection against overwriting changes made by other processes or instances. The system uses optimistic locking to detect conflicts and prevent data loss.

**Why this priority**: Optimistic locking prevents race conditions in parallel orchestration scenarios. While important for multi-instance safety, it can be implemented after core functionality is stable. The system should gracefully handle conflicts when they occur.

**Independent Test**: Can be fully tested by simulating concurrent write attempts to the same file and verifying the system detects the conflict and prevents the stale write. This delivers value by ensuring data integrity in parallel workflows.

**Acceptance Scenarios**:

1. **Given** a file write operation is initiated, **When** the system checks the file's current state, **Then** it computes the SHA256 hash of the current file content and compares it with the expected hash, proceeding only if they match
2. **Given** a file was modified by another process since the operation started, **When** the system detects the state mismatch, **Then** it rejects the write operation and reports a conflict
3. **Given** a conflict is detected, **When** the system handles the conflict, **Then** it provides clear information about what changed and allows the developer to resolve the conflict

---

### User Story 6 - Dynamic Intent Context Injection (Priority: P2)

A developer wants the AI assistant to have awareness of the active intent's context, requirements, and constraints when generating responses. The system dynamically injects intent context into the system prompt so the AI can make informed decisions aligned with the intent.

**Why this priority**: Context injection enables the AI to work within intent boundaries and make decisions that align with declared requirements. This improves the quality of AI-generated code and reduces out-of-scope suggestions. Can be implemented after intent selection is working.

**Independent Test**: Can be fully tested by selecting an intent, initiating an AI conversation, and verifying the system prompt includes intent context. This delivers value by improving AI response quality and alignment with intent.

**Acceptance Scenarios**:

1. **Given** an active intent is selected, **When** the system constructs the prompt for the AI, **Then** the prompt includes intent context with description, scope, and constraints
2. **Given** no active intent is selected, **When** the system constructs the prompt, **Then** the prompt does not include intent context or includes a prompt to select an intent
3. **Given** intent context is injected, **When** the AI generates a response, **Then** the AI's suggestions and tool calls align with the intent's scope and requirements

---

### Edge Cases

- What happens when the active_intents.yaml file is missing or malformed?
- How does the system handle file write operations when the .orchestration directory doesn't exist?
- What happens when a new intent is selected while another intent is already active? (Answer: The new intent replaces the previous one, becoming the single active intent)
- How does the system handle intent selection during an ongoing tool execution? (Answer: Intent change is deferred and applies to the next tool execution; current operation completes with the original intent)
- What happens when a file write operation fails after validation passes but before completion?
- How does the system handle hash computation for very large files?
- What happens when optimistic locking detects a conflict but the file is being read by another process?
- How does the system handle intent context injection when the intent file is modified during an active session?
- What happens when the trace log file becomes corrupted or inaccessible?
- How does the system handle scope validation for symbolic links or special file paths?

## Requirements _(mandatory)_

### Functional Requirements

#### ✅ Implemented Requirements

- **FR-001**: System MUST require selection of an active intent before allowing any file write operations ✅ **IMPLEMENTED**
- **FR-001a**: System MUST provide a `select_active_intent` tool that accepts an intent ID parameter to set the active intent ✅ **IMPLEMENTED**
- **FR-001b**: System MUST allow only one active intent at a time; selecting a new intent MUST replace the previous active intent ✅ **IMPLEMENTED**
- **FR-001c**: System MUST defer intent changes during ongoing tool execution; the new intent applies to the next tool execution while the current operation completes with the original intent ✅ **IMPLEMENTED**
- **FR-002**: System MUST require selection of an active intent before allowing any command execution operations that modify system state ✅ **IMPLEMENTED**
- **FR-003**: System MUST validate file write paths against the active intent's owned_scope patterns using glob-style matching (with `*` and `**` wildcards) before allowing the operation ✅ **IMPLEMENTED**
- **FR-004**: System MUST block file write operations when the target path does not match any owned_scope pattern in the active intent ✅ **IMPLEMENTED**
- **FR-011**: System MUST inject active intent context into the system prompt when an intent is selected ✅ **IMPLEMENTED**
- **FR-012**: System MUST update intent context in the system prompt dynamically when the active intent changes ✅ **IMPLEMENTED**
- **FR-013**: System MUST isolate hook middleware components in a dedicated hooks directory structure ✅ **IMPLEMENTED**
- **FR-014**: System MUST provide clear error messages when operations are blocked due to missing intent or scope validation failures ✅ **IMPLEMENTED**
- **FR-015**: System MUST handle missing or malformed intent configuration files gracefully with appropriate error messages ✅ **IMPLEMENTED**

#### 🚧 Pending Requirements

- **FR-005**: System MUST log all successful file write operations to the agent trace log file ❌ **NOT IMPLEMENTED**
- **FR-006**: System MUST compute SHA256 content hash for every file write operation ❌ **NOT IMPLEMENTED**
- **FR-007**: System MUST include intent_id, content_hash, file_path, mutation_class, and timestamp in each trace log entry ❌ **NOT IMPLEMENTED**
- **FR-008**: System MUST append trace log entries to the agent_trace.jsonl file without overwriting existing entries ❌ **NOT IMPLEMENTED**
- **FR-009**: System MUST implement optimistic locking to detect file state conflicts before write operations using SHA256 content hash comparison ❌ **NOT IMPLEMENTED**
- **FR-010**: System MUST reject write operations when optimistic locking detects a content hash mismatch between expected and actual file state ❌ **NOT IMPLEMENTED**

### Key Entities _(include if feature involves data)_

- **Active Intent**: Represents the currently selected intent that governs tool operations. Contains intent ID, description, owned_scope patterns, constraints, and metadata. Must be selected before destructive operations. Only one intent can be active at a time; selecting a new intent replaces the previous active intent.

- **Intent Scope Pattern**: Defines file path patterns using glob-style matching (e.g., "src/components/**") that determine which files are within an intent's authorized boundaries. Supports `*` for single-segment wildcards and `**` for recursive directory matching. Used to validate file write operations.

- **Trace Log Entry**: A record of a file write operation containing intent_id, content_hash (SHA256), file_path, mutation_class (create/modify), line_ranges, and timestamp. Appended to agent_trace.jsonl for audit trail.

- **Content Hash**: A SHA256 digest of file content bytes, enabling spatial independence by tracking changes by content rather than location. Used for detecting identical content across different paths.

- **File State Lock**: A mechanism for optimistic locking that tracks expected file state using SHA256 content hash and compares it with actual file content hash before write operations to detect conflicts.

- **Intent Context**: Dynamic information injected into system prompts, including intent description, scope boundaries, constraints, and related requirements. Enables AI to make decisions aligned with the active intent.

## Success Criteria _(mandatory)_

### Measurable Outcomes

#### ✅ Achieved Success Criteria

- **SC-001**: 100% of file write operations are blocked when no active intent is selected, with clear error messages provided to users ✅ **ACHIEVED**
- **SC-002**: 100% of file write operations are validated against active intent scope patterns before execution ✅ **ACHIEVED**
- **SC-006**: Intent context is injected into system prompts within 100 milliseconds of intent selection ✅ **ACHIEVED**
- **SC-007**: System prompt updates with new intent context within 200 milliseconds when active intent changes during an active session ✅ **ACHIEVED**
- **SC-008**: Scope validation completes for file path checks within 10 milliseconds per validation ✅ **ACHIEVED**
- **SC-010**: Users receive clear, actionable error messages within 500 milliseconds when operations are blocked due to validation failures ✅ **ACHIEVED**

#### 🚧 Pending Success Criteria

- **SC-003**: 100% of successful file write operations are logged to the trace file with complete metadata (intent_id, content_hash, file_path, mutation_class, timestamp) ❌ **PENDING**
- **SC-004**: Content hash computation completes for file write operations within 50 milliseconds for files up to 1MB in size ❌ **PENDING**
- **SC-005**: Optimistic locking detects and prevents 100% of stale write conflicts when file state changes between operation initiation and execution ❌ **PENDING**
- **SC-009**: Trace log entries are appended successfully 99.9% of the time (accounting for file system errors) ❌ **PENDING**

## Assumptions

- The active_intents.yaml file follows a standard YAML structure with intent definitions containing owned_scope patterns
- The .orchestration directory is created automatically if it doesn't exist
- File write operations are considered "destructive" and require intent governance
- Command executions that modify system state (not read-only) require intent governance
- Content hashing uses SHA256 algorithm for consistency and security
- Optimistic locking uses SHA256 content hash as the state indicator for conflict detection
- Intent context injection happens at system prompt construction time, not during streaming
- The hook middleware architecture allows interception of tool calls before and after execution
- Multiple hook components can be composed together in the middleware pipeline
- The system can handle concurrent operations from multiple instances with proper locking mechanisms

## Dependencies

- Existing tool execution infrastructure (BaseTool, WriteToFileTool, ExecuteCommandTool)
- System prompt construction mechanism (SYSTEM_PROMPT function)
- File system access for reading/writing intent files and trace logs
- YAML parsing capability for reading active_intents.yaml
- Hash computation library or function for SHA256
- File state tracking mechanism for optimistic locking

## Out of Scope

- Intent creation or editing UI (assumes intents are defined externally)
- Intent versioning or history tracking beyond trace logs
- Automatic intent selection based on file paths or context
- Intent conflict resolution for overlapping scopes
- Real-time collaboration features for intent management
- Intent approval workflows or multi-user intent governance
- Integration with external version control systems for conflict detection
- Performance optimization for very large trace log files
- Intent template system or intent library management
