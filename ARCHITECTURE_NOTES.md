# ARCHITECTURE_NOTES.md
## TRP1 Challenge Week 1
### Architecting the AI-Native IDE & Intent-Code Traceability

Author: Addisu Taye 
Role: Forward Deployed Engineer (FDE)  
Target Extension: Roo Code (Forked)  
Submission: Interim (Wednesday 21hr UTC)

---

# 1. Executive Summary

This document describes the architectural upgrade of Roo Code into a Governed AI-Native IDE.

Traditional Git tracks:
- What changed
- When it changed

It does NOT track:
- Why it changed (Intent)
- Whether the change preserves semantics (AST refactor vs feature evolution)

This creates:
- Cognitive Debt
- Trust Debt
- Context Rot
- Vibe Coding

We introduce:

- Deterministic Hook Middleware
- Intent-Code Traceability
- AI-Native Git (Semantic Ledger)
- Context Injection Protocol
- Parallel Agent Orchestration Support

This transforms the IDE into a Governed Execution Environment.

---

# 2. Baseline Roo Code Architecture (Phase 0 – Archaeological Dig)

## 2.1 Observed Execution Flow

Webview (UI)
    ↓ postMessage
Extension Host
    ↓
Agent Loop
    ↓
Tool Dispatcher (write_file, execute_command, etc.)
    ↓
Filesystem / Terminal

### Findings

1. Prompt construction happens in the Extension Host.
2. Tool execution is centrally dispatched.
3. No semantic trace exists.
4. No intent enforcement layer.
5. No governance middleware boundary.

The system is linear and text-diff driven.

---

# 3. Proposed AI-Native Architecture

We introduce a strict middleware boundary.

Webview (UI - Restricted)
        ↓
Extension Host (Core Logic)
        ↓
┌──────────────────────────────┐
│         HOOK ENGINE          │
│  Deterministic Middleware    │
└──────────────────────────────┘
        ↓
Tool Dispatcher
        ↓
Filesystem / Git / Terminal

The Hook Engine becomes:

- Security Boundary
- Governance Layer
- Semantic Trace Controller

---

# 4. Hook Engine Design

Location:

src/hooks/
    hookEngine.ts
    preHooks.ts
    postHooks.ts
    intentValidator.ts
    traceSerializer.ts
    concurrencyGuard.ts

## 4.1 Responsibilities

### Pre-Tool Execution

- Validate intent_id
- Enforce owned_scope
- Inject structured intent context
- Classify command (Safe / Destructive)
- Human-in-the-Loop approval
- Concurrency hash validation

### Post-Tool Execution

- Compute SHA-256 content hash
- Classify mutation (AST_REFACTOR / INTENT_EVOLUTION)
- Append to agent_trace.jsonl
- Update intent_map.md
- Update active_intents.yaml lifecycle state

Hooks are:

- Isolated
- Composable
- Fail-safe
- Deterministic

No business logic leaks into the main execution loop.

---

# 5. Two-Stage State Machine (Handshake Protocol)

## Problem

LLM is synchronous.
IDE loop is asynchronous.

Without governance, the agent writes code immediately.

## Solution

Enforced Two-Stage Protocol:

State 1 — User Request  
State 2 — Reasoning Intercept (Intent Checkout)  
State 3 — Contextualized Execution  

The agent MUST call:

select_active_intent(intent_id: string)

before any mutating operation.

If not declared → Execution blocked.

This prevents:
- Context drift
- Intent ambiguity
- Unauthorized edits

---

# 6. The .orchestration/ Data Model

All governance artifacts are stored in:

.orchestration/

This sidecar model ensures spatial independence from the source code.

---

## 6.1 active_intents.yaml

Tracks business requirements formally.

Structure:

active_intents:
  - id: "INT-001"
    name: "JWT Authentication Migration"
    status: "IN_PROGRESS"
    owned_scope:
      - "src/auth/**"
      - "src/middleware/jwt.ts"
    constraints:
      - "Must maintain backward compatibility"
    acceptance_criteria:
      - "All auth tests pass"

Updated by:
- Pre-Hook (when selected)
- Post-Hook (when completed)

---

## 6.2 agent_trace.jsonl (Semantic Ledger)

Append-only JSONL file.

Each entry contains:

- uuid
- timestamp
- git revision
- file path
- content_hash (sha256)
- mutation_class
- intent_id reference

Example entry:

{
  "id": "uuid-v4",
  "timestamp": "2026-02-16T12:00:00Z",
  "vcs": { "revision_id": "git_sha" },
  "files": [
    {
      "relative_path": "src/auth/middleware.ts",
      "conversations": [
        {
          "contributor": {
            "entity_type": "AI",
            "model_identifier": "claude-3-5-sonnet"
          },
          "ranges": [
            {
              "start_line": 15,
              "end_line": 45,
              "content_hash": "sha256:abc123..."
            }
          ],
          "mutation_class": "AST_REFACTOR",
          "related": [
            { "type": "specification", "value": "INT-001" }
          ]
        }
      ]
    }
  ]
}

This guarantees spatial independence.

---

## 6.3 intent_map.md

Maps:

Intent → Files → AST Regions

Provides managerial observability:

"Where is billing logic implemented?"

---

## 6.4 CLAUDE.md (Shared Brain)

Persistent parallel memory.

Contains:

- Architectural decisions
- Style constraints
- Lessons learned
- Verification failures

Enables multi-agent parallel orchestration.

---

# 7. Content Hashing (Spatial Independence)

We compute:

SHA-256(modified_code_block)

Properties:

- Independent of file position
- Independent of line movement
- Independent of diff noise
- Mathematically stable identity

If code moves → Hash remains valid.

This repays Trust Debt.

---

# 8. Scope Enforcement Model

On write_file:

1. Extract relative_path
2. Match against active_intent.owned_scope
3. If outside scope → Reject

Structured error returned:

{
  "error": "ScopeViolation",
  "intent_id": "INT-001",
  "file": "src/payment/processor.ts"
}

Prevents:

- Intent drift
- Cross-feature contamination
- Accidental feature evolution

---

# 9. Command Classification

Commands are categorized as:

Safe:
- read_file
- list_files
- search

Destructive:
- write_file
- delete_file
- execute_command

Destructive operations require:

- Intent validation
- Scope validation
- Optional HITL approval

---

# 10. Concurrency Control (Parallel Agents)

Optimistic Locking:

1. Agent reads file → compute read_hash
2. Before write → compute current_hash
3. If mismatch → Block write

Error returned:

{
  "error": "StaleFileError",
  "message": "File modified by another contributor."
}

Prevents:

- Parallel overwrite
- Agent-agent collision
- Human-agent race conditions

Enables Master Thinker orchestration.

---

# 11. Security Boundary

Strict privilege separation:

Webview:
- Presentation only
- No tool execution
- No secret access

Extension Host:
- File system access
- Git access
- Secret management

Hook Engine:
- Deterministic policy enforcement
- No LLM invocation
- No external calls

This architecture prevents privilege escalation.

---

# 12. Architectural Decisions & Rationale

| Decision | Rationale |
|----------|------------|
| Sidecar .orchestration | Spatial independence |
| JSONL ledger | Append-only auditability |
| SHA-256 hashing | Mathematical traceability |
| Intent-first handshake | Eliminate context rot |
| Scope enforcement | Prevent agent drift |
| HITL boundary | Reduce trust debt |
| Optimistic locking | Enable safe parallelism |
| Middleware isolation | Clean separation of concerns |

---

# 13. Transformation Summary

Before:

AI-powered text editor.

After:

Governed AI-Native IDE with:

- Intent awareness
- Semantic tracking
- Deterministic hooks
- Cryptographic verification
- Parallel orchestration support
- Living documentation

We replaced:

Blind trust → Verifiable traceability  
Drift → Deterministic governance  
Text diffs → Intent-AST correlation  

This architecture repays:

- Cognitive Debt
- Trust Debt

And enables Master Thinker workflows.
