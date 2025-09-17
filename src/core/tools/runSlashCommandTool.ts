import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { getCommand, getCommandNames } from "../../services/command/commands"
import { EXPERIMENT_IDS, experiments } from "../../shared/experiments"
import { McpServerManager } from "../../services/mcp/McpServerManager"

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

			// Get the command from the commands service (pass McpHub for MCP prompt support)
			let mcpHub = undefined
			if (provider) {
				try {
					mcpHub = await McpServerManager.getInstance(provider.context, provider)
				} catch (error) {
					console.error("Failed to get MCP hub:", error)
				}
			}
			const command = await getCommand(task.cwd, commandName, mcpHub)

			if (!command) {
				// Get available commands for error message
				const availableCommands = await getCommandNames(task.cwd, mcpHub)
				task.recordToolError("run_slash_command")
				pushToolResult(
					formatResponse.toolError(
						`Command '${commandName}' not found. Available commands: ${availableCommands.join(", ") || "(none)"}`,
					),
				)
				return
			}

			// Handle MCP prompt commands differently
			let commandContent = command.content

			if (command.source === "mcp" && command.name.startsWith("mcp.") && mcpHub) {
				const parts = command.name.split(".")
				if (parts.length >= 3) {
					const serverName = parts[1]
					const promptName = parts.slice(2).join(".")

					try {
						const { executeMcpPrompt, parsePromptArguments } = await import(
							"../../services/command/mcp-prompts"
						)

						// Parse arguments if provided
						let promptArgs: Record<string, unknown> = {}
						if (args) {
							const servers = mcpHub.getAllServers()
							const server = servers.find((s) => s.name === serverName)
							const prompt = server?.prompts?.find((p) => p.name === promptName)

							if (prompt) {
								promptArgs = parsePromptArguments(prompt, args)
							}
						}

						// Execute the MCP prompt to get the actual content
						commandContent = await executeMcpPrompt(mcpHub, serverName, promptName, promptArgs)
					} catch (error) {
						console.error(`Failed to execute MCP prompt ${command.name}:`, error)
						commandContent = `Error executing MCP prompt: ${error instanceof Error ? error.message : String(error)}`
					}
				}
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
			result += `\n\n--- Command Content ---\n\n${commandContent}`

			// Return the command content as the tool result
			pushToolResult(result)

			return
		}
	} catch (error) {
		await handleError("running slash command", error)
		return
	}
}
