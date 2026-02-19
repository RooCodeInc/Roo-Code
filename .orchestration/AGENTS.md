# AGENTS.md - Shared Brain

## Lessons Learned
- Always validate API keys before calling external services to avoid runtime errors.

## Project-Specific Rules
- Code style: Use 2-space indentation, async/await over promises.
- Architecture: Separate concerns – API logic in src/api/, middleware in src/middleware/.