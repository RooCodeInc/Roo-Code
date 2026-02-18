### Core Objective

Design a VS Code extension that binds high-level business intent to source code Abstract Syntax Trees (AST) using deterministic lifecycle hooks, executable specifications, and immutable trace records.

### Architectural Components

**1. The Hook Engine (Middleware Boundary)**
The extension must act as a strict middleware between the LLM and the filesystem.

- **PreToolUse Hook:** Intercepts agent requests _before_ execution.
    - **Classification:** regex/AST analysis categorizes commands as **Safe** (read) or **Destructive** (write, delete, exec).
    - **HITL Gate:** Destructive commands trigger a UI-blocking modal requiring human approval.
- **PostToolUse Hook:** Executes immediately _after_ file modification.
    - **Automation:** Triggers formatters (Prettier) and linters.
    - **Self-Correction:** Captures linter `stderr` and feeds it back to the agent’s context window for autonomous fixing.

**2. Spec-Driven Development (SDD)**
Utilizes the GitHub SpecKit workflow to invert the coding process:

- **Constitution:** A persistent memory file defining non-negotiable architectural/testing constraints.
- **Pipeline:** Constitution $\rightarrow$ Functional Spec $\rightarrow$ Technical Plan $\rightarrow$ Code Execution.
- **Constraint:** Agents must validate plans against the Constitution before generating code.

**3. Code-to-Intent Traceability (Agent Trace)**
Implementation of the **Agent Trace** schema to attribute code to specific requirements.

- **Data Model:**
    - **Trace Record:** Groups modifications by file and conversation.
    - **Conversation Object:** Links to the specific interaction log.
    - **Related Array:** Injects the specific **Requirement ID** from the SpecKit document.
- **Storage:** Sidecar pattern. Uses a local `.orchestration/agent_trace.jsonl` file (or SQLite) to store metadata, avoiding source code pollution.
- **Spatial Independence:** Uses **Content Hashing** (Murmur3/SHA-256) of the AST node or string block. This ensures attribution remains valid even if line numbers shift during refactoring.

**4. System Topology & MCP**

- **Separation of Concerns:**
    - **Webview:** UI presentation only. No Node.js access.
    - **Extension Host:** Handles logic, API polling, and secret management.
- **Model Context Protocol (MCP):** Connects the extension to tools via `stdio`.
    - **Tools:** Spec Discovery (parsing markdown), Filesystem (safe R/W), Validation (running tests).

---

### Implementation Curriculum (Phases)

**Phase 1: Scaffolding & State**

- **Output:** A VS Code extension with segregated Webview/Extension Host.
- **State:** Implement `.orchestration/TODO.md` read/write logic to persist session context across reloads.

**Phase 2: The Hook Middleware**

- **Interceptor:** Build the PreToolUse logic to classify commands.
- **Recovery:** If a user rejects a command, format the rejection as a JSON tool-error to prompt the agent for an alternative plan.
- **Auto-Format:** Wire PostToolUse events to local formatters.

**Phase 3: Traceability Engine**

- **Intent Extraction:** Parse active `.specify/` files to capture the current Requirement ID.
- **Hashing:** Compute hashes of generated code blocks immediately upon write.
- **Serialization:** Write the Trace Record (Requirement ID + Content Hash + Timestamp) to the sidecar JSONL file.

**Phase 4: Multi-Agent Orchestration**

- **Supervisor Pattern:** A "Manager" agent reads the main spec and spawns "Worker" agents with restricted scopes (e.g., specific sub-directories).
- **Concurrency Control:**
    - **Optimistic Locking:** Before writing, re-compute the target file's hash. If it differs from the start-of-task hash, abort and refresh context.
    - **Write Partitioning:** Assign disjoint file spaces to different agents.
    - **Unified Diffs:** Force agents to emit patch actions rather than full-file rewrites to minimize collisions.

### Guardrails

- **Context Compaction:** Use `PreCompact` hooks to summarize history and truncate tool outputs to prevent context rot.
- **Circuit Breakers:** Halt execution if `PostToolUseFailure` events exceed a defined threshold (preventing infinite error loops).
- **Security:** Sanitize all JSON tool inputs and quote shell variables to prevent injection attacks.
