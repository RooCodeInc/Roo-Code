# Project Constitution: Intent-Code Traceability System

**Project**: TRP1 Challenge Week 1 - AI-Native IDE with Intent Traceability  
**Repository**: https://github.com/IbnuEyni/Roo-Code  
**Branch**: feature/intent-traceability-system  
**Created**: 2025-02-17  
**Status**: Active

---

## 1. Project Vision

Transform Roo Code from a traditional AI coding assistant into an **AI-Native IDE** with formal Intent-Code Traceability, eliminating "vibe coding" and establishing governed, verifiable development workflows.

### Core Problem

Traditional version control tracks **what** changed and **when**, but is blind to **why** (Intent) and **structural identity** (AST). When AI agents modify 50 files, Git sees 50 unrelated diffs with no semantic understanding.

### Solution

Implement a **Hook-Based Governance System** that:

- Enforces intent-first workflows
- Traces every code change to business requirements
- Maintains spatial independence via content hashing
- Enables parallel agent orchestration

---

## 2. Architectural Principles

### 2.1 Minimal Intervention

**Principle**: Hooks must be non-invasive and backward-compatible.

**Rules**:

- ✅ Wrap existing tool execution, don't replace
- ✅ Fail gracefully if `.orchestration/` doesn't exist
- ✅ All existing tests must pass
- ❌ No breaking changes to public APIs

**Rationale**: Existing Roo Code users must not be affected.

### 2.2 Type Safety First

**Principle**: All interfaces must be strictly typed.

**Rules**:

- ✅ Use TypeScript strict mode
- ✅ Define Zod schemas for runtime validation
- ✅ No `any` types except in legacy integration points
- ✅ Export all types from `src/hooks/types.ts`

**Rationale**: Enterprise code requires compile-time guarantees.

### 2.3 Single Responsibility

**Principle**: Each component has one clear purpose.

**Rules**:

- ✅ HookEngine: Orchestration only
- ✅ PreToolHook: Validation and context injection
- ✅ PostToolHook: Logging and traceability
- ✅ IntentManager: CRUD operations on intents
- ✅ TraceLogger: Append-only ledger writes

**Rationale**: Maintainability and testability.

### 2.4 Fail-Safe Design

**Principle**: Hooks never crash the agent.

**Rules**:

- ✅ All hook operations wrapped in try-catch
- ✅ Errors logged, not thrown
- ✅ Graceful degradation if files missing
- ✅ Agent continues even if hook fails

**Rationale**: Governance should enhance, not block, development.

### 2.5 Performance Conscious

**Principle**: Hooks add <100ms latency per tool execution.

**Rules**:

- ✅ Async operations only
- ✅ Cache intent data in memory
- ✅ Batch file operations
- ✅ No synchronous blocking

**Rationale**: User experience must not degrade.

---

## 3. Data Model Principles

### 3.1 Immutable Ledger

**Principle**: `agent_trace.jsonl` is append-only.

**Rules**:

- ✅ Never modify existing entries
- ✅ One line per mutation
- ✅ Include content hash for spatial independence
- ❌ No deletions or updates

**Rationale**: Audit trail integrity.

### 3.2 Human-Readable Specs

**Principle**: `active_intents.yaml` must be editable by humans.

**Rules**:

- ✅ YAML format (not JSON)
- ✅ Comments allowed
- ✅ Validated on load, not on save
- ✅ Clear error messages

**Rationale**: Developers need to understand and modify intents.

### 3.3 Content Addressing

**Principle**: Use SHA-256 hashes for spatial independence.

**Rules**:

- ✅ Hash code content, not file paths
- ✅ Store hash in trace entries
- ✅ Enable code movement detection
- ❌ Don't rely on line numbers alone

**Rationale**: Code moves, hashes don't.

---

## 4. Security & Privacy

### 4.1 No Credential Storage

**Principle**: Hooks never access or store credentials.

**Rules**:

- ✅ Read-only access to workspace files
- ✅ Write only to `.orchestration/`
- ❌ No network requests
- ❌ No credential scanning

**Rationale**: Security and trust.

### 4.2 Workspace Isolation

**Principle**: Each workspace has independent state.

**Rules**:

- ✅ `.orchestration/` per workspace
- ✅ No global state sharing
- ✅ No cross-workspace access

**Rationale**: Multi-workspace support.

---

## 5. Testing Standards

### 5.1 Test Coverage

**Principle**: All hook logic must be tested.

**Requirements**:

- ✅ Unit tests for each hook class
- ✅ Integration tests for full flow
- ✅ Edge case coverage (missing files, invalid YAML)
- ✅ Minimum 80% code coverage

### 5.2 Test Isolation

**Principle**: Tests don't depend on external state.

**Rules**:

- ✅ Mock file system operations
- ✅ Use temporary directories
- ✅ Clean up after each test
- ✅ No shared test state

---

## 6. Code Style

### 6.1 Naming Conventions

```typescript
// Classes: PascalCase
class HookEngine {}

// Interfaces: PascalCase with 'I' prefix (optional)
interface PreHookContext {}

// Functions: camelCase
async function executePreHook() {}

// Constants: UPPER_SNAKE_CASE
const MAX_INTENT_SCOPE = 100

// Files: kebab-case or PascalCase
// hook-engine.ts OR HookEngine.ts
```

### 6.2 File Organization

```
src/hooks/
├── index.ts              # Public exports
├── types.ts              # Type definitions
├── HookEngine.ts         # Main orchestrator
├── PreToolHook.ts        # Pre-execution
├── PostToolHook.ts       # Post-execution
├── IntentManager.ts      # Intent CRUD
├── TraceLogger.ts        # Trace writer
├── ContentHasher.ts      # Hashing utility
├── schemas/
│   └── intent.schema.ts  # Zod schemas
└── __tests__/
    └── *.spec.ts         # Tests
```

### 6.3 Import Order

```typescript
// 1. Node built-ins
import fs from "fs/promises"
import path from "path"

// 2. External dependencies
import { z } from "zod"
import yaml from "yaml"

// 3. Internal packages
import { Task } from "../core/task/Task"
import type { ToolName } from "@roo-code/types"

// 4. Relative imports
import { HookEngine } from "./HookEngine"
import type { PreHookContext } from "./types"
```

---

## 7. Documentation Standards

### 7.1 Code Comments

**When to comment**:

- ✅ Complex algorithms
- ✅ Non-obvious business logic
- ✅ Workarounds for bugs
- ✅ Public API documentation

**When NOT to comment**:

- ❌ Obvious code
- ❌ Redundant descriptions
- ❌ Outdated information

### 7.2 JSDoc for Public APIs

```typescript
/**
 * Executes pre-hook validation and context injection.
 *
 * @param context - Tool execution context
 * @returns Result indicating if execution should proceed
 * @throws Never - All errors are caught and logged
 */
async execute(context: PreHookContext): Promise<PreHookResult>
```

---

## 8. Git Workflow

### 8.1 Commit Messages

Format: `<type>(<scope>): <subject>`

**Types**:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `test`: Tests
- `refactor`: Code refactoring
- `chore`: Maintenance

**Examples**:

```
feat(hooks): add HookEngine infrastructure
test(hooks): add IntentManager unit tests
docs: update architecture with hook system
fix(hooks): handle missing .orchestration directory
```

### 8.2 Branch Strategy

- `main`: Stable code
- `feature/intent-traceability-system`: Our work
- No direct commits to main

---

## 9. Dependencies

### 9.1 Allowed Dependencies

**Already in package.json**:

- ✅ `zod` - Schema validation
- ✅ `yaml` - YAML parsing
- ✅ `simple-git` - Git operations
- ✅ `crypto` (Node built-in) - Hashing

**Not allowed**:

- ❌ No new external dependencies without justification
- ❌ No heavy libraries (>1MB)

### 9.2 Dependency Principles

- Prefer Node.js built-ins
- Use existing Roo Code dependencies
- Minimize bundle size impact

---

## 10. Success Criteria

### 10.1 Functional Requirements

- ✅ Agent must call `select_active_intent` before writes
- ✅ Pre-hook blocks out-of-scope file modifications
- ✅ Post-hook logs all mutations to `agent_trace.jsonl`
- ✅ Content hashes enable spatial independence
- ✅ Parallel agents detect conflicts

### 10.2 Quality Requirements

- ✅ All existing tests pass
- ✅ New tests achieve 80%+ coverage
- ✅ TypeScript compiles with no errors
- ✅ ESLint passes with no warnings
- ✅ Build succeeds

### 10.3 Performance Requirements

- ✅ Hook overhead <100ms per tool execution
- ✅ Intent file loads cached in memory
- ✅ No blocking operations on main thread

### 10.4 Documentation Requirements

- ✅ README with setup instructions
- ✅ Architecture documentation
- ✅ API documentation for hooks
- ✅ Demo video (5 minutes)

---

## 11. Non-Goals

**What we are NOT building**:

- ❌ Full AST parsing (use content hashing instead)
- ❌ GitHub integration (local files only)
- ❌ UI for intent management (YAML editing)
- ❌ Real-time collaboration
- ❌ Cloud synchronization

**Rationale**: 1-week timeline requires focus.

---

## 12. Risk Mitigation

### Risk 1: Breaking Existing Functionality

**Mitigation**: Extensive testing, backward compatibility

### Risk 2: Performance Degradation

**Mitigation**: Async operations, caching, benchmarking

### Risk 3: Complex Edge Cases

**Mitigation**: Start simple, iterate, document limitations

---

## 13. Acceptance Criteria

**This project is complete when**:

1. ✅ Hook system intercepts all tool executions
2. ✅ Intent-first workflow enforced
3. ✅ All mutations logged with content hashes
4. ✅ Demo video shows parallel orchestration
5. ✅ All tests pass
6. ✅ Documentation complete
7. ✅ PR ready for review

---

**Constitution Status**: Active  
**Last Updated**: 2025-02-17  
**Next Review**: After Phase 1 implementation
