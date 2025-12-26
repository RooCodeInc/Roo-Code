import type OpenAI from "openai"
import accessMcpResource from "./access_mcp_resource"
import { apply_diff } from "./apply_diff"
import applyPatch from "./apply_patch"
import askFollowupQuestion from "./ask_followup_question"
import attemptCompletion from "./attempt_completion"
import browserAction from "./browser_action"
import codebaseSearch from "./codebase_search"
import executeCommand from "./execute_command"
import fetchInstructions from "./fetch_instructions"
import generateImage from "./generate_image"
import listFiles from "./list_files"
import newTask from "./new_task"
import { createReadFileTool, type CreateReadFileToolOptions } from "./read_file"
import runSlashCommand from "./run_slash_command"
import searchAndReplace from "./search_and_replace"
import searchReplace from "./search_replace"
import edit_file from "./edit_file"
import searchFiles from "./search_files"
import switchMode from "./switch_mode"
import updateTodoList from "./update_todo_list"
import writeToFile from "./write_to_file"

export { getMcpServerTools } from "./mcp_server"
export { convertOpenAIToolToAnthropic, convertOpenAIToolsToAnthropic } from "./converters"

/**
 * Options for getting native tools
 */
export interface GetNativeToolsOptions {
	/** Whether to include advanced reading parameters (offset, mode, indentation) in read_file tool */
	partialReadsEnabled?: boolean
	/** The configured max lines per read (shown in description for model awareness) */
	maxReadFileLine?: number
}

/**
 * Get native tools array, optionally customizing based on settings.
 *
 * @param options - Configuration options (or boolean for backward compatibility)
 * @returns Array of native tool definitions
 */
export function getNativeTools(options: GetNativeToolsOptions | boolean = true): OpenAI.Chat.ChatCompletionTool[] {
	// Handle backward compatibility with boolean parameter
	const opts: GetNativeToolsOptions = typeof options === "boolean" ? { partialReadsEnabled: options } : options

	const readFileOptions: CreateReadFileToolOptions = {
		partialReadsEnabled: opts.partialReadsEnabled ?? true,
		maxReadFileLine: opts.maxReadFileLine,
	}

	return [
		accessMcpResource,
		apply_diff,
		applyPatch,
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
		searchAndReplace,
		searchReplace,
		edit_file,
		searchFiles,
		switchMode,
		updateTodoList,
		writeToFile,
	] satisfies OpenAI.Chat.ChatCompletionTool[]
}

// Backward compatibility: export default tools with line ranges enabled
export const nativeTools = getNativeTools({ partialReadsEnabled: true })
