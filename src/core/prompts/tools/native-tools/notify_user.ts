import type OpenAI from "openai"

const notifyUser: OpenAI.Chat.ChatCompletionTool = {
	type: "function",
	function: {
		name: "notify_user",
		description:
			"Send a notification to the user via VS Code without pausing the task. Unlike ask_followup_question which pauses execution and waits for a response, notify_user sends a non-blocking notification and continues execution. Use this for progress updates, milestone announcements, or alerts during long-running tasks.",
		parameters: {
			type: "object",
			properties: {
				message: {
					type: "string",
					description: "The notification message to send to the user.",
				},
				level: {
					type: "string",
					enum: ["info", "warning", "error"],
					description:
						'The severity level of the notification. "info" for progress updates, "warning" for potential issues, "error" for critical problems. Default: "info".',
				},
			},
			required: ["message"],
		},
	},
}

export default notifyUser
