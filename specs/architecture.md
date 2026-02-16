# Architecture

## Components & Privilege Separation

### REQ-ARCH-001 Webview Boundary
- The Webview (UI) MUST be a restricted presentation layer that emits events via `postMessage`.

### REQ-ARCH-002 Extension Host Boundary
- The Extension Host MUST handle:
- API polling
- secret management
- tool execution orchestration

### REQ-ARCH-003 Hook Engine Boundary
- The Hook Engine MUST act as strict middleware around tool execution, enforcing:
- intent handshake
- HITL authorization
- scope enforcement
- trace emission
- documentation side-effects

## Conversation Turn State Machine

### REQ-SM-001 Two-Stage State Machine
- Each turn MUST follow a two-stage handshake before mutation:
1) Request analysis
2) `select_active_intent(intent_id)` intercept and context injection
3) Contextualized action (writes allowed only after stage 2)