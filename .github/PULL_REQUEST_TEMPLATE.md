## Summary
- **Scope:** Concise description of the atomic change
- **Intent ID:** Link or identifier (e.g., INT-YYYY-MM-DD-####)
- **Context:** Why this change matters and how it aligns with governance

## Checklist
- [ ] Atomic change (single clear purpose, minimal unrelated edits)
- [ ] Tests added/updated (unit/e2e, governance invariants)
- [ ] Docs/diagrams updated (if user-facing or architecture-affecting)
- [ ] Intent verified (PreHook pass; scope constraints respected)
- [ ] Ledger trace validated (PostHook appends with content_hash + intent_id)

## Verification
- **Steps:**
  - Run `pnpm lint && pnpm build && pnpm test`
  - Execute feature locally; observe HookEngine pre/post behavior
  - Confirm `.orchestration/agent_trace.jsonl` has expected entry
- **Risk:** Low / Medium / High (brief note)

## Notes
- **Related PRs/Docs:** Links to diagrams and specs
