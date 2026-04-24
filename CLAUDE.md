# Lessons Learned (Phase 5: Human-In-The-Loop Governance)

This file records insights from verification failures and governance decisions across agent turns.

---

## Lesson Learned (2026-02-20)

**Context**: Lint check on hello.js during INT-001 feature implementation  
**Failure**: ESLint detected missing semicolons in factorial() function (5 instances)  
**Resolution**: Added semicolons to all statements; enabled 'semi' rule in .eslintrc.json

---

