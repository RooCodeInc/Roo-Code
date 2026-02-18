/**
 * select_active_intent — Native tool schema definition.
 *
 * Phase 1 "Handshake" tool for the Intent-Driven Architecture.
 * This tool forces the AI agent to declare which business intent (from
 * .orchestration/active_intents.yaml) it is working on BEFORE it can
 * perform any mutating operations (write_to_file, execute_command, etc.).
 *
 * The HookEngine intercepts this tool call at PreToolUse to:
 *   1. Read .orchestration/active_intents.yaml from the workspace root
 *   2. Find the matching intent by ID
 *   3. Build an <intent_context> XML block with constraints, scope, and criteria
 *   4. Return the block as the tool result so the AI sees it in the next turn
 *
 * @see src/hooks/HookEngine.ts — orchestration entry point
 * @see src/hooks/IntentContextLoader.ts — YAML parsing and context building
 * @see TRP1 Challenge Week 1 — Phase 1: The Handshake
 */
import type OpenAI from "openai"

const SELECT_ACTIVE_INTENT_DESCRIPTION = `Declare which business intent you are working on. You MUST call this tool before performing any mutating operations (write_to_file, apply_diff, execute_command, etc.). This loads the constraints, owned_scope, and acceptance_criteria for the selected intent from the project's .orchestration/active_intents.yaml file.

Parameters:
- intent_id: (required) The unique identifier of the intent to activate (e.g., "INT-001"). Must match an entry in .orchestration/active_intents.yaml.

Example: Selecting an intent before refactoring auth
{ "intent_id": "INT-001" }`

const INTENT_ID_PARAMETER_DESCRIPTION = `The unique identifier of the business intent to activate (e.g., "INT-001"). Must match an id in .orchestration/active_intents.yaml.`

export default {
	type: "function",
	function: {
		name: "select_active_intent",
		description: SELECT_ACTIVE_INTENT_DESCRIPTION,
		strict: true,
		parameters: {
			type: "object",
			properties: {
				intent_id: {
					type: "string",
					description: INTENT_ID_PARAMETER_DESCRIPTION,
				},
			},
			required: ["intent_id"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
