# Architecture Notes: Master Thinker Edition

## 1. Data Flow Map (Request-to-Execution)

1. User Input: Received via the React Webview.
2. Context Assembly: `ClineProvider.ts` calls `src/core/task/Task.ts` to generate the System Prompt.
3. Decision: The LLM selects a tool. `presentAssistantMessage.ts` orchestrates the tool call.
4. Execution: `WriteToFileTool.ts` executes the `handle()` method to modify the file system.

## 2. Governance Interception Points

- **Pre-Hook (Phase 1/2):** Located in `WriteToFileTool.ts` inside `handle()`. This will block execution if `.orchestration/active_intents.yaml` does not have an `in-progress` status.
- **Post-Hook (Phase 3):** Located at the end of `handle()` after a successful write. This will trigger the `agent_trace.jsonl` logger to hash the new content.

## 3. Intent-Code Gap Analysis

Standard Git tracks "What" changed but lacks the "Why." By using a sidecar orchestration layer, we map every Abstract Syntax Tree (AST) change to a specific Requirement ID. This prevents "Context Rot" where agents lose track of architectural constraints during long-running tasks.

# Architectural Design Report

## 1. The Intent-First Protocol (Two-Stage State Machine)

The core of this implementation is a move away from "Vibe Coding" towards a governed, stateful interaction. I have architected a Two-Stage State Machine for every user request:

**Stage 1: The Reasoning Intercept (The Handshake):** The agent is no longer permitted to generate code immediately. It must first analyze the request, identify a valid intent_id from the governance sidecar, and call the select_active_intent tool.
+1

**Stage 2: Contextualized Action:** Only after the "Handshake" is successful and the context is injected can the agent proceed to use destructive tools like write_to_file or execute_command.
+1

## 2. The Deterministic Hook (Gatekeeper Architecture)

To ensure compliance, I implemented a Deterministic Hook System that acts as a strict middleware boundary:
+1

Pre-Hook Implementation: In WriteToFileTool.ts and ExecuteCommandTool.ts, I injected a gatekeeper check at the start of the handle method.

Verification Logic: This hook verifies the presence of a global active intent flag. If the agent attempts a file modification without a validated "checkout," the hook blocks execution and returns a formal governance error: "You must cite a valid active Intent ID".

Fail-Safe: This ensures that the architecture enforces the rules, rather than relying on the LLM's "best effort" to follow instructions.

## 3. Context Engineering (Dynamic Injection vs. Context Rot)

Traditional AI IDEs suffer from "Context Rot" by dumping entire file trees into the prompt. This implementation solves this via Dynamic Context Injection:
+1

**Sidecar Pattern:** All architectural constraints and business intents are stored in .orchestration/active_intents.yaml.
+1

**On-Demand Context:** When select_active_intent is called, the system reads the YAML and constructs a targeted <intent_context> XML block.

**Traceability:** This ensures the agent only operates within its "owned_scope" and respects the "acceptance_criteria" defined in the sidecar, maintaining a high signal-to-noise ratio in the context window.
