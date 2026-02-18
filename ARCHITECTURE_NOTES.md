ARCHITECTURE_NOTES.md: AI-Native Governance Framework

1. Executive Summary
   This document outlines the architectural implementation of a Deterministic Hook System within Roo Code. The goal is to move from a "Probabilistic" execution model (where the AI acts on vibes) to a "Governed" state machine where every code change is anchored to a verified Intent ID.

2. Phase 0: Archaeological Dig (Nervous System Map)
   Through deep-code analysis, I have identified the three critical "Hook Points" where governance must be injected.

A. The Tool Dispatcher (The Interceptor)
Location: src/core/assistant-messages/presentAssistantMessage.ts (~Lines 679-765)

Function: This switch statement is the "brain-to-body" gateway. It parses LLM responses into actionable tools like write_to_file.

Intervention: This is where the Pre-Hook will reside. Before a tool is dispatched, the system will check .orchestration/active_intents.yaml for a non-null active_intent_id.

B. The System Prompt Builder (The Instruction Root)
Location: src/core/prompts/system.ts (~Lines 112-193)

Function: SYSTEM_PROMPT() assembles the agent's core identity and rules.

Intervention: This is where the Handshake Protocol is enforced. I will inject instructions that explicitly strip the AI of its "Right to Write" until it successfully calls select_active_intent().

C. The Physical Write Layer (The Fail-Safe)
Location: src/integrations/editor/DiffViewProvider.ts (~Lines 642-690, saveDirectly())

Function: The low-level execution point where the extension calls fs.writeFile.

Intervention: This is the Post-Hook and final gatekeeper. It will verify that the content being written matches the "Intent Hash" logged during the handshake.

3. Phase 1: The Handshake Protocol
   To solve the Context Paradox, I am implementing a synchronous state machine within the asynchronous IDE loop.

The Handshake State Machine
Intent Selection: A new tool select_active_intent(intent_id: string) is registered.

Context Loading: Upon calling this tool, the extension reads active_intents.yaml and injects a hidden <intent_context> block into the prompt.

Governance Gate: If the AI attempts to use write_to_file without an active intent, the preToolUse hook returns a Standardized Governance Error: "Action Blocked: You must cite a valid active Intent ID before modifying the codebase."

4. Structural Memory & Ledger
   The system relies on a local, version-controlled ledger to maintain "Why" transparency.

.orchestration/active_intents.yaml: Tracks the live state of the agent's current focus.

.orchestration/intent_map.md: A long-term human-readable log linking Intent IDs to specific file changes and hashes.

5. Technical Environment & Dependencies
   Base: Roo Code (Forked)

Runtime: VS Code Extension Host

Inference: Ollama (Local DeepSeek-R1) / Hybrid Cloud Offloading.

Package Management: pnpm (Workspace-aware).
