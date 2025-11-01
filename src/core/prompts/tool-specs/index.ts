import type { ToolSpec } from "../../../api/transform/tool-converters"
import type { ToolName } from "@roo-code/types"

// Import all tool specifications
import { readFileToolSpec } from "./read-file"
import { writeToFileToolSpec } from "./write-to-file"
import { applyDiffToolSpec } from "./apply-diff"
import { executeCommandToolSpec } from "./execute-command"
import { listFilesToolSpec } from "./list-files"
import { searchFilesToolSpec } from "./search-files"
import { listCodeDefinitionNamesToolSpec } from "./list-code-definition-names"
import { codebaseSearchToolSpec } from "./codebase-search"
import { insertContentToolSpec } from "./insert-content"
import { searchAndReplaceToolSpec } from "./search-and-replace"
import { browserActionToolSpec } from "./browser-action"
import { useMcpToolToolSpec } from "./use-mcp-tool"
import { accessMcpResourceToolSpec } from "./access-mcp-resource"
import { askFollowupQuestionToolSpec } from "./ask-followup-question"
import { attemptCompletionToolSpec } from "./attempt-completion"
import { switchModeToolSpec } from "./switch-mode"
import { newTaskToolSpec } from "./new-task"
import { updateTodoListToolSpec } from "./update-todo-list"
import { runSlashCommandToolSpec } from "./run-slash-command"
import { generateImageToolSpec } from "./generate-image"
import { fetchInstructionsToolSpec } from "./fetch-instructions"

/**
 * Registry of all tool specifications
 * Maps tool names to their specifications
 */
export const TOOL_SPECS: Record<ToolName, ToolSpec> = {
	read_file: readFileToolSpec,
	write_to_file: writeToFileToolSpec,
	apply_diff: applyDiffToolSpec,
	execute_command: executeCommandToolSpec,
	list_files: listFilesToolSpec,
	search_files: searchFilesToolSpec,
	list_code_definition_names: listCodeDefinitionNamesToolSpec,
	codebase_search: codebaseSearchToolSpec,
	insert_content: insertContentToolSpec,
	search_and_replace: searchAndReplaceToolSpec,
	browser_action: browserActionToolSpec,
	use_mcp_tool: useMcpToolToolSpec,
	access_mcp_resource: accessMcpResourceToolSpec,
	ask_followup_question: askFollowupQuestionToolSpec,
	attempt_completion: attemptCompletionToolSpec,
	switch_mode: switchModeToolSpec,
	new_task: newTaskToolSpec,
	update_todo_list: updateTodoListToolSpec,
	run_slash_command: runSlashCommandToolSpec,
	generate_image: generateImageToolSpec,
	fetch_instructions: fetchInstructionsToolSpec,
}

/**
 * Get tool specifications for a specific set of tool names
 * @param toolNames - Array of tool names to get specs for
 * @returns Array of tool specifications
 */
export function getToolSpecs(toolNames: ToolName[]): ToolSpec[] {
	return toolNames.map((name) => TOOL_SPECS[name]).filter((spec): spec is ToolSpec => spec !== undefined)
}

/**
 * Get all available tool specifications
 * @returns Array of all tool specifications
 */
export function getAllToolSpecs(): ToolSpec[] {
	return Object.values(TOOL_SPECS)
}
