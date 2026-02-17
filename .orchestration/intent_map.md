# Intent Map

## INT-001 Hook Engine Core

- `src/hooks/preToolUse.ts` -> `preToolUse`
- `src/hooks/postToolUse.ts` -> `postToolUse`
- `src/core/assistant-message/presentAssistantMessage.ts` -> tool dispatch interception points

## INT-002 Intent Handshake and Governance

- `src/core/prompts/tools/native-tools/select_active_intent.ts` -> handshake tool declaration
- `src/core/prompts/tools/native-tools/write_to_file.ts` -> enforced write schema
- `src/shared/tools.ts` -> native arg contract and metadata parameters

## INT-003 Concurrency and Security Hardening

- `src/hooks/concurrencyGuard.ts` -> read/write hash snapshots and stale write checks
- `src/hooks/scopeValidator.ts` -> path sanitization and scope validation
- `src/hooks/securityClassifier.ts` -> destructive classification and circuit breaker
- `src/hooks/traceLogger.ts` -> append-only TRP1 trace schema serialization
