import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { getCommand, getCommandNames } from "../../services/command/commands"
import { EXPERIMENT_IDS, experiments } from "../../shared/experiments"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { ToolUse } from "../../shared/tools"
import { getModeBySlug } from "../../shared/modes"
import type { SkillContent } from "../../shared/skills"

interface RunSlashCommandParams {
	command: string
	args?: string
}

export class RunSlashCommandTool extends BaseTool<"run_slash_command"> {
	readonly name = "run_slash_command" as const

	async execute(params: RunSlashCommandParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { command: commandName, args } = params
		const { askApproval, handleError, pushToolResult } = callbacks

		// Check if run slash command experiment is enabled
		const provider = task.providerRef.deref()
		const state = await provider?.getState()
		const isRunSlashCommandEnabled = experiments.isEnabled(
			state?.experiments ?? {},
			EXPERIMENT_IDS.RUN_SLASH_COMMAND,
		)

		if (!isRunSlashCommandEnabled) {
			pushToolResult(
				formatResponse.toolError(
					"Run slash command is an experimental feature that must be enabled in settings. Please enable 'Run Slash Command' in the Experimental Settings section.",
				),
			)
			return
		}

		try {
			if (!commandName) {
				task.consecutiveMistakeCount++
				task.recordToolError("run_slash_command")
				task.didToolFailInCurrentTurn = true
				pushToolResult(await task.sayAndCreateMissingParamError("run_slash_command", "command"))
				return
			}

			task.consecutiveMistakeCount = 0

			// Get the command from the commands service
			const command = await getCommand(task.cwd, commandName)

			// Check if this might be a skill-based command
			let skillContent: SkillContent | null = null
			let skillName: string | undefined

			if (!command) {
				// Try to find a skill-based command with this name
				const skillsManager = provider?.getSkillsManager?.()
				const currentMode = state?.mode ?? "code"

				if (skillsManager) {
					const skillCommands = skillsManager.getSkillsAsCommands(currentMode)
					const matchingSkillCmd = skillCommands.find((sc) => sc.name === commandName)

					if (matchingSkillCmd) {
						// Found a skill-based command - load the skill content
						skillName = matchingSkillCmd.skillName
						skillContent = await skillsManager.getSkillContent(skillName, currentMode)
					}
				}
			}

			if (!command && !skillContent) {
				// Get available commands for error message
				const availableCommands = await getCommandNames(task.cwd)

				// Also include skill-based command names
				const skillsManager = provider?.getSkillsManager?.()
				const currentMode = state?.mode ?? "code"
				const skillCommandNames = skillsManager?.getSkillsAsCommands(currentMode).map((sc) => sc.name) ?? []
				const allCommandNames = [...new Set([...availableCommands, ...skillCommandNames])]

				task.recordToolError("run_slash_command")
				task.didToolFailInCurrentTurn = true
				pushToolResult(
					formatResponse.toolError(
						`Command '${commandName}' not found. Available commands: ${allCommandNames.join(", ") || "(none)"}`,
					),
				)
				return
			}

			// Handle skill-based command
			if (skillContent) {
				const toolMessage = JSON.stringify({
					tool: "runSlashCommand",
					command: commandName,
					args: args,
					source: skillContent.source,
					description: skillContent.description,
					isSkill: true,
					skillName: skillName,
				})

				const didApprove = await askApproval("tool", toolMessage)

				if (!didApprove) {
					return
				}

				// Build the result message for skill-based command
				let result = `Skill Command: /${commandName}`

				if (skillContent.description) {
					result += `\nDescription: ${skillContent.description}`
				}

				if (args) {
					result += `\nProvided arguments: ${args}`
				}

				result += `\nSource: ${skillContent.source} (skill: ${skillName})`
				result += `\n\n--- Skill Instructions ---\n\n${skillContent.instructions}`

				pushToolResult(result)
				return
			}

			// Handle regular command
			const toolMessage = JSON.stringify({
				tool: "runSlashCommand",
				command: commandName,
				args: args,
				source: command!.source,
				description: command!.description,
				mode: command!.mode,
			})

			const didApprove = await askApproval("tool", toolMessage)

			if (!didApprove) {
				return
			}

			// Switch mode if specified in the command frontmatter
			if (command!.mode) {
				const targetMode = getModeBySlug(command!.mode, (await provider?.getState())?.customModes)
				if (targetMode) {
					await provider?.handleModeSwitch(command!.mode)
				}
			}

			// Build the result message
			let result = `Command: /${commandName}`

			if (command!.description) {
				result += `\nDescription: ${command!.description}`
			}

			if (command!.argumentHint) {
				result += `\nArgument hint: ${command!.argumentHint}`
			}

			if (command!.mode) {
				result += `\nMode: ${command!.mode}`
			}

			if (args) {
				result += `\nProvided arguments: ${args}`
			}

			result += `\nSource: ${command!.source}`
			result += `\n\n--- Command Content ---\n\n${command!.content}`

			// Return the command content as the tool result
			pushToolResult(result)
		} catch (error) {
			await handleError("running slash command", error as Error)
		}
	}

	override async handlePartial(task: Task, block: ToolUse<"run_slash_command">): Promise<void> {
		const commandName: string | undefined = block.params.command
		const args: string | undefined = block.params.args

		const partialMessage = JSON.stringify({
			tool: "runSlashCommand",
			command: commandName,
			args: args,
		})

		await task.ask("tool", partialMessage, block.partial).catch(() => {})
	}
}

export const runSlashCommandTool = new RunSlashCommandTool()
