<!-- # Architecture Notes

## Findings

- Tool Execution: Controlled via `presentAssistantMessage.ts` and individual tool handles like `WriteToFileTool.ts`.
- Prompt Logic: The system prompt is constructed in `src/core/task/Task.ts`.
- Governance Layer: We have initialized a `.orchestration/` sidecar for intent-traceability.
- Integration Goal: We will implement a Pre-Hook in `WriteToFileTool.ts` that validates actions against `.orchestration/active_intents.yaml`. -->

# Architecture Notes: Master Thinker Edition

## 1. Data Flow Map (Request-to-Execution)

1. User Input: Received via the React Webview.
2. Context Assembly: `ClineProvider.ts` calls `src/core/task/Task.ts` to generate the System Prompt.
3. Decision: The LLM selects a tool. `presentAssistantMessage.ts` orchestrates the tool call.
4. Execution: `WriteToFileTool.ts` executes the `handle()` method to modify the file system.

## 2. Governance Interception Points

- **Pre-Hook (Phase 1/2):** Located in `WriteToFileTool.ts` inside `handle()`. This will block execution if `.orchestration/active_intents.yaml` does not have an `in-progress` status.
- **Post-Hook (Phase 3):** Located at the end of `handle()` after a successful write. This will trigger the `agent_trace.jsonl` logger to hash the new content.

## 3. Intent-Code Gap Analysis

Standard Git tracks "What" changed but lacks the "Why." By using a sidecar orchestration layer, we map every Abstract Syntax Tree (AST) change to a specific Requirement ID. This prevents "Context Rot" where agents lose track of architectural constraints during long-running tasks.
