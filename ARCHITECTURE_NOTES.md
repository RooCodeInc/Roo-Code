# Phase 1: The Handshake (Reasoning Loop Implementation)

## 1. Executive Summary
The objective is to move beyond text-based version control by implementing a **Deterministic Hook System**.  
This system enforces a **"Plan-First" workflow** where AI agents must formally declare their **Intent** before mutating the codebase.

---

## 2. Nervous System & Interception Points
Based on the codebase audit, the following functions represent the "Strategic High Ground" for hook injection:

### A. The "Reasoning Loop" (Prompt Construction)
- **Location**: `src/core/prompts/` and `src/core/RooCode.ts`  
- **Function**: Handles the assembly of system instructions and tool definitions.  
- **Injection Strategy**: Modify the SystemPrompt generator to include the mandatory `select_active_intent` tool and instructions that forbid file writes without an active session intent.

### B. The "Pre-Hook" (Command Execution)
- **Location**: `src/integrations/terminal/TerminalManager.ts` and `src/services/EditorService.ts`  
- **Function**: `executeCommand()` and `openFile()`  
- **Injection Strategy**: Intercept calls before they reach the terminal or editor. If the agent attempts a structural change (e.g., `npm install` or `rm`), the Pre-Hook validates the action against the `owned_scope` defined in `.orchestration/active_intents.yaml`.

### C. The "Post-Hook" (File Mutations)
- **Location**: `src/core/webview/DiffViewProvider.ts` and `src/services/RelayService.ts`  
- **Function**: `writeFile()` and `applyDiff()`  
- **Injection Strategy**: Intercept immediately after a successful write. This hook triggers the Content Hashing engine to generate a spatial fingerprint of the change, appending the metadata to the `.orchestration/agent_trace.jsonl` ledger.

---

## 3. The Two-Stage State Machine
To eliminate "Vibe Coding," the execution flow is re-architected into a strict handshake:

| State | Entity | Action |
|-------|--------|--------|
| 1. Request | User | "Refactor the auth middleware." |
| 2. Intent Handshake | Agent | Calls `select_active_intent("INT-001")`. |
| 3. Validation | Pre-Hook | Pauses loop. Queries `.orchestration/`. Injects constraints (e.g., "Use JWT, not Session"). |
| 4. Contextual Action | Agent | Generates code with injected constraints. Calls `write_file`. |
| 5. Trace Logging | Post-Hook | Calculates sha256 hash. Updates `agent_trace.jsonl`. |

---

## 4. Logical Architecture Diagram
User Prompt → Extension Host → Pre-Hook (Intent Validation) → LLM → Post-Hook (Trace Logging) → File System


---

## 5. Data Model Specification
The following machine-managed files in `.orchestration/` act as the "Source of Truth" for AI governance:

- **active_intents.yaml**: The "Why." Defines scope, constraints, and Definition of Done (DoD).  
- **agent_trace.jsonl**: The "How." An append-only ledger linking Intent IDs to specific Code Hashes.  
- **intent_map.md**: The "Where." A spatial map linking business logic to AST nodes and files.  
- **AGENT.md**: The "Memory." Shared architectural decisions and lessons learned across agent sessions.

---

## 6. Phase 1 Implementation Goals
- **Initialize Sidecar**: Automatically generate the `.orchestration/` directory on extension activation.  
- **Tool Injection**: Register `select_active_intent` as a core capability.  
- **Strict Middleware**: Implement logic that blocks `write_file` if `current_session_intent` is null.

