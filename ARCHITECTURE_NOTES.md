# ARCHITECTURE_NOTES

Phase 0 notes: locating hook points and intent flow for Roo Code.

1. Hook Engine placement
    - Implement middleware in the Extension Host where `execute_command` and `write_file` are proxied.
2. Tools to add
    - `select_active_intent(intent_id: string)` - required first action for any mutating workflow.
3. Pre-Hook responsibilities
    - Validate `intent_id` against `.orchestration/active_intents.yaml`.
    - Return an `<intent_context>` containing constraints and scope.
4. Post-Hook responsibilities
    - Compute SHA-256 of modified content ranges and append trace to `.orchestration/agent_trace.jsonl`.
5. Concurrency
    - Compare read-hash vs on-disk hash; block on mismatch.

Next: implement `src/hooks/` scaffolding and wire a minimal pre/post hook.

Commit Guidance & Engineering Process

1. Use many small commits. Example phases:
    - `chore(trp1): add ARCHITECTURE_NOTES.md (analysis)`
    - `feat(trp1): scaffold src/hooks (scaffolding)`
    - `feat(trp1): implement HookEngine and select_active_intent (first-impl)`
    - `fix(trp1): improve YAML parsing and typing (refinements)`
    - `test(trp1): add intent validation tests (tests)`

System Prompt Update

- The extension must modify the system prompt used for LLM calls to include a strict rule:
  "You MUST call the tool `select_active_intent(intent_id)` as your first action before proposing code changes."

Wiring Notes

- `src/hooks/tool_registry.ts` exports a `registerDefaultTools(hooks)` helper. The extension host should instantiate `HookEngine`, call `registerDefaultTools`, and then proxy tool calls through `callTool(...)` so pre/post hooks run consistently.
