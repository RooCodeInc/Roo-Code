# Architecture Notes: Roo Code "Intent-Driven" Hook System

## Phase 0: The Archaeological Dig (Current System Map)

### 1. The Nervous System (Extension Host)

The core logic resides in the **Extension Host** process, distinct from the UI (Webview).

- **Core Class:** `Task` (in `src/core/task/Task.ts`) appears to be the main orchestrator for an active task/session.
- **Message Loop:**
    - `ClineProvider` receives messages from Webview (`src/core/webview/ClineProvider.ts`).
    - It instantiates/manages `Task` instances.
    - `Task.ts` runs the main loop: `initiateTaskLoop()`.

### 2. The Tool Loop (Execution Flow)

The "Brain" (LLM) sends a text response containing XML-like tool tags (e.g., `<execute_command>`).

- **Parsing:** `presentAssistantMessage` (in `src/core/assistant-message/index.ts` or similar) parses the raw stream.
- **Execution:** `Task.ts` has a method (likely `executeTool` or similar, need to verify exact name in `src/core/task/Task.ts`) that switches on the tool name.
    - `execute_command` -> `Terminal` integration.
    - `write_to_file` -> `fs.writeFile`.
    - `ask_followup_question` -> Sends message back to Webview.

### 3. The Prompt Builder

- **Location:** `src/core/prompts/system.ts`.
- **Function:** `SYSTEM_PROMPT()`.
- **Role:** Constructs the massive context string sent to the LLM, including:
    - Role definition ("You are...").
    - Tool definitions (What `<tags>` are available).
    - Capabilities (Permissions).
    - Loaded Context (Open files, specific instructions).

---

## Architectural Specification (The New System)

### 1. The Hook Engine (Middleware)

We will introduce a strict middleware layer in `src/hooks/`.
**Directory Structure:**

```
src/
  hooks/
    HookEngine.ts       # Main orchestrator
    PreTools/
      IntentCheck.ts    # Enforces active_intent before write
      ScopeCheck.ts     # Verifies file path ownership
    PostTools/
      TraceLogger.ts    # Appends to agent_trace.jsonl
      HashVerifier.ts   # Updates verification hashes
  services/
    OrchestrationManager.ts # Manages .orchestration/ files
```

### 2. The Two-Stage State Machine

The `Task` loop in `src/core/task/Task.ts` will be modified to support a "Blocked" state.

**State Flow:**

1.  **Thinking (LLM):** LLM generates a tool call.
2.  **Intercept (Pre-Hook):** `HookEngine.intercept(toolCall)`
    - _If `select_active_intent`:_ Allow. Load intent context.
    - _If `write_file` AND `no_active_intent`:_ **REJECT**. Return "Error: Must select intent."
    - _If `write_file` AND `intent_active`:_ Check Scope.
3.  **Execution (Core):** Run the actual tool (OS level).
4.  **Audit (Post-Hook):** `HookEngine.audit(result)`
    - Log generic trace.
    - Calculate SHA256 of written file.
    - Append to `.orchestration/agent_trace.jsonl`.

### 3. Data Schemas

**A. Active Intents (`.orchestration/active_intents.yaml`)**

- **Source of Truth** for _why_ we are coding.
- Loaded into the System Prompt context when `select_active_intent` is called.

**B. Agent Trace (`.orchestration/agent_trace.jsonl`)**

- **Immutable Ledger.**
- Links `Intent ID` -> `Code Hash`.
- Ensures we can reconstruct the history of _thought-to-code_.

### 4. Implementation Strategy

1.  **Modify `src/core/task/Task.ts`**:

    - Wrap the internal `executeTool` call.
    - Add `this.activeIntentId` state to the `Task` class.

2.  **Modify `src/core/prompts/system.ts`**:

    - Add `<tool_definition>` for `select_active_intent`.
    - Add "Prime Directive": _Do not write code without an active intent._

3.  **Create `src/services/orchestration/`**:
    - Implement file watchers/readers for the Orchestration directory (YAML/JSONL parsing).

---

## Gap Analysis & Risks

1.  **Latency:** Reading YAML/JSONL on every turn might be slow.
    - _Mitigation:_ Cache intents in memory (`Task` instance) and only re-read on modification or specific refresh.
2.  **Concurrency:** Multiple VS Code windows writing to `agent_trace.jsonl`.
    - _Mitigation:_ Append-only atomic writes or simple file locking.
3.  **User Override:** User might want to just "quick fix" something without an intent.
    - _Mitigation:_ Create a default `INT-000: Ad-hoc Fix` enabled by default for trivial tasks, or prompt user to create one.
