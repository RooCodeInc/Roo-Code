import type OpenAI from "openai"
import accessMcpResource from "./access_mcp_resource"
import { edit_file_roo, apply_diff } from "./edit_file_roo"
import edit_file_codex, { apply_patch } from "./edit_file_codex"
import askFollowupQuestion from "./ask_followup_question"
import attemptCompletion from "./attempt_completion"
import browserAction from "./browser_action"
import codebaseSearch from "./codebase_search"
import executeCommand from "./execute_command"
import fetchInstructions from "./fetch_instructions"
import generateImage from "./generate_image"
import listFiles from "./list_files"
import newTask from "./new_task"
import { createReadFileTool, type ReadFileToolOptions } from "./read_file"
import runSlashCommand from "./run_slash_command"
import edit_file_anthropic, { search_and_replace } from "./edit_file_anthropic"
import edit_file_grok, { search_replace } from "./edit_file_grok"
import edit_file_gemini, { edit_file } from "./edit_file_gemini"
import searchFiles from "./search_files"
import switchMode from "./switch_mode"
import updateTodoList from "./update_todo_list"
import writeToFile from "./write_to_file"

export { getMcpServerTools } from "./mcp_server"
export { convertOpenAIToolToAnthropic, convertOpenAIToolsToAnthropic } from "./converters"
export type { ReadFileToolOptions } from "./read_file"

/**
 * Options for customizing the native tools array.
 */
export interface NativeToolsOptions {
	/** Whether to include line_ranges support in read_file tool (default: true) */
	partialReadsEnabled?: boolean
	/** Maximum number of files that can be read in a single read_file request (default: 5) */
	maxConcurrentFileReads?: number
	/** Whether the model supports image processing (default: false) */
	supportsImages?: boolean
}

/**
 * Edit tool variant types - determines which edit tool schema is presented to the LLM
 */
export type EditToolVariant = "roo" | "anthropic" | "grok" | "gemini" | "codex"

/**
 * All edit tool definitions mapped by variant
 */
export const EDIT_TOOL_VARIANTS: Record<EditToolVariant, OpenAI.Chat.ChatCompletionTool> = {
	roo: edit_file_roo,
	anthropic: edit_file_anthropic,
	grok: edit_file_grok,
	gemini: edit_file_gemini,
	codex: edit_file_codex,
}

/**
 * Get the edit tool definition for a specific variant
 * @param variant The edit tool variant to use
 * @returns The tool definition for that variant
 */
export function getEditToolForVariant(variant: EditToolVariant): OpenAI.Chat.ChatCompletionTool {
	return EDIT_TOOL_VARIANTS[variant]
}

/**
 * Get native tools array, including all edit tool variants.
 * The filterNativeToolsForMode function will select the appropriate variant
 * based on modelInfo.editToolVariant and rename it to "edit_file".
 *
 * @param options - Configuration options for the tools
 * @returns Array of native tool definitions (including all edit tool variants)
 */
export function getNativeTools(options: NativeToolsOptions = {}): OpenAI.Chat.ChatCompletionTool[] {
	const { partialReadsEnabled = true, maxConcurrentFileReads = 5, supportsImages = false } = options

	const readFileOptions: ReadFileToolOptions = {
		partialReadsEnabled,
		maxConcurrentFileReads,
		supportsImages,
	}

	return [
		accessMcpResource,
		// All edit tool variants - filterNativeToolsForMode will select one and rename to "edit_file"
		edit_file_roo,
		edit_file_anthropic,
		edit_file_grok,
		edit_file_gemini,
		edit_file_codex,
		askFollowupQuestion,
		attemptCompletion,
		browserAction,
		codebaseSearch,
		executeCommand,
		fetchInstructions,
		generateImage,
		listFiles,
		newTask,
		createReadFileTool(readFileOptions),
		runSlashCommand,
		searchFiles,
		switchMode,
		updateTodoList,
		writeToFile,
	] satisfies OpenAI.Chat.ChatCompletionTool[]
}

// Backward compatibility: export default tools with line ranges enabled
// Note: filterNativeToolsForMode will select the edit tool variant based on modelInfo
export const nativeTools = getNativeTools()

// Re-export individual tools for backward compatibility
export {
	// New names
	edit_file_roo,
	edit_file_anthropic,
	edit_file_grok,
	edit_file_gemini,
	edit_file_codex,
	// Old names (aliases)
	apply_diff,
	search_and_replace,
	search_replace,
	edit_file,
	apply_patch,
}
