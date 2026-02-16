# Acceptance Criteria

## AC-DEMO-001 Setup
- Given a fresh workspace
- When the user defines `.orchestration/active_intents.yaml` with `INT-001`
- Then the system SHALL recognize `INT-001` as selectable

## AC-DEMO-002 Parallel Sessions
- Given two extension sessions open
- When Agent A monitors intent_map.md and Agent B attempts changes
- Then concurrent writes SHALL be guarded by optimistic locking

## AC-DEMO-003 Trace Ledger
- Given Agent B successfully writes a file within owned_scope
- When the write completes
- Then `.orchestration/agent_trace.jsonl` SHALL append an entry containing:
- intent_id = "INT-001"
- mutation_class in {AST_REFACTOR, INTENT_EVOLUTION}
- content_hash for the modified range

## AC-DEMO-004 Guardrails: No Intent
- Given an agent attempts to write without selecting an intent
- When the hook intercepts the write
- Then execution MUST be blocked with an error indicating a valid intent is required

## AC-DEMO-005 Guardrails: Scope Violation
- Given the active intent has owned_scope that excludes a target file
- When the agent tries to write outside scope
- Then the system MUST block with a scope violation error

## AC-DEMO-006 Guardrails: Destructive Command
- Given the agent requests a destructive command
- When the hook executes PreToolUse
- Then the system MUST require Approve/Reject and reject MUST return a structured tool-error