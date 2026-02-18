# Architecture Notes: AI-Native IDE Hook System (Phase 0 & Upgrade Plan)

## 1. Host Extension Architectural Analysis (Phase 0)

### 1.1 Trace of Execution: The Nervous System

We performed a deep structural analysis of the **Roo Code** codebase to identify interception points. The execution flow for a single agent turn is mapped as follows:

1.  **User Input:** Entered in Webview Sidebar (`webview-ui/`).
2.  **IPC Transmission:** Message sent via `vscode.postMessage({ type: 'submit', text: ... })` to Extension Host.
3.  **Webview Provider:** `src/core/webview/ClineProvider.ts` receives the message. This is the **Data Boundary**.
4.  **Task Manager:** `ClineProvider` instantiates or updates a `Task` instance in `src/core/task/Task.ts`.
5.  **Prompt Construction:** `Task.ts` assembles the System Prompt (stateless re-assembly on every turn).
6.  **Tool Execution Loop:** `src/core/assistant-message/presentAssistantMessage.ts` contains a switch statement that calls `tool.handle(task, block, callbacks)` for each tool.
    - **Injection Point:** The switch statement in `presentAssistantMessage.ts` (lines 700-850) is the **Logical Chokepoint** where the Hook Engine will intercept execution.

### 1.2 Data Boundaries: Webview vs. Extension Host

| Layer            | Component                    | Data Format               | Transformation Process                         |
| :--------------- | :--------------------------- | :------------------------ | :--------------------------------------------- |
| **UI Layer**     | `ClineProvider.ts`           | JSON (`postMessage`)      | Sanitized input only; No Node.js API access    |
| **IPC Boundary** | `ipcHandler.ts`              | JSON → Internal Object    | Deserializes JSON payload into `ToolUse` block |
| **Logic Layer**  | `presentAssistantMessage.ts` | Internal `ToolUse` Object | Full Filesystem Access; Manages Promise Chain  |

**Architectural Constraint:** The System Prompt is **stateless**. It must be re-assembled from conversation history on every turn. This necessitates the **PreCompact Hook** to prevent context overflow and ensure deterministic behavior.

### 1.3 Identification of Injection Points

The Hook Engine is inserted at two critical junctures in `src/core/assistant-message/presentAssistantMessage.ts`:

1.  **Pre-Execution:** Before `tool.handle()` is called. We wrap the Promise chain to intercept the `ToolUse` block. This allows us to validate intent before any side effects occur.
2.  **Post-Execution:** After the Promise resolves but before the result is appended to conversation history. This allows us to modify the result (e.g., inject linter errors) before the LLM sees it, enabling autonomous recovery.

---

## 2. The 'Reasoning Loop' Architecture (Phases 1 & 2)

### 2.1 The Two-Stage State Machine (Handshake)

To solve the **Context-Injection Paradox**, we implement a mandatory Two-Stage State Machine. The agent cannot transition from **Reasoning** to **Action** without completing the Handshake.

- **Stage 1: Intent Selection.** Agent must call `select_active_intent(intent_id)`.
- **Stage 2: Contextualized Action.** Only after receiving `<intent_context>` can the agent call `write_file`.

### 2.2 Trigger Mechanism & Gatekeeper

- **Trigger Tool:** `select_active_intent(intent_id: string)`.
- **Gatekeeper Logic:** Located in `src/hooks/middleware/intent-gatekeeper.ts`.
    - **Check 1:** Is `intent_id` valid in `active_intents.yaml`?
    - **Check 2:** Is the intent `LOCKED` by another agent? (Optimistic Locking).
    - **Check 3:** Does the requested tool action fall within `owned_scope`?

### 2.3 Theoretical Grounding: Repaying Debt

| Technical Decision      | Debt Repaid        | Mechanism                                                                          |
| :---------------------- | :----------------- | :--------------------------------------------------------------------------------- |
| **Mandatory Handshake** | **Trust Debt**     | Prevents blind code acceptance. Forces explicit intent citation.                   |
| **Scope Enforcement**   | **Cognitive Debt** | Prevents "Vibe Coding" drift. Ensures agent stays within architectural boundaries. |
| **PreCompact Hook**     | **Context Rot**    | Summarizes history to prevent token overflow and reasoning degradation.            |

### 2.4 Failure Modes & Recovery Flows

- **Locked Intent:** If Agent A selects `INT-001`, Agent B is blocked. **Recovery:** Agent B is prompted to select a different intent or wait (returned as `tool_error`).
- **Token Limit Exceeded:** If `<intent_context>` exceeds window. **Recovery:** `PreCompact Hook` truncates non-essential constraints, prioritizing `acceptance_criteria`.
- **Scope Violation:** Agent attempts to write outside `owned_scope`. **Recovery:** Hook blocks write, returns error suggesting `scope_expansion_request` tool.

---

## 3. Hook System Architecture (Upgraded)

### 3.1 Design Philosophy

The upgraded hook system provides a **Deterministic Lifecycle** boundary for governed agent operations. It follows the **Middleware Interceptor Pattern**, allowing:

- **Privilege Separation**: Webview (UI) cannot access filesystem directly.
- **Deterministic Execution**: Hooks execute regardless of model probabilistic output.
- **Fail-Safe Operations**: Individual hook failures do not crash the agent loop.
- **Traceability**: Every action is logged to `.orchestration/agent_trace.jsonl`.

### 3.2 Architecture Components

#### HookEngine

Central middleware boundary that orchestrates all hook operations:

- **Registration**: Registers PreToolUse and PostToolUse hooks.
- **Interception**: Wraps tool execution promises.
- **Context Management**: Maintains `activeIntentId` across turns.

#### Hook Types (Deterministic Lifecycle)

- **PreToolUse**: Executes BEFORE tool execution (Validation, HITL, Scope Check).
- **PostToolUse**: Executes AFTER tool execution (Trace Logging, Linting, Formatting).
- **PreCompact**: Executes BEFORE context assembly (Token Management, Summarization).

### 3.3 Priority System

Hooks execute in priority order to ensure security before logic:

- **Critical**: Security gates (Intent Gatekeeper, HITL).
- **High**: Context enrichment (Intent Loading).
- **Normal**: Traceability (Logging, Hashing).
- **Low**: Post-processing (Formatting, Telemetry).

### 3.4 Error Handling

The hook system implements robust error handling:

- Individual hook failures don't stop other hooks from executing.
- Errors are returned as structured `tool_error` to the LLM for self-correction.
- Hook execution continues even if one hook fails (Fail-Safe).

---

## 4. Integration Points

### 4.1 Extension Activation

The hook system is initialized during extension activation:

```typescript
// In src/extension.ts
const hookEngine = new HookEngine(context)
hookEngine.registerPreHook(new IntentGatekeeper())
hookEngine.registerPostHook(new TraceSerializer())
```

### 4.2 Task Lifecycle

Hooks are integrated into the task system at the tool execution chokepoint:

```typescript
// In src/core/assistant-message/presentAssistantMessage.ts
const preResult = await hookEngine.interceptPre(toolCall)
if (preResult.blocked) return this.formatRejection(preResult)

const result = await tool.handle(task, block, callbacks)

await hookEngine.interceptPost(toolCall, result)
```

### 4.3 Sidecar Storage

Trace data is stored non-destructively in `.orchestration/`:

- **active_intents.yaml**: Intent Specifications (SpecKit Foundation).
- **agent_trace.jsonl**: Immutable Ledger (Agent Trace Spec).
- **CLAUDE.md**: Shared Brain (Multi-Agent Orchestration).

---

## 5. Visual System Blueprint

### 5.1 Component Separation

- **Webview**: Restricted UI (No Node.js API).
- **Extension Host**: Logic Layer (Task.ts, presentAssistantMessage.ts).
- **Hook Engine**: Middleware Boundary (src/hooks/).
- **Sidecar Storage**: Data Layer (.orchestration/).

### 5.2 Data Flow

1.  User Prompt → Webview → IPC → Extension Host.
2.  Extension Host → Hook Engine (PreToolUse).
3.  Hook Engine → Tool Executor (if validated).
4.  Tool Executor → File System.
5.  File System → Hook Engine (PostToolUse).
6.  Hook Engine → Sidecar Storage (Trace Log).

---

## 6. Best Practices

1.  **Spatial Independence**: Use content hashes (SHA-256) for trace records, not line numbers.
2.  **Atomic Writes**: Sidecar files must be written atomically to prevent corruption.
3.  **Idempotency**: Hooks should be idempotent when possible.
4.  **Least Privilege**: Tools should operate under the principle of least privilege.
5.  **Documentation**: Document hook behavior and side effects in CLAUDE.md.
