import type OpenAI from "openai"

const GET_SERVICE_LOGS_DESCRIPTION = `Get logs from a background service that was started with execute_command. This is useful for debugging and monitoring services that are running in the background (like development servers, docker containers, etc.).

IMPORTANT: To get logs from a service, you MUST provide the service_id parameter. If you don't know the service_id, first call this tool without service_id to list all running services, then call it again with the service_id to get the logs.

Parameters:
- service_id: (optional) The ID of the service to get logs from. If null or not provided, lists all running services and their IDs. To get logs, you MUST provide a valid service_id string.
- max_lines: (optional) Maximum number of log lines to return (default: 100).

Example: List all running services (to find service_id)
{ "service_id": null, "max_lines": null }

Example: Get logs from a specific service (REQUIRED to get actual logs)
{ "service_id": "service-1", "max_lines": 50 }`

const SERVICE_ID_PARAMETER_DESCRIPTION = `The ID of the service to get logs from. If not provided, lists all running services.`

const MAX_LINES_PARAMETER_DESCRIPTION = `Maximum number of log lines to return (default: 100).`

export default {
	type: "function",
	function: {
		name: "get_service_logs",
		description: GET_SERVICE_LOGS_DESCRIPTION,
		strict: true,
		parameters: {
			type: "object",
			properties: {
				service_id: {
					type: ["string", "null"],
					description: SERVICE_ID_PARAMETER_DESCRIPTION,
				},
				max_lines: {
					type: ["number", "null"],
					description: MAX_LINES_PARAMETER_DESCRIPTION,
				},
			},
			required: [],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
