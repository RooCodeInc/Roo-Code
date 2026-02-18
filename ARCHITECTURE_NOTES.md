# Architecture Notes for Roo Code Fork (TRP1 Challenge)

## Repo Structure Overview

- `src/`: Main extension code (extension.ts for activation, core/prompts for prompts, services/command for tools).
- `packages/`: Shared utilities (core for agent logic, telemetry, types).
- `apps/`: Related tools like CLI.
- Key entry: src/extension.ts – activates on command, sets up Webview and providers.

## Tool Loop Tracing

- Functions:
    - write_to_file: In packages/core/tools/file.ts or src/services/command/built-in-commands.ts – async function that uses vscode.workspace.fs.writeFile after approval.
    - execute_command: In src/services/command/built-in-commands.ts – creates terminal and sends text.
- Flow: Agent parses tool call → routes to command service in Extension Host → executes with HITL approval.

## Prompt Builder Location

- Main: src/core/prompts/system.ts – SYSTEM_PROMPT function assembles sections (persona, tools, rules).
- Customization: src/core/prompts/sections/custom-instructions.ts – loads workspace files.
- Integration: src/agents/baseAgent.ts – builds full prompt before LLM call.

## Extension Host vs Webview

- Webview: UI only (chat panel), emits postMessage events.
- Extension Host: Handles logic, API calls, MCP tools, secrets.

## Notes for Hooks

- Inject Pre/Post hooks in tool executor (built-in-commands.ts) for interception.
- Modify system prompt in system.ts for reasoning enforcement.
