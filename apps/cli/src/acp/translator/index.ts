/**
 * Translator Module
 *
 * Re-exports all translator functionality for backward compatibility.
 * Import from this module to use the translator features.
 *
 * The translator is split into focused modules:
 * - diff-parser: Unified diff parsing
 * - location-extractor: File location extraction
 * - prompt-extractor: Prompt content extraction
 * - tool-parser: Tool information parsing
 * - message-translator: Main message translation
 * - plan-translator: TodoItem to ACP PlanEntry translation
 */

// Diff parsing
export { parseUnifiedDiff, isUnifiedDiff, type ParsedDiff } from "./diff-parser.js"

// Location extraction
export { extractLocations, extractFilePathsFromSearchResults, type LocationParams } from "./location-extractor.js"

// Prompt extraction
export { extractPromptText, extractPromptImages, extractPromptResources } from "./prompt-extractor.js"

// Tool parsing
export {
	parseToolFromMessage,
	generateToolTitle,
	extractToolContent,
	buildToolCallFromMessage,
	type ToolCallInfo,
} from "./tool-parser.js"

// Message translation
export {
	translateToAcpUpdate,
	isPermissionAsk,
	isCompletionAsk,
	createPermissionOptions,
} from "./message-translator.js"

// Re-export mapToolKind for backward compatibility
// (now uses mapToolToKind from tool-registry internally)
export { mapToolToKind as mapToolKind } from "../tool-registry.js"

// Plan translation (TodoItem to ACP PlanEntry)
export {
	todoItemToPlanEntry,
	todoListToPlanUpdate,
	parseTodoListFromMessage,
	isTodoListMessage,
	extractTodoListFromMessage,
	createPlanUpdateFromMessage,
	type PlanEntry,
	type PlanEntryPriority,
	type PlanEntryStatus,
	type PlanUpdate,
	type PriorityConfig,
} from "./plan-translator.js"
