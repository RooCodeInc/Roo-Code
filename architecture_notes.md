# ARCHITECTURE_NOTES.md - Phase 0: Archaeological Dig

**Date**: February 18, 2026  
**Project**: Roo-Code Fork

## 1. Tool Loop (The Nervous System)

**Main Tool Execution Files**:

- `src/core/tools/ExecuteCommandTool.ts`
- `src/core/tools/WriteToFileTool.ts`

**Execution Function for execute_command**:  
`ExecuteCommandTool.execute`

**Execution Function for write_to_file**:  
`WriteToFileTool.execute`

**Where I will add PreToolUse / PostToolUse hooks**:  
(inside the `.execute()` functions above — this is the exact middleware boundary)

## 2. Prompt Builder

**System Prompt File**:  
`src/core/prompts/system.ts`

**Main Function / Constant**:  
`SYSTEM_PROMPT`

**Where I will enforce the Reasoning Loop** (select_active_intent):  
(modify `SYSTEM_PROMPT` in this file to force the handshake: "You MUST first call select_active_intent(intent_id) before any other action")

## 3. Flow Diagram (ASCII)

User Prompt → Webview → Extension Host → Prompt Builder (SYSTEM_PROMPT) → LLM → Tool Call → ToolExecutor → ExecuteCommandTool.execute / WriteToFileTool.execute → OS (terminal / filesystem)

## 4. Summary & Next Steps

- Tool loop found and mapped ✓
- Prompt builder found and mapped ✓
- Ready for Phase 1 (Handshake + select_active_intent tool)

Signed: [Your Name]
