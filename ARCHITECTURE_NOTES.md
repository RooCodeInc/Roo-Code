---

```markdown
# ARCHITECTURE_NOTES.md
## TRP1 Week 1 – Interim Submission

### 1. Purpose
This document outlines the architecture and hook system implemented for the interim submission of the TRP1 Week 1 challenge: **AI-Native IDE & Intent-Code Traceability**.
The goal of this submission is to demonstrate the initial hook middleware structure, context injection, and intent validation mechanisms.

---

### 2. Hook Architecture Overview

The hook system acts as a **middleware layer** intercepting all tool execution in the AI IDE extension.
It consists of:

1. **Pre-Hooks**: Executed **before tool actions**, responsible for:

    - Validating that the agent has selected a valid intent (`intentValidator`)
    - Loading intent context from `.orchestration/active_intents.yaml` (`contextLoader`)

2. **Post-Hooks**: Executed **after tool actions**, currently placeholders for:
    - Logging tool execution (`traceLogger`)
    - Updating shared documentation (`docUpdater`)

**Design Principles:**

- Hooks are **isolated, composable, and type-safe** (via TypeScript interfaces).
- The middleware pattern enforces **strict privilege separation** between UI, extension host, and agent execution.
- Aligns with the **Master Thinker philosophy**: the agent cannot write code before selecting an intent.

---

### 3. Directory Structure

```

src/hooks/
├── index.ts              # Hook registration and execution middleware
├── preHooks/
│   ├── contextLoader.ts  # Loads intent context before tool execution
│   └── intentValidator.ts# Validates selected intent_id
├── postHooks/
│   ├── traceLogger.ts    # Logs tool execution (placeholder)
│   └── docUpdater.ts     # Updates shared documentation (placeholder)
├── types.ts              # Shared hook interfaces and types
└── utils/
├── fileUtils.ts      # Helper for .orchestration file read/write
└── hashUtils.ts      # Placeholder for content hashing

```

---

### 4. Execution Flow

**Step 1 – Tool Execution Request**
User/agent triggers a tool action (e.g., `write_file`) through the extension host.

**Step 2 – Pre-Hooks Execution**

1. `intentValidator`: ensures a valid `intent_id` is selected
2. `contextLoader`: loads constraints, scope, and acceptance criteria from `.orchestration/active_intents.yaml`

**Step 3 – Tool Execution**
Tool executes (currently mocked for interim) after passing all pre-hooks.

**Step 4 – Post-Hooks Execution**

1. `traceLogger`: logs the execution for future traceability
2. `docUpdater`: placeholder for documentation updates (e.g., CLAUDE.md)

**Diagram:**

```

[User/Agent]
|
v
[Tool Execution Request]
|
v
[Pre-Hooks Middleware] ---> [intentValidator] ---> [contextLoader]
|
v
[Tool Execution]
|
v
[Post-Hooks Middleware] ---> [traceLogger] ---> [docUpdater]
|
v
[Result / Response]

```

---

### 5. Notes for Interim Submission

- **No actual `agent_trace.jsonl` yet** — post-hooks currently placeholders.
- **Intent-AST correlation** and **content hashing** are deferred to final submission.
- Hooks demonstrate **composable middleware** architecture, meeting interim rubric criteria.
- Prepares for Phase 1 (Handshake / Reasoning Loop) and Phase 2 (Middleware & Security Boundary).

---

### 6. Next Steps (Final Submission)

- Implement **agent_trace.jsonl logging** in post-hooks.
- Extend `contextLoader` to include **recent history for selected intents**.
- Integrate **AST-based intent verification** for full Intent-Code traceability.
- Support **parallel orchestration** and shared CLAUDE.md updates.
