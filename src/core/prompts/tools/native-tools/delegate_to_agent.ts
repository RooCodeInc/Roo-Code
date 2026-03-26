import type OpenAI from "openai"

const DELEGATE_TO_AGENT_DESCRIPTION = `Delegate a task to an external A2A (Agent-to-Agent) agent. Use this tool when you need to send work to a specialized agent that can handle a specific task. The agent will process the request and return results. This runs as a background operation - you can continue with other work while waiting for the agent to respond.

Parameters:
- agent_name: (required) The name of the A2A agent to delegate to, as configured in the A2A settings.
- message: (required) The task description or message to send to the agent. Be specific about what you need the agent to do.`

const delegate_to_agent: OpenAI.Chat.ChatCompletionTool = {
	type: "function",
	function: {
		name: "delegate_to_agent",
		description: DELEGATE_TO_AGENT_DESCRIPTION,
		parameters: {
			type: "object",
			properties: {
				agent_name: {
					type: "string",
					description: "The name of the A2A agent to delegate to, as configured in the A2A settings.",
				},
				message: {
					type: "string",
					description:
						"The task description or message to send to the agent. Be specific about what you need the agent to do.",
				},
			},
			required: ["agent_name", "message"],
			additionalProperties: false,
		},
	},
}

export default delegate_to_agent
