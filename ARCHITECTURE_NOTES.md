# Architecture Notes: AI-Native Governance in Roo Code

## 1. Extension Overview

This extension operates within the VS Code Extension Host, separating the **Webview (UI)** from the **Core Logic**.

- **Webview**: Handles user chat and rendering.
- **Extension Host**: Manages the LLM state and tool execution loop.

## 2. The Hook Engine & Middleware Boundary

We have implemented a **Two-Stage State Machine** to solve the Context Paradox.

- **Pre-Hook (The Gatekeeper)**: Located in `presentAssistantMessage.ts`. It intercepts all destructive tool calls (`write_to_file`, `execute_command`, etc.). If `activeIntentId` is null, execution is blocked.
- **Post-Hook (The Ledger)**: Executes after `writeToFileTool.handle`. It captures the `content_hash` and appends a record to the `agent_trace.jsonl`.

## 3. Architectural Decisions

- **Intent-First Design**: The LLM is restricted via the System Prompt to call `select_active_intent` before any other action.
- **Spatial Independence**: We use SHA-256 content hashing in the trace ledger to ensure traceability even if file line numbers shift.
- **Privilege Separation**: Logic is kept in the Extension Host to prevent prompt injection from bypassing security constraints in the Webview.

## 4. Data Models

- **Intent Spec**: `.orchestration/active_intents.yaml`
- **Audit Ledger**: `.orchestration/agent_trace.jsonl`
