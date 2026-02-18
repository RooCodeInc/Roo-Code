/**
 * Intent Orchestration Module - Main exports
 *
 * This module provides the hook engine for intent-driven development,
 * including pre/post tool interception, intent validation, and trace tracking.
 */

// Core Hook Engine
export { HookEngine, hookEngine } from "./HookEngine"
export type { PreHook, PostHook } from "./HookEngine"

// Type Definitions
export type {
	IntentDefinition,
	ActiveIntentsSpec,
	SelectedIntent,
	IntentConstraint,
	IntentScope,
} from "./types/IntentTypes"

export type { HookAction, HookContext, HookResult, PreHookResult, PostHookResult } from "./types/HookResult"

export type { ToolName, ToolAction, ToolCall, ToolRegistry, ToolInterceptor } from "./types/ToolAction"

export type { TraceRecord, SpatialMapEntry, TraceLedger, SpatialMap, TraceEntry } from "./types/TraceTypes"

// Intent Store
export { IntentStore, intentStore } from "./intent-store/IntentStore"
export { OrchestrationPaths } from "./intent-store/OrchestrationPaths"
export { ActiveIntentsSchema } from "./intent-store/ActiveIntentsSchema"

// Pre-Tool-Use Hook
export { PreToolUseHook } from "./pre-tool-use/PreToolUseHook"
export type { PreToolUseConfig } from "./pre-tool-use/PreToolUseHook"

// Post-Tool-Use Hook
export { PostToolUseHook } from "./post-tool-use/PostToolUseHook"
export type { PostToolUseConfig } from "./post-tool-use/PostToolUseHook"

// Error Classes
export { ValidationError } from "./errors/ValidationError"
export { ScopeViolationError } from "./errors/ScopeViolationError"
export { IntentNotSelectedError } from "./errors/IntentNotSelectedError"
export { ApprovalRejectedError } from "./errors/ApprovalRejectedError"

// Utilities
export { globMatch, globMatchAny } from "./utils/globMatch"
