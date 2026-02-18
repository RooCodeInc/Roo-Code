**Intent Locking**
- **Purpose:** Prevent parallel agent collisions by optimistic locks per `intent_id`.
- **Mechanism:** File-based locks at `.orchestration/locks/intent-<id>.lock` with `owner`, `timestamp`, and `ttlMs`.
- **TTL:** Expired locks are reclaimable to avoid deadlocks; default 300s.
- **Ownership:** Only the creating `owner` can release; mismatches are rejected.
- **Failure Modes:**
  - Expired lock reclaimed → execution proceeds with new owner.
  - Active lock present → tool execution should be deferred or routed.
- **Usage:**
  - Acquire before tool execution; release after PostHook.
  - Integrate with `HookEngine` around execution.

Example (TypeScript):
- Acquire: `await new IntentLockManager().acquire(intentId, owner)`
- Release: `await new IntentLockManager().release(intentId, owner)`
