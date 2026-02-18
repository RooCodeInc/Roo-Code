# Shared Brain - Agent Collaboration

## Purpose

A persistent knowledge base shared across parallel sessions (Architect/Builder/Tester).
Contains "Lessons Learned" and project-specific stylistic rules.

## Project Rules

### Code Style

- Use TypeScript for all new code
- Follow existing code patterns in the codebase
- Add unit tests for new functionality

### Intent-Driven Development

1. Always select an intent before making changes: `select_active_intent`
2. Check the scope before editing files
3. Log all changes to the trace

### Parallel Workflow

- Architect agent defines the plan in intent_map.md
- Builder agent implements code
- Tester agent verifies against acceptance criteria

## Lessons Learned

### 2026-02-17

- Initial setup of Intent-Code Traceability system
- System enforces that agents must "checkout" an intent before writing code
- Scope validation prevents unauthorized file modifications

## Active Sessions

- Agent A (Architect): Monitoring intent_map.md
- Agent B (Builder): Working on INT-001

## Notes

- If you encounter a "Stale File" error, re-read the file before overwriting
- Use `select_active_intent` to load context before starting work
