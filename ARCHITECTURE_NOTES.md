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
