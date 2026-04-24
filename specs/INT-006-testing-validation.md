# INT-006 — Testing & Validation

## Intent
Create comprehensive test coverage for the Intent-Code Traceability system, including unit tests, integration tests, and end-to-end validation scenarios.

## Scope (owned_scope)
- `src/core/hooks/**/*.test.ts`
- `src/core/orchestration/**/*.test.ts`
- `src/core/tools/SelectActiveIntentTool.test.ts`
- `tests/integration/hook-system.test.ts`
- `tests/e2e/intent-traceability.test.ts`

## Constraints
- Tests must not modify production `.orchestration/` files (use temp directories).
- Tests must be deterministic and isolated (no shared state).
- Integration tests must verify hook system works with real tool execution.
- E2E tests must simulate full agent workflow (intent selection → code change → trace logging).

## Acceptance Criteria
- Unit tests for `HookEngine.preHook()` and `HookEngine.postHook()`.
- Unit tests for `OrchestrationDataModel` file operations.
- Unit tests for `SelectActiveIntentTool` intent loading and context generation.
- Integration test: Verify Pre-Hook blocks destructive tool without intent.
- Integration test: Verify Post-Hook logs trace entry after file write.
- E2E test: Full workflow from intent selection to trace logging.
- All tests pass in CI/CD pipeline.
- Test coverage > 80% for hook and orchestration modules.

