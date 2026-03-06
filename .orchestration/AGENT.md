# Shared Knowledge Base

This file contains persistent knowledge shared across parallel sessions (Architect/Builder/Tester). Contains "Lessons Learned" and project-specific stylistic rules.

## Lessons Learned

<!-- 
Example entry:
### 2026-02-16: Authentication Refactoring
- **Issue:** Initial JWT implementation caused circular dependency
- **Solution:** Extracted token validation to separate utility module
- **Impact:** Reduced coupling, improved testability
- **Related Intent:** INT-001
-->

## Project-Specific Rules

<!-- 
Example entry:
### Code Style
- Always use async/await, never raw Promises
- Prefer named exports over default exports
- Use TypeScript strict mode
-->

## Architectural Decisions

<!-- 
Example entry:
### 2026-02-16: Database Schema Change
- **Decision:** Migrate from SQLite to PostgreSQL
- **Rationale:** Need better concurrent access for parallel agents
- **Impact:** All database queries must be updated
- **Related Intent:** INT-002
-->

