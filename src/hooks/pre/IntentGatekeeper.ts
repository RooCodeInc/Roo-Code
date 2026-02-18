/**
 * pre/IntentGatekeeper.ts
 * ─────────────────────────────────────────────────────────────
 * PRE-HOOK #1 — The Gatekeeper
 *
 * Blocks any destructive/mutating tool call that does not have
 * an active intent ID declared for the current session.
 *
 * The agent MUST call select_active_intent() before it can write
 * any files or execute any commands. This is the enforcement
 * mechanism for the Two-Stage State Machine.
 *
 * Safe (read-only) tools are allowed through unconditionally.
 * ─────────────────────────────────────────────────────────────
 */

import { ToolContext, BlockSignal } from '../HookEngine';

/** Tools that write to the filesystem or execute shell commands */
const DESTRUCTIVE_TOOLS = new Set([
  'write_file',
  'write_to_file',
  'create_file',
  'apply_diff',
  'execute_command',
  'run_terminal_command',
  'insert_code_block',
  'replace_in_file',
  'delete_file',
]);

/** Tools that are always allowed — they don't mutate state */
const SAFE_TOOLS = new Set([
  'read_file',
  'list_files',
  'list_directory',
  'search_files',
  'get_file_info',
  'select_active_intent', // the handshake tool itself
  'attempt_completion',
  'ask_followup_question',
]);

export async function intentGatekeeper(ctx: ToolContext): Promise<ToolContext | BlockSignal> {
  // Always allow safe tools
  if (SAFE_TOOLS.has(ctx.toolName)) return ctx;

  // Allow unknown tools through (don't block things we don't know about)
  if (!DESTRUCTIVE_TOOLS.has(ctx.toolName)) return ctx;

  // Destructive tool: must have an intent declared
  if (!ctx.intentId) {
    return new BlockSignal(
      `BLOCKED [NO_INTENT_DECLARED]: You attempted to call "${ctx.toolName}" without first ` +
      `declaring an active intent.\n\n` +
      `You MUST call select_active_intent(intent_id) as your FIRST action this turn.\n` +
      `Valid intent IDs are listed in .orchestration/active_intents.yaml.\n\n` +
      `Example: select_active_intent("INT-001")`,
      'NO_INTENT_DECLARED'
    );
  }

  return ctx;
}