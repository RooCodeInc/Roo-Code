# Two-Stage State Machine for Intent-Code Traceability

<!--
  This diagram models the two-stage flow: (1) Reasoning Intercept (handshake)
  captures intent and injects context before the LLM acts; (2) Contextualized
  Action captures tool calls and builds traceability (hash, trace, log, map).
-->

```mermaid
stateDiagram-v2
  direction LR

  title Two-Stage State Machine for Intent-Code Traceability

  [*] --> Request

  state Request {
    direction TB
    [*] --> user_prompt
    note right of user_prompt : User sends prompt; conversation starts
  }

  state "Reasoning Intercept (handshake)" as RI {
    direction TB
    [*] --> agent_identifies_intent
    agent_identifies_intent --> calls_select_active_intent
    calls_select_active_intent --> prehook_intercepts
    prehook_intercepts --> validates_intent
    validates_intent --> loads_context
    loads_context --> builds_xml_block
    builds_xml_block --> injects_context
    injects_context --> [*]
    note right of agent_identifies_intent : Agent infers user intent from prompt
    note right of calls_select_active_intent : Tool invoked to register/select intent
    note right of prehook_intercepts : Pre-hook intercepts before tool runs
    note right of validates_intent : Intent validated against allowed set
    note right of loads_context : Context (rules, specs) loaded for intent
    note right of builds_xml_block : XML block built with context for prompt
    note right of injects_context : Context injected into system/user message
  }

  state "Contextualized Action" as CA {
    direction TB
    [*] --> llm_generates_changes
    llm_generates_changes --> calls_write_file
    calls_write_file --> posthook_intercepts
    posthook_intercepts --> computes_hash
    computes_hash --> creates_trace
    creates_trace --> appends_to_log
    appends_to_log --> updates_map
    updates_map --> [*]
    note right of llm_generates_changes : LLM produces edits using injected context
    note right of calls_write_file : Agent calls write_file (or other tools)
    note right of posthook_intercepts : Post-hook intercepts after tool execution
    note right of computes_hash : Content hash computed for change
    note right of creates_trace : Trace record created (intent → change)
    note right of appends_to_log : Entry appended to traceability log
    note right of updates_map : Intent–code map updated for lookup
  }

  Request --> RI : prompt received
  RI --> CA : context injected
  CA --> [*] : response complete
```

## Step summary

| Stage                     | Step                       | Description                                                       |
| ------------------------- | -------------------------- | ----------------------------------------------------------------- |
| **Request**               | User prompt                | Conversation starts; user prompt is the trigger for the pipeline. |
| **Reasoning Intercept**   | Agent identifies intent    | Model infers the user’s intent from the prompt.                   |
|                           | Calls select_active_intent | Agent invokes the `select_active_intent` tool.                    |
|                           | Pre-hook intercepts        | Pre-hook runs before the tool executes (e.g. to capture args).    |
|                           | Validates intent           | Intent is checked against the allowed intent set.                 |
|                           | Loads context              | Rules, specs, or other context for that intent are loaded.        |
|                           | Builds XML block           | A structured XML block is built with the loaded context.          |
|                           | Injects context            | The block is injected into the prompt (system/user message).      |
| **Contextualized Action** | LLM generates changes      | LLM produces edits using the injected context.                    |
|                           | Calls write_file           | Agent calls `write_file` (or other tools) to apply changes.       |
|                           | Post-hook intercepts       | Post-hook runs after tool execution to capture results.           |
|                           | Computes hash              | A content hash is computed for the change.                        |
|                           | Creates trace              | A trace record is created linking intent to the change.           |
|                           | Appends to log             | The trace is appended to the traceability log.                    |
|                           | Updates map                | The intent–code map is updated for later lookup.                  |
