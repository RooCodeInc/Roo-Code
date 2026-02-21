# CLAUDE.md — Shared Brain / Lessons Learned

Durable project memory for architecture, structure, and workflow decisions.

## Current Snapshot

- Project: **Excel Analyzer**
- Runtime: Browser-only (client-side)
- Extensibility: `src/hooks/hook-engine.js`
- Operational memory:
  - `.orchestration/active_intents.yaml`
  - `.orchestration/agent_trace.jsonl`
  - `.orchestration/intent_map.md`

## Documentation Map

- `README.md` (workspace root)
- `Excel-Based-Data-Analzer/README.md` (application-level guide)
- `specify/specification.md`
- `specify/memory/constitution.md`
- `specify/plan/plan.md`
- `specify/architecture/architecture.md`
- `specify/project_structure/project_structure.md`

## Lessons Learned

1. Keep structure docs synchronized immediately after file moves.
2. Keep hook-specific logic isolated under `src/hooks/`.
3. Keep orchestration artifacts lightweight and plain-text for traceability.
4. Update both root and app README when structure changes.

## Working Agreements

- `.orchestration/active_intents.yaml` tracks active goals.
- `.orchestration/agent_trace.jsonl` logs key operations.
- `.orchestration/intent_map.md` maps goals to code areas.
- `specify/project_structure/project_structure.md` is the canonical structure reference.


