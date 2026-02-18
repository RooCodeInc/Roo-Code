# Roo Code: Governed AI-Native IDE (TRP1 Challenge Week 1)

[![VS Code Marketplace](https://img.shields.io/badge/VS_Code_Marketplace-007ACC?style=flat&logo=visualstudiocode&logoColor=white)](https://marketplace.visualstudio.com/items?itemName=RooVeterinaryInc.roo-cline)
[![TRP1 Challenge](https://img.shields.io/badge/TRP1-Week_1_Challenge-FFD700?style=flat)](https://github.com/RooCodeInc/Roo-Code)

This repository is a hardened, governed fork of Roo Code. It has been re-architected to transition software engineering from manual syntax generation to the **orchestration of silicon workers** with strict **Intent-Code Traceability**.

---

## 🎯 The Business Objective

In the era of AI-generated code, the primary bottleneck is no longer writing syntax, but **Governance and Context Management**. This project addresses two critical forms of debt:

1.  **Cognitive Debt**: Preventing the loss of knowledge "stickiness" that occurs when humans skim AI output rather than deeply understanding it.
2.  **Trust Debt**: Bridging the gap between what the system produces and what can be verified through cryptographic and architectural constraints.

## ✨ Governance Features (Master Thinker Implementation)

### 1. The Handshake (Reasoning Loop)

We have implemented a **Two-Stage State Machine** for every agent turn. The agent is strictly forbidden from writing code immediately; it must first "checkout" an intent.

- **`select_active_intent(intent_id)`**: A mandatory tool that loads business constraints, owned scopes, and architectural requirements from the sidecar database into the agent's immediate context.

### 2. The Hook Engine (Deterministic Gatekeeper)

All tool executions are intercepted by a **Deterministic Hook System** within the Extension Host:

- **Pre-Hook Governance**: Automatically blocks destructive tools (`write_to_file`, `execute_command`, `apply_diff`) if no active Intent ID is declared.
- **Protocol Enforcement**: Rejects "Vibe Coding" attempts, forcing the agent to adhere to the plan-first strategy modeled after industry leaders like Boris Cherny (Anthropic).

### 3. AI-Native Git (Traceability Ledger)

By enforcing **Intent-Code Traceability**, we replace blind trust with verification:

- **Spatial Independence**: Every file modification is logged with a **SHA-256 Content Hash**. Even if lines move during refactoring, the logic remains traceable.
- **The Ledger**: An append-only `.orchestration/agent_trace.jsonl` file that links Business Intent -> Code AST -> Agent Action.

---

## 🛠️ Data Model & Sidecar Storage

The architecture maintains a strictly defined `.orchestration/` directory in the user's workspace to prevent "Context Rot":

- **`active_intents.yaml`**: Tracks the lifecycle of business requirements and formalized scope definitions.
- **`agent_trace.jsonl`**: A machine-readable history of every mutating action, ensuring spatial independence via content hashing.
- **`intent_map.md`**: Maps high-level business intents to physical files and AST nodes for real-time architectural auditing.

---

## 🚀 Getting Started

### Installation

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/ibnu-asma/Roo-Code.git
    ```
2.  **Install Dependencies**:
    ```bash
    pnpm install
    ```
3.  **Run the Governed IDE**:
    Press `F5` to open the **VS Code Extension Development Host**.

### Usage Protocol

1.  Create a `.orchestration/active_intents.yaml` file in your test project.
2.  Define an intent (e.g., `id: "INT-101"`).
3.  Prompt the agent. Observe the **Gatekeeper** blocking unauthorized writes until the **Handshake** (`select_active_intent`) is performed.

---

## 🎓 TRP1 Challenge Roadmap

- [x] **Phase 0**: Archaeological Dig (Mapping the Tool Loop & Prompt Builder)
- [x] **Phase 1**: The Handshake (Reasoning Loop & Context Injection)
- [x] **Phase 2**: The Hook Middleware (Command Classification & Security Boundary)
- [x] **Phase 3**: AI-Native Git Layer (SHA-256 Content Hashing & Ledger Serialization)
- [ ] **Phase 4**: Parallel Orchestration (Optimistic Locking & Lesson Recording)

---

## 📜 License

This project is licensed under the Apache 2.0 License - see the [LICENSE](./LICENSE) file for details.
