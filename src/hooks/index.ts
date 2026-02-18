/**
 * Roo Code Hook Middleware
 *
 * Composable interceptors for tool execution.
 *
 * @example
 * import { registerPreToolUseHook, classifyCommand } from "./hooks"
 *
 * registerPreToolUseHook(async (context) => {
 *   if (context.toolUse.name === "execute_command") {
 *     const classification = classifyCommand(context.params.command)
 *     if (classification.riskLevel === "critical") {
 *       return { continue: false, reason: classification.reason }
 *     }
 *   }
 *   return { continue: true }
 * })
 */

// Type definitions
export type {
	HookResult,
	PreToolUseContext,
	PostToolUseContext,
	PreToolUseHook,
	PostToolUseHook,
	HookRegistry,
	IntentContext,
	AgentTraceRecord,
	CommandClassification,
} from "./types"

// Core middleware
export {
	registerPreToolUseHook,
	registerPostToolUseHook,
	executePreToolUseHooks,
	executePostToolUseHooks,
	clearAllHooks,
	getHookRegistry,
} from "./middleware"

// Intent context loading
export { loadIntentContext, parseActiveIntents, formatIntentAsXml, hasIntentContext } from "./intent-loader"

// Trace logging
export {
	createToolUseTrace,
	createToolResultTrace,
	createApprovalRequestedTrace,
	createApprovalReceivedTrace,
	appendToTraceLog,
	readTraceLog,
	analyzeTraceMetrics,
} from "./trace-logger"

// Security classification
export {
	classifyCommand,
	isDangerousCommand,
	suggestSaferAlternative,
	classifyFileOperation,
	isPathOutsideWorkspace,
	isSensitiveFile,
	enforceSecurityPolicy,
	explainRisk,
} from "./security"
