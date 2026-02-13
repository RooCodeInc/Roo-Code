import type OpenAI from "openai"

const shellWriteToProcess: OpenAI.Chat.ChatCompletionTool = {
	type: "function",
	function: {
		name: "shell_write_to_process",
		description:
			"Send input (stdin) to a running process. Use this to interact with processes that are waiting for input, such as interactive prompts, REPL sessions, or processes that accept piped input. The process must have been started by execute_command and must still be running.",
		parameters: {
			type: "object",
			properties: {
				artifact_id: {
					type: "string",
					description: "The artifact ID of the running process (returned by execute_command).",
				},
				input: {
					type: "string",
					description: "The text input to send to the process stdin. A newline will be appended.",
				},
			},
			required: ["artifact_id", "input"],
		},
	},
}

export default shellWriteToProcess
