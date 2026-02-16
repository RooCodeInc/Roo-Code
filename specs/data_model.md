# Data Model - .orchestration Sidecar Storage

## REQ-DM-001 Orchestration Directory
- The system MUST maintain a strictly defined `.orchestration/` directory in the workspace.

## active_intents.yaml

### REQ-DM-INT-001 Intent Lifecycle Store
- `.orchestration/active_intents.yaml` SHALL store intents with:
- id, name, status
- owned_scope (glob paths)
- constraints (rules)
- acceptance_criteria (definition of done)

Example:

```yaml
active_intents:
  - id: "INT-001"
    name: "Build Weather API"
    status: "IN_PROGRESS"
    owned_scope:
      - "src/weather/**"
    constraints:
      - "No external auth providers"
    acceptance_criteria:
      - "All tests pass"
```

## agent_trace.jsonl

### REQ-DM-TRACE-001 Trace Schema
- `.orchestration/agent_trace.jsonl` MUST store one JSON object per line with:
- id, timestamp, vcs revision_id
- modified files and ranges
- content_hash for each range
- related requirement links

## intent_map.md

### REQ-DM-MAP-001 Spatial Map
- `.orchestration/intent_map.md` SHALL map high-level intents to physical files and (when available) AST nodes.

## AGENT.md or CLAUDE.md

### REQ-DM-KB-001 Shared Brain
- `AGENT.md` or `CLAUDE.md` SHALL store persistent project rules and lessons learned across sessions.