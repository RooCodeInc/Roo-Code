# Intent Map

This document defines how user requests are mapped to structured intents.

## Intent: refactor-auth

**Description:** Refactor authentication module  
**Scope:** src/auth  
**Constraints:**

- Do not change database schema
- Do not add new dependencies

---

## Intent: fix-bug-42

**Description:** Fix reported bug #42  
**Scope:** src/utils, src/services  
**Constraints:**

- Only modify existing functions
- No new files allowed

---

## Intent: add-logging

**Description:** Add logging to critical operations  
**Scope:** src  
**Constraints:**

- Use existing logger only
- Do not expose secrets

---

## Purpose

This mapping ensures:

- The agent selects an intent before acting
- Tool execution is bounded by scope
- Context can be injected consistently
- Auditing and replay are possible
