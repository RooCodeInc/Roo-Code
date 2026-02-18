/**
 * Hook Engine — TRP1 Intent-Code Traceability
 *
 * Middleware boundary that intercepts tool execution for:
 * - PreToolUse: intent context injection, HITL authorization, scope enforcement
 * - PostToolUse: agent_trace.jsonl updates, intent evolution, documentation
 *
 * Phase 0: Directory and types in place.
 * Phase 1+: Implement select_active_intent, context loader, prompt injection.
 * Phase 2+: Command classification, UI-blocking approval, scope enforcement.
 * Phase 3+: Agent trace schema, content hashing, write_file post-hook.
 */

export * from "./types"

// Hook engine registration point — to be wired in Phase 1 from extension/tool loop
export const HOOK_ENGINE_VERSION = "0.1.0"
