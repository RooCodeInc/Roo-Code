# SPEC-004: Data Model Specification

All orchestration data is stored in `.orchestration/` as machine-managed sidecar
state.

## 1. Active Intent Registry

### File

`.orchestration/active_intents.yaml`

### Purpose

Track lifecycle and governance metadata of business requirements.

### Updated By

- Pre-hooks when intent selection occurs.
- Post-hooks when task lifecycle advances.

### Structure

`active_intents[]` entries include:

- `id`
- `name`
- `status`
- `owned_scope`
- `constraints`
- `acceptance_criteria`

## 2. Agent Trace Ledger

### File

`.orchestration/agent_trace.jsonl`

### Purpose

Append-only machine-readable mutation history linking intent to code hashes.

### Updated By

Post-hook after successful write operations.

### Requirements

- Compute SHA-256 `content_hash`.
- Preserve spatial independence of tracked changes.
- Persist `tool_origin` and canonical `agent_action` per trace entry.
- Persist per-range AST attribution:
    - `ast_status` in `{ok,fallback}`
    - `ast_nodes[]` with symbol/type/line/hash when available.

## 3. Spatial Intent Map

### File

`.orchestration/intent_map.md`

### Purpose

Map business intents to physical files and structural change surfaces.

### Updated By

On `INTENT_EVOLUTION` mutations.

### Requirements

- When AST attribution exists, append symbol surfaces alongside file mappings.

## 4. Hook Policy Sidecar

### File

`.orchestration/hook_policy.yaml`

### Purpose

Defines deterministic command/MCP mutability policy used by pre-hooks.

### Structure

- `command.readonly_allowlist[]`
- `mcp.default_classification`
- `mcp.readonly_tools[]`

## 5. Shared Brain

### File

`CLAUDE.md` or `AGENT.md`

### Purpose

Persistent shared knowledge across architect, builder, and tester roles.

### Contents

- Lessons learned.
- Stylistic and governance rules.
- Architectural decisions.
