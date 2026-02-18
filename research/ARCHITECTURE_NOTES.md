# Intent-Driven Architecture Notes

## 1. Executive Summary

This document describes the architecture for an intent-driven orchestration system built as a VS Code extension. The system introduces a **Hook Engine** middleware layer that intercepts all AI agent operations, enforces business intent context, and maintains immutable trace records linking code changes to specific requirements.

**Core Innovation**: Instead of direct code generation, the system enforces a **"Reasoning → Intent Selection → Contextualized Action"** workflow. All file modifications are tagged with intent IDs and content hashes, enabling spatial independence during refactoring and complete audit trails.

---

## 2. High-Level System Architecture

### 2.1 System Topology

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER WORKSPACE                           │
│  ┌─────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │   Source    │  │ .orchestration/  │  │  CLAUDE.md /     │   │
│  │    Code     │  │                  │  │  AGENT.md        │   │
│  │             │  │ • active_intents │  │                  │   │
│  │             │  │ • agent_trace    │  │ • Lessons        │   │
│  │             │  │ • intent_map     │  │ • Patterns       │   │
│  │             │  │ • TODO.md        │  │ • Constraints    │   │
│  └──────┬──────┘  └──────────────────┘  └──────────────────┘   │
└─────────┼───────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    VS CODE EXTENSION HOST                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    HOOK ENGINE                            │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │  │
│  │  │ PreToolUse  │  │   Context    │  │  PostToolUse    │  │  │
│  │  │  Hook       │──│   Injector   │──│    Hook         │  │  │
│  │  │             │  │              │  │                 │  │  │
│  │  │ • Intent    │  │ • Load YAML  │  │ • Hash Content  │  │  │
│  │  │   Validation│  │ • Inject XML │  │ • Write JSONL   │  │  │
│  │  │ • Scope     │  │   Context    │  │ • Update Map    │  │  │
│  │  │   Check     │  │ • Enforce    │  │ • Link Intent   │  │  │
│  │  │ • HITL Gate │  │   Constraints│  │                 │  │  │
│  │  └─────────────┘  └──────────────┘  └─────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              TOOL ORCHESTRATION LAYER                     │  │
│  │   write_file │ execute_command │ read_file │ search_code  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
          │
          │ postMessage
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      WEBVIEW UI                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  Chat View  │  │ Intent Panel │  │  Settings / Config   │   │
│  │             │  │              │  │                      │   │
│  │ • Messages  │  │ • Active     │  │ • Intent Creation    │   │
│  │ • Tool Use  │  │   Intents    │  │ • Scope Definition   │   │
│  │ • Approvals │  │ • Trace View │  │ • Constraints        │   │
│  └─────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Execution Flow Diagram

```
┌──────────┐     ┌──────────────┐     ┌──────────────────┐     ┌─────────────┐
│   User   │────▶│   Prompt     │────▶│ Agent Analysis   │────▶│ Intent ID   │
│  Request │     │  Processing  │     │ (Cannot Write    │     │  Required   │
└──────────┘     └──────────────┘     │  Code Yet)       │     └──────┬──────┘
                                      └──────────────────┘            │
                                                                      ▼
┌──────────┐     ┌──────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Execute │◀────│ Contextualized│◀────│  PreToolUse Hook │◀────│select_active│
│  Action  │     │    Action    │     │ • Validate Intent│     │   _intent   │
└──────────┘     └──────────────┘     │ • Inject Context │     │             │
                                      │ • Check Scope    │     └─────────────┘
                                      └──────────────────┘
                                               │
                                               ▼
                                      ┌──────────────────┐
                                      │   LLM Generates  │
                                      │   Code Changes   │
                                      └────────┬─────────┘
                                               │
                                               ▼
                                      ┌──────────────────┐
                                      │  PostToolUse Hook│
                                      │ • Compute Hash   │
                                      │ • Log to Trace   │
                                      │ • Update Map     │
                                      └────────┬─────────┘
                                               │
                                               ▼
                                      ┌──────────────────┐
                                      │  .orchestration/ │
                                      │  agent_trace.jsonl
                                      └──────────────────┘
```

---

## 3. Architectural Key Components

### 3.1 The Hook Engine

The Hook Engine is the central middleware that intercepts all tool execution requests. It operates in three phases:

#### PreToolUse Hook

- **Intent Validation**: Verifies that a valid `intent_id` is active
- **Context Injection**: Loads constraints and scope from `active_intents.yaml`
- **Scope Enforcement**: Validates target files against `owned_scope` patterns
- **Command Classification**: Categorizes as Safe (Read) or Destructive (Write/Delete/Execute)
- **HITL Gate**: Pauses execution for user approval on destructive operations

#### Context Injector

- Reads `.orchestration/active_intents.yaml`
- Constructs `<intent_context>` XML block
- Injects constraints, acceptance criteria, and owned scope into prompt
- Enforces "analysis before action" via prompt engineering

#### PostToolUse Hook

- Computes SHA-256 content hashes for modified files
- Constructs trace records with intent linkage
- Appends to `agent_trace.jsonl`
- Updates `intent_map.md` with spatial mappings
- Triggers automated formatting/linting

### 3.2 Intent Management System

The Intent Management System tracks the lifecycle of business requirements:

- **Intent Specification**: YAML-based definition with formal scope, constraints, and acceptance criteria
- **Status Tracking**: States include PENDING, IN_PROGRESS, COMPLETED, ABORTED
- **Scope Definition**: Glob patterns defining which files the intent owns
- **Constraint Enforcement**: Non-negotiable rules agents must follow

### 3.3 Traceability Engine

The Traceability Engine maintains immutable records of all code modifications:

- **Content Hashing**: SHA-256 of code blocks ensures spatial independence
- **Trace Records**: Append-only JSONL format with full audit trail
- **Git Integration**: Links traces to VCS revisions
- **Temporal Tracking**: Timestamps for all modifications

### 3.4 Orchestration Directory Structure

```
.orchestration/
├── active_intents.yaml      # Current business requirements
├── agent_trace.jsonl        # Immutable mutation log
├── intent_map.md           # High-level intent to code mapping
├── TODO.md                 # Session state persistence
└── claude.md               # Shared knowledge across sessions
```

---

## 4. Phase-by-Phase Implementation Architecture

### Phase 0: System Analysis

**Goal**: Map the extension's execution loop and identify integration points.

**Tasks**:

1. Trace `execute_command` and `write_to_file` in tool system
2. Locate System Prompt construction in message manager
3. Identify state management patterns (ContextProxy)
4. Map webview message protocol

**Integration Points**:

- `src/core/Cline.ts`: Main task execution controller
- `src/shared/tools.ts`: Tool definition schemas
- `src/services/mcp/McpHub.ts`: MCP tool execution
- `webview-ui/src/context/ExtensionStateContext.tsx`: UI state management

**Deliverable**: Complete architecture mapping document

---

### Phase 1: Reasoning Loop & Context Injection

**Goal**: Bridge synchronous LLM with asynchronous IDE loop.

#### Key Components:

**1. Intent Selection Tool**

```typescript
// src/shared/tools.ts - New Tool Definition
interface SelectActiveIntentTool {
	name: "select_active_intent"
	parameters: {
		intent_id: string // e.g., "INT-001"
		reasoning: string // Why this intent is selected
		expected_mutations: string[] // What files will be modified
	}
}
```

**2. PreToolUse Hook Implementation**

```typescript
// src/hooks/PreToolUseHook.ts
interface PreToolUseHook {
	intercept(toolName: string, params: any): Promise<HookResult>
	validateIntent(intentId: string): Promise<IntentValidation>
	injectContext(intentId: string, originalPrompt: string): Promise<string>
	enforceConstraints(intent: IntentSpec, proposedAction: ToolAction): ValidationResult
}

interface HookResult {
	allowed: boolean
	modifiedParams?: any
	injectedContext?: string
	rejectionReason?: string
}
```

**3. System Prompt Modification**
Add mandatory preamble to system prompt:

```
"You CANNOT write code immediately. You MUST:
1. Analyze the user's request
2. Identify the appropriate intent_id
3. Call select_active_intent(intent_id) BEFORE any file modifications
4. Wait for context injection before proceeding"
```

**4. Gatekeeper**

```typescript
// src/hooks/Gatekeeper.ts
class Gatekeeper {
	private activeIntent: string | null = null

	requireIntent(): boolean {
		if (!this.activeIntent) {
			throw new Error("No active intent. Call select_active_intent first.")
		}
		return true
	}

	setActiveIntent(intentId: string): void {
		this.activeIntent = intentId
	}
}
```

**Integration Points**:

- Hook into `src/core/Cline.ts` tool execution flow
- Extend tool definitions in `src/shared/tools.ts`
- Modify system prompt generation in message manager

---

### Phase 2: Hook Middleware & Security

**Goal**: Establish formal boundaries for safe execution.

#### Key Components:

**1. Command Classification**

```typescript
// src/hooks/CommandClassifier.ts
enum CommandType {
	SAFE = "safe", // read_file, search_code
	DESTRUCTIVE = "destructive", // write_file, execute_command, delete
}

class CommandClassifier {
	classify(toolName: string, params: any): CommandType {
		const destructiveTools = ["write_file", "execute_command", "delete_file"]
		return destructiveTools.includes(toolName) ? CommandType.DESTRUCTIVE : CommandType.SAFE
	}
}
```

**2. Authorization Flow**

```typescript
// src/hooks/AuthorizationGate.ts
interface AuthorizationGate {
	requestApproval(toolName: string, params: any, intentId: string): Promise<ApprovalResult>

	renderApprovalUI(details: ActionDetails): Promise<UserDecision>
}

interface ApprovalResult {
	approved: boolean
	rejectionFeedback?: string // JSON tool-error format
}
```

**3. Scope Enforcement**

```typescript
// src/hooks/ScopeValidator.ts
class ScopeValidator {
	validateWriteAccess(filePath: string, ownedScope: string[]): boolean {
		return ownedScope.some((pattern) => minimatch(filePath, pattern))
	}

	enforceScope(intentId: string, targetFile: string): void {
		const intent = this.loadIntent(intentId)
		if (!this.validateWriteAccess(targetFile, intent.owned_scope)) {
			throw new ScopeViolationError(`File ${targetFile} outside intent scope: ${intent.owned_scope.join(", ")}`)
		}
	}
}
```

**4. Recovery Mechanism**

```typescript
// Standardized error format for agent correction
interface ToolError {
	error: true
	type: "scope_violation" | "user_rejection" | "validation_failed"
	message: string
	context: {
		intent_id: string
		attempted_action: string
		available_intents: string[]
	}
}
```

**Integration Points**:

- Intercept in `src/core/Cline.ts` before tool execution
- Extend webview UI for approval dialogs
- Store authorization state in `ContextProxy`

---

### Phase 3: Traceability & Hashing

**Goal**: Implement semantic tracking with spatial independence.

#### Key Components:

**1. Content Hashing Strategy**

```typescript
// src/hooks/ContentHasher.ts
import { createHash } from "crypto"

interface ContentHash {
	algorithm: "sha256"
	hash: string
	content_preview: string // First 100 chars for debugging
}

class ContentHasher {
	hashContent(content: string): ContentHash {
		const hash = createHash("sha256").update(content).digest("hex")

		return {
			algorithm: "sha256",
			hash: hash.substring(0, 32), // Truncate for readability
			content_preview: content.substring(0, 100),
		}
	}

	// Hash specific AST nodes for fine-grained tracking
	hashNode(nodeContent: string, nodeType: string): string {
		return createHash("sha256").update(`${nodeType}:${nodeContent}`).digest("hex").substring(0, 16)
	}
}
```

**2. Trace Record Schema**

```typescript
// src/types/AgentTrace.ts
interface AgentTraceRecord {
	id: string // UUID v4
	timestamp: string // ISO 8601
	vcs: {
		revision_id: string // Git SHA
		branch: string
		dirty: boolean
	}
	intent_id: string // Reference to active_intents.yaml
	mutation_class: MutationClass
	files: FileTrace[]
	conversation: ConversationRef
}

enum MutationClass {
	INTENT_EVOLUTION = "intent_evolution", // New feature implementation
	AST_REFACTOR = "ast_refactor", // Structural changes
	BUG_FIX = "bug_fix", // Correction
	OPTIMIZATION = "optimization", // Performance improvement
}

interface FileTrace {
	relative_path: string
	operation: "create" | "modify" | "delete"
	before_hash?: string // null for creates
	after_hash: string
	line_ranges: LineRange[]
}

interface LineRange {
	start_line: number
	end_line: number
	content_hash: string
	ast_node_type?: string // e.g., "FunctionDeclaration"
}

interface ConversationRef {
	session_id: string
	message_index: number
	model: string
	contributor_type: "AI" | "HUMAN"
}
```

**3. Trace Ledger Writer**

```typescript
// src/hooks/TraceLedger.ts
class TraceLedger {
	private ledgerPath = ".orchestration/agent_trace.jsonl"

	async append(record: AgentTraceRecord): Promise<void> {
		const line = JSON.stringify(record)
		await fs.appendFile(this.ledgerPath, line + "\n")
	}

	async *readRecords(intentId?: string): AsyncGenerator<AgentTraceRecord> {
		const fileStream = fs.createReadStream(this.ledgerPath)
		const rl = readline.createInterface(fileStream)

		for await (const line of rl) {
			const record: AgentTraceRecord = JSON.parse(line)
			if (!intentId || record.intent_id === intentId) {
				yield record
			}
		}
	}

	// Query by content hash for spatial independence
	async findByContentHash(hash: string): Promise<AgentTraceRecord[]> {
		const matches: AgentTraceRecord[] = []
		for await (const record of this.readRecords()) {
			for (const file of record.files) {
				for (const range of file.line_ranges) {
					if (range.content_hash === hash) {
						matches.push(record)
						break
					}
				}
			}
		}
		return matches
	}
}
```

**4. Spatial Map Builder**

```typescript
// src/hooks/SpatialMap.ts
interface IntentSpatialMap {
	intents: Map<string, IntentSpatialEntry>
}

interface IntentSpatialEntry {
	intent_id: string
	files: FileSpatialEntry[]
	last_updated: string
}

interface FileSpatialEntry {
	path: string
	blocks: CodeBlock[]
}

interface CodeBlock {
	content_hash: string
	line_range: { start: number; end: number }
	ast_type: string
	intent_id: string
	created_at: string
	trace_id: string
}

class SpatialMapBuilder {
	async updateMap(traceRecord: AgentTraceRecord): Promise<void> {
		// Update .orchestration/intent_map.md
		// With links from intent to code blocks via content hash
	}
}
```

**Integration Points**:

- Extend `write_file` tool schema to include `intent_id` and `mutation_class`
- Hook into `src/core/Cline.ts` after successful file writes
- Store trace ledger in workspace `.orchestration/`

---

### Phase 4: Parallel Orchestration

**Goal**: Enable safe concurrent agent execution.

#### Key Components:

**1. Supervisor Pattern**

```typescript
// src/orchestration/Supervisor.ts
interface Supervisor {
	// Manager agent spawns workers with restricted scopes
	spawnWorker(intentId: string, scope: string[], role: AgentRole): Promise<WorkerAgent>

	// Monitor worker progress
	monitorWorkers(): WorkerStatus[]
}

enum AgentRole {
	ARCHITECT = "architect",
	BUILDER = "builder",
	TESTER = "tester",
}
```

**2. Optimistic Locking**

```typescript
// src/orchestration/OptimisticLock.ts
interface FileLock {
	filePath: string
	intentId: string
	baseHash: string // Hash at time of read
	timestamp: number
}

class OptimisticLockManager {
	private locks: Map<string, FileLock> = new Map()

	async acquireLock(filePath: string, intentId: string): Promise<LockResult> {
		const currentHash = await this.computeFileHash(filePath)

		if (this.locks.has(filePath)) {
			const existing = this.locks.get(filePath)!
			if (existing.intentId !== intentId) {
				// Check for stale file
				const diskHash = await this.computeFileHash(filePath)
				if (diskHash !== existing.baseHash) {
					return {
						acquired: false,
						reason: "stale_file",
						currentHash: diskHash,
						expectedHash: existing.baseHash,
					}
				}
			}
		}

		this.locks.set(filePath, {
			filePath,
			intentId,
			baseHash: currentHash,
			timestamp: Date.now(),
		})

		return { acquired: true }
	}

	async validateLock(filePath: string, intentId: string): Promise<boolean> {
		const lock = this.locks.get(filePath)
		if (!lock || lock.intentId !== intentId) {
			return false
		}

		const currentHash = await this.computeFileHash(filePath)
		return currentHash === lock.baseHash
	}
}
```

**3. Write Partitioning**

```typescript
// Ensure workers have disjoint file spaces
interface PartitionStrategy {
	validateDisjointness(workers: WorkerAgent[]): boolean
	suggestPartition(intents: IntentSpec[]): FilePartition[]
}

interface FilePartition {
	intentId: string
	paths: string[]
	conflicts: string[] // Overlapping areas requiring coordination
}
```

**4. Unified Diff Protocol**

```typescript
// src/orchestration/DiffProtocol.ts
interface UnifiedDiff {
	filePath: string
	hunks: Hunk[]
	intentId: string
}

interface Hunk {
	oldStart: number
	oldLines: number
	newStart: number
	newLines: number
	lines: string[] // + for additions, - for deletions, space for context
}

class DiffApplier {
	async applyDiff(diff: UnifiedDiff): Promise<ApplyResult> {
		// Apply patch format to minimize collision surface
		// Similar to git apply
	}
}
```

**5. Shared Knowledge Base**

```typescript
// src/orchestration/SharedKnowledge.ts
class SharedKnowledgeManager {
	private claudeMdPath = ".orchestration/claude.md"

	async recordLesson(lesson: Lesson): Promise<void> {
		const entry = `
## ${lesson.timestamp}
**Intent**: ${lesson.intentId}
**Issue**: ${lesson.issue}
**Resolution**: ${lesson.resolution}
**Pattern**: ${lesson.pattern}
---
`
		await fs.appendFile(this.claudeMdPath, entry)
	}

	async loadLessons(intentId?: string): Promise<Lesson[]> {
		// Parse CLAUDE.md and return relevant lessons
	}
}
```

**Integration Points**:

- Extend MCP server for multi-agent coordination
- Modify webview UI to show parallel agent status
- Store locks in memory with persistence to `.orchestration/`

---

## 5. Data Models & Schemas

### 5.1 Intent Specification Schema (YAML)

```yaml
# .orchestration/active_intents.yaml
version: "1.0"
active_intents:
    - id: "INT-001"
      name: "JWT Authentication Migration"
      description: "Migrate from Basic Auth to JWT tokens"
      status: "IN_PROGRESS" # PENDING, IN_PROGRESS, COMPLETED, ABORTED
      priority: "HIGH" # LOW, MEDIUM, HIGH, CRITICAL

      # Formal Scope Definition
      owned_scope:
          - "src/auth/**"
          - "src/middleware/jwt.ts"
          - "tests/auth/**"

      # Constraints (Non-negotiable)
      constraints:
          - "Must not use external auth providers"
          - "Must maintain backward compatibility with Basic Auth"
          - "Must pass all existing auth tests"

      # Definition of Done
      acceptance_criteria:
          - "Unit tests in tests/auth/ pass"
          - "Integration tests with JWT tokens pass"
          - "Documentation updated in docs/auth.md"
          - "Security review completed"

      # Metadata
      created_at: "2026-02-16T10:00:00Z"
      updated_at: "2026-02-16T14:30:00Z"
      parent_intent: null # For hierarchical intents

    - id: "INT-002"
      name: "API Rate Limiting"
      status: "PENDING"
      owned_scope:
          - "src/rate-limiter/**"
          - "src/middleware/rate-limit.ts"
      constraints:
          - "Max 100 requests per minute per IP"
          - "Must use Redis for distributed rate limiting"
      acceptance_criteria:
          - "Rate limit headers included in responses"
          - "429 status returned when limit exceeded"
```

### 5.2 Agent Trace Record Schema (JSONL)

```json
{
	"id": "550e8400-e29b-41d4-a716-446655440000",
	"timestamp": "2026-02-16T12:00:00Z",
	"vcs": {
		"revision_id": "abc123def456",
		"branch": "feature/jwt-auth",
		"dirty": true
	},
	"intent_id": "INT-001",
	"mutation_class": "INTENT_EVOLUTION",
	"files": [
		{
			"relative_path": "src/auth/middleware.ts",
			"operation": "modify",
			"before_hash": "sha256:a8f5f167f44f4964e6c998dee827110c",
			"after_hash": "sha256:b9g6g278g55g5077f7g009ef938221d",
			"line_ranges": [
				{
					"start_line": 15,
					"end_line": 45,
					"content_hash": "sha256:c7h8h389h66h6188g8h110fg049332e",
					"ast_node_type": "FunctionDeclaration"
				}
			]
		}
	],
	"conversation": {
		"session_id": "session-uuid",
		"message_index": 42,
		"model": "claude-3-5-sonnet-20241022",
		"contributor_type": "AI"
	},
	"metadata": {
		"tool_used": "write_file",
		"execution_time_ms": 150,
		"approval_required": true,
		"approved_by": "user-id"
	}
}
```

### 5.3 Spatial Map Structure (Markdown)

```markdown
# Intent Spatial Map

## INT-001: JWT Authentication Migration

### Files

#### src/auth/middleware.ts

- **Lines 15-45** (`sha256:c7h8h...`)
    - Type: FunctionDeclaration
    - Created: 2026-02-16T12:00:00Z
    - Trace: 550e8400-e29b-41d4-a716-446655440000

#### src/auth/token.ts

- **Lines 1-120** (`sha256:d8i9i...`)
    - Type: ClassDeclaration
    - Created: 2026-02-16T12:05:00Z
    - Trace: 660f9511-f30c-52e5-b827-557766551111

## INT-002: API Rate Limiting

### Files

#### src/rate-limiter/store.ts

- **Lines 10-50** (`sha256:e9j0j...`)
    - Type: InterfaceDeclaration
    - Created: 2026-02-16T13:00:00Z
```

---

## 6. Interface Specifications

### 6.1 Extension Host Interface

The Extension Host provides the core API for the hook system:

```typescript
// src/extension/IntentOrchestrationAPI.ts

interface IntentOrchestrationAPI {
	// Intent Management
	createIntent(spec: IntentSpec): Promise<Intent>
	getIntent(intentId: string): Promise<Intent | null>
	updateIntentStatus(intentId: string, status: IntentStatus): Promise<void>
	listActiveIntents(): Promise<Intent[]>

	// Hook Registration
	registerPreToolUseHook(hook: PreToolUseHook): void
	registerPostToolUseHook(hook: PostToolUseHook): void

	// Context Injection
	getIntentContext(intentId: string): Promise<IntentContext>
	injectContextIntoPrompt(intentId: string, prompt: string): Promise<string>

	// Trace Operations
	recordTrace(record: AgentTraceRecord): Promise<void>
	queryTraces(filter: TraceFilter): Promise<AgentTraceRecord[]>
	getTraceByContentHash(hash: string): Promise<AgentTraceRecord[]>

	// Spatial Map
	updateSpatialMap(intentId: string, filePath: string, blocks: CodeBlock[]): Promise<void>
	getCodeIntent(filePath: string, lineNumber: number): Promise<string | null>

	// Authorization
	requestApproval(action: ActionDetails): Promise<ApprovalResult>
	checkScopeAccess(intentId: string, filePath: string): boolean

	// Multi-Agent
	spawnWorkerAgent(intentId: string, role: AgentRole): Promise<WorkerAgent>
	acquireOptimisticLock(intentId: string, filePath: string): Promise<LockResult>
}

// Registration with VS Code extension system
export function activateIntentOrchestration(context: vscode.ExtensionContext): IntentOrchestrationAPI {
	const api = new IntentOrchestrationAPIImpl(context)

	// Register commands
	vscode.commands.registerCommand("intentorchestration.createIntent", api.createIntent.bind(api))

	return api
}
```

### 6.2 Webview UI Interface

The Webview UI provides visual interfaces for intent management:

```typescript
// webview-ui/src/types/IntentTypes.ts

// State types
interface IntentUIState {
  activeIntents: Intent[];
  selectedIntent: string | null;
  traces: AgentTraceRecord[];
  isLoading: boolean;
  error: string | null;
}

// Component Props
interface IntentPanelProps {
  intents: Intent[];
  selectedIntent: string | null;
  onSelectIntent: (intentId: string) => void;
  onCreateIntent: () => void;
  onUpdateIntent: (intent: Intent) => void;
}

interface TraceViewerProps {
  traces: AgentTraceRecord[];
  selectedIntent: string | null;
  onFilterByIntent: (intentId: string) => void;
  onShowCodeContext: (traceId: string) => void;
}

interface ApprovalDialogProps {
  isOpen: boolean;
  action: ActionDetails;
  onApprove: () => void;
  onReject: (reason: string) => void;
}

// Message Protocol (Extension <-> Webview)
interface WebviewMessage {
  type:
    | 'intent:list'
    | 'intent:select'
    | 'intent:create'
    | 'intent:update'
    | 'trace:query'
    | 'approval:request'
    | 'approval:respond'
    | 'scope:validate';
  payload: any;
}

// React Components
// webview-ui/src/components/intent/IntentPanel.tsx
export const IntentPanel: React.FC<IntentPanelProps> = ({
  intents,
  selectedIntent,
  onSelectIntent,
  onCreateIntent,
  onUpdateIntent
}) => {
  return (
    <div className="intent-panel">
      <IntentList
        intents={intents}
        selectedId={selectedIntent}
        onSelect={onSelectIntent}
      />
      <IntentDetails
        intent={intents.find(i => i.id === selectedIntent)}
        onUpdate={onUpdateIntent}
      />
      <CreateIntentButton onClick={onCreateIntent} />
    </div>
  );
};

// webview-ui/src/components/trace/TraceViewer.tsx
export const TraceViewer: React.FC<TraceViewerProps> = ({
  traces,
  selectedIntent,
  onFilterByIntent,
  onShowCodeContext
}) => {
  return (
    <div className="trace-viewer">
      <TraceFilter
        selectedIntent={selectedIntent}
        onFilterChange={onFilterByIntent}
      />
      <TraceList
        traces={traces}
        onTraceClick={onShowCodeContext}
      />
    </div>
  );
};

// Context Provider
// webview-ui/src/context/IntentContext.tsx
export const IntentContext = createContext<IntentContextType>(null!);

export const IntentProvider: React.FC<{ children: ReactNode }> = ({
  children
}) => {
  const [state, dispatch] = useReducer(intentReducer, initialState);

  useEffect(() => {
    // Listen for messages from extension host
    const handler = (event: MessageEvent) => {
      const message: ExtensionMessage = event.data;

      switch (message.type) {
        case 'intent:list':
          dispatch({ type: 'SET_INTENTS', payload: message.payload });
          break;
        case 'trace:query':
          dispatch({ type: 'SET_TRACES', payload: message.payload });
          break;
        case 'approval:request':
          dispatch({ type: 'SHOW_APPROVAL', payload: message.payload });
          break;
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  return (
    <IntentContext.Provider value={{ state, dispatch }}>
      {children}
    </IntentContext.Provider>
  );
};
```

---

## 7. Integration with Current Implementation

### 7.1 Extension Entry Points

```
src/
├── activate/
│   ├── index.ts                    # Add: initialize intent orchestration
│   └── registerCommands.ts         # Add: intent management commands
├── core/
│   └── Cline.ts                    # Modify: inject hook interception
├── shared/
│   ├── tools.ts                    # Extend: add select_active_intent tool
│   └── WebviewMessage.ts           # Extend: add intent message types
├── services/
│   └── intent/                     # NEW: intent management service
│       ├── IntentManager.ts
│       ├── TraceLedger.ts
│       └── SpatialMap.ts
└── hooks/                          # NEW: hook system
    ├── PreToolUseHook.ts
    ├── PostToolUseHook.ts
    ├── Gatekeeper.ts
    ├── CommandClassifier.ts
    ├── ScopeValidator.ts
    └── ContentHasher.ts
```

### 7.2 Key Integration Points

**1. Tool Execution Flow**

Location: `src/core/Cline.ts`

Current flow:

```typescript
// Current pattern (simplified)
async executeTool(toolName: string, params: any) {
  const tool = this.tools[toolName];
  return await tool.execute(params);
}
```

New flow with hooks:

```typescript
// Modified pattern
async executeTool(toolName: string, params: any) {
  // Pre-hook interception
  const preResult = await this.hookEngine.preToolUse(toolName, params);
  if (!preResult.allowed) {
    throw new ToolError(preResult.rejectionReason);
  }

  // Execute with modified params
  const tool = this.tools[toolName];
  const result = await tool.execute(preResult.modifiedParams || params);

  // Post-hook processing
  await this.hookEngine.postToolUse(toolName, params, result);

  return result;
}
```

**2. System Prompt Generation**

Location: `src/core/prompts/system.ts`

Add intent enforcement preamble:

```typescript
export function generateSystemPrompt(): string {
	return `
${getBaseSystemPrompt()}

## INTENT-DRIVEN DEVELOPMENT PROTOCOL

You CANNOT modify code immediately. You MUST follow this workflow:

1. **ANALYSIS PHASE**: Analyze the user's request and identify the business intent
2. **INTENT SELECTION**: Call select_active_intent(intent_id) with the appropriate intent ID
3. **CONTEXT WAIT**: Wait for context injection before proceeding
4. **CONTEXTUALIZED ACTION**: Once context is injected, proceed with file modifications

Failure to follow this protocol will result in execution blocking.

### Intent Context Format

When you select an intent, you will receive:
<intent_context>
  <id>INT-001</id>
  <name>JWT Authentication Migration</name>
  <constraints>
    - Must not use external auth providers
    - Must maintain backward compatibility
  </constraints>
  <scope>
    - src/auth/**
    - src/middleware/jwt.ts
  </scope>
  <acceptance_criteria>
    - Unit tests pass
    - Integration tests pass
  </acceptance_criteria>
</intent_context>

You MUST validate all file modifications against the provided scope.
  `
}
```

**3. State Management Integration**

Location: `src/services/roo-config/index.ts`

Extend to store intent state:

```typescript
interface RooConfig {
	// Existing fields...

	// New intent orchestration fields
	intentOrchestration: {
		activeIntentId: string | null
		intentHistory: string[]
		lastTraceId: string | null
		sessionId: string
	}
}
```

**4. Webview Message Protocol**

Location: `src/shared/WebviewMessage.ts`

Extend message types:

```typescript
export interface WebviewMessage {
	type:
		| "intent:list"
		| "intent:select"
		| "intent:create"
		| "intent:update"
		| "intent:delete"
		| "trace:query"
		| "trace:highlight"
		| "approval:request"
		| "approval:respond"
		| "scope:violation"
	payload?: any
}
```

**5. Tool Definition Extension**

Location: `src/shared/tools.ts`

Add new tool:

```typescript
export const selectActiveIntentTool = {
	name: "select_active_intent",
	description: "Select an active intent before modifying code",
	parameters: {
		type: "object",
		properties: {
			intent_id: {
				type: "string",
				description: "The intent ID (e.g., INT-001)",
			},
			reasoning: {
				type: "string",
				description: "Why this intent is being selected",
			},
			expected_mutations: {
				type: "array",
				items: { type: "string" },
				description: "List of files expected to be modified",
			},
		},
		required: ["intent_id", "reasoning"],
	},
}

// Extend write_file to require intent_id
export const writeFileTool = {
	name: "write_file",
	parameters: {
		// Existing fields...
		intent_id: {
			type: "string",
			description: "Required: Intent ID for traceability",
		},
		mutation_class: {
			type: "string",
			enum: ["INTENT_EVOLUTION", "AST_REFACTOR", "BUG_FIX", "OPTIMIZATION"],
			description: "Classification of the change",
		},
	},
	required: ["path", "content", "intent_id", "mutation_class"],
}
```

**6. MCP Server Integration**

Create new MCP server for orchestration:

Location: `src/services/mcp/OrchestrationMcpServer.ts`

```typescript
export class OrchestrationMcpServer {
	private tools = [
		{
			name: "orchestration/list_intents",
			description: "List all active intents",
			handler: async () => {
				return await intentManager.listActiveIntents()
			},
		},
		{
			name: "orchestration/get_intent_context",
			description: "Get context for an intent",
			handler: async (params: { intent_id: string }) => {
				return await intentManager.getIntentContext(params.intent_id)
			},
		},
		{
			name: "orchestration/query_traces",
			description: "Query the trace ledger",
			handler: async (params: TraceFilter) => {
				return await traceLedger.query(params)
			},
		},
	]
}
```

---

## 8. Security & Guardrails

### 8.1 Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                           │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: Command Classification                             │
│  ├─ Safe: read_file, search_code                             │
│  └─ Destructive: write_file, execute_command, delete         │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: Intent Validation                                  │
│  ├─ Active intent required for all destructive operations    │
│  └─ Intent must exist in active_intents.yaml                 │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: Scope Enforcement                                  │
│  ├─ Target file must match owned_scope patterns              │
│  └─ Violations result in immediate rejection                 │
├─────────────────────────────────────────────────────────────┤
│  Layer 4: Human-in-the-Loop                                  │
│  ├─ UI-blocking modal for destructive operations             │
│  └─ User approval required before execution                  │
├─────────────────────────────────────────────────────────────┤
│  Layer 5: Input Sanitization                                 │
│  ├─ JSON schema validation on all tool inputs                │
│  └─ Shell command validation to prevent injection            │
├─────────────────────────────────────────────────────────────┤
│  Layer 6: Circuit Breakers                                   │
│  ├─ Halt on excessive PostToolUse failures                   │
│  └─ Prevent infinite error loops                             │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 Guardrail Specifications

**Command Injection Prevention**:

```typescript
// src/hooks/InputSanitizer.ts
class InputSanitizer {
	sanitizeShellCommand(command: string): string {
		// Validate against dangerous patterns
		const dangerousPatterns = [/rm\s+-rf\s+\//, />\s*\/dev\/null/, /curl.*\|.*sh/]

		for (const pattern of dangerousPatterns) {
			if (pattern.test(command)) {
				throw new SecurityError(`Dangerous command pattern detected: ${command}`)
			}
		}

		return command
	}

	validateJsonInput(schema: JSONSchema, data: any): boolean {
		// Use ajv or similar for schema validation
		return validate(schema, data)
	}
}
```

**Circuit Breaker Pattern**:

```typescript
// src/hooks/CircuitBreaker.ts
class CircuitBreaker {
	private failureCount = 0
	private lastFailureTime: number | null = null
	private readonly threshold = 5
	private readonly resetTimeout = 60000 // 1 minute

	recordFailure(): void {
		this.failureCount++
		this.lastFailureTime = Date.now()

		if (this.failureCount >= this.threshold) {
			throw new CircuitBreakerError(`Too many failures (${this.failureCount}). Circuit opened.`)
		}
	}

	recordSuccess(): void {
		if (Date.now() - (this.lastFailureTime || 0) > this.resetTimeout) {
			this.failureCount = 0
		}
	}

	isOpen(): boolean {
		return this.failureCount >= this.threshold
	}
}
```

---

## 9. Diagrams Appendix

### 9.1 Two-Stage State Machine

```
                    ┌─────────────────┐
                    │     START       │
                    └────────┬────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                      STATE 1: REQUEST                        │
│                                                              │
│  Trigger: User inputs prompt                                 │
│  Action: Display in chat                                     │
│                                                              │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 STATE 2: REASONING INTERCEPT                  │
│                    (The Handshake)                           │
│                                                              │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │  Agent Analysis │──│select_active_    │──│ Pre-Hook    │ │
│  │  (Cannot write  │  │intent()          │  │ Intercept   │ │
│  │   code yet)     │  │                  │  │             │ │
│  └─────────────────┘  └──────────────────┘  └──────┬──────┘ │
│                                                    │         │
│                           ┌────────────────────────┘         │
│                           ▼                                  │
│                    ┌──────────────────┐                      │
│                    │ Context Query    │                      │
│                    │ Read active_     │                      │
│                    │ intents.yaml     │                      │
│                    └────────┬─────────┘                      │
│                             │                                │
│                             ▼                                │
│                    ┌──────────────────┐                      │
│                    │ Context Injection│                      │
│                    │ Inject XML block │                      │
│                    │ into prompt      │                      │
│                    └──────────────────┘                      │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   STATE 3: CONTEXTUALIZED ACTION             │
│                                                              │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │  LLM Generates  │──│  Tool Execution  │──│ Post-Hook   │ │
│  │  Code with      │  │  (write_file,    │  │ Processing  │ │
│  │  Context        │  │   etc.)          │  │             │ │
│  └─────────────────┘  └──────────────────┘  └──────┬──────┘ │
│                                                    │         │
│                           ┌────────────────────────┘         │
│                           ▼                                  │
│                    ┌──────────────────┐                      │
│                    │ Trace Logging    │                      │
│                    │ Write to         │                      │
│                    │ agent_trace.jsonl│                      │
│                    └──────────────────┘                      │
│                                                              │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
                    ┌─────────────────┐
                    │      END        │
                    └─────────────────┘
```

### 9.2 Hook Engine Data Flow

```
┌────────────────────────────────────────────────────────────────┐
│                         HOOK ENGINE                             │
│                                                                 │
│  Input: Tool Request (toolName, params, conversationContext)   │
│                                                                 │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────┐
│                      PRE-PROCESSING PIPELINE                    │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Command      │──│ Intent       │──│ Scope        │          │
│  │ Classifier   │  │ Validator    │  │ Validator    │          │
│  │              │  │              │  │              │          │
│  │ Safe?        │  │ Active?      │  │ In Scope?    │          │
│  │ Destructive? │  │ Valid ID?    │  │ Authorized?  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│         │                 │                 │                   │
│         └─────────────────┼─────────────────┘                   │
│                           ▼                                     │
│              ┌────────────────────────┐                         │
│              │   All Checks Passed?   │                         │
│              └───────────┬────────────┘                         │
│                          │                                      │
│           ┌──────────────┴──────────────┐                      │
│           │                             │                      │
│           ▼                             ▼                      │
│  ┌─────────────────┐           ┌─────────────────┐            │
│  │   YES           │           │   NO            │            │
│  │                 │           │                 │            │
│  │ Context Inject  │           │ Return Error    │            │
│  │ Load intent     │           │ ToolError with  │            │
│  │ Build XML block │           │ correction hints│            │
│  └────────┬────────┘           └─────────────────┘            │
│           │                                                     │
└───────────┼─────────────────────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────────────┐
│                      TOOL EXECUTION                             │
│                                                                 │
│  Execute tool with modified params and injected context        │
│                                                                 │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────┐
│                      POST-PROCESSING PIPELINE                   │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Hash         │──│ Trace        │──│ Map          │          │
│  │ Computer     │  │ Builder      │  │ Updater      │          │
│  │              │  │              │  │              │          │
│  │ SHA-256 of   │  │ Build JSONL  │  │ Update       │          │
│  │ content      │  │ record       │  │ intent_map   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│         │                 │                 │                   │
│         └─────────────────┼─────────────────┘                   │
│                           ▼                                     │
│              ┌────────────────────────┐                         │
│              │   Persistence Layer    │                         │
│              │                        │                         │
│              │ • agent_trace.jsonl    │                         │
│              │ • intent_map.md        │                         │
│              │ • active_intents.yaml  │                         │
│              └────────────────────────┘                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 9.3 Multi-Agent Orchestration Topology

```
┌─────────────────────────────────────────────────────────────────┐
│                     SUPERVISOR AGENT                            │
│                     (Manager / Orchestrator)                    │
│                                                                 │
│  Responsibilities:                                              │
│  • Read main specification                                      │
│  • Spawn worker agents                                          │
│  • Monitor progress                                             │
│  • Resolve conflicts                                            │
│  • Update CLAUDE.md with lessons                                │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│  WORKER A     │  │  WORKER B     │  │  WORKER C     │
│  (Architect)  │  │  (Builder)    │  │  (Tester)     │
│               │  │               │  │               │
│ Scope:        │  │ Scope:        │  │ Scope:        │
│ • src/auth/** │  │ • src/api/**  │  │ • tests/**    │
│ • docs/       │  │               │  │               │
│               │  │ Intent:       │  │ Intent:       │
│ Intent:       │  │ INT-002       │  │ INT-003       │
│ INT-001       │  │               │  │               │
└───────┬───────┘  └───────┬───────┘  └───────┬───────┘
        │                   │                   │
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SHARED RESOURCES                            │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │ .orchestration/  │  │ CLAUDE.md        │  │ Git          │  │
│  │                  │  │                  │  │ Repository   │  │
│  │ • agent_trace    │  │ • Lessons        │  │              │  │
│  │ • active_intents │  │ • Patterns       │  │ • Commits    │  │
│  │ • intent_map     │  │ • Constraints    │  │ • Branches   │  │
│  │ • TODO.md        │  │                  │  │ • Merges     │  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Conflict Resolution:
┌──────────────────────────────────────────────────────────────┐
│  When Workers Conflict:                                       │
│                                                               │
│  1. Optimistic Locking detects hash mismatch                  │
│  2. Supervisor pauses conflicting worker                      │
│  3. Supervisor analyzes traces                                │
│  4. Supervisor reassigns or merges work                       │
│  5. Lesson recorded in CLAUDE.md                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 10. Summary

This architecture provides a comprehensive framework for intent-driven AI-assisted development:

### Core Achievements:

1. **Strict Protocol Enforcement**: Agents cannot modify code without explicit intent selection
2. **Spatial Independence**: Content hashing ensures traces remain valid during refactoring
3. **Complete Audit Trail**: Every modification linked to business requirements
4. **Safe Concurrency**: Multi-agent support with optimistic locking
5. **Human Oversight**: HITL gates for destructive operations

### Implementation Path:

1. **Phase 0**: Map existing codebase and identify integration points
2. **Phase 1**: Implement reasoning loop and context injection
3. **Phase 2**: Build security middleware with scope enforcement
4. **Phase 3**: Create traceability engine with content hashing
5. **Phase 4**: Enable parallel orchestration with supervisor pattern

### Key Files:

- `src/hooks/`: New directory for hook system
- `src/services/intent/`: Intent management service
- `src/core/Cline.ts`: Modified for hook interception
- `src/shared/tools.ts`: Extended tool definitions
- `webview-ui/src/components/intent/`: UI components for intent management
- `.orchestration/`: Workspace directory for persistence

This architecture transforms AI agents from autonomous code generators into contextualized, traceable, and governable development partners.
