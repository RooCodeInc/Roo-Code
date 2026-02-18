Roo-Code Architecture Notes
Entry Point

Roo Code is implemented as a VS Code extension that activates through the standard VS Code lifecycle.
The extension entry point is the activate(context: ExtensionContext) function, where:

The Roo Code WebView chat panel is registered.

The ClientProvider is initialized to manage communication between the WebView UI and the backend.

The agent runtime is started.

User interaction begins when:

The user opens the Roo Code panel from the VS Code sidebar.

The user submits a prompt through the WebView chat interface.

The prompt is forwarded from the WebView to the extension backend via ClientProvider.

This establishes the entry path:

WebView UI → ClientProvider → Task/Agent Runtime

Prompt Builder

User prompts are constructed inside the ClientProvider and task creation logic.

At this stage:

The raw user input is wrapped into a task object.

System instructions and prior conversation context are attached.

The resulting structured prompt is sent to the LLM agent.

This prompt contains:

User message

System role definition

Available tool schema

Conversation history

This is the stage where the agent is prepared to reason about which tool to call.

Tool Execution Handler

After reasoning, the agent produces a structured tool call request:

Tool name (e.g. writeFile, readFile, execShell)

Arguments (file path, content, command, etc.)

This tool call is dispatched through the tool execution layer, where:

The tool function is selected.

Arguments are passed to the tool implementation.

The tool result is returned to the agent.

Originally, this flow was:

Agent → Tool

With no interception or validation layer.

Hook Injection Candidates (Critical Chokepoint)

The architectural chokepoint for hook injection is the boundary between:

Agent tool selection and actual tool execution

At this point:

The tool name is known.

The arguments are known.

Execution has not yet occurred.

This makes it the optimal interception point.

The modified flow becomes:

Agent → HookEngine → Tool

Pre-Tool Hook

The Pre-Tool Hook runs immediately before tool execution and can:

Validate arguments

Enforce scope rules

Block unsafe operations

Verify intent ownership (in Phase 1)

Example:
If tool = execShell and command contains rm -rf, deny execution.

Post-Tool Hook

The Post-Tool Hook runs immediately after tool execution and can:

Log results

Audit tool usage

Record side effects

Enable traceability for debugging

Phase 1 Handshake Injection Point

The proactive Reasoning Loop is implemented by introducing a new tool:

select_active_intent(intent_id: string)

This tool is registered in the same tool registry as other tools and is intercepted by the Hook Engine.

Flow:

Agent must first call select_active_intent.

Hook system intercepts the call.

active_intents.yaml is read.

Intent scope and constraints are injected into context.

Only after this step may normal tools execute.

This forces a handshake:

Reasoning → Intent Declaration → Context Injection → Tool Execution

Summary

The hook system is injected at the agent-to-tool boundary, not in the UI or LLM logic.
This preserves the original Roo Code architecture while enabling:

Governance

Reasoning loop enforcement

Intent traceability

Safety controls

This chokepoint provides maximum leverage with minimal architectural disruption.
