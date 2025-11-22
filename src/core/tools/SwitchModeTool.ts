import delay from "delay"

import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { defaultModeSlug, getModeBySlug } from "../../shared/modes"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { ToolUse } from "../../shared/tools"

interface SwitchModeParams {
	mode_slug: string
	reason: string
}

export class SwitchModeTool extends BaseTool<"switch_mode"> {
	readonly name = "switch_mode" as const

	parseLegacy(params: Partial<Record<string, string>>): SwitchModeParams {
		return {
			mode_slug: params.mode_slug || "",
			reason: params.reason || "",
		}
	}

	async execute(params: SwitchModeParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { mode_slug, reason } = params
		const { askApproval, handleError, pushToolResult, toolProtocol } = callbacks

		try {
			if (!mode_slug) {
				task.consecutiveMistakeCount++
				task.recordToolError("switch_mode")
				pushToolResult(await task.sayAndCreateMissingParamError("switch_mode", "mode_slug"))
				return
			}

			task.consecutiveMistakeCount = 0

			const state = await task.providerRef.deref()?.getState()
			const customModes = state?.customModes

			// Verify the mode exists (including hidden modes)
			const targetMode = getModeBySlug(mode_slug, customModes)

			if (!targetMode) {
				task.recordToolError("switch_mode")
				pushToolResult(formatResponse.toolError(`Invalid mode: ${mode_slug}`))
				return
			}

			// Check if already in requested mode
			const currentMode = state?.mode ?? defaultModeSlug
			const currentModeConfig = getModeBySlug(currentMode, customModes)

			// Check if the target mode is hidden
			if (targetMode.hidden) {
				// Hidden modes can only be accessed by their parent mode
				if (!targetMode.parent || targetMode.parent !== currentMode) {
					task.recordToolError("switch_mode")
					pushToolResult(
						formatResponse.toolError(
							`Mode '${mode_slug}' is not accessible from the current mode '${currentMode}'.`,
						),
					)
					return
				}
			}

			if (currentMode === mode_slug) {
				task.recordToolError("switch_mode")
				pushToolResult(`Already in ${targetMode.name} mode.`)
				return
			}

			const completeMessage = JSON.stringify({ tool: "switchMode", mode: mode_slug, reason })
			const didApprove = await askApproval("tool", completeMessage)

			if (!didApprove) {
				return
			}

			// Switch the mode using shared handler
			await task.providerRef.deref()?.handleModeSwitch(mode_slug)

			pushToolResult(
				`Successfully switched from ${currentModeConfig?.name ?? currentMode} mode to ${
					targetMode.name
				} mode${reason ? ` because: ${reason}` : ""}.`,
			)

			await delay(500) // Delay to allow mode change to take effect before next tool is executed
		} catch (error) {
			await handleError("switching mode", error as Error)
		}
	}

	override async handlePartial(task: Task, block: ToolUse<"switch_mode">): Promise<void> {
		const mode_slug: string | undefined = block.params.mode_slug
		const reason: string | undefined = block.params.reason

		const partialMessage = JSON.stringify({
			tool: "switchMode",
			mode: this.removeClosingTag("mode_slug", mode_slug, block.partial),
			reason: this.removeClosingTag("reason", reason, block.partial),
		})

		await task.ask("tool", partialMessage, block.partial).catch(() => {})
	}
}

export const switchModeTool = new SwitchModeTool()
