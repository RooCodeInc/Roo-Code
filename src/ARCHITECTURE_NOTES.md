# Architecture Notes – TRP1 Challenge Implementation

## Phase 0: Archaeological Dig - Roo Code Architecture

### Overview

Roo Code is an AI-native IDE extension for VS Code built on top of the Anthropic Messages API. It orchestrates AI agents to execute development tasks through a sophisticated tool execution system.

### Key Components

#### 1. Entry Point

- **`src/extension.ts`**: Main extension activation file
    - Initializes VS Code extension context
    - Registers commands and providers
    - Loads environment variables from `.env`

#### 2. Task Orchestration (The Core Loop)

- **`src/core/task/Task.ts`**: Main task orchestration class (~17,700+ lines)
    - Manages the conversation loop with the LLM
    - Handles message streaming and tool execution scheduling
    - Maintains conversation history
    - Controls task state (paused, aborted, etc.)

#### 3. Tool Execution Pipeline

- **`src/core/assistant-message/presentAssistantMessage.ts`**: Tool execution entry point
    - Uses a switch statement on `block.name` to route to specific tools
    - Key execution points:
        - `write_to_file` → `WriteToFileTool.handle()`
        - `execute_command` → `ExecuteCommandTool.handle()`
        - `read_file` → `ReadFileTool.handle()`
        - etc.

#### 4. Tool Definitions

- **`src/core/tools/BaseTool.ts`**: Abstract base class for all tools

    - Defines `execute()` method that tools implement
    - Handles parameter parsing from `nativeArgs`
    - Provides `handlePartial()` for streaming responses

- **Individual tools** in `src/core/tools/`:
    - `WriteToFileTool.ts` - File writing with diff view
    - `ExecuteCommandTool.ts` - Shell command execution
    - `ReadFileTool.ts` - File reading
    - `EditTool.ts`, `SearchReplaceTool.ts` - File editing
    - `ApplyPatchTool.ts`, `ApplyDiffTool.ts` - Patch application

#### 5. System Prompt Generation

- **`src/core/prompts/system.ts`**: Builds the SYSTEM_PROMPT
    - Called with `vscode.ExtensionContext` and other parameters
    - Includes mode-specific instructions
    - Provides tool definitions and capabilities

### Hook System Architecture

#### Injection Points

1. **Pre-Hook (Before tool execution)**:

    - In `presentAssistantMessage.ts`, before each `tool.handle()` call
    - Can intercept, validate, and modify tool parameters
    - Can block execution and return error results

2. **Post-Hook (After tool execution)**:
    - After successful tool execution
    - For logging traces and updating documentation

#### Intent-Driven Workflow

1. **State 1 - Request**: User prompts the agent
2. **State 2 - Reasoning Intercept**: Agent must call `select_active_intent` tool
    - Pre-Hook intercepts this call
    - Loads intent context from `.orchestration/active_intents.yaml`
    - Injects context into the prompt
3. **State 3 - Contextualized Action**: Agent executes tools with full context
    - Pre-Hook validates scope before write operations
    - Post-Hook logs traces to `.orchestration/agent_trace.jsonl`

### Data Model Files (`.orchestration/`)

#### 1. `active_intents.yaml`

Tracks business requirements and their lifecycle:

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
          - "Must maintain backward compatibility"
      acceptance_criteria:
          - "Unit tests pass"
```

#### 2. `agent_trace.jsonl`

Append-only ledger linking Intent → Code Hash:

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
					"related": [{ "type": "specification", "value": "REQ-001" }]
				}
			]
		}
	]
}
```

#### 3. `intent_map.md`

Spatial map of business intents to files/AST nodes.

#### 4. `CLAUDE.md` (or `AGENT.md`)

Shared brain for parallel agent sessions.

### Hook Implementation Strategy

1. **Hook Engine**: `src/hooks/HookEngine.ts`

    - Central middleware that wraps tool execution
    - Provides Pre-Hook and Post-Hook capabilities
    - Manages intent state across the session

2. **Intent Validator**: `src/hooks/IntentValidator.ts`

    - Validates intent IDs and scope
    - Blocks unauthorized operations

3. **Trace Logger**: `src/hooks/TraceLogger.ts`

    - Computes content hashes
    - Appends to `agent_trace.jsonl`

4. **New Tool**: `select_active_intent`
    - Forces the reasoning loop
    - Returns intent context to the agent

## comment
