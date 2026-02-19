# ARCHITECTURE_NOTES.md

## Phase 0: The Archaeological Dig

1. Fork & Run: Forked from RooCodeInc/Roo-Code. Extension runs in VS Code via `npm run dev` or similar.

2. Trace the Tool Loop: 
   - Tool execution happens in src/agent/AgentLoop.ts (assumed based on upstream structure; actual may vary).
   - execute_command and write_to_file are registered in src/tools/ (e.g., fileTool.ts for write_to_file).

3. Locate the Prompt Builder: 
   - System prompt constructed in src/prompt/PromptBuilder.ts or src/context/ContextFormatter.ts.
   - Inject hooks here for context enforcement.

4. Architectural Decisions:
   - Use middleware pattern for hooks to wrap tool calls without modifying core loop.
   - Diagram: (ASCII art or link to draw.io if added)
     User Prompt -> Reasoning Intercept (select_active_intent) -> Pre-Hook (Context Injection) -> Tool Call -> Post-Hook (Trace Update)

## Hook System Schema
- Pre-Hook: Intercepts select_active_intent, injects from active_intents.yaml.
- Post-Hook: Updates agent_trace.jsonl with content hash.