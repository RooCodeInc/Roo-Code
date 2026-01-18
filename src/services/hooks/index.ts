/**
 * Hooks Service
 *
 * Provides Claude Code-style hooks for Roo Code.
 * Hooks allow users to run custom shell commands at key lifecycle events.
 *
 * @example
 * ```typescript
 * import { createHookManager, HookEventType } from './services/hooks'
 *
 * const hookManager = createHookManager({
 *   cwd: '/path/to/project',
 *   mode: 'code'
 * })
 *
 * // Load configuration
 * await hookManager.loadHooksConfig()
 *
 * // Execute hooks for an event
 * const result = await hookManager.executeHooks('PreToolUse', {
 *   context: {
 *     event: 'PreToolUse',
 *     timestamp: new Date().toISOString(),
 *     session: { taskId: 'task_1', sessionId: 'session_1', mode: 'code' },
 *     project: { directory: '/path/to/project', name: 'my-project' },
 *     tool: { name: 'Write', input: { filePath: '/src/index.ts', content: '...' } }
 *   }
 * })
 *
 * if (result.blocked) {
 *   console.log('Hook blocked:', result.blockMessage)
 * }
 * ```
 */

// Types
export {
	// Event types
	HookEventType,
	BLOCKING_EVENTS,
	isBlockingEvent,

	// Schema types
	HookDefinitionSchema,
	HooksConfigFileSchema,
	HookModificationSchema,

	// Type definitions
	type HookDefinition,
	type HooksConfigFile,
	type HookSource,
	type ResolvedHook,
	type HooksConfigSnapshot,

	// Context types
	type HookContext,
	type HookSessionContext,
	type HookProjectContext,
	type HookToolContext,
	type HookPromptContext,
	type HookNotificationContext,
	type ConversationHistoryEntry,

	// Execution types
	HookExitCode,
	type HookExecutionResult,
	type HooksExecutionResult,
	type HookModification,
	type HookExecution,
	type ExecuteHooksOptions,

	// Manager interface
	type IHookManager,
} from "./types"

// Config loader
export {
	loadHooksConfig,
	getHooksForEvent,
	getHookById,
	type LoadHooksConfigOptions,
	type LoadHooksConfigResult,
} from "./HookConfigLoader"

// Matcher
export { compileMatcher, getMatcher, clearMatcherCache, filterMatchingHooks, hookMatchesTool } from "./HookMatcher"

// Executor
export { executeHook, interpretResult, describeResult } from "./HookExecutor"

// Manager
export { HookManager, createHookManager, type HookManagerOptions } from "./HookManager"

// Config Writer
export { updateHookConfig } from "./HookConfigWriter"

// Tool Execution Integration
export {
	ToolExecutionHooks,
	createToolExecutionHooks,
	type ToolExecutionContext,
	type PreToolUseResult,
	type PermissionRequestResult,
	type HookStatusCallback,
} from "./ToolExecutionHooks"
