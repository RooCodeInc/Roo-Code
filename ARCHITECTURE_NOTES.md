# ARCHITECTURE_NOTES.md
## TRP1 Challenge Week 1 - Phase 0: Archaeological Dig

**Author:** Addisu Taye
**Date:** 2026-02-17
**Extension Base:** Roo Code (pnpm + Turbo monorepo)

---

## 1. Executive Summary

This document outlines the architectural blueprint for instrumenting the Roo Code VS Code extension with a **Governed Hook Engine**. The system enforces Intent-Code Traceability, deterministic lifecycle hooks, and Human-in-the-Loop (HITL) authorization for all agent operations.

**Key Objectives:**
- Bind high-level business intent directly to source code AST
- Intercept all tool execution via PreToolUse/PostToolUse hooks
- Maintain immutable trace records in `.orchestration/agent_trace.jsonl`
- Enable parallel agent orchestration with optimistic locking

---

## 2. Extension Foundation

| Property | Value |
|----------|-------|
| **Base Extension** | Roo Code |
| **Node Version** | v20.19.2 |
| **Package Manager** | pnpm 10.8.1 |
| **Build System** | Turbo |
| **Extension Location** | `src/` directory |
| **Activation Events** | `onLanguage`, `onStartupFinished` |
| **Build Output** | `src/dist/` |

---

## 3. Tool Execution Entry Point

### Discovery Results
- **File Path:** `src/core/ToolExecutor.ts` 
- **Function Name:** `executeTool(toolName, params, sessionId)`
- **Hook Injection Point:** PreToolUse interceptor before tool execution
- **Parameters:** `(toolName: string, params: object, sessionId: string)`

### Hook Injection Strategy
```typescript
// BEFORE (Original)
export async function executeTool(toolName, params, sessionId) {
  const result = await toolImplementation(toolName, params);
  return result;
}

// AFTER (With Hook Engine)
export async function executeTool(toolName, params, sessionId) {
  // PreToolUse Hook - Intercept before execution
  const preHookResult = await hookEngine.interceptPreToolUse(toolName, params, sessionId);
  if (preHookResult.blocked) return preHookResult.errorResponse;
  
  const result = await toolImplementation(toolName, params);
  
  // PostToolUse Hook - Intercept after execution
  await hookEngine.interceptPostToolUse(toolName, params, result, sessionId);
  return result;
}