# INT-005 — Logging & Traceability

## Intent
Implement comprehensive trace logging that links intents to code changes via content hashing, enabling spatial independence and auditability.

## Scope (owned_scope)
- `src/core/hooks/HookEngine.ts` (Post-Hook implementation)
- `src/core/orchestration/OrchestrationDataModel.ts`
- `.orchestration/agent_trace.jsonl`
- `src/utils/git.ts` (for VCS revision tracking)

## Constraints
- Trace entries must include `sha256:` content hash of modified code blocks.
- Line ranges must be best-effort (may be approximate for complex edits).
- Each trace entry must link to:
  - Intent ID
  - File path (relative to workspace root)
  - VCS revision (Git SHA)
  - Timestamp
  - Model identifier
- Content hashing must be spatially independent (same code block = same hash regardless of file location).

## Acceptance Criteria
- Post-hook computes SHA-256 hash of modified content for file tools.
- Trace entry includes all required fields per `document.md` schema:
  - `id` (UUID)
  - `timestamp` (ISO 8601)
  - `vcs.revision_id` (Git SHA)
  - `files[]` with `relative_path`, `conversations[]`, `ranges[]`, `content_hash`
- Trace entries are appended atomically to `agent_trace.jsonl`.
- Content hash format: `sha256:<hex>`.
- Git SHA is retrieved from workspace root (handles non-Git repos gracefully).

