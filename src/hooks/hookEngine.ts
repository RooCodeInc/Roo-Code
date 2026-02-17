import { preToolUse } from './preToolUse';
import { postToolUse } from './postToolUse';
import { approvalGuard } from './approvalGuard';
import { scopeValidator } from './scopeValidator';
import { concurrencyGuard } from './concurrencyGuard';

export type ToolEvent = {
  type: string;
  payload: any;
};

export type HookContext = {
  userId: string;
  agentId: string;
  sessionId: string;
  filePath?: string;
  command?: string;
  contentHash?: string;
  // Add more session or agent context as needed
};

export class HookEngine {
  constructor() {}

  /**
   * Main entry point for executing a tool request emitted by an agent.
   * Enforces pre-tool, HITL, concurrency, and post-tool hooks.
   */
  async executeTool(event: ToolEvent, context: HookContext) {
    // 1. Run PreToolUse hook (validation, safety, authorization)
    const preResult = await preToolUse(event, context);
    if (!preResult.allowed) {
      console.log(`[HookEngine] PreToolUse blocked execution: ${preResult.reason}`);
      return { success: false, reason: preResult.reason };
    }

    // 2. Run scope validator to ensure agent operates only in allowed areas
    const scopeOk = scopeValidator(event, context);
    if (!scopeOk) {
      console.log(`[HookEngine] Scope validation failed`);
      return { success: false, reason: 'Scope violation' };
    }

    // 3. Run concurrency guard to prevent conflicting edits
    const concurrencyOk = concurrencyGuard(event, context);
    if (!concurrencyOk) {
      console.log(`[HookEngine] Concurrency guard triggered`);
      return { success: false, reason: 'Concurrency conflict detected' };
    }

    // 4. Run approval guard (HITL)
    const approved = await approvalGuard(event, context);
    if (!approved) {
      console.log(`[HookEngine] Human approval denied`);
      return { success: false, reason: 'Human approval denied' };
    }

    // 5. Execute the actual tool (stub - replace with real executor)
    console.log(`[HookEngine] Executing tool: ${event.type}`);
    // TODO: Call toolExecutor or MCP client here

    // 6. Run PostToolUse hook (formatters, linters, state updates)
    await postToolUse(event, context);

    return { success: true };
  }
}
