/**
 * hooks/index.ts
 * ─────────────────────────────────────────────────────────────
 * Entry point for the Hook System.
 *
 * Registers all pre and post hooks in execution order.
 * Exports the dispatchWithHooks() wrapper that replaces the
 * extension's existing tool dispatcher.
 *
 * Pre-hook execution order (matters — each enriches ctx for next):
 *   1. ContextInjector     → intercepts select_active_intent, sets ctx.intentId
 *   2. IntentGatekeeper    → blocks writes if no intentId
 *   3. ScopeEnforcer       → blocks writes outside owned_scope
 *   4. OptimisticLockGuard → blocks stale file writes, captures old content
 *
 * Post-hook execution order (all run, errors are swallowed):
 *   1. TraceLogger         → writes to agent_trace.jsonl
 *   2. IntentMapUpdater    → updates intent_map.md
 *   3. LessonRecorder      → appends to CLAUDE.md on evolution/errors
 * ─────────────────────────────────────────────────────────────
 */

import { hookEngine, ToolContext, BlockSignal } from './HookEngine';

// Pre-hooks
import { contextInjector } from './pre/ContextInjector';
import { intentGatekeeper } from './pre/IntentGatekeeper';
import { scopeEnforcer } from './pre/ScopeEnforcer';
import { optimisticLockGuard } from './pre/OptimisticLockGuard';

// Post-hooks
import { traceLogger } from './post/TraceLogger';
import { intentMapUpdater } from './post/IntentMapUpdater';
import { lessonRecorder } from './post/LessonRecorder';

// ── Registration ───────────────────────────────────────────────

export function registerAllHooks(): void {
  // Pre-hooks (ORDER MATTERS)
  hookEngine.registerPre('ContextInjector', contextInjector);
  hookEngine.registerPre('IntentGatekeeper', intentGatekeeper);
  hookEngine.registerPre('ScopeEnforcer', scopeEnforcer);
  hookEngine.registerPre('OptimisticLockGuard', optimisticLockGuard);

  // Post-hooks
  hookEngine.registerPost('TraceLogger', traceLogger);
  hookEngine.registerPost('IntentMapUpdater', intentMapUpdater);
  hookEngine.registerPost('LessonRecorder', lessonRecorder);

  console.log('[HookSystem] All hooks registered.');
}

// ── Dispatcher Wrapper ─────────────────────────────────────────

/**
 * Drop-in replacement for the extension's tool dispatcher.
 *
 * Usage — replace this pattern in the extension host:
 *
 *   // BEFORE (original extension code):
 *   const result = await executeTool(toolName, params);
 *
 *   // AFTER (with hook system):
 *   const result = await dispatchWithHooks(toolName, params, workspacePath, originalExecuteTool);
 */
export async function dispatchWithHooks(
  toolName: string,
  params: Record<string, unknown>,
  workspacePath: string,
  originalDispatch: (toolName: string, params: Record<string, unknown>) => Promise<unknown>,
  sessionIntentId?: string
): Promise<{ content: unknown; blocked: boolean; blockReason?: string }> {

  const ctx: ToolContext = {
    toolName,
    params,
    workspacePath,
    intentId: sessionIntentId,
  };

  // ── Run Pre-Hooks ────────────────────────────────────────────
  const preResult = await hookEngine.runPreHooks(ctx);

  if (preResult instanceof BlockSignal) {
    return {
      content: {
        type: 'error',
        error: preResult.reason,
        code: preResult.code,
      },
      blocked: true,
      blockReason: preResult.reason,
    };
  }

  // ── Context injection short-circuit ─────────────────────────
  // If a hook injected context (select_active_intent), return it
  // directly WITHOUT running the original tool.
  if (preResult.__injectedContext__) {
    await hookEngine.runPostHooks(preResult);
    return {
      content: {
        type: 'tool_result',
        content: preResult.__injectedContext__,
      },
      blocked: false,
    };
  }

  // ── Run Original Tool ────────────────────────────────────────
  const toolResult = await originalDispatch(preResult.toolName, preResult.params);

  // ── Run Post-Hooks ───────────────────────────────────────────
  await hookEngine.runPostHooks(preResult);

  return { content: toolResult, blocked: false };
}

// Re-export core types for extension host use
export { hookEngine, ToolContext, BlockSignal } from './HookEngine';