/**
 * src/hooks/index.ts
 * 
 * Public API of the Hook Engine.
 * Import from here in Task.ts and build-tools.ts.
 */

export { HookEngine } from "./HookEngine"
export { HookedBaseTool } from "./HookedBaseTool"
export { IntentStore } from "./IntentStore"
export { TraceLogger } from "./TraceLogger"
export { selectActiveIntentToolDefinition } from "./SelectActiveIntentTool"
export { getIntentEnforcementPrompt } from "./IntentSystemPrompt"
export type { PreHookContext, PostHookContext, HookResult, MutationClass } from "./HookEngine"
export type { Intent } from "./IntentStore"
export type { TraceEntry, TraceFile } from "./TraceLogger"
