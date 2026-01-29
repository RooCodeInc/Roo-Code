import type OpenAI from "openai"

/**
 * Native tool definition for write_stdin.
 *
 * This tool allows the LLM to write characters to an existing terminal session
 * and receive the resulting output. It enables interactive terminal workflows
 * where the LLM can respond to prompts, provide input to running processes,
 * and monitor long-running commands.
 */

const WRITE_STDIN_DESCRIPTION = `Writes characters to an existing exec session and returns recent output.

Use this tool when:
1. A command started with execute_command is still running and waiting for input
2. You need to respond to an interactive prompt (e.g., "Press y to continue", password prompts)
3. You want to poll a long-running process for new output without sending input

The session_id is returned by execute_command when a process is still running.

Parameters:
- session_id: (required) Identifier of the running exec session (returned by execute_command)
- chars: (optional) Characters to write to stdin. Use empty string or omit to just poll for output.
- yield_time_ms: (optional) Milliseconds to wait for output after writing (default: 250, min: 250, max: 30000)
- max_output_tokens: (optional) Maximum tokens to return in the response

Common use cases:
- Sending 'y' or 'n' to confirmation prompts
- Providing input to interactive CLI tools
- Sending Ctrl+C (\\x03) to terminate a process
- Polling for output from a long-running process

Example: Responding to a confirmation prompt
{ "session_id": 1234, "chars": "y\\n" }

Example: Sending Ctrl+C to stop a process
{ "session_id": 1234, "chars": "\\x03" }

Example: Polling for new output (no input)
{ "session_id": 1234, "chars": "", "yield_time_ms": 2000 }

Example: Providing password (note: prefer non-interactive approaches when possible)
{ "session_id": 1234, "chars": "password\\n" }`

const SESSION_ID_DESCRIPTION = `Identifier of the running exec session (returned by execute_command when a process is still running)`

const CHARS_DESCRIPTION = `Characters to write to stdin. May be empty to just poll for output. Supports escape sequences like \\n (newline) and \\x03 (Ctrl+C).`

const YIELD_TIME_MS_DESCRIPTION = `Milliseconds to wait for output after writing (default: 250, range: 250-30000). Use higher values when expecting delayed output.`

const MAX_OUTPUT_TOKENS_DESCRIPTION = `Maximum tokens to return in the response. Excess output will be truncated with head/tail preservation.`

export default {
	type: "function",
	function: {
		name: "write_stdin",
		description: WRITE_STDIN_DESCRIPTION,
		// Note: strict mode is intentionally disabled for this tool.
		// With strict: true, OpenAI requires ALL properties to be in the 'required' array,
		// which forces the LLM to always provide explicit values (even null) for optional params.
		// This creates verbose tool calls and poor UX. By disabling strict mode, the LLM can
		// omit optional parameters entirely, making the tool easier to use.
		parameters: {
			type: "object",
			properties: {
				session_id: {
					type: "number",
					description: SESSION_ID_DESCRIPTION,
				},
				chars: {
					type: "string",
					description: CHARS_DESCRIPTION,
				},
				yield_time_ms: {
					type: "number",
					description: YIELD_TIME_MS_DESCRIPTION,
				},
				max_output_tokens: {
					type: "number",
					description: MAX_OUTPUT_TOKENS_DESCRIPTION,
				},
			},
			required: ["session_id"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
