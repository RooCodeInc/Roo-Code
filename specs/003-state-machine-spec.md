# SPEC-003: Two-Stage State Machine

## Requirement

The agent is not allowed to mutate code immediately. It MUST first select an
active intent.

## Execution Flow

### State 1: Request

User submits a request.

### State 2: Reasoning Intercept

Agent actions:

- Analyze request.
- Identify `intent_id`.
- Call `select_active_intent(intent_id)`.

Pre-hook actions:

- Pause execution.
- Query model data and constraints.
- Inject relevant context.
- Resume execution on success.

### State 3: Contextualized Action

Agent actions:

- Produce reasoning with injected intent context.
- Execute mutation tools.

Post-hook actions:

- Compute content hash.
- Log trace record.
- Link mutation to `intent_id`.
