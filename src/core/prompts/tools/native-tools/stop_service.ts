import type OpenAI from "openai"

const STOP_SERVICE_DESCRIPTION = `Stop a background service that was started with execute_command. This tool properly terminates the process tree to ensure the service and all its child processes are stopped.

IMPORTANT:
- You MUST provide the service_id parameter to stop a service.
- If you don't know the service_id, use get_service_logs without parameters to list all running services first.
- Do NOT try to stop services manually using taskkill or kill commands - use this tool instead for proper process tree termination.

Example: Stop a service
{ "service_id": "service-1" }`

const SERVICE_ID_PARAMETER_DESCRIPTION = `The ID of the service to stop. Use get_service_logs without parameters to list all running services and find the service_id.`

export default {
	type: "function",
	function: {
		name: "stop_service",
		description: STOP_SERVICE_DESCRIPTION,
		strict: true,
		parameters: {
			type: "object",
			properties: {
				service_id: {
					type: "string",
					description: SERVICE_ID_PARAMETER_DESCRIPTION,
				},
			},
			required: ["service_id"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
