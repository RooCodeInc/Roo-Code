import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { BaseTool, ToolCallbacks } from "./BaseTool"

interface SkillParams {
	skill: string
	args?: string
}

export class SkillTool extends BaseTool<"skill"> {
	readonly name = "skill" as const

	async execute(params: SkillParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { skill: skillName, args } = params
		const { handleError, pushToolResult } = callbacks

		try {
			// Validate skill name parameter
			if (!skillName) {
				task.consecutiveMistakeCount++
				task.recordToolError("skill")
				task.didToolFailInCurrentTurn = true
				pushToolResult(await task.sayAndCreateMissingParamError("skill", "skill"))
				return
			}

			task.consecutiveMistakeCount = 0

			// Get SkillsManager from provider
			const provider = task.providerRef.deref()
			const skillsManager = provider?.getSkillsManager()

			if (!skillsManager) {
				task.recordToolError("skill")
				task.didToolFailInCurrentTurn = true
				pushToolResult(formatResponse.toolError("Skills Manager not available"))
				return
			}

			// Get current mode for skill resolution
			const state = await provider?.getState()
			const currentMode = state?.mode ?? "code"

			// Fetch skill content
			const skillContent = await skillsManager.getSkillContent(skillName, currentMode)

			if (!skillContent) {
				// Get available skills for error message
				const availableSkills = skillsManager.getSkillsForMode(currentMode)
				const skillNames = availableSkills.map((s) => s.name)

				task.recordToolError("skill")
				task.didToolFailInCurrentTurn = true
				pushToolResult(
					formatResponse.toolError(
						`Skill '${skillName}' not found. Available skills: ${skillNames.join(", ") || "(none)"}`,
					),
				)
				return
			}

			// Build the result message - no approval needed, skills just execute
			let result = `Skill: ${skillName}`

			if (skillContent.description) {
				result += `\nDescription: ${skillContent.description}`
			}

			if (args) {
				result += `\nProvided arguments: ${args}`
			}

			result += `\nSource: ${skillContent.source}`
			result += `\n\n--- Skill Instructions ---\n\n${skillContent.instructions}`

			pushToolResult(result)
		} catch (error) {
			await handleError("executing skill", error as Error)
		}
	}

	// No handlePartial - skills execute silently without streaming UI
}

export const skillTool = new SkillTool()
