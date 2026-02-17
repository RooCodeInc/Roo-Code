# Reviewer Setup for Governance Hook System

This repository demonstrates Privilege Separation, Inversion of Control, Context Engineering, and Immutable Traceability via a deterministic hook system.

- Architecture notes: [ARCHITECTURE_NOTES.md](../ARCHITECTURE_NOTES.md)
- Hook system: `src/hooks/` (PreHook, PostHook, models, utilities)
- Diagrams: `diagrams/` (Mermaid sources)
- State machine: [docs/StateMachine.md](./StateMachine.md)
- Ledger schema: [docs/LedgerSchema.md](./LedgerSchema.md)

## Export Diagrams (PNG/SVG)

```sh
pnpm add -D @mermaid-js/mermaid-cli
npx mmdc -i diagrams/sequence.mmd -o diagrams/sequence.svg
npx mmdc -i diagrams/class.mmd -o diagrams/class.svg
npx mmdc -i diagrams/state.mmd -o diagrams/state.svg
npx mmdc -i diagrams/ledger-schema.mmd -o diagrams/ledger-schema.svg
```

## Deterministic Lifecycle Hooks

- No action occurs without a checked-out intent (`PreHook.validate`) and scope enforcement.
- SYSTEM_PROMPT injects `<intent_context>` at preview/runtime.
- All writes append to `.orchestration/agent_trace.jsonl` with SHA-256 normalized content hashes for spatial independence.
- Classification distinguishes `REFACTOR` vs `FEATURE`; `ast_node_type` reserved for AST correlation.

## Orchestration Alignment

Parallel orchestration is supported via isolated hooks and clean IoC boundaries; the system acts as a Hive Mind by governing context consistently across tools and prompts.
