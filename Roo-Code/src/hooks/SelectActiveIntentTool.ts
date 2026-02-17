import type OpenAI from "openai"

/**
 * The select_active_intent tool definition.
 * This tool must be injected into buildNativeToolsArray() in build-tools.ts.
 *
 * The system prompt instructs the LLM that it CANNOT call write_to_file or
 * execute_command without first calling this tool to "check out" an intent.
 *
 * The Pre-Hook intercepts this call, loads context from active_intents.yaml,
 * and injects it back as the tool result — establishing the Handshake.
 */
export const selectActiveIntentToolDefinition: OpenAI.Chat.ChatCompletionTool = {
	type: "function",
	function: {
		name: "select_active_intent",
		description: `MANDATORY FIRST STEP. You MUST call this tool before any write_to_file, apply_diff, or execute_command call.

This tool "checks out" a business intent from active_intents.yaml. It loads the intent's constraints, owned file scope, and acceptance criteria into your context window. Without checking out an intent, all destructive tool calls will be blocked.

Use this to answer: "What am I authorized to change, and why?"`,
		parameters: {
			type: "object",
			properties: {
				intent_id: {
					type: "string",
					description:
						"The ID of the intent to activate (e.g. 'INT-001'). Must match an entry in .orchestration/active_intents.yaml.",
				},
				reasoning: {
					type: "string",
					description:
						"Brief explanation of why this intent is relevant to the current user request.",
				},
			},
			required: ["intent_id", "reasoning"],
		},
	},
}
