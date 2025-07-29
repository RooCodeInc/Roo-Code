import { modes, getModeBySlug } from "../shared/modes"

/**
 * Represents a detected slash command
 */
export interface SlashCommand {
	/** The full command text including the slash */
	fullCommand: string
	/** The command name without the slash */
	commandName: string
	/** The type of command: custom or mode_switch */
	type: "custom" | "mode_switch"
}

/**
 * Detects slash commands in user input text
 * @param text The user input text to analyze
 * @returns Array of detected slash commands
 */
export function detectSlashCommands(text: string): SlashCommand[] {
	if (!text) {
		return []
	}

	// Regex to match slash commands at the beginning of a line or after whitespace
	// Matches /command_name (letters, numbers, hyphens, underscores)
	// Must be followed by word boundary to avoid matching file paths
	const slashCommandRegex = /(?:^|\s)(\/[a-zA-Z][a-zA-Z0-9_-]*)(?=\s|$)/gm
	const commands: SlashCommand[] = []
	let match

	while ((match = slashCommandRegex.exec(text)) !== null) {
		const fullCommand = match[1]
		const commandName = fullCommand.substring(1) // Remove the leading slash

		// Determine if this is a mode switch command or custom command
		const commandType = isModeCommand(commandName) ? "mode_switch" : "custom"

		commands.push({
			fullCommand,
			commandName,
			type: commandType,
		})
	}

	return commands
}

/**
 * Checks if a command name corresponds to a mode switch
 * @param commandName The command name to check (without slash)
 * @returns True if this is a mode switch command
 */
function isModeCommand(commandName: string): boolean {
	// Check if the command name matches any mode slug
	const mode = getModeBySlug(commandName)
	return mode !== undefined
}

/**
 * Extracts the first slash command from text, if any
 * @param text The user input text to analyze
 * @returns The first detected slash command or null
 */
export function getFirstSlashCommand(text: string): SlashCommand | null {
	const commands = detectSlashCommands(text)
	return commands.length > 0 ? commands[0] : null
}
