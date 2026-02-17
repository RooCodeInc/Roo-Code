# Roo Code Architecture Analysis - Phase 0

## Executive Summary

Roo Code is an enterprise-grade VS Code extension that transforms the IDE into an AI-native development environment. It provides autonomous coding agents with tool execution capabilities, multi-modal interactions, and sophisticated context management.

---

## 1. High-Level Architecture

### 1.1 Three-Tier Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    WEBVIEW LAYER (UI)                       │
│  - React-based UI (webview-ui/)                             │
│  - Presentation logic only                                  │
│  - Communicates via postMessage                             │
└─────────────────────────────────────────────────────────────┘
                            ↕ postMessage
┌─────────────────────────────────────────────────────────────┐
│              EXTENSION HOST (Business Logic)                │
│  - ClineProvider (src/core/webview/ClineProvider.ts)        │
│  - Task orchestration (src/core/task/Task.ts)               │
│  - Tool execution engine                                    │
│  - API management & LLM communication                       │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                   VS CODE API LAYER                         │
│  - File system operations                                   │
│  - Terminal management                                      │
│  - Editor control                                           │
│  - Workspace management                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Core Components

### 2.1 Extension Entry Point (`src/extension.ts`)

**Activation Flow:**

1. **Environment Setup**: Loads `.env` configuration
2. **Service Initialization**:
    - Network proxy configuration
    - Telemetry service (PostHog)
    - MDM (Mobile Device Management) service
    - Cloud service integration
3. **Context Management**:
    - ContextProxy initialization
    - Code index managers for workspace folders
4. **Provider Registration**:
    - ClineProvider (main orchestrator)
    - Webview view provider
    - URI handlers
    - Code action providers
5. **Command Registration**: All VS Code commands

**Key Services:**

- `CloudService`: Manages authentication, remote control, and cloud sync
- `TelemetryService`: Tracks usage metrics
- `CodeIndexManager`: Maintains semantic code search indices
- `McpServerManager`: Model Context Protocol server management
- `TerminalRegistry`: Terminal lifecycle management

---

### 2.2 ClineProvider (`src/core/webview/ClineProvider.ts`)

**Role**: Central orchestrator bridging UI and business logic

**Responsibilities:**

- Webview lifecycle management
- Message routing between UI and extension host
- Task creation and management
- State synchronization
- API configuration management
- Profile management (provider settings, custom modes)

**Message Flow:**

```
User Input (Webview)
    → postMessage
    → ClineProvider.handleWebviewMessage()
    → Task.execute()
    → Tool execution
    → Results back to Webview
```

---

### 2.3 Task System (`src/core/task/Task.ts`)

**Purpose**: Represents a single conversation/task session with the AI agent

**Key Features:**

- **Conversation Management**: Maintains message history
- **Tool Orchestration**: Coordinates tool execution
- **Context Tracking**: Manages file context and workspace state
- **Approval Flow**: Human-in-the-loop authorization
- **State Persistence**: Saves/loads task state

**Task Lifecycle:**

1. User submits prompt
2. Task analyzes context
3. LLM generates response with tool calls
4. Tools execute (with approval if needed)
5. Results fed back to LLM
6. Loop continues until completion

---

## 3. Tool Execution Architecture

### 3.1 Tool System Design

**Base Architecture:**

```typescript
BaseTool<TName extends ToolName>
    ├── execute(params, task, callbacks): Promise<void>
    ├── handlePartial(task, block): Promise<void>  // Streaming support
    └── handle(task, block, callbacks): Promise<void>  // Entry point
```

**Tool Execution Flow:**

```
1. LLM Response → ToolUse block (native tool calling)
2. BaseTool.handle() → Entry point
3. If partial → handlePartial() → UI updates
4. If complete → execute() → Full execution
5. Callbacks:
   - askApproval() → Human authorization
   - pushToolResult() → Send result to LLM
   - handleError() → Error handling
```

### 3.2 Available Tools (src/core/tools/)

**File Operations:**

- `WriteToFileTool`: Create/modify files with diff preview
- `ReadFileTool`: Read file contents
- `EditFileTool`: Apply targeted edits
- `ApplyPatchTool`: Apply unified diff patches
- `SearchReplaceTool`: Search and replace in files

**Code Intelligence:**

- `CodebaseSearchTool`: Semantic code search
- `SearchFilesTool`: File name search
- `ListFilesTool`: Directory listing

**Execution:**

- `ExecuteCommandTool`: Run shell commands
- `ReadCommandOutputTool`: Read terminal output

**Workflow:**

- `AskFollowupQuestionTool`: Request clarification
- `AttemptCompletionTool`: Mark task complete
- `NewTaskTool`: Delegate to new task
- `UpdateTodoListTool`: Manage task checklist

**Advanced:**

- `UseMcpToolTool`: Execute MCP server tools
- `SkillTool`: Run custom skills
- `GenerateImageTool`: Create images

---

### 3.3 Tool Execution Hook Points

**Current Architecture (Pre-Hook):**

```typescript
// In Task.ts - processToolUse()
async processToolUse(block: ToolUse) {
    const tool = this.getToolInstance(block.name)

    // ⚠️ NO HOOK HERE - Direct execution
    await tool.handle(this, block, {
        askApproval: this.askApproval.bind(this),
        handleError: this.handleError.bind(this),
        pushToolResult: this.pushToolResult.bind(this),
    })
}
```

**Identified Hook Injection Points:**

1. **Pre-Tool Execution Hook** (Before tool.handle()):

    - Intent validation
    - Context injection
    - Scope enforcement
    - Authorization checks

2. **Post-Tool Execution Hook** (After pushToolResult()):
    - Trace logging
    - Content hashing
    - Documentation updates
    - State evolution tracking

---

## 4. Prompt System

### 4.1 System Prompt Construction (`src/core/prompts/`)

**Location**: `src/core/prompts/system.ts`

**Components:**

- Base instructions
- Tool definitions (JSON schemas)
- Mode-specific rules
- Custom rules from `.roo/rules/`
- Context constraints

**Prompt Assembly:**

```
System Prompt =
    Base Instructions +
    Tool Schemas +
    Mode Rules +
    Custom Rules +
    Active Context
```

**Hook Opportunity**: Inject intent context into system prompt before LLM call

---

## 5. Context Management

### 5.1 Context Tracking (`src/core/context-tracking/`)

**FileContextTracker**:

- Tracks which files are relevant to current task
- Records access patterns
- Maintains context window budget

**Context Sources:**

- User mentions (`@file`, `@folder`)
- Tool operations (read, write)
- Diagnostic errors
- Search results

### 5.2 Context Proxy (`src/core/config/ContextProxy.ts`)

**Purpose**: Unified interface for global/workspace state

**Capabilities:**

- Settings management
- State persistence
- Profile management
- Secret storage

---

## 6. Data Flow Analysis

### 6.1 Tool Execution Data Flow

```
┌──────────────┐
│ User Prompt  │
└──────┬───────┘
       ↓
┌──────────────────────────────────────┐
│ ClineProvider.handleWebviewMessage() │
└──────┬───────────────────────────────┘
       ↓
┌──────────────────┐
│ Task.execute()   │ ← System Prompt Construction
└──────┬───────────┘
       ↓
┌──────────────────┐
│ API.sendMessage()│ → LLM Request
└──────┬───────────┘
       ↓
┌──────────────────────┐
│ LLM Response Stream  │
└──────┬───────────────┘
       ↓
┌──────────────────────────┐
│ Task.processToolUse()    │ ⚠️ HOOK POINT #1 (Pre-Tool)
└──────┬───────────────────┘
       ↓
┌──────────────────────────┐
│ BaseTool.handle()        │
│   ├─ handlePartial()     │ (streaming)
│   └─ execute()           │ (complete)
└──────┬───────────────────┘
       ↓
┌──────────────────────────┐
│ Callbacks:               │
│   ├─ askApproval()       │ → Human authorization
│   ├─ pushToolResult()    │ ⚠️ HOOK POINT #2 (Post-Tool)
│   └─ handleError()       │
└──────┬───────────────────┘
       ↓
┌──────────────────────────┐
│ Back to LLM (next turn)  │
└──────────────────────────┘
```

---

## 7. Storage & Persistence

### 7.1 Current Storage Locations

**Global State** (`~/.vscode/globalStorage/`):

- User settings
- API configurations
- Task history
- Allowed commands

**Workspace State**:

- Task-specific data
- Checkpoints
- Custom modes

**Task Storage** (`~/.roo-code/tasks/`):

- Conversation history
- Tool results
- Context snapshots

### 7.2 Proposed `.orchestration/` Structure

**New Directory**: `<workspace>/.orchestration/`

**Files to Create:**

- `active_intents.yaml` - Intent specifications
- `agent_trace.jsonl` - Append-only ledger
- `intent_map.md` - Spatial mapping
- `CLAUDE.md` - Shared brain

---

## 8. Critical Files for Hook Implementation

### 8.1 Files to Modify

| File                                | Purpose             | Modification                            |
| ----------------------------------- | ------------------- | --------------------------------------- |
| `src/core/task/Task.ts`             | Task orchestration  | Inject hook calls in `processToolUse()` |
| `src/core/tools/BaseTool.ts`        | Tool base class     | Add hook callbacks                      |
| `src/core/prompts/system.ts`        | Prompt construction | Inject intent context                   |
| `src/core/webview/ClineProvider.ts` | Provider            | Initialize hook engine                  |

### 8.2 New Files to Create

```
src/hooks/
├── HookEngine.ts              # Main hook orchestrator
├── PreToolHook.ts             # Pre-execution hooks
├── PostToolHook.ts            # Post-execution hooks
├── IntentManager.ts           # Intent CRUD operations
├── TraceLogger.ts             # Agent trace writer
└── types.ts                   # Hook type definitions

.orchestration/
├── active_intents.yaml        # Intent specifications
├── agent_trace.jsonl          # Execution ledger
├── intent_map.md              # Spatial mapping
└── CLAUDE.md                  # Shared knowledge
```

---

## 9. Monorepo Structure

### 9.1 Workspace Organization

```
Roo-Code/
├── src/                       # Main extension
├── webview-ui/                # React UI
├── packages/
│   ├── core/                  # Core utilities
│   ├── cloud/                 # Cloud services
│   ├── telemetry/             # Analytics
│   ├── types/                 # Shared types
│   └── ipc/                   # Inter-process communication
└── apps/
    ├── cli/                   # CLI tool
    └── web-roo-code/          # Web interface
```

**Build System**: Turborepo + pnpm workspaces

---

## 10. Key Insights for Hook Implementation

### 10.1 Advantages

✅ **Clean Tool Architecture**: BaseTool pattern makes hook injection straightforward
✅ **Callback System**: Existing callback pattern aligns with hook design
✅ **Type Safety**: Full TypeScript with strict typing
✅ **Monorepo**: Shared packages enable clean separation
✅ **Active Development**: Modern codebase with good practices

### 10.2 Challenges

⚠️ **Streaming Complexity**: Partial tool calls require careful hook timing
⚠️ **State Management**: Multiple state layers (global, workspace, task)
⚠️ **Async Flows**: Promise-based architecture needs careful error handling
⚠️ **Backward Compatibility**: Must not break existing functionality

### 10.3 Hook Integration Strategy

**Phase 1: Minimal Viable Hook**

1. Create `HookEngine` class
2. Inject into `Task.processToolUse()`
3. Implement basic Pre/Post hooks
4. Add `.orchestration/` directory creation

**Phase 2: Intent System**

1. Create `active_intents.yaml` schema
2. Implement `select_active_intent` tool
3. Add intent validation in Pre-Hook
4. Inject context into system prompt

**Phase 3: Traceability**

1. Implement `agent_trace.jsonl` writer
2. Add content hashing utility
3. Log all tool executions in Post-Hook
4. Link intents to code changes

**Phase 4: Orchestration**

1. Add optimistic locking
2. Implement parallel session detection
3. Create `CLAUDE.md` shared brain
4. Add lesson recording

---

## 11. Next Steps

### Immediate Actions:

1. ✅ **Complete**: Architecture analysis
2. **Next**: Design hook engine interface
3. **Then**: Implement minimal hook infrastructure
4. **Finally**: Add intent management system

### Development Environment Setup:

```bash
cd Roo-Code
pnpm install
# Press F5 in VS Code to launch extension development host
```

---

## 12. References

**Key Documentation:**

- VS Code Extension API: https://code.visualstudio.com/api
- Anthropic SDK: Used for Claude integration
- MCP Protocol: Model Context Protocol for tool servers

**Related Files:**

- Extension manifest: `src/package.json`
- Main entry: `src/extension.ts`
- Task orchestration: `src/core/task/Task.ts`
- Tool system: `src/core/tools/`
- Prompts: `src/core/prompts/`

---

**Document Version**: 1.0  
**Date**: 2025-02-16  
**Author**: Phase 0 Archaeological Dig  
**Status**: Complete - Ready for Phase 1
