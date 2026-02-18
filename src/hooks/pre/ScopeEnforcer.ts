/**
 * pre/ScopeEnforcer.ts
 * ─────────────────────────────────────────────────────────────
 * PRE-HOOK #3 — The Scope Enforcer
 *
 * For write operations, verifies that the target file path falls
 * within the owned_scope of the currently active intent.
 *
 * If the agent tries to write outside its declared scope:
 *   → Block and return a structured error explaining the violation.
 *   → The agent must either request scope expansion or switch intent.
 *
 * Files listed in .intentignore are always allowed through.
 * ─────────────────────────────────────────────────────────────
 */

import * as path from 'path';
import { ToolContext, BlockSignal } from '../HookEngine';
import { findIntent, isFileInScope, isIntentIgnored } from '../utils/intentStore';

const WRITE_TOOLS = new Set([
  'write_file',
  'write_to_file',
  'create_file',
  'apply_diff',
  'insert_code_block',
  'replace_in_file',
  'delete_file',
]);

export async function scopeEnforcer(ctx: ToolContext): Promise<ToolContext | BlockSignal> {
  if (!WRITE_TOOLS.has(ctx.toolName)) return ctx;
  if (!ctx.intentId) return ctx; // IntentGatekeeper already handles this case

  const targetPath = ctx.params['path'] as string ?? ctx.params['file_path'] as string;
  if (!targetPath) return ctx;

  // Normalize to relative path
  const relPath = path.relative(ctx.workspacePath, path.resolve(ctx.workspacePath, targetPath))
    .replace(/\\/g, '/');

  // Check .intentignore first
  if (isIntentIgnored(ctx.workspacePath, relPath)) {
    return ctx; // Explicitly ignored — allow through
  }

  const intent = findIntent(ctx.workspacePath, ctx.intentId);
  if (!intent) return ctx; // Intent not found — gatekeeper already blocked this

  if (!isFileInScope(intent, relPath)) {
    return new BlockSignal(
      `BLOCKED [SCOPE_VIOLATION]: Intent "${ctx.intentId}" (${intent.name}) is NOT authorized ` +
      `to modify "${relPath}".\n\n` +
      `Authorized scope for ${ctx.intentId}:\n` +
      intent.owned_scope.map(s => `  • ${s}`).join('\n') +
      `\n\nOptions:\n` +
      `  1. Switch to an intent that owns this file.\n` +
      `  2. Request scope expansion by stating: "I need to expand the scope of ${ctx.intentId} to include ${relPath}."`,
      'SCOPE_VIOLATION'
    );
  }

  return ctx;
}