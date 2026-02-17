# Roo Code - Quick Architecture Reference

## 🎯 What is Roo Code?

An **AI-native VS Code extension** that turns your IDE into an autonomous coding environment. Think of it as having an AI developer that can:

- Read and write files
- Execute commands
- Search codebases
- Ask for clarification
- Complete tasks autonomously

---

## 🏗️ Architecture in 3 Layers

### Layer 1: **Webview (UI)**

- React-based chat interface
- Located in `webview-ui/`
- **Restriction**: Presentation only, no business logic
- **Communication**: postMessage API

### Layer 2: **Extension Host (Brain)**

- Core business logic in `src/`
- **ClineProvider**: Main orchestrator
- **Task**: Conversation manager
- **Tools**: 20+ capabilities (read, write, execute, etc.)
- **API**: LLM communication

### Layer 3: **VS Code API**

- File system, terminal, editor control
- Provided by VS Code

---

## 🔧 How Tools Work

### Current Flow (No Hooks):

```
User: "Create a login page"
    ↓
ClineProvider receives message
    ↓
Task.execute() → Builds prompt → Sends to LLM
    ↓
LLM responds: "I'll use write_to_file tool"
    ↓
Task.processToolUse() → ⚠️ NO HOOK HERE
    ↓
WriteToFileTool.execute() → Creates file
    ↓
Result sent back to LLM
    ↓
LLM: "Task complete!"
```

### Where We'll Add Hooks:

```
Task.processToolUse() {
    // 🎣 PRE-HOOK: Before tool execution
    await hookEngine.preToolUse(toolName, params)

    // Original tool execution
    await tool.handle(...)

    // 🎣 POST-HOOK: After tool execution
    await hookEngine.postToolUse(toolName, result)
}
```

---

## 📁 Key Files Explained

### **src/extension.ts**

- Entry point when extension activates
- Initializes all services
- Registers commands
- Sets up providers

### **src/core/webview/ClineProvider.ts**

- Central orchestrator (1,500+ lines)
- Manages webview lifecycle
- Routes messages
- Creates tasks

### **src/core/task/Task.ts**

- Represents one conversation
- Manages LLM interaction loop
- Coordinates tool execution
- Handles approvals

### **src/core/tools/BaseTool.ts**

- Abstract base for all tools
- Defines execution interface
- Handles streaming (partial updates)
- Type-safe parameters

### **src/core/tools/WriteToFileTool.ts**

- Example tool implementation
- Shows diff preview
- Requests approval
- Tracks file changes

### **src/core/prompts/system.ts**

- Constructs system prompt
- Includes tool definitions
- Adds mode-specific rules
- **Hook opportunity**: Inject intent context here

---

## 🛠️ Available Tools (20+)

**File Operations:**

- write_to_file, read_file, edit_file
- apply_patch, search_replace

**Code Intelligence:**

- codebase_search, search_files, list_files

**Execution:**

- execute_command, read_command_output

**Workflow:**

- ask_followup_question
- attempt_completion
- new_task (delegation)
- update_todo_list

**Advanced:**

- use_mcp_tool (Model Context Protocol)
- skill (custom capabilities)
- generate_image

---

## 🎯 Hook Implementation Plan

### What We Need to Build:

```
src/hooks/
├── HookEngine.ts           # Main coordinator
├── PreToolHook.ts          # Before execution
├── PostToolHook.ts         # After execution
├── IntentManager.ts        # Manage intents
└── TraceLogger.ts          # Log to agent_trace.jsonl

.orchestration/             # New directory in workspace
├── active_intents.yaml     # What we're working on
├── agent_trace.jsonl       # Execution history
├── intent_map.md           # Code → Intent mapping
└── CLAUDE.md               # Shared knowledge base
```

### Hook Responsibilities:

**Pre-Hook (Before Tool Execution):**

1. Validate intent ID is declared
2. Load intent constraints from `active_intents.yaml`
3. Check file scope permissions
4. Inject context into prompt
5. Request human approval if needed

**Post-Hook (After Tool Execution):**

1. Calculate content hash (SHA-256)
2. Classify mutation type (refactor vs new feature)
3. Write to `agent_trace.jsonl`
4. Update `intent_map.md`
5. Record lessons in `CLAUDE.md`

---

## 🔍 Critical Insights

### ✅ What Makes This Easy:

- **Clean architecture**: Well-separated concerns
- **Type safety**: Full TypeScript with strict types
- **Callback pattern**: Already has approval flow
- **Monorepo**: Can create isolated packages
- **Active project**: Modern, maintained codebase

### ⚠️ What Makes This Hard:

- **Streaming**: Tools receive partial updates during LLM streaming
- **Async complexity**: Everything is Promise-based
- **State management**: Multiple layers (global, workspace, task)
- **Backward compatibility**: Can't break existing users

---

## 🚀 Development Workflow

### Setup:

```bash
cd Roo-Code
pnpm install
```

### Run Extension:

1. Open `Roo-Code` folder in VS Code
2. Press **F5** (Start Debugging)
3. New VS Code window opens with extension loaded
4. Test your changes

### Build VSIX:

```bash
pnpm vsix
# Creates bin/roo-cline-<version>.vsix
```

### Install Locally:

```bash
code --install-extension bin/roo-cline-<version>.vsix
```

---

## 📊 Data Flow Diagram

```
┌─────────────┐
│ User Types  │ "Create auth middleware"
└──────┬──────┘
       ↓
┌──────────────────┐
│ Webview (React)  │ postMessage
└──────┬───────────┘
       ↓
┌─────────────────────┐
│ ClineProvider       │ handleWebviewMessage()
└──────┬──────────────┘
       ↓
┌─────────────────────┐
│ Task                │ execute()
│ - Build prompt      │
│ - Add context       │
│ - Call LLM          │
└──────┬──────────────┘
       ↓
┌─────────────────────┐
│ LLM (Claude/GPT)    │ Streams response
└──────┬──────────────┘
       ↓
┌─────────────────────┐
│ Task                │ processToolUse()
│ ⚠️ HOOK POINT #1    │ ← Pre-Hook goes here
└──────┬──────────────┘
       ↓
┌─────────────────────┐
│ WriteToFileTool     │ execute()
│ - Show diff         │
│ - Ask approval      │
│ - Write file        │
└──────┬──────────────┘
       ↓
┌─────────────────────┐
│ Task                │ pushToolResult()
│ ⚠️ HOOK POINT #2    │ ← Post-Hook goes here
└──────┬──────────────┘
       ↓
┌─────────────────────┐
│ Back to LLM         │ Next turn
└─────────────────────┘
```

---

## 🎓 Key Concepts

### **Task**

A single conversation session. Has:

- Message history
- Context (files, errors, etc.)
- State (running, paused, completed)
- API configuration

### **Tool**

A capability the AI can use. Examples:

- write_to_file
- execute_command
- codebase_search

### **Provider**

The ClineProvider manages:

- Multiple tasks
- Webview communication
- Settings/profiles
- Cloud sync

### **Context**

Information given to the LLM:

- File contents
- Error messages
- Search results
- User instructions

### **Intent** (What We're Adding)

A business requirement being worked on:

- ID: "INT-001"
- Name: "JWT Authentication"
- Scope: Which files it can modify
- Constraints: Rules to follow
- Status: In progress, complete, etc.

---

## 📝 Next Steps

1. ✅ **Phase 0 Complete**: Architecture mapped
2. **Phase 1**: Design hook engine interface
3. **Phase 2**: Implement basic hooks
4. **Phase 3**: Add intent system
5. **Phase 4**: Implement traceability
6. **Phase 5**: Add parallel orchestration

---

## 🔗 Important Links

- **Repository**: https://github.com/RooCodeInc/Roo-Code
- **VS Code Extension API**: https://code.visualstudio.com/api
- **Your Fork**: https://github.com/IbnuEyni/Roo-Code

---

**Status**: Phase 0 Complete ✅  
**Ready for**: Hook Engine Design
