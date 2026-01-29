import type OpenAI from "openai"

/**
 * Native tool definition for terminate_session.
 *
 * This tool allows the LLM to terminate a running terminal session
 * that was started by execute_command and is still active.
 */

const TERMINATE_SESSION_DESCRIPTION = `Terminates a running terminal session by sending an abort signal to the process.

Use this tool when:
1. A long-running command needs to be stopped (e.g., a server, watch process)
2. A command is stuck or unresponsive
3. You no longer need a background process that was started earlier
4. You want to free up resources from idle sessions

The session_id is returned by execute_command when a process is still running.

Parameters:
- session_id: (required) Identifier of the running exec session to terminate

Example: Terminating a development server
{ "session_id": 1234 }

Note: After termination, the session_id is no longer valid. Use list_sessions to see remaining active sessions.`

const SESSION_ID_DESCRIPTION = `Identifier of the running exec session to terminate (returned by execute_command)`

export default {
	type: "function",
	function: {
		name: "terminate_session",
		description: TERMINATE_SESSION_DESCRIPTION,
		parameters: {
			type: "object",
			properties: {
				session_id: {
					type: "number",
					description: SESSION_ID_DESCRIPTION,
				},
			},
			required: ["session_id"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
