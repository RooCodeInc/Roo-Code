# AGENT.md

## Lessons Learned

- Always enforce intent selection before code actions.
- Maintain spatial independence via content hashing in agent_trace.jsonl.
- Use .orchestration/ as the single source of truth for orchestration state.

## Stylistic Rules

- All code changes must be linked to an intent.
- Never bypass the Reasoning Loop handshake.
- Document architectural decisions here as they arise.
