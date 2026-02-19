/**
 * pre/ContextInjector.ts
 * ─────────────────────────────────────────────────────────────
 * PRE-HOOK #2 — The Context Injector
 *
 * Intercepts the select_active_intent() tool call.
 * Instead of running the tool, the hook:
 *   1. Looks up the intent in active_intents.yaml
 *   2. Constructs a structured <intent_context> XML block
 *   3. Returns it as the tool result
 *
 * The agent sees only the XML block — it never directly reads
 * the sidecar YAML files. The hook is the context layer.
 *
 * Also sets ctx.intentId so downstream hooks know the active intent.
 * ─────────────────────────────────────────────────────────────
 */

import { ToolContext, BlockSignal } from '../HookEngine';
import { findIntent, loadIntents, ActiveIntent } from '../utils/intentStore';

export async function contextInjector(ctx: ToolContext): Promise<ToolContext | BlockSignal> {
  if (ctx.toolName !== 'select_active_intent') return ctx;

  const intentId = ctx.params['intent_id'] as string;

  if (!intentId || typeof intentId !== 'string') {
    return new BlockSignal(
      'select_active_intent requires an intent_id string parameter.\n' +
      'Example: select_active_intent("INT-001")'
    );
  }

  const intent = findIntent(ctx.workspacePath, intentId);

  if (!intent) {
    const available = loadIntents(ctx.workspacePath).map(i => `  • ${i.id}: ${i.name}`).join('\n');
    return new BlockSignal(
      `BLOCKED [UNKNOWN_INTENT]: No active intent found with id "${intentId}".\n\n` +
      `Available intents:\n${available || '  (none — create .orchestration/active_intents.yaml first)'}`,
      'UNKNOWN_INTENT'
    );
  }

  if (intent.status === 'COMPLETE') {
    return new BlockSignal(
      `BLOCKED: Intent "${intentId}" is already COMPLETE. ` +
      `Create a new intent or reopen this one before proceeding.`
    );
  }

  // Build the context XML block that will be returned to the LLM as the tool result
  const contextXml = buildIntentContextXml(intent);

  // Store in context for downstream hooks and for the dispatcher to return
  ctx.__injectedContext__ = contextXml;
  ctx.intentId = intentId;

  return ctx;
}

// ── XML Builder ────────────────────────────────────────────────

function buildIntentContextXml(intent: ActiveIntent): string {
  const scopeList = intent.owned_scope.map(s => `    <path>${escapeXml(s)}</path>`).join('\n');
  const constraintList = intent.constraints.map(c => `    <rule>${escapeXml(c)}</rule>`).join('\n');
  const criteriaList = intent.acceptance_criteria.map(c => `    <criterion>${escapeXml(c)}</criterion>`).join('\n');

  return `<intent_context>
  <id>${escapeXml(intent.id)}</id>
  <name>${escapeXml(intent.name)}</name>
  <status>${escapeXml(intent.status)}</status>

  <owned_scope>
${scopeList}
  </owned_scope>

  <constraints>
${constraintList}
  </constraints>

  <acceptance_criteria>
${criteriaList}
  </acceptance_criteria>

  <instructions>
    You are now operating under intent ${escapeXml(intent.id)}.
    You MAY ONLY modify files within the paths listed in owned_scope.
    You MUST respect ALL constraints listed above.
    Before completing, verify each acceptance criterion.
    When calling write_file, include "intent_id": "${escapeXml(intent.id)}" in your tool params.
  </instructions>
</intent_context>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}