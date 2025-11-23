import { ToolArgs } from "./types"
import { DiffStrategy } from "../../../shared/tools"

/**
 * Returns a compact tool description without examples for lite mode
 */
export function getLiteReadFileDescription(args: ToolArgs): string {
	const maxReads = args.settings?.maxConcurrentFileReads ?? 5
	return `## read_file
Read file contents (max ${maxReads} files/request). Line-numbered output.
Params: path (required), line_range (optional)`
}

export function getLiteWriteToFileDescription(): string {
	return `## write_to_file
Create/overwrite file with content.
Params: path, content, line_count (required)`
}

export function getLiteSearchFilesDescription(): string {
	return `## search_files
Regex search in directory.
Params: path, regex (required), file_pattern (optional)`
}

export function getLiteListFilesDescription(): string {
	return `## list_files
List directory contents.
Params: path (required), recursive (optional)`
}

export function getLiteExecuteCommandDescription(): string {
	return `## execute_command
Execute CLI command.
Params: command (required), cwd (optional)`
}

export function getLiteInsertContentDescription(): string {
	return `## insert_content
Insert lines at specific position.
Params: path, line, content (required)`
}

export function getLiteListCodeDefinitionNamesDescription(): string {
	return `## list_code_definition_names
List code definitions (classes, functions, etc).
Params: path (required)`
}

export function getLiteAskFollowupQuestionDescription(): string {
	return `## ask_followup_question
Ask user for clarification.
Params: question, follow_up with 2-4 suggest tags`
}

export function getLiteAttemptCompletionDescription(): string {
	return `## attempt_completion
Present final result after task completion.
Params: result (required)`
}

export function getLiteBrowserActionDescription(): string {
	return `## browser_action
Browser interaction: screenshot, click, type, scroll.
Params: action (required), coordinate/text/direction/amount based on action`
}

export function getLiteSwitchModeDescription(): string {
	return `## switch_mode
Switch to different mode.
Params: mode_slug (required), reason (optional)`
}

export function getLiteNewTaskDescription(): string {
	return `## new_task
Create new task in specified mode.
Params: mode, message (required)`
}

export function getLiteUpdateTodoListDescription(): string {
	return `## update_todo_list
Update TODO checklist.
Format: [ ] pending, [x] completed, [-] in progress`
}

export function getLiteFetchInstructionsDescription(): string {
	return `## fetch_instructions
Get task instructions.
Params: task (required) - create_mcp_server or create_mode`
}

export function getLiteApplyDiffDescription(diffStrategy?: DiffStrategy): string {
	if (!diffStrategy) return ""
	return `## apply_diff
Apply targeted edits to existing file.
Params: path, diff (SEARCH/REPLACE blocks with :start_line:)`
}

export function getLiteCodebaseSearchDescription(): string {
	return `## codebase_search
Semantic search for relevant code.
Params: query (required)`
}

export function getLiteUseMcpToolDescription(): string {
	return `## use_mcp_tool
Use MCP server tool.
Params: server_name, tool_name, arguments (required)`
}

export function getLiteAccessMcpResourceDescription(): string {
	return `## access_mcp_resource
Access MCP server resource.
Params: server_name, uri (required), arguments (optional)`
}

export function getLiteGenerateImageDescription(): string {
	return `## generate_image
Generate image using AI.
Params: prompt (required), size (optional)`
}

export function getLiteRunSlashCommandDescription(): string {
	return `## run_slash_command
Run a VS Code slash command.
Params: command, args (required)`
}
