🧠 Roo-Code Architecture Notes

Intent-Driven Tool Governance & Reasoning Loop

1. Entry Point (Extension Host)

Roo Code is implemented as a VS Code extension and follows the standard extension lifecycle.
The execution begins in:

`activate(context: ExtensionContext)`

During activation:

The Roo Code WebView chat panel is registered.

The ClientProvider is initialized to manage UI ↔ backend messaging.

The agent runtime (LLM controller) is started.

User interaction begins when:

The user opens the Roo Code sidebar panel.

The user submits a prompt via the WebView chat UI.

The WebView sends the message to the backend through ClientProvider.

This establishes the primary entry path:

`WebView UI → ClientProvider → Agent Runtime` 2. Prompt Construction (Prompt Builder)

Inside the backend, user input is wrapped into a task context:

Raw user message is captured.

System role instructions are added.

Prior conversation history is attached.

Tool schemas are included.

The resulting structured prompt sent to the LLM contains:

User request

System constraints

Available tools

Conversation memory

At this stage, the agent is prepared to reason about which tool to call, but no tool has yet executed.

3. Tool Execution Handler (Baseline System)

After reasoning, the agent outputs a structured tool call:

Tool name (e.g. writeFile, readFile, execShell)

Arguments (file path, content, shell command)

Originally, Roo Code’s execution pipeline was:

`Agent → Tool`

This meant:

No interception

No validation

No scope control

No intent ownership

No governance

4. Architectural Chokepoint (Phase 0)

The optimal injection point is the boundary between:

Agent tool selection
and
Actual tool execution

At this moment:

Tool name is known.

Tool arguments are known.

Execution has not yet happened.

This makes it the ideal chokepoint for introducing governance without modifying:

UI logic

LLM logic

Tool implementations

The modified pipeline becomes:

`Agent → HookEngine → Tool`

This preserves Roo Code’s architecture while enabling control.

5. Hook Engine (Governance Layer)

The Hook Engine mediates between the agent and tools.

It executes:

preToolHook → before execution

postToolHook → after execution

Folder structure:

````src/hooks/
  preToolHook.ts
  postToolHook.ts
  hookEngine.ts```
6. Pre-Tool Hook (Policy & Gatekeeper)

The Pre-Tool Hook enforces safety and reasoning rules.

Responsibilities:

Validate arguments

Enforce policies

Block unsafe actions

Verify intent ownership

Example failure mode:

Tool: deleteFile
Path: "/"
Decision: DENY
Reason: Root deletion is unsafe

This introduces a policy enforcement layer without changing tools themselves.

7. Reasoning Loop (Phase 1 Handshake)

To prevent reactive validation, a proactive handshake is introduced.

A new tool is defined:

select_active_intent(intent_id: string)

The system prompt requires:

The agent MUST first call select_active_intent
before any other tool may be executed.

Execution flow becomes:
```User Prompt
   ↓
Agent Analysis
   ↓
select_active_intent(intent_id)
   ↓
Context Injection
   ↓
preToolHook (gatekeeper)
   ↓
Tool Execution```

This forces the agent to:

Commit to a goal

Declare scope

Accept constraints

Only then act

This resolves the Context Paradox:

asynchronous IDE state vs synchronous LLM reasoning.

8. Context Injection (Intent Loader)

When select_active_intent is called:

active_intents.yaml is read.

Matching intent is located.

Scope and constraints are extracted.

An XML block is constructed:
```<intent_context>
  <intent_id>fix-bug-42</intent_id>
  <scope>src/utils, src/services</scope>
  <constraints>No new files</constraints>
</intent_context>```

This block is injected into the agent’s context window.

Result:
The agent is forced to reason within declared intent boundaries.

9. Gatekeeper Enforcement (Failure Paths)

The Pre-Tool Hook verifies:

An intent has been declared

The intent exists

The tool is permitted under that intent

Failure scenarios:

Case	Result
No intent declared	Block execution
Invalid intent ID	Error returned
Tool outside scope	Deny
Unsafe operation	Deny

Error message:

"You must cite a valid active Intent ID."

This enforces ownership and prevents uncontrolled execution.

10. Post-Tool Hook (Audit & Traceability)

The Post-Tool Hook runs after execution and records:

Tool name

Timestamp

Result

Associated intent

This enables:

Replay

Debugging

Compliance auditing

Behavioral analysis

11. Data Stores (Sidecars)

Supporting files:
````

.orchestration/
active_intents.yaml
agent_trace.jsonl
intent_map.md

```
These provide:

Intent definitions

Action traces

Mapping documentation

They decouple reasoning state from tool logic.

12. Architectural Decision Rationale

Hooks were chosen over inline logic because they:

Preserve core architecture

Enable policy layering

Improve maintainability

Support extensibility

Reduce coupling

13. Summary

This design introduces an Intent-Driven Reasoning Loop into Roo Code by:

Injecting a Hook Engine at the agent-to-tool boundary

Forcing a proactive handshake before action

Injecting scoped context

Enforcing gatekeeping

Auditing behavior
```
