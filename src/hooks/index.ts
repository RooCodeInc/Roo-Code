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
	TraceRecord,
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
	requestHITLAuthorization,
	formatRejectionError,
	checkFileCollision,
} from "./middleware"

// Intent validation hook
export { registerIntentValidationHook, validateIntentForTool } from "./intent-validation-hook"

// Documentation and lesson recording
export { appendLesson, createClaudeMd, readLessons } from "./documentation"

// Intent context loading
export {
	loadIntentContext,
	parseActiveIntents,
	formatIntentAsXml,
	hasIntentContext,
	readActiveIntents,
	findIntentById,
	validateIntentScope,
} from "./intent-loader"
export type { Intent } from "./intent-loader"

// Trace logging
export {
	createToolUseTrace,
	createToolResultTrace,
	createApprovalRequestedTrace,
	createApprovalReceivedTrace,
	appendToTraceLog,
	readTraceLog,
	analyzeTraceMetrics,
	computeContentHash,
	computeGitSha,
	buildTraceRecord,
	appendTraceRecord,
} from "./trace-logger"

// Security classification
export {
	classifyCommand,
	classifyToolSafety,
	isDangerousCommand,
	suggestSaferAlternative,
	classifyFileOperation,
	isPathOutsideWorkspace,
	isSensitiveFile,
	enforceSecurityPolicy,
	explainRisk,
} from "./security"

// Session state management
export {
	initSessionState,
	setSessionIntent,
	getSessionIntent,
	clearSessionIntent,
	getAllSessions,
	clearAllSessions,
	getSessionState,
	updateSessionMetadata,
} from "./session-state"
