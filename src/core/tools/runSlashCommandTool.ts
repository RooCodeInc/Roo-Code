import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { getCommand, getCommandNames } from "../../services/command/commands"
import { EXPERIMENT_IDS, experiments } from "../../shared/experiments"
import { parseMentions } from "../mentions"
import { UrlContentFetcher } from "../../services/browser/UrlContentFetcher"

export async function runSlashCommandTool(
	task: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	// Check if run slash command experiment is enabled
	const provider = task.providerRef.deref()
	const state = await provider?.getState()
	const isRunSlashCommandEnabled = experiments.isEnabled(state?.experiments ?? {}, EXPERIMENT_IDS.RUN_SLASH_COMMAND)

	if (!isRunSlashCommandEnabled) {
		pushToolResult(
			formatResponse.toolError(
				"Run slash command is an experimental feature that must be enabled in settings. Please enable 'Run Slash Command' in the Experimental Settings section.",
			),
		)
		return
	}

	const commandName: string | undefined = block.params.command
	const args: string | undefined = block.params.args

	try {
		if (block.partial) {
			const partialMessage = JSON.stringify({
				tool: "runSlashCommand",
				command: removeClosingTag("command", commandName),
				args: removeClosingTag("args", args),
			})

			await task.ask("tool", partialMessage, block.partial).catch(() => {})
			return
		} else {
			if (!commandName) {
				task.consecutiveMistakeCount++
				task.recordToolError("run_slash_command")
				pushToolResult(await task.sayAndCreateMissingParamError("run_slash_command", "command"))
				return
			}

			task.consecutiveMistakeCount = 0

			// Get the command from the commands service
			const command = await getCommand(task.cwd, commandName)

			if (!command) {
				// Get available commands for error message
				const availableCommands = await getCommandNames(task.cwd)
				task.recordToolError("run_slash_command")
				pushToolResult(
					formatResponse.toolError(
						`Command '${commandName}' not found. Available commands: ${availableCommands.join(", ") || "(none)"}`,
					),
				)
				return
			}

			const toolMessage = JSON.stringify({
				tool: "runSlashCommand",
				command: commandName,
				args: args,
				source: command.source,
				description: command.description,
			})

			const didApprove = await askApproval("tool", toolMessage)

			if (!didApprove) {
				return
			}

			// Process mentions in the command content
			const provider = task.providerRef.deref()
			const urlContentFetcher = new UrlContentFetcher(provider!.context)
			let processedContent = command.content

			try {
				// Process @/file references and other mentions in the command content
				processedContent = await parseMentions(
					command.content,
					task.cwd,
					urlContentFetcher,
					undefined, // fileContextTracker - not needed for slash commands
					undefined, // rooIgnoreController - will use default
					false, // showRooIgnoredFiles
					true, // includeDiagnosticMessages
					50, // maxDiagnosticMessages
					undefined, // maxReadFileLine
				)
			} catch (error) {
				// If mention processing fails, log the error but continue with original content
				console.warn(`Failed to process mentions in slash command content: ${error}`)
			}

			// Build the result message
			let result = `Command: /${commandName}`

			if (command.description) {
				result += `\nDescription: ${command.description}`
			}

			if (command.argumentHint) {
				result += `\nArgument hint: ${command.argumentHint}`
			}

			if (args) {
				result += `\nProvided arguments: ${args}`
			}

			result += `\nSource: ${command.source}`
			result += `\n\n--- Command Content ---\n\n${processedContent}`

			// Return the command content as the tool result
			pushToolResult(result)

			return
		}
	} catch (error) {
		await handleError("running slash command", error)
		return
	}
}
