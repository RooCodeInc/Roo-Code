import { IHook, ToolCall, HookResult, ToolHookContext } from "../types"
import { IntentGatekeeper } from "../middleware/intent-gatekeeper"

export class PreToolUseHook implements IHook {
	name = "PreToolUseHook"
	private gatekeeper: IntentGatekeeper

	constructor() {
		this.gatekeeper = new IntentGatekeeper()
	}

	async execute(toolCall: ToolCall, context?: ToolHookContext): Promise<HookResult> {
		if (!context) {
			return { blocked: false }
		}

		const gatekeeperResult = await this.gatekeeper.execute(toolCall, context)
		if (gatekeeperResult.blocked) {
			return gatekeeperResult
		}

		const riskLevel = this.classifyRisk(toolCall)
		if (riskLevel === "DESTRUCTIVE") {
			return {
				blocked: true,
				reason: "HITL_REQUIRED: Destructive command requires human approval",
				recoveryHint: "Awaiting user authorization via IDE modal",
			}
		}

		return { blocked: false }
	}

	private classifyRisk(toolCall: ToolCall): "SAFE" | "DESTRUCTIVE" {
		const destructivePatterns = ["delete", "remove", "rm", "drop", "destroy"]
		const toolName = toolCall.name.toLowerCase()

		if (destructivePatterns.some((p) => toolName.includes(p))) {
			return "DESTRUCTIVE"
		}
		return "SAFE"
	}
}
