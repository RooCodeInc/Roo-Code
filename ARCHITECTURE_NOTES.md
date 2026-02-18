# ARCHITECTURE_NOTES.md
## TRP1 Challenge – Architecting the AI-Native IDE & Intent-Code Traceability

Author: Addisu Taye
Target Extension: Roo Code (Forked)  
Submission Phase: Interim (Week 1)

---

# 1. Executive Overview

This document describes the architectural upgrade of Roo Code into a Governed AI-Native IDE.

Traditional Git tracks:

- What changed
- When it changed

It does NOT track:

- Why it changed (Intent)
- Whether the change preserved semantics
- Which agent performed the mutation
- Whether architectural constraints were respected

This project introduces:

- Deterministic Hook Middleware
- Intent-First Execution Protocol
- AI-Native Git Semantic Ledger
- Scope Enforcement
- Concurrency Control
- Living Documentation

The goal is to replace blind trust with deterministic verification.

---

# 2. Baseline Roo Code Architecture (Archaeological Dig)

## Existing Execution Flow

User Prompt
   ↓
Webview (UI)
   ↓ postMessage
Extension Host
   ↓
Agent Loop
   ↓
Tool Dispatcher (write_file, execute_command, etc.)
   ↓
Filesystem / Terminal

### Observations

- No middleware governance layer
- No semantic mutation tracking
- No intent declaration requirement
- No concurrency safeguards

The system is linear and text-diff driven.

---

# 3. Proposed AI-Native Architecture

We introduce a strict middleware boundary called the Hook Engine.

New Execution Flow:

User Prompt
   ↓
Webview (Restricted Presentation Layer)
   ↓
Extension Host (Core Logic)
   ↓
Hook Engine (Deterministic Middleware)
   ↓
Tool Dispatcher
   ↓
Filesystem / Git
   ↓
.orchestration/ (Governance Artifacts)

The Hook Engine becomes:

- Intent validator
- Scope enforcer
- Context injector
- Semantic ledger writer
- Concurrency guard

Governance is enforced at execution time.

---

# 4. Two-Stage Intent Handshake

## Problem

LLMs are synchronous.
The IDE tool execution loop is asynchronous.

Without control, the agent can write code immediately.

## Solution: Mandatory Intent Checkout

State 1: User Request  
State 2: Reasoning Intercept  
State 3: Contextualized Execution  

Protocol:

1. Agent analyzes request.
2. Agent MUST call:

   select_active_intent(intent_id: string)

3. Pre-Hook validates intent.
4. Context constraints injected.
5. Only then may write operations proceed.

If no valid intent_id → Execution blocked.

This prevents context drift and vibe coding.

---

# 5. The Hook Engine Design

Location:

src/hooks/

Structure:

- hookEngine.ts
- preHooks.ts
- postHooks.ts
- intentValidator.ts
- traceSerializer.ts
- concurrencyGuard.ts

## 5.1 Pre-Tool Responsibilities

- Validate intent_id
- Enforce owned_scope
- Classify command (Safe / Destructive)
- Inject structured intent context
- Verify concurrency hash

## 5.2 Post-Tool Responsibilities

- Compute SHA-256 content hash
- Classify mutation
- Append ledger entry
- Update intent_map.md
- Update active_intents.yaml

Hooks are:

- Deterministic
- Isolated
- Fail-safe
- Policy-driven

No governance logic is embedded in the main execution loop.

---

# 6. Governance Layer (.orchestration/)

All AI-native artifacts are stored in:

.orchestration/

Contains:

- active_intents.yaml
- agent_trace.jsonl
- intent_map.md
- CLAUDE.md

This sidecar model ensures separation from business source code.

---

# 7. active_intents.yaml

Tracks lifecycle of business requirements.

Example structure:

active_intents:
  - id: "INT-001"
    name: "JWT Authentication Migration"
    status: "IN_PROGRESS"
    owned_scope:
      - "src/auth/**"
      - "src/middleware/jwt.ts"
    constraints:
      - "Maintain backward compatibility"
    acceptance_criteria:
      - "All auth tests pass"

Purpose:

- Formalize intent ownership
- Define allowed file scope
- Enable parallel safe execution

---

# 8. agent_trace.jsonl (AI-Native Git Ledger)

Append-only JSONL file.

Each mutating action logs:

- Unique ID (UUID)
- Timestamp
- Git revision
- File path
- SHA-256 content hash
- Mutation class
- Related intent_id

Mutation classes:

- AST_REFACTOR (structure preserved)
- INTENT_EVOLUTION (feature expansion)

This creates Intent → AST → File traceability.

---

# 9. Content Hashing (Spatial Independence)

For every write operation:

SHA-256(modified_code_block)

Properties:

- Independent of line position
- Independent of file movement
- Independent of diff noise
- Cryptographically stable

If code moves, the hash remains valid.

This repays Trust Debt with verification.

---

# 10. Scope Enforcement

Before write_file executes:

1. Extract target path.
2. Compare against active_intent.owned_scope.
3. If outside scope → Block execution.

Example structured error:

{
  "error": "ScopeViolation",
  "intent_id": "INT-001",
  "file": "src/payment/processor.ts"
}

Prevents:

- Cross-intent contamination
- Architectural drift
- Unauthorized feature expansion

---

# 11. Concurrency Control (Parallel Agents)

Optimistic Locking Model:

1. Agent reads file → compute read_hash.
2. Before write → compute current_hash.
3. If mismatch → Block write.

Error returned:

{
  "error": "StaleFileError",
  "message": "File modified by another contributor."
}

Prevents:

- Agent-agent collision
- Human-agent overwrite
- Lost updates

Enables Master Thinker parallel orchestration.

---

# 12. Architectural Principles

This system enforces:

- Intent-first execution
- Deterministic middleware boundaries
- Cryptographic traceability
- Scope-limited mutation
- Parallel-safe orchestration
- Living documentation side effects

Governance is encoded in the execution layer.

Not discipline.
Architecture.

---

# 13. Interim Status

Completed:

- Architecture mapping
- Hook Engine design
- Governance schema design
- Mutation classification model
- Concurrency strategy definition

In Progress:

- Hook integration
- select_active_intent tool
- Hash utility implementation
- Ledger serialization logic

Remaining:

- Full middleware wiring
- HITL integration
- Parallel orchestration demo
- Meta-audit video

---

# 14. Summary

This architecture transforms Roo Code from:

AI-powered text editor

into:

Governed AI-Native IDE.

It replaces:

Blind trust → Verifiable trace  
Text diffs → Intent-linked semantic ledger  
Vibe coding → Deterministic governance  

This is the foundation for Intent-Driven AI Software Engineering.
