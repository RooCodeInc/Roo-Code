# TRP1 Week 1 Architecture Notes - Roo Code Fork

Tool Execution Entry Point:

- src/core/task/Task.ts → doNextTurn() & executeTool()
- Tool registry: src/core/task/build-tools.ts
- Individual tools: src/core/tools/WriteToFileTool.ts, ExecuteCommandTool.ts, etc.
- System prompt: src/core/prompts/system.ts + sections/

Hook Insertion Points Identified:

1. Add new tool in build-tools.ts
2. Inject mandatory intent rule in system prompt (system.ts)
3. Wrap executeTool() in Task.ts with HookEngine.preToolUse / postToolUse
