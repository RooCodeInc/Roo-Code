/**
 * index.ts — Public API for the Hook Engine module
 *
 * Re-exports all hook components for clean imports:
 *   import { HookEngine, IntentContextLoader, GatekeeperHook } from "../hooks"
 *
 * @see HookEngine.ts — main orchestrator
 * @see IntentContextLoader.ts — select_active_intent handler
 * @see PreToolHook.ts — gatekeeper validation
 * @see types.ts — shared types and constants
 */

export { HookEngine } from "./HookEngine"
export { IntentContextLoader } from "./IntentContextLoader"
export { GatekeeperHook } from "./PreToolHook"

export type { HookContext, PreHookResult, IntentEntry, ActiveIntentsFile } from "./types"

export { MUTATING_TOOLS, EXEMPT_TOOLS } from "./types"
