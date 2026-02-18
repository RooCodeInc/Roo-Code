# SPEC-008: Definition of Done

The SDD implementation is complete only when all conditions below are true:

- Agent cannot mutate workspace without intent checkout.
- Successful writes produce SHA-256 trace metadata.
- Ledger links intent to code mutation records.
- Scope violations are blocked.
- Destructive commands require explicit approval.
- Dynamic MCP tool paths are governed by the same deterministic pre/post hooks.
- Parallel stale overwrite is prevented.
- Documentation evolves as a side effect of code execution.
