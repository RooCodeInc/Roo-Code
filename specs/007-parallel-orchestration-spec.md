# SPEC-007: Parallel Orchestration

The system MUST support concurrent agent sessions without unsafe overwrite.

## Concurrency Control

- Compare current file hash to the hash observed at read or turn start.
- If mismatch, block write and return a stale-file error.
- Require re-read before allowing mutation after stale detection.

## Shared Mutable State

- `.orchestration/active_intents.yaml`
- `.orchestration/agent_trace.jsonl`
- `AGENT.md` or `CLAUDE.md`
