# Security & Governance

### REQ-SEC-001 Destructive Approval
- The system MUST require user approval for destructive operations.

### REQ-SEC-002 Standardized Error Returns
- The system MUST return structured tool-errors to enable self-correction.

### REQ-GOV-001 Living Documentation Side-Effect
- Post-hooks SHOULD update:
- `.orchestration/intent_map.md` on intent evolution
- `AGENT.md` / `CLAUDE.md` for lessons learned