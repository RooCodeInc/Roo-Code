# ARCHITECTURE_NOTES.md

## Governed AI-Native IDE Extension (TRP1 Week 1)

Author: Ephrata Nebiyu  
Base Fork: Roo Code  
Objective: Upgrade Roo into a Governed AI-Native IDE with Intent-Code Traceability

---

# 1. Problem Statement

Traditional Git tracks textual diffs but lacks:

- Intent awareness (WHY)
- Structural identity (AST)
- AI attribution metadata
- Governance enforcement
- Concurrency protection

This extension upgrades Roo Code into a deterministic, governed AI-native IDE by implementing:

- Intent-first execution
- Deterministic lifecycle hooks
- AI-native Git trace layer
- Spatially independent content hashing
- Parallel multi-agent orchestration

---

# 2. High-Level Architecture

The system follows strict privilege separation:

## 2.1 Webview (UI Layer)

- Chat interface
- Emits events via postMessage
- Cannot access filesystem or secrets
- No execution logic

## 2.2 Extension Host (Logic Layer)

- Handles LLM calls
- Manages MCP tool execution
- Contains Hook Engine
- Manages orchestration state
- Manages sidecar storage

## 2.3 Hook Engine (Middleware Boundary)

Central governance layer intercepting all tool calls.

Implements:

- PreToolUse hooks
- PostToolUse hooks
- Context injection
- Scope enforcement
- HITL authorization
- Trace logging
- Concurrency validation

---

# 3. Two-Stage Execution State Machine

To prevent uncontrolled code generation, the system enforces a mandatory handshake.

## STATE 1: User Request

Example:

> "Refactor auth middleware"

Agent CANNOT write code immediately.

## STATE 2: Intent Handshake

Agent MUST call:

select_active_intent(intent_id)

PreHook:

- Validates intent exists
- Loads constraints
- Loads owned scope
- Injects <intent_context> XML block

Execution resumes only after context injection.

## STATE 3: Contextualized Action

Agent calls write_file with:

- intent_id
- mutation_class

PostHook:

- Computes content_hash
- Logs Agent Trace record
- Updates sidecar state

---

# 4. Sidecar Storage Model (.orchestration/)

Machine-managed only.

## 4.1 active_intents.yaml

Tracks business lifecycle and scope boundaries.

Example:

active_intents:

- id: "INT-001"
  name: "JWT Authentication Migration"
  status: "IN_PROGRESS"
  owned_scope:
    - "src/auth/\*\*"
    - "src/middleware/jwt.ts"
      constraints:
    - "Must not use external auth providers"
    - "Maintain backward compatibility"
      acceptance_criteria:
    - "Unit tests in tests/auth/ pass"

---

## 4.2 agent_trace.jsonl

Append-only ledger.

Each entry:

- uuid
- timestamp (RFC 3339)
- git revision
- file path
- contributor metadata
- content_hash
- related intent_id

Spatial independence ensured via SHA-256 hashing.

---

## 4.3 intent_map.md

Maps:
Business Intent → Files → AST Nodes

Updated during INTENT_EVOLUTION.

---

## 4.4 CLAUDE.md (Shared Brain)

Stores:

- Architectural decisions
- Lessons learned
- Failure recovery notes

Shared across parallel agents.

---

# 5. Hook Engine Architecture

Location:
src/hooks/

Modules:

- preToolUse.ts
- postToolUse.ts
- intentLoader.ts
- scopeValidator.ts
- traceLogger.ts
- concurrencyGuard.ts
- securityClassifier.ts

Hooks are isolated middleware components.
They do NOT pollute core execution loop.

---

# 6. PreToolUse Responsibilities

1. Enforce Intent Selection
2. Classify Command (Safe vs Destructive)
3. Enforce Scope
4. HITL Authorization
5. Concurrency Validation

Blocking Errors:

- Missing intent_id
- Scope violation
- Stale file hash
- Unauthorized destructive action

---

# 7. PostToolUse Responsibilities

1. Compute SHA-256 content hash
2. Detect mutation_class:
    - AST_REFACTOR
    - INTENT_EVOLUTION
3. Serialize Agent Trace schema
4. Append to agent_trace.jsonl
5. Update CLAUDE.md if verification fails

---

# 8. Concurrency Control

Optimistic Locking Strategy:

Before write:

- Compare file hash at read-time
- Compare with current disk hash
- If mismatch → reject write

Prevents parallel agent overwrite.

---

# 9. Security Model

- Least privilege
- No execution logic in Webview
- Path sanitization
- Directory traversal prevention
- Shell argument escaping
- Mandatory HITL for destructive actions

---

# 10. Performance Strategy

- Append-only JSONL (O(1) writes)
- Lazy YAML parsing (cached in memory)
- Hashing only modified blocks
- No full file AST rebuild
- Token compaction via PreCompact hook
- Circuit breaker for infinite tool loops

---

# 11. Edge Case Handling

- Missing intent_id → Hard block
- Intent outside scope → Hard block
- Invalid YAML → Fails safe
- Stale file write → Reject and re-read
- Repeated tool failures → Circuit breaker
- Agent tries bypassing handshake → Reject

---

# 12. Master Thinker Compliance

This architecture achieves:

- Intent-AST correlation
- Dynamic context injection
- Clean middleware isolation
- Parallel orchestration
- Cryptographic traceability
- Governance-first execution
