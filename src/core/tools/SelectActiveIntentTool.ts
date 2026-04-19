/**
 * SelectActiveIntentTool — The Mandatory Handshake
 *
 * This tool is the FIRST thing the agent must call before modifying any file.
 * It implements the "Two-Stage State Machine" from the architecture spec:
 *
 * Stage 1 (Request):    User asks for a code change
 * Stage 2 (Handshake):  Agent calls select_active_intent → gets context injected
 * Stage 3 (Action):     Agent now writes code with full intent context
 *
 * What this tool does:
 * 1. Reads .orchestration/active_intents.yaml
 * 2. Finds the intent by ID
 * 3. Registers it as the active intent in the HookEngine (per-task state)
 * 4. Returns an <intent_context> XML block back to the LLM
 *    — the LLM now knows: what files it can touch, what constraints apply,
 *      and what "done" looks like
 */

import { Task } from "../task/Task"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import { findIntentById } from "../../hooks/utils/intentLoader"
import { hookEngine } from "../../hooks/HookEngine"
import { IntentState } from "../../hooks/types"
import type { ToolUse } from "../../shared/tools"

interface SelectActiveIntentParams {
	intent_id: string
}

export class SelectActiveIntentTool extends BaseTool<"select_active_intent"> {
	readonly name = "select_active_intent" as const

	async execute(params: SelectActiveIntentParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { pushToolResult } = callbacks
		const { intent_id } = params

		if (!intent_id) {
			pushToolResult(
				`[select_active_intent] Error: 'intent_id' parameter is required.\n` +
					`Please provide a valid intent ID from .orchestration/active_intents.yaml`,
			)
			return
		}

		// Load the intent from the YAML file
		const intent = await findIntentById(task.cwd, intent_id)

		if (!intent) {
			pushToolResult(
				`[select_active_intent] Error: Intent '${intent_id}' not found in .orchestration/active_intents.yaml\n` +
					`Available intent IDs can be found by reading: .orchestration/active_intents.yaml`,
			)
			return
		}

		if (intent.status === "COMPLETED" || intent.status === "CANCELLED") {
			pushToolResult(
				`[select_active_intent] Error: Intent '${intent_id}' has status '${intent.status}' and cannot be activated.\n` +
					`Only IN_PROGRESS or PENDING intents can be selected.`,
			)
			return
		}

		// Register the active intent in the HookEngine (per-task state)
		const intentState: IntentState = {
			intentId: intent.id,
			intentName: intent.name,
			ownedScope: intent.owned_scope ?? [],
			constraints: intent.constraints ?? [],
			acceptanceCriteria: intent.acceptance_criteria ?? [],
			activatedAt: new Date().toISOString(),
		}
		hookEngine.setActiveIntent(task.taskId, intentState)

		// Build the <intent_context> XML block for the LLM
		// This is what gets injected into the model's context
		const scopeXml =
			intentState.ownedScope.length > 0
				? `<owned_scope>\n${intentState.ownedScope.map((p) => `      <path>${p}</path>`).join("\n")}\n    </owned_scope>`
				: `<owned_scope><!-- No scope restrictions defined --></owned_scope>`

		const constraintsXml =
			intentState.constraints.length > 0
				? `<constraints>\n${intentState.constraints.map((c) => `      <constraint>${c}</constraint>`).join("\n")}\n    </constraints>`
				: ""

		const criteriaXml =
			intentState.acceptanceCriteria.length > 0
				? `<acceptance_criteria>\n${intentState.acceptanceCriteria.map((c) => `      <criterion>${c}</criterion>`).join("\n")}\n    </acceptance_criteria>`
				: ""

		const intentContext = `
<intent_context>
  <intent id="${intent.id}" name="${intent.name}" status="${intent.status}">
    ${scopeXml}
    ${constraintsXml}
    ${criteriaXml}
    <governance>
      <rule>You may ONLY modify files within the owned_scope paths listed above.</rule>
      <rule>Any attempt to write outside this scope will be BLOCKED by the system.</rule>
      <rule>All your changes will be traced and linked to intent ID: ${intent.id}</rule>
    </governance>
  </intent>
</intent_context>

Intent '${intent.id}' is now active. You have loaded the context for: "${intent.name}".
You may now proceed with code modifications within the declared scope.
`.trim()

		pushToolResult(intentContext)
	}

	override async handlePartial(task: Task, block: ToolUse<"select_active_intent">): Promise<void> {
		// No streaming UI needed for this tool
	}
}

export const selectActiveIntentTool = new SelectActiveIntentTool()
