# Hook Diagrams And Schemas

## 1) Runtime Boundary Diagram

```mermaid
flowchart LR
    U[User in VS Code] --> WV[Webview UI]
    WV -->|postMessage| EH[Extension Host]
    EH -->|assistant output| LOOP[presentAssistantMessage loop]
    LOOP --> PRE[Pre-Tool Hooks]
    PRE --> DISPATCH[Tool Dispatch]
    DISPATCH --> TOOL[Native Tool Execute]
    TOOL --> POST[Post-Tool Hooks]
    POST --> ORCH[.orchestration sidecar]
    POST --> RESP[tool_result to UI]
    RESP --> WV
```

## 2) Two-Stage Handshake Sequence

```mermaid
sequenceDiagram
    participant User
    participant Agent
    participant HookEngine
    participant Sidecar as .orchestration

    User->>Agent: "Refactor auth middleware"
    Agent->>HookEngine: tool_use(select_active_intent, intent_id)
    HookEngine->>Sidecar: read active_intents.yaml
    Sidecar-->>HookEngine: intent constraints + scope
    HookEngine-->>Agent: inject context patch, allow
    Agent->>HookEngine: tool_use(write_to_file, ...)
    HookEngine->>HookEngine: pre-hook policy checks
    HookEngine-->>Agent: allow or block
    Agent->>HookEngine: tool_result
    HookEngine->>Sidecar: append agent_trace.jsonl
```

## 3) Hook Engine Schema (Type-Level)

```ts
type HookDecision =
	| { allow: true; contextPatch?: Record<string, unknown> }
	| {
			allow: false
			code: "INTENT_REQUIRED" | "SCOPE_VIOLATION" | "DESTRUCTIVE_BLOCKED" | "HOOK_ERROR"
			reason: string
	  }
```

## 4) `active_intents.yaml` Schema (Minimal)

```yaml
active_intents:
    - id: "INT-001"
      name: "JWT Authentication Migration"
      status: "IN_PROGRESS"
      owned_scope:
          - "src/auth/**"
          - "src/middleware/jwt.ts"
      constraints:
          - "Must not use external auth providers"
      acceptance_criteria:
          - "Unit tests in tests/auth/ pass"
```

## 5) `agent_trace.jsonl` Record Schema (Minimal)

```json
{
	"id": "uuid-v4",
	"timestamp": "2026-02-18T12:00:00Z",
	"intent_id": "INT-001",
	"mutation_class": "AST_REFACTOR",
	"vcs": { "revision_id": "git_sha_hash" },
	"files": [
		{
			"relative_path": "src/auth/middleware.ts",
			"ranges": [
				{
					"start_line": 15,
					"end_line": 45,
					"content_hash": "sha256:..."
				}
			]
		}
	]
}
```
