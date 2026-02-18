# SPEC-005: Governance and Enforcement

## Deterministic Hook System

The hook layer MUST intercept all tool executions relevant to mutation and
governance checks.

- This includes native tool calls, dynamic MCP tool calls, and custom tools.

## Pre-Execution Enforcement

- Intent MUST be selected.
- Context MUST be injected for the active intent.
- Human authorization MUST gate destructive commands.
- Write targets MUST match `owned_scope`.
- `execute_command` classification defaults to DESTRUCTIVE unless all chained
  segments match a read-only allowlist.
- Dynamic MCP tools default to DESTRUCTIVE unless explicitly allowlisted in
  `.orchestration/hook_policy.yaml`.

If any check fails, execution MUST be blocked.

## Post-Execution Enforcement

- Compute SHA-256 hashes for modified content.
- Serialize mutation metadata.
- Append to `agent_trace.jsonl`.
- Update intent/documentation side effects.
- Include `tool_origin`, `agent_action`, and best-effort AST attribution metadata
  in write traces.
