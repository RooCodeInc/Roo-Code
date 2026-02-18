# Intent-Driven Architecture Notes

## 1. Executive Summary

This document describes the architecture for an intent-driven orchestration system built as a VS Code extension. The system introduces a **Hook Engine** middleware layer that intercepts all AI agent operations, enforces business intent context, and maintains immutable trace records linking code changes to specific requirements.

The purpose is to make AI-assisted development behave more like a controlled engineering workflow than a free-form code generator. In particular, the architecture assumes that (a) the model is probabilistic and can make unsafe guesses, and (b) developers need to understand and audit why a change happened later. So the system focuses on hard interception points, explicit intent selection, and append-only trace records that can be queried and reviewed.

**Core Innovation**: Instead of direct code generation, the system enforces a **"Reasoning → Intent Selection → Contextualized Action"** workflow. All file modifications are tagged with intent IDs and content hashes, enabling spatial independence during refactoring and complete audit trails.

In practical terms, the agent must "check out" an intent before it can mutate the workspace. The selected intent acts as a short contract that defines:

- what the agent is allowed to touch (owned scope),
- what it must not violate (constraints), and
- how to decide the work is complete (acceptance criteria).

The trace layer then links every actual mutation back to that contract so later refactors (which move code around) do not break attribution.

---

## Folder structure

Phase 1 (Reasoning Loop & Context Injection) is implemented as a primary feature under `src/hook/`, with one public entrypoint and internal submodules for intent validation, scope enforcement, approval gating, context injection, and trace recording.

```text
src/
  hook/
    intent-orchestration/
      README.md
      index.ts
      HookEngine.ts
      types/
        HookResult.ts
        IntentTypes.ts
        ToolAction.ts
        TraceTypes.ts
      errors/
        ApprovalRejectedError.ts
        IntentNotSelectedError.ts
        ScopeViolationError.ts
        ValidationError.ts
      pre-tool-use/
        PreToolUseHook.ts
        CommandClassifier.ts
        ScopeEnforcer.ts
        IntentValidator.ts
        ApprovalGate.ts
        ContextInjector.ts
      post-tool-use/
        PostToolUseHook.ts
        ContentHasher.ts
        TraceLedgerWriter.ts
        SpatialMapUpdater.ts
      intent-store/
        IntentStore.ts
        OrchestrationPaths.ts
        ActiveIntentsSchema.ts
      trace-store/
        TraceLedger.ts
        SpatialMap.ts
      utils/
        normalizePath.ts
        globMatch.ts
        redact.ts
```

## 2. High-Level System Architecture

This section explains where the major parts live (topology) and how a single request becomes an approved, scoped tool action (execution flow). The design is intentionally layered so UI concerns, execution concerns, and policy concerns stay separate.

### 2.1 System Topology

The topology highlights three planes:

- **Workspace plane**: user source code plus a dedicated `.orchestration/` sidecar directory that stores intent specs and traces without polluting the codebase.
- **Extension-host plane**: the only place with Node/VSC APIs and filesystem/command access; it runs the Hook Engine and tool orchestration.
- **Webview plane**: presentation only; it sends and receives messages via `postMessage` and cannot directly execute tools.

The key property is that all tool calls that can mutate state flow through the Hook Engine first, so an agent (or UI) cannot bypass scope checks, approval gates, or logging.

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

The flow formalizes a "handshake" step that sits between user intent and destructive execution:

- The model can analyze immediately, but it cannot write code immediately.
- The model must declare which intent it is serving (via `select_active_intent`).
- Only after the Hook Engine injects the corresponding constraints/scope does the system allow mutating tools.

This reduces two common failure modes:

1. **Unscoped edits** (agent touches unrelated files because it does not know boundaries).
2. **Stale context** (agent acts based on earlier conversation instead of current intent constraints).

It also makes approvals more meaningful because the UI can show the _intent_ and the _exact tool action_ together.

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

### 2.3 Data Boundary Mapping: UI (Webview) ↔ Extension Host

The following details the specific data flow between the Webview UI and Extension Host layers:

**Webview → Extension Host (via `postMessage`):**

- Message type: `WebviewMessage` (defined in `src/shared/WebviewMessage.ts`)
- Handler: `webviewMessageHandler()` in `src/core/webview/webviewMessageHandler.ts`
- State updates flow through `provider.contextProxy.setValue()` → VS Code global state

**Extension Host → Webview (via `postMessage`):**

- Message type: `ExtensionMessage` (defined in `@roo-code/types`)
- Handlers in UI: `ExtensionStateContext.tsx` uses `window.addEventListener('message', handler)`
- State synchronization: Messages dispatched via `provider.postMessageToWebview()`

**Specific Message Flows:**

1. **Tool Approval Request:**

    - Host → UI: `askApproval()` callback triggers UI modal
    - UI → Host: User response via `ClineAskResponse` type
    - Data: `{type: 'ask', ask: 'tool', ...}` → `{response: 'yesButtonClicked' | 'noButtonClicked', text?: string}`

2. **State Synchronization:**

    - Host: `ContextProxy` maintains `stateCache` for global state
    - UI: `ExtensionStateContext` hydrates from `ExtensionMessage` type events
    - Key files: `src/core/config/ContextProxy.ts` ↔ `webview-ui/src/context/ExtensionStateContext.tsx`

3. **Streaming Content:**
    - Host → UI: `cline.say()` sends incremental updates
    - UI: React components re-render via context updates
    - Format: `{type: 'say', say: 'text' | 'tool', ...}`

### 2.4 Agent Turn Lifecycle Mapping

The following traces a single agent turn from user input through tool execution to response generation:

```
TURN START
│
├─► User Input received via webviewMessageHandler.ts
│   └─► `provider.contextProxy.getState()` retrieves settings
│   └─► `task.resumeTask(message.text)` initiates turn
│
├─► Task.ts: `initiateTaskLoop()` or `resumeTask()`
│   └─► Reconstruct API message history from persistence
│   └─► Load `assistantMessageContent` from previous turn
│   └─► System prompt regenerated via `generateSystemPrompt()`
│       └─► `src/core/prompts/system.ts:generatePrompt()` - STATELESS
│       └─► Prompt includes: role definition, rules, capabilities, custom instructions
│
├─► API Request initiated via `startTask()` or `resumeTask()`
│   └─► `apiHandler.createMessage()` sends conversation to LLM
│   └─► Streaming response received via `ApiStream`
│
├─► Streaming Content Processing
│   └─► `for await (const chunk of stream)` in Task.ts
│   └─► Chunks appended to `assistantMessageContent` array
│   └─► `presentAssistantMessage(this)` called for each chunk
│       └─► LOCK: `presentAssistantMessageLocked` prevents concurrent execution
│       └─► Process `block.type`:
│           ├─ "text": Display to user
│           ├─ "tool_use": Execute tool (HOOK INJECTION POINT)
│           └─ "mcp_tool_use": Execute MCP tool
│
├─► Tool Execution (if triggered)
│   └─► Validation: `block.nativeArgs` must exist
│   └─► Approval: `askApproval()` callback → UI modal
│   └─► Dispatch: Tool handlers (WriteToFileTool, ExecuteCommandTool, etc.)
│   └─► Result: `pushToolResult()` → API history
│
├─► Turn Completion
│   └─► `didCompleteReadingStream = true`
│   └─► `userMessageContentReady = true`
│   └─► `saveApiMessages()` persists conversation state
│   └─► `saveTaskMessages()` persists UI-visible messages
│
└─► TURN END (Loop repeats with next user input or autonomous continuation)
```

**Key State Transforms:**

- **Input**: Plain text → API message format (user message)
- **Prompt**: Stateless assembly each turn (JSON → string with role/constraint injection)
- **Streaming**: Raw chunks → Structured blocks (`text` | `tool_use` | `tool_result`)
- **Tool Params**: Raw JSON → Validated `nativeArgs` → Tool-specific parameter objects
- **Tool Results**: Tool output → `tool_result` block → API message history

---

## 3. Architectural Key Components

This section describes the components that turn a conversational agent into a governable system: (1) a hook boundary that can block unsafe operations, (2) an intent model that declares scope/constraints, and (3) trace records that provide durable attribution.

### 3.1 The Hook Engine

The Hook Engine is the central middleware that intercepts all tool execution requests. It operates in three phases:

Conceptually, the Hook Engine is a deterministic policy gate around non-deterministic model behavior. It should be implemented so the same tool request and intent state produce the same allow/deny decision and the same injected context, making the system predictable and easier to debug.

#### PreToolUse Hook

- **Intent Validation**: Verifies that a valid `intent_id` is active
- **Context Injection**: Loads constraints and scope from `active_intents.yaml`
- **Scope Enforcement**: Validates target files against `owned_scope` patterns
- **Command Classification**: Categorizes as Safe (Read) or Destructive (Write/Delete/Execute)
- **HITL Gate**: Pauses execution for user approval on destructive operations

PreToolUse should be treated as _fail-closed_ for destructive actions: if intent is missing/invalid, scope does not match, or approval is not granted, the tool does not run. For safe/read tools, PreToolUse can still inject context (or just pass through) depending on how strongly you want to steer model behavior.

#### Context Injector

- Reads `.orchestration/active_intents.yaml`
- Constructs `<intent_context>` XML block
- Injects constraints, acceptance criteria, and owned scope into prompt
- Enforces "analysis before action" via prompt engineering

Context injection should be curated rather than a raw dump of all project state. The ideal injected payload is the smallest set of information that reliably constrains the next step:

- intent id and short name,
- owned scope patterns,
- constraints (non-negotiables),
- acceptance criteria (definition of done),
- and optionally relevant prior trace highlights for the same intent.

Using a structured block (XML-like) is less about XML and more about creating a stable, parseable boundary in the prompt so both the model and any future tooling can reliably find the injected context.

#### PostToolUse Hook

- Computes SHA-256 content hashes for modified files
- Constructs trace records with intent linkage
- Appends to `agent_trace.jsonl`
- Updates `intent_map.md` with spatial mappings
- Triggers automated formatting/linting

PostToolUse is responsible for recording reality. It should capture:

- what tool actually ran,
- what files were mutated,
- before/after content hashes,
- and any automation side effects (formatter/linter rewrites).

This ensures the audit log reflects the true final state on disk, even if the agent's narrative is incomplete or incorrect.

#### 3.1.1 Roo Code Host Extension Architectural Constraints

The following constraints are specific to the Roo Code host extension architecture and must be respected when designing the hook system:

**Native Tool Calling Protocol Requirements:**

- Every `tool_use` block MUST have a corresponding `tool_result` block with matching `tool_use_id`
- Missing or mismatched tool_use/tool_result pairs cause Anthropic API 400 errors
- Tool IDs must be unique within a conversation turn (sanitized via `sanitizeToolUseId`)

**Stateless System Prompt Assembly:**

- System prompt is reconstructed on every agent turn (no persistent state)
- Prompt assembly occurs in `src/core/prompts/system.ts:generatePrompt()`
- Context must be re-injected on each turn via `Task.ts` message queue

**Streaming Content Block Processing:**

- Content blocks arrive incrementally during API streaming
- `presentAssistantMessage()` uses a locking mechanism (`presentAssistantMessageLocked`) to prevent concurrent execution
- Blocks are processed sequentially via `currentStreamingContentIndex`
- Partial blocks (`block.partial === true`) must not trigger tool execution

**Message Ordering Invariants:**

- `tool_use` blocks must appear BEFORE corresponding `tool_result` blocks in API history
- `didCompleteReadingStream` flag indicates when streaming is complete
- `userMessageContentReady` signals when to proceed to next request

**Tool Execution Dispatch Flow:**

1. `block.type === "tool_use"` triggers tool dispatch
2. `block.nativeArgs` validation (must exist for valid tool calls)
3. Tool name validation via `isValidToolName()`
4. Approval flow via `askApproval()` callback
5. Tool execution via specific tool handlers (e.g., `WriteToFileTool`, `ExecuteCommandTool`)
6. `pushToolResult()` sends result back to API history

### 3.2 Intent Management System

The Intent Management System tracks the lifecycle of business requirements:

- **Intent Specification**: YAML-based definition with formal scope, constraints, and acceptance criteria
- **Status Tracking**: States include PENDING, IN_PROGRESS, COMPLETED, ABORTED
- **Scope Definition**: Glob patterns defining which files the intent owns
- **Constraint Enforcement**: Non-negotiable rules agents must follow

Intent specs are the policy substrate of the system. A useful way to think about them:

- **owned_scope** is an allowlist ("may write here"); if it is not matched, writes are blocked.
- **constraints** are invariants ("must be true"); they should be phrased to be verifiable when possible (tests, lint rules, compatibility requirements).
- **acceptance_criteria** is the completion contract; it can drive automated checks and UI progress reporting.

The status field enables lifecycle governance (e.g., block destructive operations for ABORTED intents; require explicit override approvals for COMPLETED intents).

### 3.3 Traceability Engine

The Traceability Engine maintains immutable records of all code modifications:

- **Content Hashing**: SHA-256 of code blocks ensures spatial independence
- **Trace Records**: Append-only JSONL format with full audit trail
- **Git Integration**: Links traces to VCS revisions
- **Temporal Tracking**: Timestamps for all modifications

The design centers on **spatial independence**: attribution should survive refactors and file movement.

- Line numbers are helpful for navigation, but not reliable identifiers.
- Content hashes (and optionally AST-node hashes) become stable anchors for tracking ownership over time.

The ledger being append-only is intentional: it supports forensic integrity and makes it possible to rebuild derived views (like `intent_map.md`) from ground truth.

### 3.4 Orchestration Directory Structure

```
.orchestration/
├── active_intents.yaml      # Current business requirements
├── agent_trace.jsonl        # Immutable mutation log
├── intent_map.md           # High-level intent to code mapping
├── TODO.md                 # Session state persistence
└── claude.md               # Shared knowledge across sessions
```

Operational expectations:

- `active_intents.yaml` is the source of truth for what work is active and what boundaries apply.
- `agent_trace.jsonl` is the source of truth for what mutations occurred.
- `intent_map.md` is a human-friendly index that can be regenerated from trace records.
- `TODO.md` is short-lived session continuity (useful across reloads).
- `claude.md` (or `CLAUDE.md` depending on conventions) accumulates lessons/patterns to reduce repeated failures.

---

## Research-Informed Enhancements

> **Source**: [AI-Native Git: Version Control for Agent Code](https://medium.com/@ThinkingLoop/ai-native-git-version-control-for-agent-code-a98462c154e4) (Thinking Loop, Aug 2025)  
> **Key Insight**: Agentic systems require a paradigm shift from **static snapshots** to **continuous memory streams**, from **commit hashes** to **semantic intent queries**.

The following ideas extend the base architecture with AI-native capabilities:

### 1. Semantic Query Layer

Enable natural language queries over the trace ledger instead of requiring content hashes or intent IDs. Developers can ask "show me authentication-related changes from last week" or "what was the agent trying to do when it modified the rate limiter?"

### 2. Continuous Memory Stream

Extend traceability beyond discrete tool executions to capture the agent's reasoning process. Record "thinking" tokens, partial code drafts, rejected approaches, and internal checkpoints before the agent finalizes a tool call.

### 3. Generative vs. Operational Classification

Distinguish between:

- **Generative actions**: Reasoning, planning, analysis (no side effects, no approval needed)
- **Operational actions**: File writes, command execution (requires intent + approval)
- **Meta actions**: Changes to orchestration state (requires elevated privileges)

### 4. Intent Branching & Evolution

Treat intents as a version-controlled graph supporting forking (try alternative approaches), merging (combine completed intents), and evolution (track how requirements change over time).

### 5. Semantic Recovery Points

## Research (Inspired by git-ai)

Additive ideas from `git-ai-project/git-ai` that map well onto the intent + hook + trace ledger approach.

- Git Notes for provenance: attach intent/trace/attribution metadata to commits via Git Notes (keep main history clean)
- Line-level authorship log: maintain a machine-readable mapping of file + line ranges -> agent session (tool + model + session ID) to enable an "AI blame" view
- Checkpoints during work, aggregate on commit: collect small attribution/trace checkpoints as edits happen and materialize a single structured artifact at commit time
- Keep transcripts out of Git: store only transcript pointers/IDs in notes; keep transcripts local (e.g., SQLite) or in a controlled prompt store (with access control + redaction)
- Durability across history rewrites: preserve provenance through rebase/squash/merge/cherry-pick by rewriting/translating attribution logs when history changes
- First-class "why" retrieval: provide a `/ask`-style tool/skill that rehydrates original intent + transcript context for a file/hunk/line range
- Adoption/quality metrics: track AI/human/mixed contributions plus acceptance/override/durability indicators to guide governance and tooling
- IDE surfaces: show provenance in-editor (gutter/hover) with links to trace artifacts and transcript summaries

## 4. Phase-by-Phase Implementation Architecture

The implementation is staged to keep the extension usable while gradually increasing enforcement. Early phases focus on learning the current execution model and adding the minimum viable handshake. Later phases add security hardening and traceability, and only then attempt concurrency (which otherwise multiplies failure modes).

This sequencing mirrors the curriculum described in related research notes: first scaffolding and state, then hook middleware, then traceability, then multi-agent orchestration. Each phase should leave the system in a valid state where the next phase can be implemented without rewriting earlier work.

### Phase 0: System Analysis

Phase 0 is about finding the real control points in the existing extension. In VS Code extensions, "where work happens" is often spread across message handlers, tool dispatchers, and prompt builders; this phase ensures you can intercept the right point once and apply policy consistently.

**Goal**: Map the extension's execution loop and identify integration points.

The main architectural question to answer is: "What is the narrowest place to intercept _all_ tool calls?" If the interception point is incomplete (misses a path), the system can end up with unenforced writes.

**Tasks**:

1. Trace `execute_command` and `write_to_file` in tool system
2. Locate System Prompt construction in message manager
3. Identify state management patterns (ContextProxy)
4. Map webview message protocol

**Integration Points**:

- `src/core/task/Task.ts`: Main task execution controller (Cline class replaced with Task)
- `src/core/assistant-message/presentAssistantMessage.ts`: Tool dispatch and execution orchestration
- `src/shared/tools.ts`: Tool definition schemas
- `src/services/mcp/McpHub.ts`: MCP tool execution
- `webview-ui/src/context/ExtensionStateContext.tsx`: UI state management

**Deliverable**: Complete architecture mapping document

#### Phase 0.1: Precise Injection Chokepoint Identification

**The Narrowest Interception Point:**

The ideal hook injection location is within `src/core/assistant-message/presentAssistantMessage.ts` at the `case "tool_use":` block switch statement (approximately line 298). This is the ONLY point where all tool execution paths converge.

**Exact Injection Location:**

```typescript
// src/core/assistant-message/presentAssistantMessage.ts ~line 298
case "tool_use": {
  // INJECTION POINT 1: Pre-hook validation
  // - Check if intent is selected
  // - Validate scope for destructive tools
  // - Request user approval

  const toolCallId = (block as any).id as string | undefined
  if (!toolCallId) {
    // Handle invalid tool call...
  }

  // ... validation logic ...

  // Tool dispatch happens here via switch on block.name
  switch (block.name) {
    case "write_to_file":
      await writeToFileTool.handle(cline, block, callbacks)
      break
    case "execute_command":
      await executeCommandTool.handle(cline, block, callbacks)
      break
    // ... other tools
  }

  // INJECTION POINT 2: Post-hook processing
  // - Compute content hashes
  // - Write trace records
  // - Update spatial map
}
```

**Why This Is The Ideal Chokepoint:**

1. **Single entry**: All tool calls (native and MCP) flow through this switch statement
2. **After validation**: Tool IDs and `nativeArgs` are validated before this point
3. **Before execution**: Tool handlers haven't been invoked yet
4. **After completion**: Results are pushed via `pushToolResult()` callback

**Alternative (Less Desirable) Points:**

- Individual tool handlers (e.g., `WriteToFileTool.execute()`): Too granular, easy to miss edge cases
- `Task.ts` message loop: Too early, before tool parsing
- `ClineProvider.ts`: Too far from execution, misses programmatic tool calls

Completion checklist (practical):

- Confirm where tool schemas are defined and validated.
- Confirm where the extension decides a tool call is allowed and where it requests approvals.
- Confirm how the webview receives tool results and how it triggers new actions.

---

### Phase 1: Reasoning Loop & Context Injection

Phase 1 introduces the handshake that prevents "immediate code generation" from turning into "immediate mutation". The design goal is to make intent selection explicit, interceptable, and auditable.

**Goal**: Bridge synchronous LLM with asynchronous IDE loop.

This is less about threading and more about modeling: the model runs in turns, while the IDE can require asynchronous approvals and policy checks. Intent selection becomes the explicit synchronization point.

#### Key Components:

**1. Intent Selection Tool**

By defining intent selection as a tool, you ensure the agent cannot "silently" decide intent in natural language. The selection becomes structured data the system can validate (does the intent exist? is it active?) and the UI can display.

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

Even though this section shows a TypeScript interface, the core requirement is behavioral: PreToolUse must be able to (a) deny, (b) request approval, or (c) enrich the next model turn with curated intent context.

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

The system prompt change is a cooperative layer: it teaches the model the protocol so it chooses the right first step. Enforcement must still be implemented in hooks, but clear prompting reduces wasted turns.
Add mandatory preamble to system prompt:

```
"You CANNOT write code immediately. You MUST:
1. Analyze the user's request
2. Identify the appropriate intent_id
3. Call select_active_intent(intent_id) BEFORE any file modifications
4. Wait for context injection before proceeding"
```

**4. Gatekeeper**

The Gatekeeper is a minimal stateful guard. Keeping it small reduces the chance of duplicating policy logic (which leads to drift). Treat it as an "intent selected?" latch, not as a full authorization engine.

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

- Hook into `src/core/assistant-message/presentAssistantMessage.ts` tool execution flow
- Extend tool definitions in `src/shared/tools.ts`
- Modify system prompt generation in message manager

---

### Phase 2: Hook Middleware & Security

Phase 2 turns the Hook Engine into a security boundary. The intent protocol is only meaningful if destructive operations are consistently classified, constrained, and optionally approved by a human.

**Goal**: Establish formal boundaries for safe execution.

The boundary is defined in terms of tool effects:

- read/search tools are generally safe,
- write/delete/execute tools are potentially destructive and must be guarded.

#### Key Components:

**1. Command Classification**

Classification is the first defense layer. It does not need to be perfect; it needs to be conservative. When unsure, classify as destructive and require approval.

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

Approval should be designed for fast, informed decisions. The user should see intent id/name, the exact operation, and the paths/commands affected.

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

Scope enforcement is an allowlist. A common failure mode is path trickery (relative paths, different separators, symlinks). Normalizing paths before matching is an important implementation detail.

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

Structured errors are essential for autonomous recovery. They let the model react to a specific violation (missing intent vs out-of-scope vs user rejection) rather than guessing.

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

- Intercept in `src/core/assistant-message/presentAssistantMessage.ts` before tool execution
- Extend webview UI for approval dialogs
- Store authorization state in `ContextProxy`

---

### Phase 3: Traceability & Hashing

Phase 3 makes the system auditable. The intent protocol explains what the agent _intended_ to do; traceability records what the system _actually_ did.

**Goal**: Implement semantic tracking with spatial independence.

Spatial independence means a trace remains meaningful even after code is moved. Hashes (file/block/AST) are used as anchors so attribution survives refactors.

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
- Hook into `src/core/assistant-message/presentAssistantMessage.ts` after successful file writes
- Store trace ledger in workspace `.orchestration/`

---

### Phase 4: Parallel Orchestration

Phase 4 introduces multi-agent execution. This is deliberately last because concurrency increases complexity: it creates conflicts, ordering issues, and new recovery paths.

**Goal**: Enable safe concurrent agent execution.

The design assumes that conflicts are inevitable at some scale. The objective is not to prevent every conflict, but to detect them early (locking), minimize their surface area (diffs), and provide a clear resolution workflow (supervisor arbitration + lessons).

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

These schemas are the contract between the Hook Engine (enforcement), the `.orchestration/` directory (persistence), and the Webview UI (inspection/approval). They should be treated as versioned public interfaces: validate them with JSON Schema / YAML schema checks and evolve them carefully to avoid breaking existing traces.

### 5.1 Intent Specification Schema (YAML)

The intent spec is designed to be human-authored and diff-friendly:

- YAML keeps the file readable and easy to edit.
- `owned_scope` should be considered an allowlist used by scope enforcement.
- `constraints` and `acceptance_criteria` should be written so they can be verified (tests, commands, or checklists).

If this file becomes a single point of enforcement, schema validation becomes important: malformed YAML should fail closed (block destructive tools) rather than allow a write with missing constraints.

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

The trace ledger is an append-only event stream.

- JSONL (one JSON object per line) allows safe appends and streaming reads.
- Records should be written by the system (PostToolUse), not by the agent, to ensure integrity.
- Including VCS metadata makes it possible to correlate traces with commits and review states.

When designing queries, treat hashes as identifiers and line ranges as navigation hints.

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

The spatial map is a human navigation layer. It exists to answer questions like:

- "Which intent owns this code block?"
- "Where in the repo did INT-001 make changes?"

It should be treated as a derived projection that can be regenerated from the immutable JSONL ledger if it drifts.

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

The system relies on clear boundaries:

- The **Extension Host** owns execution, policy enforcement, and persistence.
- The **Webview** owns presentation and user interaction.

Defining explicit interfaces keeps the hook/intent system modular and makes it easier to test pieces independently.

### 6.1 Extension Host Interface

The Extension Host provides the core API for the hook system:

This interface is effectively the "intent orchestration runtime". It should be the only place that:

- reads/writes `.orchestration/` files,
- executes mutating tools,
- and emits approval requests.

Everything else (including the UI) should interact through message passing or these methods, ensuring there is a single, enforceable pathway for mutation.

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

The UI is not a security boundary; it is a decision surface.

- It renders current intent state, trace results, and pending approvals.
- It should not attempt to re-implement validation rules; instead it should display validation outcomes from the host.
- Because webviews do not have Node access, all privileged operations must round-trip through the extension host.

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

This section explains how to integrate the intent-driven layer into an existing Roo Code/Cline-style extension with minimal disruption. The general strategy is:

- intercept tool execution in one place,
- add intent protocol to the system prompt,
- extend tool schemas to carry intent metadata,
- and build new services (intent manager, trace ledger) alongside existing ones.

The most important non-functional requirement is "no bypass paths": once hooks exist, every destructive tool must go through them.

### 7.1 Extension Entry Points

The proposed file layout keeps new functionality clustered. That reduces merge conflicts and makes it easier to review the "new system" as a unit:

- `src/hooks/` for interception logic,
- `src/services/intent/` for persistence and querying,
- and small edits in core execution/prompt/message layers to wire everything together.

```
src/
├── activate/
│   ├── index.ts                    # Add: initialize intent orchestration
│   └── registerCommands.ts         # Add: intent management commands
├── core/
│   └── Task.ts                     # Modify: inject hook interception
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

The integration points here are chosen because they are high-leverage: changing them affects all tool calls and all model turns.

**1. Tool Execution Flow**

Location: `src/core/assistant-message/presentAssistantMessage.ts`

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

Security is a core motivation for the architecture. The system is designed to prevent both:

- accidental damage (well-meaning but wrong actions), and
- malicious or prompt-injected actions (unsafe commands, scope bypass attempts).

Guardrails are layered so that failure of one layer (e.g., prompt discipline) does not result in unsafe execution.

### 8.1 Security Architecture

The security layers are ordered intentionally:

- classify first (so later checks know what level of scrutiny to apply),
- validate intent and scope (so actions are tied to an explicit contract),
- require HITL approval (so risky actions are reviewed),
- sanitize inputs (so parameters cannot escape intended boundaries),
- and use circuit breakers (so repeated failures do not spiral).

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

These examples are reference implementations showing the type of enforcement expected. In production, patterns should be expanded and hardened, but the overarching rule remains: when the system cannot confidently prove an action is safe and in-scope, it should block or require explicit approval.

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

These diagrams are not just illustrative; they encode the intended invariants of the system. If implementation details change, the diagrams should be updated so they remain a reliable reference for reviewers and contributors.

### 9.1 Two-Stage State Machine

How to read this diagram:

- "Reasoning Intercept" is the mandatory handshake state. The system should not allow destructive tool calls in State 1.
- Context injection happens inside the handshake so the next model turn is constrained.
- Trace logging happens after execution so it reflects the real disk outcome.

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

How to read this diagram:

- Pre-processing is a pipeline of validators; any failure short-circuits to a structured error.
- Tool execution runs only when all validators pass.
- Post-processing persists immutable evidence (hashes + trace record) and updates derived artifacts (maps).

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

How to read this diagram:

- The Supervisor is a coordination plane: it assigns disjoint scopes, monitors progress, and arbitrates conflicts.
- Workers should still be constrained by the same intent/scope policies (no privileged bypass).
- Shared resources are designed for concurrent access (append-friendly logs, lock managers, diff-based writes).

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

This architecture reframes AI assistance as a controlled execution pipeline:

- intent selection is required before mutation,
- hooks enforce scope, constraints, and approvals at runtime,
- and trace records provide durable attribution via content hashing.

The result is a system that is safer to operate, easier to review, and robust to refactoring, while still enabling advanced workflows like multi-agent parallelism.

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
- `src/core/assistant-message/presentAssistantMessage.ts`: Modified for hook interception
- `src/shared/tools.ts`: Extended tool definitions
- `webview-ui/src/components/intent/`: UI components for intent management
- `.orchestration/`: Workspace directory for persistence

This architecture transforms AI agents from autonomous code generators into contextualized, traceable, and governable development partners.
