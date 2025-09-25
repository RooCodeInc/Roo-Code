<!--
Thank you for contributing to Roo Code!
-->

### Related GitHub Issue

Closes: #8293

### Roo Code Task Context (Optional)

_No Roo Code task context for this PR_

### Description

Condense currently preserves the initial user message visually but excludes it from the LLM's summarization input, causing summaries to omit the original ask. This leads to resume re-answering the initial ask instead of continuing the current work. This PR ensures the initial ask is included in the condense summarization input and hardens the prompt to always capture it.

### Changes Made

- Include the original first user message in LLM summarization input by changing the slice from messages.slice(1, -N_MESSAGES_TO_KEEP) to messages.slice(0, -N_MESSAGES_TO_KEEP) in [src/core/condense/index.ts](src/core/condense/index.ts).
- Harden SUMMARY_PROMPT to explicitly require the initial user ask be included, in [src/core/condense/index.ts](src/core/condense/index.ts).
- Add a unit test to assert the initial ask is present in the summarization input when no prior summary exists: [src/core/condense/**tests**/index.spec.ts](src/core/condense/__tests__/index.spec.ts).

### Test Procedure

- Run focused tests:

```bash
cd src
npx vitest run core/condense/__tests__/index.spec.ts core/condense/__tests__/condense.spec.ts
```

- Run full test suite:

```bash
cd src
npx vitest run
```

All tests pass locally.

### Verification of Acceptance Criteria

- [x] Summaries include the initial user ask so task resume maintains correct context.
- [x] Applies to manual condense flow (Task -> summarizeConversation) and automatic condense flow (sliding window -> summarizeConversation when thresholds trigger).
- [x] Guard ensures new context tokens do not exceed previous, preserving safety.

### Pre-Submission Checklist

- [x] Issue Linked
- [x] Scope focused on linked issue
- [x] Self-review completed
- [x] Tests added/updated and passing
- [x] Documentation impact considered
- [x] No breaking changes

### Screenshots / Videos

_No UI changes in this PR_

### Documentation Updates

- [x] No documentation updates are required.

### Additional Notes

- Minimal, targeted change; fallback behavior and token safety rails unchanged.
- Potential slight increase in summarization input length is bounded and protected by existing safeguards.

### Get in Touch

@roomote
