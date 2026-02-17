# SPEC-006: Intent-Code Traceability

The system MUST maintain explicit linkage:

Business Intent -> Code Surface -> Agent Action -> Content Hash

## Requirements

- Ledger remains append-only.
- Trace records include `intent_id` and per-file mutation metadata.
- Hashing ensures spatial independence of changed segments.
- Trace data is queryable by intent.
