export enum CommandType {
	SAFE = "SAFE",
	DESTRUCTIVE = "DESTRUCTIVE",
}

export interface CommandClassification {
	type: CommandType
	requiresApproval: boolean
	reason: string
}

export class CommandClassifier {
	private static readonly DESTRUCTIVE_TOOLS = [
		"write_to_file",
		"apply_diff",
		"edit",
		"search_and_replace",
		"execute_command",
		"apply_patch",
	]

	private static readonly SAFE_TOOLS = [
		"read_file",
		"list_files",
		"search_files",
		"codebase_search",
		"ask_followup_question",
		"attempt_completion",
	]

	static classify(toolName: string): CommandClassification {
		if (this.DESTRUCTIVE_TOOLS.includes(toolName)) {
			return {
				type: CommandType.DESTRUCTIVE,
				requiresApproval: true,
				reason: `${toolName} can modify files or execute commands`,
			}
		}

		if (this.SAFE_TOOLS.includes(toolName)) {
			return {
				type: CommandType.SAFE,
				requiresApproval: false,
				reason: `${toolName} is read-only`,
			}
		}

		// Unknown tools default to safe
		return {
			type: CommandType.SAFE,
			requiresApproval: false,
			reason: "Unknown tool, defaulting to safe",
		}
	}
}
