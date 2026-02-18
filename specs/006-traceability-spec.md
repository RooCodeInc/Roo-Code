# SPEC-006: Intent-Code Traceability

The system MUST maintain explicit linkage:

Business Intent -> Code Surface -> Agent Action -> Content Hash

## Requirements

- Ledger remains append-only.
- Trace records include `intent_id` and per-file mutation metadata.
- Trace records include `tool_origin` and canonical `agent_action`.
- Hashing ensures spatial independence of changed segments.
- Best-effort AST attribution links modified ranges to symbol surfaces when
  parseable.
- Trace data is queryable by intent.
