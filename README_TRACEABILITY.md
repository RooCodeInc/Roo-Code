# 🚀 Roo Code with Intent-Code Traceability System

[![TypeScript](https://img.shields.io/badge/TypeScript-0_errors-blue.svg)](https://www.typescriptlang.org/)
[![ESLint](https://img.shields.io/badge/ESLint-0_warnings-green.svg)](https://eslint.org/)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![TRP1](https://img.shields.io/badge/TRP1-100%2F100-brightgreen.svg)](https://github.com/IbnuEyni/Roo-Code)

> **AI-Native IDE with Intent-Driven Development** - Solving the Context Paradox and preventing "Vibe Coding" through deterministic hook architecture and cryptographic verification.

---

## 🎯 What is This?

This is a **production-ready implementation** of an Intent-Code Traceability System built on top of [Roo Code](https://github.com/RooVetGit/Roo-Cline), transforming it from a chat-based AI assistant into a **governed AI-Native IDE**.

### The Problem We Solve

Traditional AI coding assistants suffer from:

- ❌ **Context Rot**: AI generates code without understanding architectural constraints
- ❌ **Vibe Coding**: Developers blindly accept AI output without verification
- ❌ **Trust Debt**: No way to verify what the AI actually changed and why
- ❌ **Cognitive Debt**: Knowledge loses "stickiness" when humans skim AI output

### Our Solution

✅ **Intent-Driven Architecture**: AI must declare intent before writing code  
✅ **Cryptographic Verification**: SHA-256 content hashing for spatial independence  
✅ **Deterministic Hooks**: Intercept every tool execution for governance  
✅ **Mutation Classification**: Distinguish refactors from new features mathematically  
✅ **Append-Only Audit Trail**: Immutable trace linking Intent → Code → Agent Action

---

## 🏆 Achievement

**TRP1 Week 1 Interim Submission**: **100/100** ✨

- Phase 0 (Architectural Analysis): Perfect Score
- Phase 1 & 2 (Reasoning Loop): Perfect Score
- Visual System Blueprint: Perfect Score

---

## 🎬 Quick Demo

```bash
# 1. Agent tries to write without intent
Agent: write_file("src/auth.ts")
Hook: ❌ BLOCKED - "You must call select_active_intent first"

# 2. Agent selects intent
Agent: select_active_intent("INT-001")
Hook: ✅ Loaded context for "JWT Authentication Migration"

# 3. Agent writes with context
Agent: write_file("src/auth.ts")
Hook: ✅ Allowed (in scope: src/auth/**)
Trace: {
  "intentId": "INT-001",
  "contentHash": "sha256:abc123...",
  "mutationClass": "AST_REFACTOR"
}
```

---

## 🏗️ Architecture

### The Two-Stage State Machine

```
┌─────────────────────────────────────────────────────────┐
│  STATE 1: User Request                                   │
│  "Refactor the auth middleware"                         │
└────────────────────────┬────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────┐
│  STATE 2: The Handshake (Reasoning Intercept)           │
│  Agent MUST call: select_active_intent("INT-001")       │
│  PreHook loads context from active_intents.yaml         │
│  Returns XML block with constraints and scope           │
└────────────────────────┬────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────┐
│  STATE 3: Contextualized Action                         │
│  Agent writes code with full context                    │
│  PreHook validates scope                                │
│  PostHook logs trace with content hash                  │
└─────────────────────────────────────────────────────────┘
```

### Hook System

```
Tool Execution Request
         │
         ↓
    ┌─────────┐
    │ PreHook │ → Gatekeeper + Scope Validation + Optimistic Locking
    └────┬────┘
         │ blocked: false
         ↓
    Execute Tool
         │
         ↓
    ┌──────────┐
    │ PostHook │ → Content Hashing + Mutation Classification + Trace Logging
    └──────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20.19.2+ (or 22.x)
- pnpm 10.8.1+
- VS Code 1.80+

### Installation

```bash
# Clone repository
git clone https://github.com/IbnuEyni/Roo-Code.git
cd Roo-Code

# Checkout feature branch
git checkout feature/intent-traceability-system

# Install dependencies
pnpm install

# Build extension
cd src && pnpm bundle

# Launch in VS Code
# Press F5 to start extension development host
```

### First Run

1. Open a test workspace in the extension host
2. Create `.orchestration/active_intents.yaml`:

```yaml
- id: "INT-001"
  description: "Your first intent"
  scope:
      - "src/**"
  status: "active"
```

3. Ask the AI: "Call select_active_intent with intent_id INT-001"
4. Now you can write code within the defined scope!

---

## 📁 Project Structure

```
Roo-Code/
├── src/
│   ├── hooks/                          # 🔥 Our Hook System
│   │   ├── types.ts                    # TypeScript interfaces
│   │   ├── HookEngine.ts               # Orchestrator (singleton)
│   │   ├── PreToolHook.ts              # Gatekeeper + scope validation
│   │   ├── PostToolHook.ts             # Trace logging + hashing
│   │   ├── IntentManager.ts            # YAML loader + scope matcher
│   │   ├── TraceLogger.ts              # JSONL writer
│   │   ├── ContentHasher.ts            # SHA-256 utility
│   │   └── CommandClassifier.ts        # Safe vs Destructive
│   │
│   ├── core/
│   │   ├── assistant-message/
│   │   │   └── presentAssistantMessage.ts  # Hook integration
│   │   ├── tools/
│   │   │   └── SelectActiveIntentTool.ts   # New tool
│   │   └── prompts/
│   │       └── sections/objective.ts       # Modified system prompt
│   │
│   └── shared/
│       └── tools.ts                    # Tool type definitions
│
└── .speckit/
    ├── constitution.md                 # Project principles
    └── specs/
        ├── INT-001-hook-infrastructure.md
        ├── INT-002-intent-management.md
        └── INT-003-traceability-layer.md
```

---

## 🎯 Key Features

### ✅ Phase 1: The Handshake

- **select_active_intent Tool**: Mandatory before any write operation
- **Context Injection**: Loads constraints and scope from YAML
- **System Prompt Modification**: Enforces Intent-Driven protocol
- **Gatekeeper Logic**: Blocks writes without valid intent

### ✅ Phase 2: Hook Middleware & Security

- **Command Classification**: Safe (read) vs Destructive (write)
- **Content Hashing**: SHA-256 for spatial independence
- **Mutation Classification**: AST_REFACTOR | INTENT_EVOLUTION | FILE_CREATION
- **Optimistic Locking**: Pre-write hash for concurrency control
- **Enhanced Trace Schema**: Full traceability with intentId correlation

### 🚧 Phase 3: Parallel Orchestration (Coming Soon)

- Stale file detection
- Shared brain (CLAUDE.md)
- Conflict resolution
- .intentignore support

### 🚧 Phase 4: Testing & Demo (Coming Soon)

- Parallel session demo video
- intent_map.md generation
- End-to-end integration tests

---

## 📊 Data Model

### active_intents.yaml

```yaml
- id: "INT-001"
  description: "JWT Authentication Migration"
  scope:
      - "src/auth/**"
      - "src/middleware/jwt.ts"
  constraints:
      - "Must not use external auth providers"
      - "Must maintain backward compatibility"
  status: "active"
```

### agent_trace.jsonl (Enhanced Schema)

```json
{
	"timestamp": "2026-02-18T20:30:00.000Z",
	"toolName": "write_to_file",
	"filePath": "src/auth/middleware.ts",
	"contentHash": "sha256:a8f5f167f44f4964e6c998dee827110c",
	"mutationClass": "AST_REFACTOR",
	"intentId": "INT-001",
	"result": "success"
}
```

---

## 🧪 Testing

### Run Tests

```bash
cd Roo-Code

# Type checking
pnpm run check-types

# Linting
pnpm run lint

# Build
cd src && pnpm bundle
```

### Manual Integration Tests

See [QUICK_TEST_CARD.md](QUICK_TEST_CARD.md) for step-by-step testing instructions.

**Test Results**: ✅ All 5 tests passing

- Gatekeeper blocks without intent
- select_active_intent loads context
- In-scope writes succeed
- Out-of-scope writes blocked
- Trace logging works

---

## 📚 Documentation

- [INTERIM_SUBMISSION_REPORT.md](INTERIM_SUBMISSION_REPORT.md) - Complete architectural analysis (947 lines)
- [QUICK_TEST_CARD.md](QUICK_TEST_CARD.md) - Testing instructions
- [PDF_CONVERSION_GUIDE.md](PDF_CONVERSION_GUIDE.md) - How to generate PDF report
- [.speckit/constitution.md](Roo-Code/.speckit/constitution.md) - Project principles

---

## 🎓 Academic Context

This project was developed as part of **TRP1 Challenge Week 1: Architecting the AI-Native IDE** at 10 Academy.

**Challenge Objectives**:

- Solve the Context Paradox in AI-assisted development
- Implement Intent-Code Traceability
- Prevent "Vibe Coding" through governance
- Enable cryptographic verification of AI-generated code

**Key Concepts**:

- Intent Formalization ([arXiv:2406.09757](https://arxiv.org/abs/2406.09757))
- AI-Native Version Control ([git-ai](https://github.com/git-ai/git-ai))
- Context Engineering ([Anthropic Research](https://www.anthropic.com/research))
- Cognitive Debt ([MIT Paper](http://sunnyday.mit.edu/papers/intent-tse.pdf))

---

## 🤝 Contributing

This is an academic project, but contributions are welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

**Commit Convention**: We use [Conventional Commits](https://www.conventionalcommits.org/)

---

## 📈 Code Quality

- **TypeScript Errors**: 0
- **ESLint Warnings**: 0
- **Test Coverage**: Manual integration tests (100% pass rate)
- **Lines of Code**: ~800 (hooks + tools + specs)
- **Commits**: 22+ with conventional commit format

---

## 🙏 Acknowledgments

- **Roo Code Team** - Original extension
- **Anthropic** - Claude API and research on context engineering
- **Boris Cherny** - Parallel agent orchestration patterns
- **10 Academy** - TRP1 Challenge design

---

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

---

## 📞 Contact

**GitHub**: [@IbnuEyni](https://github.com/IbnuEyni)  
**Repository**: [Roo-Code](https://github.com/IbnuEyni/Roo-Code)  
**Branch**: `feature/intent-traceability-system`

---

## ⭐ Star History

If you find this project useful, please consider giving it a star! ⭐

---

**Built with ❤️ for AI-Native Development**
