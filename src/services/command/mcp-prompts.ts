import { Command } from "./commands"
import { McpHub } from "../mcp/McpHub"
import { McpPrompt } from "../../shared/mcp"

/**
 * Convert MCP prompts to commands that can be used in the slash command system
 */
export async function getMcpPromptsAsCommands(mcpHub: McpHub | undefined): Promise<Command[]> {
	if (!mcpHub) {
		return []
	}

	const commands: Command[] = []
	const servers = mcpHub.getAllServers()

	for (const server of servers) {
		if (server.disabled || server.status !== "connected" || !server.prompts) {
			continue
		}

		// Add each prompt as a command with the pattern: mcp.<serverName>.<promptName>
		for (const prompt of server.prompts) {
			const commandName = `mcp.${server.name}.${prompt.name}`
			commands.push({
				name: commandName,
				content: "", // Content will be fetched dynamically when the command is used
				source: server.source === "project" ? "project" : "global",
				filePath: "", // Virtual command, no file path
				description: prompt.description || `MCP prompt from ${server.name}`,
				argumentHint: getArgumentHint(prompt),
			})
		}
	}

	return commands
}

/**
 * Get a specific MCP prompt command by name
 */
export async function getMcpPromptCommand(
	mcpHub: McpHub | undefined,
	commandName: string,
): Promise<Command | undefined> {
	if (!mcpHub || !commandName.startsWith("mcp.")) {
		return undefined
	}

	// Parse the command name: mcp.<serverName>.<promptName>
	const parts = commandName.split(".")
	if (parts.length < 3) {
		return undefined
	}

	const serverName = parts[1]
	const promptName = parts.slice(2).join(".") // Handle prompt names with dots

	const servers = mcpHub.getAllServers()
	const server = servers.find((s) => s.name === serverName)

	if (!server || server.disabled || server.status !== "connected" || !server.prompts) {
		return undefined
	}

	const prompt = server.prompts.find((p) => p.name === promptName)
	if (!prompt) {
		return undefined
	}

	return {
		name: commandName,
		content: "", // Content will be fetched dynamically when the command is used
		source: server.source === "project" ? "project" : "global",
		filePath: "", // Virtual command, no file path
		description: prompt.description || `MCP prompt from ${server.name}`,
		argumentHint: getArgumentHint(prompt),
	}
}

/**
 * Execute an MCP prompt and get the resulting content
 */
export async function executeMcpPrompt(
	mcpHub: McpHub,
	serverName: string,
	promptName: string,
	args?: Record<string, unknown>,
): Promise<string> {
	try {
		const response = await mcpHub.getPrompt(serverName, promptName, args)

		// Convert the prompt response to a string that can be used as command content
		if (response.messages && response.messages.length > 0) {
			// Combine all messages into a single string
			const content = response.messages
				.map((msg) => {
					if (msg.content.type === "text" && msg.content.text) {
						return msg.content.text
					} else if (msg.content.type === "resource" && msg.content.resource?.text) {
						return msg.content.resource.text
					}
					return ""
				})
				.filter((text) => text.length > 0)
				.join("\n\n")

			return content || "No content returned from MCP prompt"
		}

		return "No messages returned from MCP prompt"
	} catch (error) {
		console.error(`Failed to execute MCP prompt ${promptName} on server ${serverName}:`, error)
		throw new Error(`Failed to execute MCP prompt: ${error instanceof Error ? error.message : String(error)}`)
	}
}

/**
 * Get argument hint for a prompt based on its arguments
 */
function getArgumentHint(prompt: McpPrompt): string | undefined {
	if (!prompt.arguments || prompt.arguments.length === 0) {
		return undefined
	}

	const requiredArgs = prompt.arguments.filter((arg) => arg.required !== false)
	const optionalArgs = prompt.arguments.filter((arg) => arg.required === false)

	const hints: string[] = []

	if (requiredArgs.length > 0) {
		hints.push(requiredArgs.map((arg) => `<${arg.name}>`).join(" "))
	}

	if (optionalArgs.length > 0) {
		hints.push(optionalArgs.map((arg) => `[${arg.name}]`).join(" "))
	}

	return hints.join(" ") || undefined
}

/**
 * Parse arguments from a command string
 */
export function parsePromptArguments(prompt: McpPrompt, argsString: string): Record<string, unknown> {
	if (!prompt.arguments || prompt.arguments.length === 0) {
		return {}
	}

	const trimmedArgs = argsString.trim()
	if (trimmedArgs.length === 0) {
		return {}
	}

	const args: Record<string, unknown> = {}
	const parts = trimmedArgs.split(/\s+/)

	// Simple positional argument parsing
	// In a more sophisticated implementation, we could support named arguments
	prompt.arguments.forEach((arg, index) => {
		if (index < parts.length) {
			args[arg.name] = parts[index]
		}
	})

	return args
}
