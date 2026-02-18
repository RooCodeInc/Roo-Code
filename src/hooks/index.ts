/**
 * Phase 2 — Hook Middleware Public API
 *
 * Barrel export for the Hook Engine and its components.
 */

// Core engine
export { HookEngine, hookEngine, buildHookContext } from "./HookEngine"

// Types
export type { HookContext, HookResult, ScopeCheckResult, ToolClassification, PreHookFn, PostHookFn } from "./types"

// Command classification
export { classifyTool, isExplicitlyDestructive } from "./commandClassifier"

// Authorization
export { authorizationHook } from "./authorizationHook"

// Scope enforcement
export { scopeEnforcerHook, isPathInScope, extractTargetPath, checkScopeViolation } from "./scopeEnforcer"

// Intent ignore
export { loadIntentIgnorePatterns, parseIntentIgnore, isIgnoredByIntent, INTENT_IGNORE_PATH } from "./intentIgnore"

// Tool error builder
export { buildToolError, buildScopeViolationError, buildAuthorizationRejectedError, HookErrorCode } from "./toolError"
export type { HookErrorCodeValue } from "./toolError"
