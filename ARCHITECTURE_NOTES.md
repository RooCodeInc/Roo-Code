# Roo Code Extension: Architecture Notes

## Overview
Roo Code is a VS Code extension that provides an AI-powered development environment with agent orchestration, code tools, and cloud integration.

## Nervous System Map

1. **Activation**
   - Entry: `activate` in `src/extension.ts`.
   - Initializes output channels, telemetry, i18n, network proxy, providers, cloud services, and code indexers.
   - Registers commands, code actions, terminal actions, and webview providers.

2. **Provider & Service Setup**
   - Main provider: `ClineProvider` (sidebar, context, cloud sync).
   - CloudService, CodeIndexManager, MdmService, etc.

3. **Tool Loop: Command & File Execution**
   - **execute_command**: Handled by tool classes in `src/core/tools/` (see `ExecuteCommandTool.ts`).
   - **write_to_file**: Handled by `WriteToFileTool` (`src/core/tools/WriteToFileTool.ts`).
   - Tools are invoked by the LLM/agent and routed to handlers.

4. **Prompt Builder**
   - System prompt is assembled from modular sections in `src/core/prompts/system.ts` and `src/core/prompts/sections/`.
   - Customizable per mode and user settings.

5. **Webview/UI Sync**
   - Webview panels and UI components reflect state, allow prompt preview/copy, and interact with the agent.

6. **Extensibility**
   - Your contributions: `ARCHITECTURE_NOTES.md`, `src/hooks/`, `.orchestration/`.
   - Designed for extension via hooks and orchestration logic.


## Key Files & Responsibilities
- `src/extension.ts`: Activation, setup, teardown.
- `src/core/tools/`: Tool execution (commands, file writes, etc).
- `src/core/prompts/`: Prompt building logic.
- `src/activate/`: Command and action registration.
- `src/hooks/`, `.orchestration/`: Custom extension points.
 - `src/hooks/`: Hook engine scaffold and implementations (`prePostHook.ts`, `preToolHook.ts`, `postToolHook.ts`, `index.ts`). Use `registerHooks()` to register core hooks during activation.

## How to Trace/Modify
- To trace command execution: Start at `activate`, follow provider/tool setup, then see tool handler files.
- To modify the system prompt: Edit or extend sections in `src/core/prompts/sections/` and logic in `system.ts`.
- For new hooks/orchestration: Add logic in your custom folders and register as needed.

Integration note:
- The recommended hook integration point is inside `src/core/task/Task.ts` after building `assistantContent` and before executing tool calls. Call `applyPreHooks(toolUse, { cwd, intentId })` and `applyPostHooks(toolResult, { cwd, intentId })` to connect the hook engine to the tool loop.

## Summary
The extension is modular, event-driven, and designed for agent extensibility. The nervous system flows from activation, through provider setup, to tool execution and prompt building, with UI and hooks for user and agent interaction.




