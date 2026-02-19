# ARCHITECTURE_NOTES.md

## Phase 0: The Archaeological Dig

1. Fork & Run: Roo Code is present and runs in VS Code via CLI or extension host. Entry point: `src/extension.ts` (VSCode), `apps/cli/src/agent/extension-host.ts` (CLI).

2. Trace the Tool Loop:

    - Tool execution (e.g., `write_to_file`, `edit_file`) is implemented in `src/core/tools/WriteToFileTool.ts`, `EditFileTool.ts`, etc.
    - All tools inherit from `BaseTool`.
    - Tool calls are managed by the agent loop in the extension host (`apps/cli/src/agent/extension-host.ts`).

3. Locate the Prompt Builder:

    - System prompt is constructed in `src/core/prompts/system.ts` (see `SYSTEM_PROMPT`).
    - Prompt sections are composed from `src/core/prompts/sections/`.

4. Architectural Decisions:
    - Middleware pattern for hooks: Pre-Hook (context injection, intent validation), Post-Hook (trace update).
    - Reasoning Loop: User Prompt -> Reasoning Intercept (select_active_intent) -> Pre-Hook (Context Injection) -> Tool Call -> Post-Hook (Trace Update)

## Phase 0 Complete

All required locations for tool execution, prompt building, and agent loop are mapped. Ready for Phase 1 implementation.

## Hook System Schema

- Pre-Hook: Intercepts select_active_intent, injects from active_intents.yaml.
- Post-Hook: Updates agent_trace.jsonl with content hash.
