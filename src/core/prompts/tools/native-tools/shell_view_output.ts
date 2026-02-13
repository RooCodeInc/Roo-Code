import type OpenAI from "openai"

const shellViewOutput: OpenAI.Chat.ChatCompletionTool = {
	type: "function",
	function: {
		name: "shell_view_output",
		description:
			"View the current output of a running or completed process without waiting for it to finish. Use this to check on long-running processes, inspect partial output, or read output from processes that are still running. Supports pagination via offset and limit parameters.",
		parameters: {
			type: "object",
			properties: {
				artifact_id: {
					type: "string",
					description: "The artifact ID of the process (returned by execute_command).",
				},
				offset: {
					type: "number",
					description: "Line number to start reading from (0-based). Default: 0.",
				},
				limit: {
					type: "number",
					description: "Maximum number of lines to return. Default: 200.",
				},
			},
			required: ["artifact_id"],
		},
	},
}

export default shellViewOutput
