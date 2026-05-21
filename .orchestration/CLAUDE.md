# CLAUDE.md

# Shared Brain for Roo Code Agent Sessions

## Project: AI-Native IDE – Week 1

### Lessons Learned

- PreHook enforces scope and intent validation.
- PostHook logs AST diffs, content hashes, and mutation class.
- Session IDs and contributor model must be tied dynamically to each agent instance.
- Active intents are required for agent execution; context injection is mandatory.
- Parallel agents must respect content hashes to prevent stale file overwrites.

### Architectural Notes

- Hooks isolated and composable.
- agent_trace.jsonl stores intent → file → hash → mutation_class.
- Future: integrate real Git SHA for vcs.revision_id.
- Future: append lessons automatically when linter/test fails.
