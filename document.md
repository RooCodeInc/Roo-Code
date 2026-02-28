TRP1 Challenge Week 1: Architecting the AI-Native IDE & Intent-Code Traceability

The Business Objective
Software engineering is transitioning from manual syntax generation to the orchestration of silicon workers. In this new era, the primary bottleneck is not writing code, but Governance and Context Management.
The Problem:
Traditional version control (Git) was built for humans. It tracks what changes (lines of text) and when, but it is completely blind to Why (Intent) and Structural Identity (Abstract Syntax Tree or AST).
When an AI agent modifies 50 files to "Refactor Auth Middleware," Git sees 50 unrelated text diffs. It cannot distinguish between a semantic refactor (Intent Preservation) and a feature addition (Intent Evolution). Furthermore, "Vibe Coding"—where developers blindly accept AI output without rigorous architectural constraints—leads to massive technical debt and "Context Rot."
The Master Thinker Philosophy:
To pass this challenge, you must adopt the mindset of an AI Master Thinker, modeled after industry leaders:
Boris Cherny (Anthropic): Runs 15+ concurrent agent sessions, treating them as specialized workers (Architect, Builder, Tester). He enforces a "Plan-First" strategy and uses a shared brain to prevent drift.
The Cursor Team: Builds environments where the IDE acts as a manager, not just a text editor.
Cognitive Debt
Before writing code, you must internalize why we are building this. As AI generates code at superhuman speed, we face two new forms of debt:
Cognitive Debt: When knowledge loses its "stickiness" because humans are skimming AI output rather than deeply understanding it.
Trust Debt: The gap between what the system produces and what we can verify.
Your architecture is the repayment mechanism for this debt. By enforcing Intent-Code Traceability, you replace blind trust with cryptographic verification. By creating Living Documentation, you prevent active knowledge decay.
Your Goal:
You will not build a chat bot. You will act as a Forward Deployed Engineer (FDE) to upgrade an existing open-source AI Agent (Roo Code or Cline) into a governed AI-Native IDE.
You will instrument this extension with a Deterministic Hook System that intercepts every tool execution to:
Enforce Context: Inject high-level architectural constraints via Sidecar files.
Trace Intent: Implement an AI-Native Git layer that links Business Intent -> Code AST -> Agent Action.
Automate Governance: Ensure documentation and attribution evolve in real-time as a side-effect of the code.

Mandatory Research & Conceptual Foundation
You are expected to engineer solutions based on these specific philosophies. Read these before writing code.
Context Engineering: Exploring Gen AI: Context Engineering for Coding Agents
Key Takeaway: How to curate the context window to prevent "Context Rot."
AI-Native Version Control: AI-Native Git Version Control & Git-AI Project
Key Takeaway: Moving from line-based diffs to Intent-AST correlation.
Agentic Workflows: Claude Code Playbook (Boris Cherny)
Key Takeaway: Running parallel agents (Architect vs. Builder) and using a "Shared Brain."
Prior Art: Entire.io CLI and Custard Seed.
On Cognitive Debt
Cognitive Debt – Understand what happens when we stop "doing the work."
Trust, Care, and What’s Lost in Abstraction – The difference between human care and machine output.
On Intent Formalization:
Intent Formalization – How to define intent mathematically.
Formal Intent Theory  
AISpec.
AI-assisted reverse engineering to reconstruct functional specifications from UI elements, binaries, and data lineage to overcome analysis paralysis. Black Box to Blueprint.

The Architecture Specification
You will fork Roo Code (Recommended) or Cline. You will inject a hook system that maintains a strictly defined .orchestration/ directory in the user's workspace.
The Hook Engine & Middleware Boundary
The physical architecture must be designed with strict privilege separation.
Webview (UI): Restricted presentation layer. Emits events via postMessage.
Extension Host (Logic): Handles API polling, secret management, and MCP tool execution.
The Hook Engine: Acts as a strict middleware boundary. It intercepts all tool execution requests. At the PreToolUse phase, the engine will enforce intent context injection and Human-in-the-Loop (HITL) authorization. At PostToolUse it will update codebase documentation, state evolution, and intent changes.
To solve the problem of injecting context before the agent has time to analyze the user's request and what it should do, you must architect a Two-Stage State Machine for every turn of the conversation. The Agent is not allowed to write code immediately; it must first "checkout" an intent.
The Execution Flow:
State 1: The Request. User prompts: "Refactor the auth middleware."
State 2: The Reasoning Intercept (The Handshake).
The Agent analyzes the request, identifies an intent ids, and calls a mandatory tool: select_active_intent(intent_id).
The Pre-Hook Intercepts this call. It pauses the execution loop.
The Hook queries the Data Model for the selected intent's constraints, related files, and recent history for the identified intent IDs.
The Hook injects this deep context into the immediate prompt and resumes execution.
State 3: Contextualized Action.
The Agent, now possessing the specific context, calls LLM to generate required changes and calls write_file.
The Post-Hook Intercepts. It calculates the content_hash and logs the trace, linking the code back to the intent_id selected in State 2.
The Data Model
You will implement a Sidecar storage pattern in .orchestration/. These files are machine-managed. These data-models are essentials only. Based on your capability and architecture you might prefer to store the data in SQLite or other high performant local databases such as Alibaba Open-Sources Zvec

1. .orchestration/active_intents.yaml (The Intent Specification)
   Inspired by Spec-Driven Development and AISpec, this file treats the codebase as a collection of formalized intents, not just text files.
   Purpose: Tracks the lifecycle of business requirements. Not all code changes are equal; this file tracks why we are working.
   Update Pattern: Updated via Pre-Hooks (when an agent picks a task) and Post-Hooks (when a task is complete).
   Structure:
   active_intents:

- id: "INT-001"
  name: "JWT Authentication Migration"
  status: "IN_PROGRESS"
    # Formal Scope Definition (Crucial for Parallelism)
    owned_scope:
    - "src/auth/\*\*"
    - "src/middleware/jwt.ts"
      constraints:
    - "Must not use external auth providers"
    - "Must maintain backward compatibility with Basic Auth"
    # The "Definition of Done"
    acceptance_criteria:
    - "Unit tests in tests/auth/ pass"

1. .orchestration/agent_trace.jsonl (The Ledger)
   Purpose: An append-only, machine-readable history of every mutating action, linking the abstract Intent to the concrete Code Hash.
   Update Pattern: Updated via Post-Hook after file writes.
   Schema Requirement: You must implement the full Agent Trace specification to ensure spatial independence via content hashing.
   {
   "id": "uuid-v4",
   "timestamp": "2026-02-16T12:00:00Z",
   "vcs": { "revision_id": "git_sha_hash" },
   "files": [
   {
   "relative_path": "src/auth/middleware.ts",
   "conversations": [
   {
   "url": "session_log_id",
   "contributor": {
   "entity_type": "AI",
   "model_identifier": "claude-3-5-sonnet"
   },
   "ranges": [
   {
   "start_line": 15,
   "end_line": 45,
   // CRITICAL: Spatial Independence.
   "content_hash": "sha256:a8f5f167f44f4964e6c998dee827110c"
   }
   ],
   // CRITICAL: The Golden Thread to SpecKit
   "related": [
   {
   "type": "specification",
   "value": "REQ-001"
   }
   ]
   }
   ]
   }
   ]
   }

Content Hashing: You must compute a hash of the modified code block to ensure spatial independence. If lines move, the hash remains valid.

3. .orchestration/intent_map.md (The Spatial Map)
   Purpose: Maps high-level business intents to physical files and AST nodes. When a manager asks, "Where is the billing logic?", this file provides the answer.
   Update Pattern: Incrementally updated when INTENT_EVOLUTION occurs.
4. AGENT.md or CLAUDE.md (The Shared Brain)
   Purpose: A persistent knowledge base shared across parallel sessions (Architect/Builder/Tester). Contains "Lessons Learned" and project-specific stylistic rules.
   Update Pattern: Incrementally appended when verification loops fail or architectural decisions are made.

Implementation Curriculum
The following guides are indicatory. You may not achieve a robust solution implementing only these phases. You must architect a full working solution and implement it based on the actual goal specified. Your innovation, thinking outside the box, and identifying potential gaps and their solutions is necessary.
Phase 0: The Archaeological Dig
Goal: Map the nervous system.
Fork & Run: Get Roo Code or Cline running in the Extension Host.
Trace the Tool Loop: Identify the exact function in the host extension that handles execute_command and write_to_file.
Locate the Prompt Builder: Find where the System Prompt is constructed. You cannot enforce the "Reasoning Loop" if you cannot modify the instructions given to the LLM.
Deliverable: ARCHITECTURE_NOTES.md.

Phase 1: The Handshake (Reasoning Loop Implementation)
Goal: Solve the Context Paradox. Bridge the synchronous LLM with the asynchronous IDE loop.
Define the Tool: Create a new tool definition: select_active_intent(intent_id: string).
Context Loader (Pre-Hook): Before the extension sends a prompt to the LLM, intercept the payload. Read the corresponding entries in active_intent.yaml, identify related agent trace entries for the active intent the agent is processing, and prepare a consolidated intent context.
Prompt Engineering: Modify the System Prompt to enforce the protocol:
"You are an Intent-Driven Architect. You CANNOT write code immediately. Your first action MUST be to analyze the user request and call select_active_intent to load the necessary context."
Context Injection Hook:
Implement logic that intercepts select_active_intent.
Read active_intents.yaml.
Construct an XML block <intent_context> containing only the constraints and scope for the selected ID.
Return this block as the tool result.
The Gatekeeper: In your Pre-Hook, verify that the agent has declared a valid intent_id. If not, block execution and return an error: "You must cite a valid active Intent ID."
Phase 2: The Hook Middleware & Security Boundary
Goal: Architect the Hook Engine that wraps all tool execution requests and enforce formal boundaries.
Command Classification: Classify commands as Safe (read) or Destructive (write, delete, execute).
UI-Blocking Authorization: Identify existing logic to pause the Promise chain. Your hook will trigger vscode.window.showWarningMessage with "Approve/Reject" to update core intent evolution. Your architecture should allow defining .intentignore like file to exclude changes to certain intents. A simple model to adopt is a codebase is a collection of intents as much as it is a collection of organized code files linked by imports. You may need to develop or adopt a simple intent language see the following references https://arxiv.org/abs/2406.09757 https://github.com/cbora/aispec http://sunnyday.mit.edu/papers/intent-tse.pdf and those that build formal intent specification structures on top of GitHub speckit.
Autonomous Recovery: If rejected, send a standardized JSON tool-error back to the LLM so it can self-correct without crashing.
Scope Enforcement: In the write_file Pre-Hook, check if the target file matches the owned_scope of the active intent.
If valid: Proceed.
If invalid: Block and return: "Scope Violation: REQ-001 is not authorized to edit [filename]. Request scope expansion."
Phase 3: The AI-Native Git Layer (Full Traceability)
Goal: Implement the semantic tracking ledger. Repay Trust Debt with Verification.
Schema Modification: Modify the write_file tool schema to require intent_id and mutation_class.
Semantic Classification: Ensure your system can distinguish between AST_REFACTOR (syntax change, same intent) and INTENT_EVOLUTION (new feature).
Spatial Hashing: Implement a utility to generate SHA-256 hashes of string content.
Trace Serialization:
Create a Post-Hook on write_file.
Construct the JSON object using the Agent Trace Schema defined before.
Crucial: You must inject the REQ-ID (from Phase 1) into the related array and the content_hash into the ranges object.
Append to agent_trace.jsonl.
Phase 4: Parallel Orchestration (The Master Thinker)
Goal: Manage Silicon Workers via Optimistic Locking.
Concurrency Control:
When an agent attempts to write, calculate the hash of the current file on disk.
Compare it to the hash the agent read when it started its turn.
If they differ: A parallel agent (or human) has modified the file. BLOCK the write to prevent overwriting. Return a "Stale File" error and force the agent to re-read.
Lesson Recording: Implement a tool that appends "Lessons Learned" to CLAUDE.md if a verification step (linter/test) fails.

Proof of Execution (The Demo)
To pass, you must submit a video (max 5 mins) demonstrating the Parallel "Master Thinker" Workflow:
Setup: Open a fresh workspace. Define active_intents.yaml with a simple example of your own - intents generated using GitHub speckit or simple like "INT-001: Build Weather API".
Parallelism: Open two separate instances/chat panels of your extension.
Agent A (Architect): Monitors intent_map.md and defines the plan.
Agent B (Builder): Writes code for INT-001.
The Trace: Have Agent B refactor a file. Show .orchestration/agent_trace.jsonl updating in real-time with the correct AST_REFACTOR classification and content hash.
The Guardrails: Have Agent B try to execute a destructive command or write code without an Intent ID. Show the Pre-Hook blocking it.

Deliverables
The following are required submissions for both the interim submission on Wednesday and final submission on Saturday.

Interim Submission - Wednesday 21hr UTC
PDF Report
How the VS Code extension works.
The code and design architecture of the agent in the extension - your note ARCHITECTURE_NOTES.md from Phase 0
Architectural decisions for the hook
Diagrams and Schemas of the hook system
Submit a GitHub Repository containing:
Your forked extension with a clean src/hooks/ directory.

Final Submission - Saturday 21hr UTC
PDF Report
Complete report of your implementation with detailed schemas, architecture, and notes.
Detailed breakdown of the Agent flow and your implemented hook
Summary of what has been achieved with all the work done.
The Meta-Audit Video:
Demonstrating the workflow defined in Section 5.
Submit a GitHub Repository containing:
The .orchestration/ Artifacts:
agent_trace.jsonl .
active_intents.yaml
intent_map.md.
The Source Code:
Your forked extension with a clean src/hooks/ directory.

Evaluation Rubric
The following criterions will play a significant role in assessing the work you will submit.

Metric
Score 1 (The Vibe Coder)
Score 3 (Competent Tech Lead)
Score 5 (Master Thinker)
Intent-AST Correlation
No machine-readable trace. Relies on standard Git.
Trace file exists but classification is random/inaccurate.
agent_trace.jsonl perfectly maps Intent IDs to Content Hashes. Distinguishes Refactors from Features mathematically.
Context Engineering
State files are handwritten/static. Agent drifts.
Hooks update state, but the architecture is brittle.
Dynamic injection of active_intents.yaml. Agent cannot act without referencing the context DB. Context is curated, not dumped.
Hook Architecture
Logic is stuffed into the main execution loop (spaghetti).
Hooks work but are tightly coupled to the host.
Clean Middleware/Interceptor Pattern. Hooks are isolated, composable, and fail-safe.
Orchestration
Single-threaded only.
Parallel attempts collide.
Parallel Orchestration demonstrated. Shared CLAUDE.md prevents collision. System acts as a "Hive Mind."
