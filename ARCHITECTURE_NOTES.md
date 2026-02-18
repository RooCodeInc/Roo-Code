# ARCHITECTURE_NOTES.md

## System Overview

This system implements a streaming, tool-augmented LLM execution engine designed for deterministic runtime governance and provider-aware tool execution.

Core capabilities:

- Context window management (condense + sliding truncation)
- Native tool schema generation with mode restrictions
- Streaming response processing
- Recursive retry handling
- Abort controller safety
- Provider-aware filtering (Gemini `allowedFunctionNames`)
- Multi-mode execution
- Runtime tool governance enforcement

The architecture is composed of three primary layers:

1. Conversation & Context Layer
2. Tool Schema & Model Invocation Layer
3. Tool Execution & Runtime Enforcement Layer

This document focuses on **Phase 1 governance integration points** required by the challenge rubric.

---

# Source Architecture Map (Verified Paths)

## Core Request Loop

**Route**
src/core/task/Task.ts

**Key Functions**

recursivelyMakeClineRequests()
attemptApiRequest()

### Responsibilities

- Manages recursive conversation loop
- Performs context preparation
- Invokes model API
- Streams responses
- Initiates tool execution pipeline

This is the **primary orchestration nucleus of the agent**.

---

## Tool Schema Construction

**Route**
src/core/task/build-tools.ts

**Function**

buildNativeToolsArrayWithRestrictions()

Imported and executed inside:

src/core/task/Task.ts

### Responsibilities

- Builds allowed tool set
- Applies mode restrictions
- Provides Gemini compatibility metadata
- Returns:

```ts
{
  tools: ChatCompletionTool[],
  allowedFunctionNames?: string[]
}
```

This is the only correct injection point for adding governance tools.

## Tool Execution Dispatcher

**Route**

src/core/assistant-message/presentAssistantMessage.ts

**Function**

presentAssistantMessage()

**Responsibilities**

- Parses assistant output
- Dispatches tool calls
- Executes tool pipeline
- Handles tool result streaming

**Role**  
This is the **runtime enforcement interception layer**.  
All intent validation **must** occur here.

## Lower-Level Tool Runtime (Reference Layer)

**Route**
src/core/tools/UseMcpToolTool.ts

**Function**
executeToolAndProcessResult()

**Role**

Low-level execution wrapper for MCP tools.

Not a primary modification point but relevant for execution tracing.

## Request Lifecycle

### High-Level Flow

recursivelyMakeClineRequests()
→ attemptApiRequest()
→ Context Management
→ Tool Schema Construction
→ api.createMessage()
→ Stream Response
→ presentAssistantMessage()
→ Tool Dispatch
→ Tool Execution

## Model Invocation Layer

### attemptApiRequest()

Central orchestration point for:

- Token accounting
- Context condensation
- Tool schema assembly
- Streaming execution
- Retry handling
- Provider compatibility
- Metadata injection

### Context Management

Before invocation:

- Token usage calculated
- Threshold checks applied
- Condensing triggered if required
- Environment details injected
- Condensed summary appended

### Guarantees

- Context window safety
- Non-destructive history
- Rewind compatibility

## Tool Schema Injection (Phase 1 Requirement)

### Governance Tool

A required intent selection tool must be appended:

```ts
const selectActiveIntentTool = {
	type: "function",
	function: {
		name: "select_active_intent",
		description: "Select operational intent before tool execution",
		parameters: {
			type: "object",
			properties: {
				intent: {
					type: "string",
					enum: ["PLAN", "CODE", "ANALYZE", "DEBUG", "WRITE_FILE", "READ_FILE", "EXECUTE"],
				},
				justification: {
					type: "string",
				},
			},
			required: ["intent"],
		},
	},
}
```

## Injection Location

Inside:

src/core/task/Task.ts

After:
allTools = toolsResult.tools

Append:

allTools.push(selectActiveIntentTool)

## Two-Stage Intent Governance Layer

### Objective

Prevent uncontrolled tool usage by enforcing:

- Explicit operational intent declaration
- Turn-level behavioral constraints
- Tool-intent compatibility validation

This transforms the system from:  
Prompt-governed  
→ Runtime-governed

### Runtime State Tracking

Inside dispatcher layer:

src/core/assistant-message/presentAssistantMessage.ts

Add:
private currentTurnIntent: string | null = null
Reset at start of each turn.

## Enforcement Rules

### Rule 1 — Mandatory Intent Selection

```ts
if (!currentTurnIntent && toolName !== "select_active_intent") {
	throw Error("Intent must be selected before executing tools")
}
```

### Rule 2 — Capture Intent

```ts
if (toolName === "select_active_intent") {
	currentTurnIntent = args.intent
	return
}
```

### Rule 3 — Compatibility Matrix

```ts
const INTENT_TOOL_MAP = {
	PLAN: [],
	ANALYZE: ["read_file"],
	DEBUG: ["read_file"],
	CODE: ["write_to_file", "apply_diff"],
	WRITE_FILE: ["write_to_file"],
	READ_FILE: ["read_file"],
	EXECUTE: ["run_command"],
}
```

Validation:

```ts
if (!INTENT_TOOL_MAP[currentTurnIntent].includes(toolName)) {
	throw Error("Tool not allowed under selected intent")
}
```

## Provider Compatibility

### Gemini

- Requires full tool visibility
- Uses allowedFunctionNames
- Intent tool must remain in full schema

### OpenAI / Anthropic

- Standard schema filtering
- No additional adjustments required

## Streaming Safety

System guarantees:

- Retry-safe streaming
- Abort controller cleanup
- Chunk synchronization
- Recursive generator handling

Intent state must reset on:

- New API request
- Retry
- Abort

## Separation of Concerns

| Layer      | Responsibility              |
| ---------- | --------------------------- |
| Context    | Token control, condensation |
| Schema     | Tool definitions            |
| Invocation | Streaming interaction       |
| Runtime    | Tool execution + governance |
| Provider   | API abstraction             |

## Phase 1 Achievements

With governance integration:

- No tool executes without intent declaration
- Tool misuse structurally blocked
- Behavior control enforced at runtime
- Deterministic execution constraints introduced
- Provider compatibility preserved

This represents transition toward:  
**Policy-driven agent architecture**

## Future Extensions (Beyond Phase 1)

- Multi-intent chaining
- Persistent intent memory
- Audit logging
- Risk scoring
- Capability policy injection
- Intent-aware tracing
- .orchestration/ state correlation

## Critical Integration Points Summary

| Purpose                | Route / File Path                                       |
| ---------------------- | ------------------------------------------------------- |
| Core Loop              | `src/core/task/Task.ts`                                 |
| Tool Schema Injection  | `src/core/task/build-tools.ts`                          |
| Intent Tool Append     | `src/core/task/Task.ts`                                 |
| Runtime Enforcement    | `src/core/assistant-message/presentAssistantMessage.ts` |
| Tool Runtime Reference | `src/core/tools/UseMcpToolTool.ts`                      |

## Final Statement

The mapped architecture provides sufficient control surfaces to implement **Two-Stage Intent Governance** without modifying:

- Context condensation
- Retry engine
- Skills manager
- Provider abstraction
