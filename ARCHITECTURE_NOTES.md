# Architecture Notes

## Findings

- Tool Execution: Controlled via `presentAssistantMessage.ts` and individual tool handles like `WriteToFileTool.ts`.
- Prompt Logic: The system prompt is constructed in `src/core/task/Task.ts`.
- Governance Layer: We have initialized a `.orchestration/` sidecar for intent-traceability.
- Integration Goal: We will implement a Pre-Hook in `WriteToFileTool.ts` that validates actions against `.orchestration/active_intents.yaml`.
