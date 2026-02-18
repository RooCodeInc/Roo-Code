# Architecture Notes – Roo Code Fork

## 1. What Roo Code Is

Roo Code is a VS Code extension that embeds an AI agent directly inside the editor. The agent can read project context, interact with a language model, and execute tool calls such as editing files or running commands within the workspace.

At a high level, Roo Code follows an iterative agent loop:

**Chat → Think → Act → Observe → Repeat**

---

## 2. High-Level Architecture

Roo Code is organized into three logical layers:

### ① Webview UI

- Chat interface inside VS Code
- Sends user messages to the extension host
- Displays assistant responses and tool progress
- Has no direct access to the filesystem

### ② Extension Host (Core Logic)

- Builds system prompts and conversation history
- Calls the LLM provider
- Interprets assistant responses
- Dispatches and executes tool calls
- Owns task and execution orchestration

### ③ Workspace & Side Effects

- Files on disk
- VS Code edits and diffs
- Commands executed in the workspace
- Sidecar metadata (added in this fork)

---

## 3. End-to-End Flow

1. User types a request in the Roo chat UI.
2. Webview sends the message to the extension host via `webviewMessageHandler`.
3. `ClineProvider` routes the message and manages `Task` instances for each conversation.
4. `Task` builds the system prompt and conversation history.

5. **Pre-LLM Handshake (Two-Stage State Machine – Stage 1 → Stage 2)**

    - An active intent must be selected.
    - The selected `intent_id` is stored on the running `Task` (runtime state).
    - Intent metadata is loaded from `.orchestration/active_intents.yaml`.
    - An `<intent_context>` block (owned scope, constraints, acceptance criteria) is injected into the system-level context (system prompt and/or an additional system message).

6. The LLM provider constructs the final messages array, sends the contextualized request to the language model, and streams back the response.
7. The model returns assistant text and optional tool calls.

8. **Assistant Dispatcher**

    - `presentAssistantMessage` renders assistant output.
    - Acts as the central dispatcher for assistant responses and tool execution.
    - Validates tool usage and resolves aliases.

9. **Tool Registry & Aliasing**

    - `tools.ts` defines canonical tool names, groups, and display names.
    - `filter-tools-for-mode.ts` resolves aliases and applies model/tool customization.
    - Example: `write_file` is an alias for canonical `write_to_file`.
    - Hooks always treat `write_to_file` as the canonical write operation, regardless of the alias used by the model.

10. **Pre-Tool Hook (Stage 2 → Stage 3)**

    - Confirms an active `intent_id` exists on the `Task`.
    - Validates target paths against the intent’s owned scope.
    - Optionally enforces human approval for mutating actions.

11. Tool implementations execute (e.g. `WriteToFileTool`, `ApplyDiffTool`, `EditFileTool`).
12. **Post-Write Hook**

    - Tool-level hook: inside `WriteToFileTool.execute` (has full task and intent context).
    - Filesystem-level hook: inside `DiffViewProvider.saveDirectly` / `saveChanges` (canonical write boundary shared by all edit tools).
    - Trace entries are appended to `.orchestration/agent_trace.jsonl`.

13. Files are written or diffs are applied to the workspace.
14. Tool results and updated files become new context for the next iteration of the agent loop.

---

## 4. Core Components and Responsibilities

### webviewMessageHandler.ts

- Receives messages from the chat UI (Webview → Extension Host)
- Forwards events into `ClineProvider`

### ClineProvider.ts

- Manages one or more `Task` instances
- Coordinates state between UI, Task, and provider
- Acts as the main entry point for extension-side orchestration

### Task.ts

- Builds the system prompt (using the shared `SYSTEM_PROMPT` builder)
- Collects conversation history and context
- Stores runtime state (including active `intent_id`)
- Initiates LLM requests via `api.createMessage(systemPrompt, messages, metadata)`

---

## 5. Prompt and LLM Request Flow

- A core system prompt (`SYSTEM_PROMPT`) defines the agent’s behavior, tools, and rules.
- `Task` assembles:
    - System prompt
    - User messages
    - Assistant and tool history
- The provider constructs a messages array with the system prompt as the first entry, followed by converted conversation messages.
- This messages array is sent to the language model and streamed back.

### Fork Extension: Intent Context Injection

Before each LLM call:

- An active intent must be selected (via a dedicated `select_active_intent(intent_id)` tool in later phases).
- Intent data is loaded from `.orchestration/active_intents.yaml`.
- An `<intent_context>` block is injected into the system-level context (system prompt and/or an extra system message).

This guarantees that every LLM request is explicitly grounded in a specific business intent, its owned scope, and its constraints.

---

## 6. Tool Execution Flow

When the model emits tool calls (for example, file edits or diffs):

### presentAssistantMessage (Central Dispatcher)

- Parses streaming assistant output.
- Validates tool usage based on allowed tools for the current mode.
- Resolves aliases via the tool registry and `filter-tools-for-mode`.
- Dispatches execution to concrete tool implementations.

### Tool Implementations

- File mutation tools (e.g. `WriteToFileTool`, `ApplyDiffTool`, `EditTool`, `EditFileTool`, `SearchReplaceTool`).
- Command execution tools (e.g. `ExecuteCommandTool`).
- Read-only tools (e.g. `ReadFileTool`, `ListFilesTool`, `CodebaseSearchTool`).

### DiffViewProvider

- Canonical write boundary for all filesystem changes.
- Applies diffs or writes files to disk via:
    - `saveDirectly(...)` → `fs.writeFile(...)`
    - `saveChanges(...)` → VS Code workspace edits + `document.save()`
- All workspace mutations ultimately pass through this layer, which is a natural place for post-write trace hooks.

---

## 7. Hook Engine (Fork Addition)

The fork introduces a Hook Engine as a middleware layer without rewriting Roo Code’s core behavior.

### Hook Points

- **Pre-LLM Hook**: before each `api.createMessage(...)` call in `Task`.
- **Pre-Tool Hook**: before mutating tools execute (inside `presentAssistantMessage` or `BaseTool.handle`).
- **Post-Tool/Post-Write Hook**: after successful writes in `WriteToFileTool` and/or `DiffViewProvider`.

### Responsibilities

- Enforce active intent selection before the agent can modify code.
- Validate file paths against the active intent’s owned scope.
- Support human-in-the-loop approval for high-risk actions.
- Record all mutating actions in `.orchestration/agent_trace.jsonl` for traceability.

The Hook Engine treats `presentAssistantMessage` as the primary dispatch boundary and `DiffViewProvider` as the canonical write boundary, using these choke points to enforce governance without scattering checks across the codebase.

---

## 8. Sidecar Architecture (`.orchestration/`)

The fork maintains machine-managed metadata in a dedicated `.orchestration/` directory at the workspace root.

### active_intents.yaml

Tracks:

- Intent ID and name
- Status (e.g. `IN_PROGRESS`, `DONE`)
- Owned file scope (`owned_scope`)
- Constraints and acceptance criteria (definition of done)

### agent_trace.jsonl

Append-only ledger capturing:

- Intent ID
- Tool name
- File path (and optionally line ranges)
- Content hash
- Timestamp
- Optional git metadata (revision, branch)

These artifacts provide deterministic traceability for **why**, **where**, and **under which intent** changes were made.

---

## 9. Summary

This architecture preserves Roo Code’s original execution model while adding:

- Intent awareness (via active intents and `<intent_context>`).
- Governance and safety boundaries (through pre-LLM and pre-tool hooks).
- A clear two-stage state machine for each turn (request → intent handshake → contextualized action).
- Deterministic traceability of AI-driven changes via `.orchestration/agent_trace.jsonl`.

The result is an AI-assisted IDE that supports not only automated code edits, but also accountability and intent-driven development.
