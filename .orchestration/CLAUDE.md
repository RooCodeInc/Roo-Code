# Shared Brain: Project Knowledge Base

_Auto-managed by Hook Engine. Do not edit manually._

## Architectural Decisions

- [DATE] INT-001: JWT migration must maintain backward compatibility via middleware chain pattern

## Lessons Learned (Hive Mind)

- **INT-001** (DATE): Linter error on `src/auth/middleware.ts:22` - Always add JSDoc for exported functions

## Style Guidelines

- Prefer composition over inheritance for middleware
- All async functions must include error handling wrappers
- **Trust Debt Rule:** All code changes must link to an Intent ID
