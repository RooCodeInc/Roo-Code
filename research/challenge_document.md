# Intent-Driven Architecture Specification

## 1. System Overview

This specification details the architecture for an extension based on **Roo Code** or **Cline**. The system introduces a hook-based orchestration layer that maintains a strictly defined `.orchestration/` directory within the user's workspace.

### Core Architecture

The system utilizes a **Hook Engine** acting as a middleware boundary between the Extension Host and Tool Execution.

1.  **Webview (UI):** Presentation layer emitting events via `postMessage`.
2.  **Extension Host:** Handles API polling, secret management, and MCP tool execution.
3.  **Hook Engine (Middleware):** Intercepts tool execution requests.
    - **PreToolUse:** Enforces intent context injection and Human-in-the-Loop (HITL) authorization.
    - **PostToolUse:** Updates codebase documentation, state evolution, and intent tracking.

---

## 2. Execution Flow: Two-Stage State Machine

The agent is prohibited from modifying code immediately. It must adhere to a "Checkout -> Act" state machine.

### State 1: Request

- **Trigger:** User inputs a prompt (e.g., "Refactor the auth middleware").

### State 2: Reasoning Intercept (The Handshake)

1.  **Analysis:** The Agent analyzes the request and identifies intent IDs.
2.  **Mandatory Call:** Agent calls `select_active_intent(intent_id)`.
3.  **Pre-Hook Interception:** The Hook Engine pauses execution.
4.  **Context Query:** The Hook queries the `.orchestration/` data model for constraints, related files, and history associated with the `intent_id`.
5.  **Injection:** The Hook injects specific context into the immediate prompt and resumes execution.

### State 3: Contextualized Action

1.  **Action:** The Agent, possessing specific context, calls the LLM to generate changes and invokes `write_file`.
2.  **Post-Hook Interception:** The Hook calculates content hashes, logs the trace, and links the code modification back to the `intent_id`.

---

## 3. Data Model (`.orchestration/`)

Storage follows a Sidecar pattern managed by the machine.

### 3.1. Intent Specification (`active_intents.yaml`)

Tracks the lifecycle of business requirements.

- **Update Pattern:** Updated via Pre-Hooks (task selection) and Post-Hooks (task completion).

```yaml
active_intents:
    - id: "INT-001"
      name: "JWT Authentication Migration"
      status: "IN_PROGRESS"
      # Formal Scope Definition
      owned_scope:
          - "src/auth/**"
          - "src/middleware/jwt.ts"
      constraints:
          - "Must not use external auth providers"
          - "Must maintain backward compatibility with Basic Auth"
      # Definition of Done
      acceptance_criteria:
          - "Unit tests in tests/auth/ pass"
```

### 3.2. Agent Trace Ledger (`agent_trace.jsonl`)

An append-only, machine-readable history of mutating actions linking abstract Intents to concrete Code Hashes.

- **Update Pattern:** Updated via Post-Hook after file writes.
- **Requirement:** Must ensure spatial independence via content hashing (SHA-256).

```json
{
	"id": "uuid-v4",
	"timestamp": "2026-02-16T12:00:00Z",
	"vcs": { "revision_id": "git_sha_hash" },
	"files": [
		{
			"relative_path": "src/auth/middleware.ts",
			"conversations": [
				{
					"url": "session_log_id",
					"contributor": {
						"entity_type": "AI",
						"model_identifier": "claude-3-5-sonnet"
					},
					"ranges": [
						{
							"start_line": 15,
							"end_line": 45,
							"content_hash": "sha256:a8f5f167f44f4964e6c998dee827110c"
						}
					],
					"related": [
						{
							"type": "specification",
							"value": "REQ-001"
						}
					]
				}
			]
		}
	]
}
```

### 3.3. Spatial Map (`intent_map.md`)

- **Purpose:** Maps high-level business intents to physical files and AST nodes.
- **Update Pattern:** Incrementally updated during Intent Evolution events.

### 3.4. Shared Knowledge (`AGENT.md` or `CLAUDE.md`)

- **Purpose:** Persistent knowledge base shared across parallel sessions (e.g., Architect/Builder/Tester roles). Contains lessons learned and stylistic rules.
- **Update Pattern:** Incrementally appended when verification loops fail or architectural decisions are made.

---

## 4. Implementation Phases

### Phase 0: System Analysis

- **Goal:** Map the extension's execution loop.
- **Tasks:**
    - Trace `execute_command` and `write_to_file` functions.
    - Locate System Prompt construction logic.
- **Deliverable:** `ARCHITECTURE_NOTES.md`.

### Phase 1: Reasoning Loop & Context Injection

- **Goal:** Bridge the synchronous LLM with the asynchronous IDE loop.
- **Tasks:**
    - Define tool: `select_active_intent(intent_id: string)`.
    - **Pre-Hook:** Intercept `select_active_intent`. Read `active_intents.yaml` and inject an `<intent_context>` XML block containing constraints and scope.
    - **Prompt Engineering:** Modify System Prompt to enforce analysis before action ("You CANNOT write code immediately...").
    - **Gatekeeper:** Block execution if no valid `intent_id` is cited.

### Phase 2: Hook Middleware & Security

- **Goal:** Establish formal boundaries.
- **Tasks:**
    - **Command Classification:** Classify as Safe (Read) or Destructive (Write/Delete/Execute).
    - **Authorization:** Pause Promise chain for "Approve/Reject" UI.
    - **Recovery:** Return standardized JSON tool-errors on rejection for autonomous correction.
    - **Scope Enforcement:** In `write_file` Pre-Hook, validate target file against `owned_scope`. Block violations.

### Phase 3: Traceability & Hashing

- **Goal:** Implement semantic tracking.
- **Tasks:**
    - Modify `write_file` schema to require `intent_id` and `mutation_class` (e.g., AST_REFACTOR vs INTENT_EVOLUTION).
    - Implement SHA-256 generation for content.
    - **Post-Hook:** Construct `agent_trace.jsonl` entry including `intent_id` and `content_hash`.

### Phase 4: Parallel Orchestration

- **Goal:** Concurrency control.
- **Tasks:**
    - **Optimistic Locking:** On write, compare current disk hash with the hash read at the start of the turn. Block write if hashes differ (Stale File).
    - **Lesson Recording:** Append failures to `CLAUDE.md`.

---

## 5. Verification & Demonstration

To validate the implementation, the following workflow must be demonstrated:

1.  **Setup:** Define `active_intents.yaml` (e.g., "INT-001: Build Weather API").
2.  **Parallelism:** Open two instances (Agent A: Architect, Agent B: Builder).
3.  **Trace:** Agent B refactors a file. Verify `.orchestration/agent_trace.jsonl` updates with correct classification and hash.
4.  **Guardrails:** Agent B attempts a destructive command without an Intent ID or outside of scope. Verify Pre-Hook blocks the action.

---

## 6. Deliverables

### Interim Submission

1.  **PDF Report:** Extension analysis (`ARCHITECTURE_NOTES.md`), Hook architecture design, diagrams, and schemas.
2.  **GitHub Repository:** Forked extension with a clean `src/hooks/` directory.

### Final Submission

1.  **PDF Report:** Complete implementation details, schema reference, and achievement summary.
2.  **Video:** Demonstration of the workflow defined in Section 5.
3.  **GitHub Repository:**
    - `.orchestration/` artifacts (`agent_trace.jsonl`, `active_intents.yaml`, `intent_map.md`).
    - Source code with complete `src/hooks/` implementation.

---

## 7. Evaluation Criteria

| Metric                     | High Standard Requirements                                                                                                 |
| :------------------------- | :------------------------------------------------------------------------------------------------------------------------- |
| **Intent-AST Correlation** | `agent_trace.jsonl` accurately maps Intent IDs to Content Hashes. Distinguishes Refactors from Features mathematically.    |
| **Context Engineering**    | Dynamic injection of `active_intents.yaml`. Agent operation requires context DB reference. Context is curated, not dumped. |
| **Hook Architecture**      | Clean Middleware/Interceptor Pattern. Hooks are isolated, composable, and fail-safe. Not coupled to main execution loop.   |
| **Orchestration**          | Parallel Orchestration demonstrated. Shared `CLAUDE.md` prevents collision.                                                |
