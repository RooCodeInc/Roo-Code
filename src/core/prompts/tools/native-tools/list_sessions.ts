import type OpenAI from "openai"

/**
 * Native tool definition for list_sessions.
 *
 * This tool allows the LLM to see all active terminal sessions
 * that can be interacted with using write_stdin or terminated.
 */

const LIST_SESSIONS_DESCRIPTION = `Lists all active terminal sessions that were started by execute_command.

Use this tool when:
1. You need to know which sessions are still running
2. You forgot or lost track of a session_id
3. You want to see the status of multiple background processes
4. Before using write_stdin or terminate_session when unsure of the session_id

Returns a list of sessions with:
- session_id: The identifier to use with write_stdin or terminate_session
- command: The original command that was executed
- running: Whether the process is still actively running
- last_used: Relative time since last interaction

Example response:
┌──────────┬─────────────────────────────────┬─────────┬──────────────┐
│ Session  │ Command                         │ Status  │ Last Used    │
├──────────┼─────────────────────────────────┼─────────┼──────────────┤
│ 1        │ npm run dev                     │ Running │ 30 seconds   │
│ 2        │ python manage.py runserver      │ Running │ 2 minutes    │
│ 3        │ tail -f /var/log/syslog         │ Stopped │ 5 minutes    │
└──────────┴─────────────────────────────────┴─────────┴──────────────┘

This tool takes no parameters.`

export default {
	type: "function",
	function: {
		name: "list_sessions",
		description: LIST_SESSIONS_DESCRIPTION,
		parameters: {
			type: "object",
			properties: {},
			required: [],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
