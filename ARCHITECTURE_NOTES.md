## Phase 0 – The Archaeological Dig: Mapping Roo Code's Nervous System

**Author:** Tsegay Assefa  
**Date:** February 18, 2026  
**Repository:** https://github.com/TsegayIS122123/Roo-Code  
**Status:** Phase 0 Complete - Ready for Interim Submission

---

## 📋 Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Objective of Phase 0](#2-objective-of-phase-0)
3. [My Exploration Process](#3-my-exploration-process)
4. [High-Level Architecture Overview](#4-high-level-architecture-overview)
5. [Instruction 2: Tracing the Tool Loop](#5-instruction-2-tracing-the-tool-loop)
6. [Instruction 3: Locating the Prompt Builder](#6-instruction-3-locating-the-prompt-builder)
7. [Complete Architecture Diagram](#7-complete-architecture-diagram)
8. [Data Flow Analysis](#8-data-flow-analysis)
9. [Identified Hook Insertion Points](#9-identified-hook-insertion-points)
10. [Key Insights & Discoveries](#10-key-insights--discoveries)
11. [Phase 1-4 Implementation Roadmap](#11-phase-1-4-implementation-roadmap)
12. [Conclusion & Phase 0 Status](#12-conclusion--phase-0-status)

---

## 1. Executive Summary

This document presents the findings of my archaeological exploration of the Roo Code codebase. Through systematic investigation, I have successfully mapped the critical paths where tool execution occurs and located the exact points where system prompts are constructed. This foundational knowledge will enable the implementation of an intent-driven hook system that transforms Roo Code into a governed AI-Native IDE.

**Key Discoveries:**

- Located both `execute_command` and `write_to_file` handlers
- Found the exact prompt builder functions in `system.ts`
- Identified 5 strategic hook insertion points
- Mapped the complete execution pipeline from user input to filesystem changes

---

## 2. Objective of Phase 0

As a Forward Deployed Engineer, my mission was to understand Roo Code's internal architecture before implementing any governance features. Phase 0 is purely **discovery and documentation** - no code changes required.

**What I needed to find:**
| Component | Why It Matters |
|-----------|----------------|
| `execute_command` handler | Where terminal commands execute - need to block destructive ones |
| `write_to_file` handler | Where file changes happen - need to enforce scope and trace intent |
| System Prompt builder | Where LLM instructions are created - need to enforce intent-first protocol |
| Tool execution flow | How control flows through the system - where to insert hooks |

**What I actually found** goes beyond these basics - I discovered a well-structured architecture with clear separation of concerns.

---

## 3. My Exploration Process

### 🔍 How I Investigated

I used a systematic approach to explore the codebase:

```bash
# Step 1: Fork and clone
git clone https://github.com/TsegayIS122123/Roo-Code
cd Roo-Code

# Step 2: Install dependencies
npm install -g pnpm
pnpm install

# Step 3: Run in debug mode (F5)
# This opened the Extension Development Host

# Step 4: Search for key terms
# In VS Code, I used Ctrl+Shift+F to search for:
# - "execute_command"
# - "write_file"
# - "system prompt"
# - "buildSystemPrompt"
```

💡 What I Discovered Through Searching
Search Term Files Found Key Findings
execute_command ExecuteCommandTool.ts Complete command execution logic
write_to_file WriteToFileTool.ts File writing with diff preview
SYSTEM_PROMPT system.ts Main prompt builder function
generatePrompt system.ts Core prompt assembly logic 4. High-Level Architecture Overview
After examining the codebase, I've mapped Roo Code's complete execution pipeline:

text
┌─────────────────────────────────────────────────────────────────────────────┐
│ ROO CODE ARCHITECTURE │
│ │
│ USER INTERFACE LAYER │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ │ │
│ │ ┌─────────────┐ ┌──────────────────────────────────────┐ │ │
│ │ │ Webview │◄───────►│ ClineProvider │ │ │
│ │ │ (React) │ postMessage│ (Extension Host Main Entry) │ │ │
│ │ └─────────────┘ └──────────────────────────────────────┘ │ │
│ │ │ │ │ │
│ │ │ │ │ │
│ │ ▼ ▼ │ │
│ │ ┌─────────────────────────────────────────────────────────────┐ │ │
│ │ │ CLINE CORE │ │ │
│ │ │ src/core/Cline.ts │ │ │
│ │ │ │ │ │
│ │ │ • Task Execution Loop: Manages conversation turns │ │ │
│ │ │ • Tool Coordination: Routes tool calls to handlers │ │ │
│ │ │ • State Management: Tracks conversation and file state │ │ │
│ │ │ • Approval Flow: Handles user confirmations │ │ │
│ │ └─────────────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ PROMPT CONSTRUCTION LAYER │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ │ │
│ │ ┌──────────────────────────────────────────────────────────────┐ │ │
│ │ │ PROMPT BUILDER │ │ │
│ │ │ src/core/prompts/system.ts │ │ │
│ │ │ │ │ │
│ │ │ ┌───────────────────────────────────────────────────────┐ │ │ │
│ │ │ │ SYSTEM_PROMPT() - Main entry point │ │ │ │
│ │ │ │ • Validates context │ │ │ │
│ │ │ │ • Determines mode │ │ │ │
│ │ │ │ • Calls generatePrompt() │ │ │ │
│ │ │ └───────────────────────────────────────────────────────┘ │ │ │
│ │ │ │ │ │ │
│ │ │ ▼ │ │ │
│ │ │ ┌───────────────────────────────────────────────────────┐ │ │ │
│ │ │ │ generatePrompt() - Core Assembly │ │ │ │
│ │ │ │ • Role Definition │ │ │ │
│ │ │ │ • Tool Usage Guidelines │ │ │ │
│ │ │ │ • Capabilities Section │ │ │ │
│ │ │ │ • Modes Section │ │ │ │
│ │ │ │ • Skills Section │ │ │ │
│ │ │ │ • Rules Section │ │ │ │
│ │ │ │ • System Info │ │ │ │
│ │ │ │ • Custom Instructions │ │ │ │
│ │ │ └───────────────────────────────────────────────────────┘ │ │ │
│ │ └──────────────────────────────────────────────────────────────┘ │ │
│ │ │ │
│ │ ┌──────────────────────────────────────────────────────────────┐ │ │
│ │ │ SUPPORTING FILES │ │ │
│ │ │ ┌─────────────────────┐ ┌─────────────────────┐ │ │ │
│ │ │ │ responses.ts │ │ types.ts │ │ │ │
│ │ │ │ • Tool response │ │ • Settings │ │ │ │
│ │ │ │ formatting │ │ definitions │ │ │ │
│ │ │ └─────────────────────┘ └─────────────────────┘ │ │ │
│ │ │ ┌─────────────────────┐ ┌─────────────────────┐ │ │ │
│ │ │ │ sections.ts │ │ │ │ │ │
│ │ │ │ • Modular prompt │ │ │ │ │ │
│ │ │ │ components │ │ │ │ │ │
│ │ │ └─────────────────────┘ └─────────────────────┘ │ │ │
│ │ └──────────────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ LLM INTERACTION LAYER │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ │ │
│ │ ┌──────────────────────────────────────────────────────────────┐ │ │
│ │ │ LLM API CALL │ │ │
│ │ │ • Receives structured prompt │ │ │
│ │ │ • Reasons about the task │ │ │
│ │ │ • Selects appropriate tools │ │ │
│ │ │ • Returns tool calls with parameters │ │ │
│ │ └──────────────────────────────────────────────────────────────┘ │ │
│ │ │ │ │
│ │ ▼ │ │
│ │ ┌──────────────────────────────────────────────────────────────┐ │ │
│ │ │ TOOL RESPONSE PROCESSING │ │ │
│ │ │ • Parse tool calls from LLM response │ │ │
│ │ │ • Validate required parameters │ │ │
│ │ │ • Route to appropriate handler │ │ │
│ │ └──────────────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ TOOL EXECUTION LAYER │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ │ │
│ │ ┌──────────────────────────────────────────────────────────────┐ │ │
│ │ │ EXECUTE_COMMAND TOOL │ │ │
│ │ │ src/core/tools/ExecuteCommandTool.ts │ │ │
│ │ │ │ │ │
│ │ │ ┌───────────────────────────────────────────────────────┐ │ │ │
│ │ │ │ execute(params, task, callbacks) │ │ │ │
│ │ │ │ • Validates command against .rooignore │ │ │ │
│ │ │ │ • Requests user approval via askApproval() │ │ │ │
│ │ │ │ • Spawns terminal process │ │ │ │
│ │ │ │ • Captures stdout/stderr │ │ │ │
│ │ │ │ • Returns formatted result to LLM │ │ │ │
│ │ │ └───────────────────────────────────────────────────────┘ │ │ │
│ │ └──────────────────────────────────────────────────────────────┘ │ │
│ │ │ │
│ │ ┌──────────────────────────────────────────────────────────────┐ │ │
│ │ │ WRITE_TO_FILE TOOL │ │ │
│ │ │ src/core/tools/WriteToFileTool.ts │ │ │
│ │ │ │ │ │
│ │ │ ┌───────────────────────────────────────────────────────┐ │ │ │
│ │ │ │ execute(params, task, callbacks) │ │ │ │
│ │ │ │ • Validates path against .rooignore │ │ │ │
│ │ │ │ • Checks if file exists │ │ │ │
│ │ │ │ • Creates directories if needed │ │ │ │
│ │ │ │ • Shows diff preview for approval │ │ │ │
│ │ │ │ • Writes content to filesystem │ │ │ │
│ │ │ │ • Returns success/failure to LLM │ │ │ │
│ │ │ └───────────────────────────────────────────────────────┘ │ │ │
│ │ └──────────────────────────────────────────────────────────────┘ │ │
│ │ │ │
│ │ ┌──────────────────────────────────────────────────────────────┐ │ │
│ │ │ OTHER TOOLS │ │ │
│ │ │ • read_file │ │ │
│ │ │ • list_files │ │ │
│ │ │ • ask_followup_question │ │ │
│ │ │ • attempt_completion │ │ │
│ │ └──────────────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ SYSTEM INTERACTION LAYER │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ │ │
│ │ ┌─────────────────────┐ ┌─────────────────────┐ │ │
│ │ │ FILE SYSTEM │ │ TERMINAL │ │ │
│ │ │ • Read/Write │ │ • Execute commands│ │ │
│ │ │ • Create dirs │ │ • Capture output │ │ │
│ │ └─────────────────────┘ └─────────────────────┘ │ │
│ │ │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│ │
└─────────────────────────────────────────────────────────────────────────────┘ 5. Instruction 2: Tracing the Tool Loop
5.1 The execute_command Handler - Deep Dive
What I Found:
When the LLM decides to run a terminal command, it calls the execute_command tool. This is handled by ExecuteCommandTool.ts.

File Location: src/core/tools/ExecuteCommandTool.ts

Key Code Analysis:

typescript
export class ExecuteCommandTool extends BaseTool<"execute_command"> {
readonly name = "execute_command" as const

    async execute(params: ExecuteCommandParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
        // This function is the EXECUTION BOUNDARY between LLM and OS
        // Every terminal command passes through here
    }

}
What I Discovered About Its Internal Flow:

text
┌─────────────────────────────────────────────────────────────────┐
│ EXECUTE_COMMAND FLOW │
├─────────────────────────────────────────────────────────────────┤
│ │
│ LLM calls execute_command("npm install") │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Step 1: Parameter Validation │ │
│ │ • Check if command exists │ │
│ │ • Unescape HTML entities │ │
│ │ • If missing → return error to LLM │ │
│ └─────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Step 2: .rooignore Check │ │
│ │ • Validate command against ignore patterns │ │
│ │ • If blocked → return rooignore_error │ │
│ └─────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Step 3: User Approval │ │
│ │ • Call askApproval("command", canonicalCommand) │ │
│ │ • Show command to user in UI │ │
│ │ • Wait for user response │ │
│ │ • If rejected → return toolDenied() │ │
│ └─────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Step 4: Terminal Execution │ │
│ │ • Get or create terminal │ │
│ │ • Set working directory │ │
│ │ • Spawn process │ │
│ │ • Set up output capture │ │
│ │ • Handle timeout if configured │ │
│ └─────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Step 5: Output Processing │ │
│ │ • Capture stdout/stderr │ │
│ │ • Compress output for UI │ │
│ │ • If output too large → persist to file │ │
│ │ • Get exit code │ │
│ └─────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Step 6: Return Result to LLM │ │
│ │ • Format output with exit code │ │
│ │ • Include artifact ID if persisted │ │
│ │ • Send back via pushToolResult() │ │
│ └─────────────────────────────────────────────────────────┘ │
│ │
└─────────────────────────────────────────────────────────────────┘
Why This Matters for Intent-Driven Development:

Current Behavior What We'll Change
Only checks .rooignore Will also check if intent selected
Asks user approval Will add intent validation before approval
Returns output Will record execution in trace ledger
Strategic Hook Insertion Point:

text
At the BEGINNING of execute() method:

1. Check if current session has intent_id
2. If not → BLOCK with "You must select an intent first"
3. If yes → proceed with command
   5.2 The write_to_file Handler - Deep Dive
   What I Found:
   When the LLM needs to create or modify files, it calls the write_to_file tool. This is handled by WriteToFileTool.ts.

File Location: src/core/tools/WriteToFileTool.ts

Key Code Analysis:

typescript
export class WriteToFileTool extends BaseTool<"write_to_file"> {
readonly name = "write_to_file" as const

    async execute(params: WriteToFileParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
        // This function is the MUTATION BOUNDARY between LLM and filesystem
        // Every file change passes through here
    }

}
What I Discovered About Its Internal Flow:

text
┌─────────────────────────────────────────────────────────────────┐
│ WRITE_TO_FILE FLOW │
├─────────────────────────────────────────────────────────────────┤
│ │
│ LLM calls write_to_file("src/api.ts", "console.log('hello')") │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Step 1: Parameter Validation │ │
│ │ • Check if path and content exist │ │
│ │ • Clean content (remove ``` fences) │ │
│ │ • If missing → return error │ │
│ └─────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Step 2: .rooignore Check │ │
│ │ • Validate file path against ignore patterns │ │
│ │ • If blocked → return rooignore_error │ │
│ └─────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Step 3: File Existence Check │ │
│ │ • Check if file already exists │ │
│ │ • Set editType: "create" or "modify" │ │
│ │ • If new file → create parent directories │ │
│ └─────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Step 4: Diff Preview │ │
│ │ • Open diff view in VS Code │ │
│ │ • Show original vs new content │ │
│ │ • Scroll to first difference │ │
│ │ • Wait for user approval │ │
│ └─────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Step 5: File Writing │ │
│ │ • If approved → write content to file │ │
│ │ • Use fs.promises.writeFile │ │
│ │ • Apply formatting if configured │ │
│ └─────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Step 6: Track File Context │ │
│ │ • Record that this file was edited by AI │ │
│ │ • Update fileContextTracker │ │
│ └─────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Step 7: Return Result to LLM │ │
│ │ • Format success message with path │ │
│ │ • Send back via pushToolResult() │ │
│ └─────────────────────────────────────────────────────────┘ │
│ │
└─────────────────────────────────────────────────────────────────┘
Why This Matters for Intent-Driven Development:

Current Behavior What We'll Change
Only checks .rooignore Will also check if file is in intent's owned_scope
Shows diff for approval Will add intent validation before showing diff
Records file was edited Will record content_hash and link to intent_id
Strategic Hook Insertion Points:

text
PRE-HOOK (at beginning of execute()):

1. Check if current session has intent_id
2. Check if file path matches intent's owned_scope
3. If either fails → BLOCK with specific error

POST-HOOK (after successful write):

1. Calculate SHA-256 hash of written content
2. Create trace record with intent_id and content_hash
3. Append to .orchestration/agent_trace.jsonl
4. Instruction 3: Locating the Prompt Builder
   6.1 Complete Prompt System Architecture
   What I Found:
   The prompt system is modular and well-organized in src/core/prompts/. This is where the instructions sent to the LLM are constructed.

Directory Structure:

text
src/core/prompts/
├── system.ts # MAIN PROMPT BUILDER
├── sections.ts # Modular prompt components
├── responses.ts # Tool response formatting
├── types.ts # TypeScript definitions
└── tools/ # Tool definitions for prompt
└── native-tools/ # Built-in tools
6.2 Deep Dive: system.ts
File Location: src/core/prompts/system.ts

Main Function Analysis:

typescript
export const SYSTEM_PROMPT = async (
context: vscode.ExtensionContext, // VS Code extension context
cwd: string, // Current working directory
supportsComputerUse: boolean, // Browser capabilities
mcpHub?: McpHub, // MCP server connections
diffStrategy?: DiffStrategy, // Diff viewing strategy
mode: Mode = defaultModeSlug, // Current mode (Code/Architect/etc)
customModePrompts?: CustomModePrompts, // User customizations
customModes?: ModeConfig[], // Custom mode definitions
globalCustomInstructions?: string, // User's custom instructions
experiments?: Record<string, boolean>, // Feature flags
language?: string, // UI language
rooIgnoreInstructions?: string, // .rooignore rules
settings?: SystemPromptSettings, // System settings
todoList?: TodoItem[], // Current tasks
modelId?: string, // LLM model being used
skillsManager?: SkillsManager, // Available skills
): Promise<string> => {
// This is the ENTRY POINT for prompt construction
// Every LLM call starts here
}
What This Function Does:

Validates context - Ensures extension is properly initialized

Determines mode - Gets the full mode configuration

Calls generatePrompt() - Delegates to the core assembly function

6.3 Deep Dive: generatePrompt() - The Heart of Prompt Construction
typescript
async function generatePrompt(...): Promise<string> {
// This function ASSEMBLES the final prompt from components
}
What I Discovered About Its Internal Assembly:

text
┌─────────────────────────────────────────────────────────────────┐
│ PROMPT ASSEMBLY FLOW │
├─────────────────────────────────────────────────────────────────┤
│ │
│ generatePrompt() called │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Component 1: Role Definition │ │
│ │ Source: modeConfig.roleDefinition │ │
│ │ Content: "You are Roo, a skilled software engineer..." │ │
│ └─────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Component 2: Markdown Formatting Rules │ │
│ │ Source: markdownFormattingSection() │ │
│ │ Content: "Use headings, lists, code blocks properly" │ │
│ └─────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Component 3: Tool Usage Guidelines │ │
│ │ Source: getSharedToolUseSection() │ │
│ │ Content: "You have access to these tools..." │ │
│ └─────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Component 4: Tool Catalog │ │
│ │ Source: toolsCatalog (from tool definitions) │ │
│ │ Content: JSON schemas for each tool │ │
│ └─────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Component 5: Capabilities │ │
│ │ Source: getCapabilitiesSection() │ │
│ │ Content: "You can read files, execute commands..." │ │
│ └─────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Component 6: Modes Section │ │
│ │ Source: getModesSection() │ │
│ │ Content: Available operation modes │ │
│ └─────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Component 7: Skills Section │ │
│ │ Source: getSkillsSection() │ │
│ │ Content: Specialized capabilities │ │
│ └─────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Component 8: Rules Section │ │
│ │ Source: getRulesSection() │ │
│ │ Content: Project-specific rules │ │
│ └─────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Component 9: System Info │ │
│ │ Source: getSystemInfoSection() │ │
│ │ Content: OS, environment details │ │
│ └─────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Component 10: Objective │ │
│ │ Source: getObjectiveSection() │ │
│ │ Content: Task description │ │
│ └─────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Component 11: Custom Instructions │ │
│ │ Source: addCustomInstructions() │ │
│ │ Content: User's custom rules │ │
│ └─────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ FINAL PROMPT: All components concatenated │ │
│ │ Result: A single large string sent to the LLM │ │
│ └─────────────────────────────────────────────────────────┘ │
│ │
└─────────────────────────────────────────────────────────────────┘
Why This Matters for Intent-Driven Development:

Current Behavior What We'll Change
Tells LLM what tools are available Will REQUIRE intent selection first
Lists all capabilities Will add "MUST call select_active_intent" rule
Includes custom instructions Will inject intent context when selected
Strategic Injection Point:

typescript
// In generatePrompt(), right after role definition:
const intentRequirement = `
==== INTENT-DRIVEN DEVELOPMENT RULES ====
You are an Intent-Driven Architect operating within a governed environment.

⚠️ CRITICAL RULE: You CANNOT write code or execute commands immediately.
Your FIRST action MUST be to analyze the user request and identify which business intent it relates to.
You MUST call select_active_intent(intent_id) to load the full context for that intent.
Only after receiving the intent context can you proceed with code changes.

# If you attempt to write files or execute commands without a selected intent, your action will be BLOCKED.

`;

const basePrompt = `${roleDefinition}
${intentRequirement}  // ← INJECTED HERE
${markdownFormattingSection()}
...` 7. Complete Architecture Diagram
text
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ROO CODE COMPLETE ARCHITECTURE │
│ (All Components & Data Flow) │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ PRESENTATION LAYER │ │
│ │ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ │ │
│ │ │ Webview UI │ │ Diff Editor │ │ Approval Modal │ │ │
│ │ │ • Chat display │ │ • File diff │ │ • Yes/No │ │ │
│ │ │ • User input │ │ • Side-by-side │ │ • Feedback │ │ │
│ │ │ • Tool output │ │ • Scroll to diff│ │ • Never ask again│ │ │
│ │ └────────┬─────────┘ └────────┬─────────┘ └────────┬─────────┘ │ │
│ │ │ │ │ │ │
│ │ └───────────────────────┼───────────────────────┘ │ │
│ │ │ postMessage │ │
│ └───────────────────────────────────┼─────────────────────────────────────────┘ │
│ │ │
│ ┌───────────────────────────────────▼─────────────────────────────────────────┐ │
│ │ EXTENSION HOST │ │
│ │ ┌──────────────────────────────────────────────────────────────────────┐ │ │
│ │ │ ClineProvider (src/core/webview/) │ │ │
│ │ │ • Manages extension lifecycle │ │ │
│ │ │ • Handles webview communication │ │ │
│ │ │ • Stores secrets and global state │ │ │
│ │ │ • Coordinates between UI and core │ │ │
│ │ └────────────────────────────────┬─────────────────────────────────────┘ │ │
│ │ │ │ │
│ │ ┌────────────────────────────────▼─────────────────────────────────────┐ │ │
│ │ │ Cline Core (src/core/Cline.ts) │ │ │
│ │ │ │ │ │
│ │ │ ┌────────────────────────────────────────────────────────────────┐ │ │ │
│ │ │ │ Task Execution Loop │ │ │ │
│ │ │ │ • Processes conversation turns │ │ │ │
│ │ │ │ • Maintains message history │ │ │ │
│ │ │ │ • Handles tool responses │ │ │ │
│ │ │ │ • Manages state between turns │ │ │ │
│ │ │ └────────────────────────────────────────────────────────────────┘ │ │ │
│ │ │ │ │ │
│ │ │ ┌────────────────────────────────────────────────────────────────┐ │ │ │
│ │ │ │ executeToolWithApproval() │ │ │ │
│ │ │ │ • Routes tool calls to handlers │ │ │ │
│ │ │ │ • Manages approval flow │ │ │ │
│ │ │ │ • Handles errors and retries │ │ │ │
│ │ │ └────────────────────────────────────────────────────────────────┘ │ │ │
│ │ └────────────────────────────────┬─────────────────────────────────────┘ │ │
│ │ │ │ │
│ │ ┌────────────────────────────────▼─────────────────────────────────────┐ │ │
│ │ │ PROMPT SYSTEM (src/core/prompts/) │ │ │
│ │ │ │ │ │
│ │ │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │ │ │
│ │ │ │ system.ts │ │ sections.ts │ │ responses.ts │ │ │ │
│ │ │ │ • Builds │ │ • Modular │ │ • Formats │ │ │ │
│ │ │ │ prompts │ │ sections │ │ responses │ │ │ │
│ │ │ └──────────────┘ └──────────────┘ └──────────────┘ │ │ │
│ │ └────────────────────────────────┬─────────────────────────────────────┘ │ │
│ │ │ │ │
│ │ ┌────────────────────────────────▼─────────────────────────────────────┐ │ │
│ │ │ TOOL HANDLERS (src/core/tools/) │ │ │
│ │ │ │ │ │
│ │ │ ┌──────────────────────┐ ┌──────────────────────┐ │ │ │
│ │ │ │ ExecuteCommandTool │ │ WriteToFileTool │ │ │ │
│ │ │ │ • execute() │ │ • execute() │ │ │ │
│ │ │ │ • Terminal ops │ │ • File ops │ │ │ │
│ │ │ └──────────────────────┘ └──────────────────────┘ │ │ │
│ │ │ │ │ │
│ │ │ ┌──────────────────────┐ ┌──────────────────────┐ │ │ │
│ │ │ │ ReadFileTool │ │ ListFilesTool │ │ │ │
│ │ │ │ • execute() │ │ • execute() │ │ │ │
│ │ │ │ • Read file content │ │ • List directory │ │ │ │
│ │ │ └──────────────────────┘ └──────────────────────┘ │ │ │
│ │ └──────────────────────────────────────────────────────────────────────┘ │ │
│ │ │ │ │
│ │ ┌────────────────────────────────▼─────────────────────────────────────┐ │ │
│ │ │ SERVICES LAYER │ │ │
│ │ │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │ │ │
│ │ │ │ McpHub │ │ Terminal │ │ FileContext │ │ │ │
│ │ │ │ • MCP │ │ • Process │ │ • Tracking │ │ │ │
│ │ │ │ servers │ │ management │ │ edits │ │ │ │
│ │ │ └──────────────┘ └──────────────┘ └──────────────┘ │ │ │
│ │ └──────────────────────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│ │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ EXTERNAL SYSTEMS │ │
│ │ ┌──────────────────────┐ ┌──────────────────────┐ │ │
│ │ │ LLM API │ │ File System │ │ │
│ │ │ • OpenAI/Anthropic │ │ • Read/write files │ │ │
│ │ │ • Stream responses │ │ • Create directories │ │ │
│ │ │ • Tool calling │ │ • Check existence │ │ │
│ │ └──────────────────────┘ └──────────────────────┘ │ │
│ │ │ │
│ │ ┌──────────────────────┐ ┌──────────────────────┐ │ │
│ │ │ Terminal │ │ MCP Servers │ │ │
│ │ │ • Execute commands │ │ • Database access │ │ │
│ │ │ • Capture output │ │ • External tools │ │ │
│ │ │ • Handle timeouts │ │ • APIs │ │ │
│ │ └──────────────────────┘ └──────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│ │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ HOOK INSERTION POINTS │ │
│ │ ⚡ PRE-HOOK POINTS: │ │
│ │ • Before execute_command.execute() - Validate intent, classify command │ │
│ │ • Before write_to_file.execute() - Check intent, enforce scope │ │
│ │ │ │
│ │ ⚡ POST-HOOK POINTS: │ │
│ │ • After write_to_file.execute() - Record trace with content_hash │ │
│ │ • After any tool failure - Record lesson in CLAUDE.md │ │
│ │ │ │
│ │ ⚡ PROMPT INJECTION POINT: │ │
│ │ • In generatePrompt() - Add intent requirement rules │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│ │
└─────────────────────────────────────────────────────────────────────────────────────┘ 8. Data Flow Analysis
8.1 Complete Data Flow Through the System
text
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ COMPLETE DATA FLOW DIAGRAM │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ │
│ [User Input] │
│ │ │
│ ▼ │
│ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│ │ WEBVIEW LAYER │ │
│ │ │ │
│ │ Input: "Create a weather API endpoint" │ │
│ │ Format: Raw text string │ │
│ │ Output: postMessage({ type: "userMessage", text: "..." }) │ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│ │ EXTENSION HOST │ │
│ │ │ │
│ │ Input: Raw user message │ │
│ │ Processing: │ │
│ │ • Add to conversation history │ │
│ │ • Prepare for LLM │ │
│ │ Output: Structured conversation object │ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│ │ PROMPT BUILDER │ │
│ │ │ │
│ │ Input: Conversation history, mode, settings │ │
│ │ Processing: │ │
│ │ • Add role definition │ │
│ │ • Add tool definitions │ │
│ │ • Add rules and constraints │ │
│ │ • Add custom instructions │ │
│ │ Output: Complete system prompt string │ │
│ │ │ │
│ │ ⚡ HOOK POINT: Inject intent requirement here │ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│ │ LLM API │ │
│ │ │ │
│ │ Input: System prompt + user message │ │
│ │ Processing: │ │
│ │ • Model reasoning │ │
│ │ • Tool selection │ │
│ │ • Response generation │ │
│ │ Output: Tool calls + text response │ │
│ │ │ │
│ │ Example: execute_command("npm install express") │ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│ │ TOOL DISPATCHER │ │
│ │ │ │
│ │ Input: Raw tool calls from LLM │ │
│ │ Processing: │ │
│ │ • Parse tool name and parameters │ │
│ │ • Validate required parameters │ │
│ │ • Route to appropriate handler │ │
│ │ Output: Structured tool request │ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│ │ PRE-HOOK EXECUTION │ │
│ │ │ │
│ │ ⚡ HOOK POINT: Execute pre-hooks │ │
│ │ │ │
│ │ For execute_command: │ │
│ │ • intentGatekeeper: Check if intent selected │ │
│ │ • commandClassifier: Check if destructive │ │
│ │ │ │
│ │ For write_to_file: │ │
│ │ • intentGatekeeper: Check if intent selected │ │
│ │ • scopeEnforcer: Check if file in owned_scope │ │
│ │ │ │
│ │ If any hook blocks → Return error to LLM │ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│ │ TOOL HANDLER │ │
│ │ │ │
│ │ execute_command: │ │
│ │ • Validate command │ │
│ │ • Check .rooignore │ │
│ │ • Request user approval │ │
│ │ • Run in terminal │ │
│ │ • Capture output │ │
│ │ │ │
│ │ write_to_file: │ │
│ │ • Validate path │ │
│ │ • Check .rooignore │ │
│ │ • Create directories if needed │ │
│ │ • Show diff preview │ │
│ │ • Request user approval │ │
│ │ • Write to filesystem │ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│ │ POST-HOOK EXECUTION │ │
│ │ │ │
│ │ ⚡ HOOK POINT: Execute post-hooks │ │
│ │ │ │
│ │ For write_to_file: │ │
│ │ • traceRecorder: Calculate content_hash │ │
│ │ • traceRecorder: Create trace record │ │
│ │ • traceRecorder: Append to agent_trace.jsonl │ │
│ │ │ │
│ │ If tool failed: │ │
│ │ • lessonRecorder: Append failure to CLAUDE.md │ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│ │ RESULT FORMATTING │ │
│ │ │ │
│ │ Input: Raw tool result │ │
│ │ Processing: │ │
│ │ • Format as text/images │ │
│ │ • Add to conversation history │ │
│ │ Output: Formatted tool response │ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│ │ WEBVIEW DISPLAY │ │
│ │ │ │
│ │ Input: Formatted response │ │
│ │ Output: Display to user │ │
│ │ "Command executed: npm install express" │ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
│ │
└─────────────────────────────────────────────────────────────────────────────────────┘ 9. Identified Hook Insertion Points
Based on my architectural analysis, I've identified 5 strategic hook insertion points:

Hook Point Location Type Purpose
HP-1 src/core/prompts/system.ts:generatePrompt() Prompt Injection Add intent requirement to system prompt
HP-2 src/core/tools/ExecuteCommandTool.ts:execute() start Pre-Hook Validate intent before command execution
HP-3 src/core/tools/WriteToFileTool.ts:execute() start Pre-Hook Validate intent and enforce scope
HP-4 src/core/tools/WriteToFileTool.ts:execute() after success Post-Hook Record trace with content_hash
HP-5 After any tool failure Post-Hook Record lesson in CLAUDE.md
9.1 Hook Implementation Plan
typescript
// HP-1: Prompt Injection (system.ts)
const intentRequirement = `==== INTENT-DRIVEN DEVELOPMENT ====
You MUST call select_active_intent before any code changes.
===================================`;

// HP-2 & HP-3: Pre-Hooks (tool files)
async function execute(...) {
// PRE-HOOK: Check intent
if (!task.session.intentId) {
return { error: "Must select intent first" };
}
// Continue with normal execution
}

// HP-4: Post-Hook (write_to_file)
async function execute(...) {
// ... normal execution ...
// POST-HOOK: Record trace
const hash = sha256(content);
await appendToTrace(intentId, filePath, hash);
}

// HP-5: Lesson Recording
if (error) {
await appendToClaudeMd(`Lesson: ${error.message}`);
} 10. Key Insights & Discoveries
💡 Insight 1: Clear Separation of Concerns
Roo Code has a well-architected separation between:

UI Layer (Webview)

Control Layer (Cline Core)

Prompt Layer (system.ts)

Execution Layer (Tool Handlers)

This makes hook insertion clean and maintainable.

💡 Insight 2: The Prompt Builder is the Perfect Control Point
generatePrompt() in system.ts is where ALL instructions to the LLM are assembled. By injecting intent requirements here, we ensure EVERY conversation starts with the right protocol.

💡 Insight 3: Tool Handlers are Natural Enforcement Boundaries
Every tool has a single execute() method that all calls go through. This gives us a SINGLE place to:

Validate intent

Enforce scope

Record traces

💡 Insight 4: The Approval Flow Already Exists
Both tools already have askApproval() calls. We can leverage this existing UI for intent-related approvals.

💡 Insight 5: File Context Tracking Exists
WriteToFileTool already calls task.fileContextTracker.trackFileContext(). We can extend this to track intent relationships.

11. Phase 1-4 Implementation Roadmap
    🚀 Phase 1: The Handshake (Due Friday)
    Task 1.1: Create select_active_intent tool

typescript
// src/core/tools/SelectActiveIntentTool.ts
export class SelectActiveIntentTool extends BaseTool<"select_active_intent"> {
async execute(params: { intent_id: string }, task: Task) {
// Load intent from .orchestration/active_intents.yaml
// Store in session
// Return context XML
}
}
Task 1.2: Modify system prompt

typescript
// In system.ts:generatePrompt()
const intentRule = "Your first action MUST be select_active_intent";
Task 1.3: Add intent gatekeeper pre-hook

typescript
// In each tool's execute() method
if (!task.session.intentId && toolName !== 'select_active_intent') {
throw new Error("Must select intent first");
}
🛡️ Phase 2: Hook Middleware (Due Friday)
Task 2.1: Build HookRegistry
Task 2.2: Implement command classification
Task 2.3: Add UI-blocking for destructive commands
Task 2.4: Create autonomous recovery

📝 Phase 3: AI-Native Git (Due Saturday)
Task 3.1: Create content hashing utility
Task 3.2: Implement trace recorder post-hook
Task 3.3: Set up .orchestration/ files
Task 3.4: Add semantic classification

🔄 Phase 4: Parallel Orchestration (Due Saturday)
Task 4.1: Implement optimistic locking
Task 4.2: Add lesson recorder
Task 4.3: Test multi-agent scenarios
