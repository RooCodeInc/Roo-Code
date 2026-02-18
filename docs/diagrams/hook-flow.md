# Hook Flow Architecture

```mermaid
graph TD
  subgraph ExtensionHost["Extension Host"]
    UM[User Message]
    TC[Tool Call]
    GK{Gatekeeper<br/>Intent selected?}
    BLOCK[Return error:<br/>Call select_active_intent first]
    ROUTE[Route by tool type]

    UM --> TC
    TC --> GK
    GK -->|No & not select_active_intent| BLOCK
    GK -->|Yes or select_active_intent| ROUTE
    BLOCK --> END1([Stop])

    subgraph SelectIntent["select_active_intent"]
      SI_PRE[Pre-hook: selectActiveIntentPreHook]
      SI_VAL{Valid intent?}
      SI_LOAD[Load context from<br/>active_intents.yaml]
      SI_INJECT[Set currentIntentId<br/>Inject context XML]
      SI_PRE --> SI_VAL
      SI_VAL -->|No| SI_BLOCK[Return blocked]
      SI_VAL -->|Yes| SI_LOAD
      SI_LOAD --> SI_INJECT
    end

    subgraph WriteFile["write_to_file"]
      WF_PRE[Pre-hook: writeFilePreHook]
      WF_SCOPE{In owned_scope?}
      WF_TOOL[writeToFileTool.handle]
      WF_POST[Post-hook: writeFilePostHook]
      WF_PRE --> WF_SCOPE
      WF_SCOPE -->|No| WF_BLOCK[Return scope violation]
      WF_SCOPE -->|Yes| WF_TOOL
      WF_TOOL --> WF_POST
      WF_POST --> WF_HASH[Compute hash]
      WF_POST --> WF_TRACE[Create trace]
      WF_POST --> WF_LOG[Append to log]
      WF_POST --> WF_MAP[Update map]
      WF_HASH --> WF_TRACE
      WF_TRACE --> WF_LOG
      WF_LOG --> WF_MAP
    end

    subgraph ExecuteCmd["execute_command"]
      EC_TOOL[executeCommand.handle]
    end

    ROUTE --> SI_PRE
    ROUTE --> WF_PRE
    ROUTE --> EC_TOOL
  end

  subgraph Orchestration[".orchestration/"]
    AI[active_intents.yaml]
    TR[agent_trace.jsonl]
    IM[intent_map.md]
  end

  SI_LOAD -.->|Read & validate| AI
  WF_PRE -.->|Load owned_scope| AI
  WF_LOG -.->|Append line| TR
  WF_MAP -.->|Update| IM
```

## Decision points

| Node                                | Condition                                             | Outcomes                                                                                                                           |
| ----------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Gatekeeper**                      | Is an intent already selected for this turn?          | If **no** and tool ≠ `select_active_intent` → return error and stop. If **yes** or tool is `select_active_intent` → route to tool. |
| **Pre-hook (select_active_intent)** | Is the intent ID valid in `active_intents.yaml`?      | **No** → return blocked. **Yes** → load context, set `currentIntentId`, inject XML.                                                |
| **Pre-hook (write_file)**           | Is the target path within the intent’s `owned_scope`? | **No** → return scope violation. **Yes** → run `writeToFileTool.handle`.                                                           |

## Flow summary

1. **Extension host**  
   User message leads to a tool call. The **gatekeeper** enforces that every tool except `select_active_intent` runs only after an intent is selected (`currentIntentId` set by a prior `select_active_intent` call).

2. **Tool types**

    - **select_active_intent**  
      Pre-hook only. Reads and validates from `.orchestration/active_intents.yaml`, then sets intent and injects context; no tool implementation “execute” step.
    - **write_to_file**  
      Pre-hook (scope check using `.orchestration/active_intents.yaml`) → tool execution → post-hook (hash, trace, append to `.orchestration/agent_trace.jsonl`, update `.orchestration/intent_map.md`).
    - **execute_command**  
      No pre/post hooks; only passes the gatekeeper, then runs the command tool.

3. **.orchestration/**
    - **active_intents.yaml**  
      Used by the gatekeeper (via `currentIntentId`) and by both pre-hooks (intent list + `owned_scope`).
    - **agent_trace.jsonl**  
      Written by the write_file post-hook (append trace lines).
    - **intent_map.md**  
      Updated by the write_file post-hook (intent → path mapping).
