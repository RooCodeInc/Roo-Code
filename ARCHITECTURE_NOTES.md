# Architecture Notes — Intent-Governed Tool Orchestration

## Overview

This project introduces an **intent-governed hook system** into the Roo-Code agent runtime.  
The goal is to ensure that **destructive tools** (file writes, diffs, commands) are only allowed
after an explicit _intent handshake_ from the user, and that all such actions are **auditable**.

Key principles:

- Explicit authorization before mutation
- Central interception of tool execution
- Tamper-resistant audit trail
- Minimal coupling to existing tool logic

---

## Core Components

### 1. Hook Engine (`src/hooks/hookEngine.ts`)

Acts as the single execution gateway for all tools.

Flow:

1. Receives `(toolName, tool, args)`
2. Runs `preToolHook(toolName, args)`
3. If allowed → executes tool
4. Runs `postToolHook(...)` for auditing

This isolates governance logic from tool implementations.

---

### 2. Intent State (`src/hooks/intentState.ts`)

Maintains the active intent in memory for the current session:

```ts
let activeIntent: string | undefined;
Functions:

setActiveIntent(id)

getActiveIntent()

This is intentionally simple to allow future replacement with
persistent or cryptographic state.

3. Pre-Tool Hook (src/hooks/preToolHook.ts)

Implements the firewall.

Responsibilities:

Handles the handshake tool select_active_intent

Blocks destructive tools when no intent is present

Produces human-readable error messages for the agent

Restricted tools:

write_to_file

apply_diff

insert_content

replace_in_file

execute_command

edit_file

This ensures:

No mutation without declared intent.

4. Post-Tool Hook (src/hooks/postToolHook.ts)

Implements the audit logger.

For write/diff tools:

Reads resulting file

Computes SHA-256 hash

Appends record to .orchestration/agent_trace.jsonl

Schema:

{
  "timestamp": "ISO-8601",
  "intent_id": "string",
  "tool": "string",
  "file": "string",
  "sha256": "string"
}

This enables:

Reproducibility

Accountability

Chain-of-custody for agent edits

Orchestration Files

Located in .orchestration/

agent_trace.jsonl

Append-only audit log of all governed mutations.

active_intents.yaml

Human-readable list of allowed intents.

intent_map.md

Mapping of intents → allowed tool behaviors.

Execution Flow (High Level)
User Prompt
   ↓
LLM selects tool
   ↓
executeWithHooks(...)
   ↓
preToolHook
   ↓
[ allowed ? ]
   ↓
tool.execute
   ↓
postToolHook
   ↓
agent_trace.jsonl
Security Model

Authorization is explicit, not inferred

Errors propagate directly to the agent (self-correcting)

Hashes prevent silent tampering

Hook engine centralizes enforcement

This model mirrors:

Zero-trust APIs

Capability-based security

Write barriers in OS kernels

Limitations (Current)

Intent state is in-memory only

No cryptographic signature (future work)

No UI visualization yet

JSONL file is append-only but not locked

Future Extensions

Intent expiry / rotation

Intent scopes

Cryptographic signing

Visualization of trace in UI

Replay & rollback of changes

Design Philosophy

“Tools are not trusted.
Intent must be proven.”

This architecture treats tool execution as a privileged operation
requiring both semantic approval (intent) and technical traceability (hashing).

Summary

This implementation provides:
✔ Intent handshake
✔ Tool firewall
✔ Audit trace
✔ Separation of concerns
✔ Extensible design
```
