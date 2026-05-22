import { parseCommand } from "@roo/parse-command"

/**
 * Find the longest matching prefix from a list of prefixes for a given command.
 * Case-insensitive prefix matching with wildcard support.
 *
 * This mirrors the logic in `src/core/auto-approval/commands.ts` so the webview
 * can independently determine which sub-commands are denied.
 */
function findLongestPrefixMatch(command: string, prefixes: string[]): string | null {
	if (!command || !prefixes?.length) {
		return null
	}

	const trimmedCommand = command.trim().toLowerCase()
	let longestMatch: string | null = null

	for (const prefix of prefixes) {
		const lowerPrefix = prefix.toLowerCase()
		if (lowerPrefix === "*" || trimmedCommand.startsWith(lowerPrefix)) {
			if (!longestMatch || lowerPrefix.length > longestMatch.length) {
				longestMatch = lowerPrefix
			}
		}
	}

	return longestMatch
}

/**
 * Check if a single sub-command is denied based on the longest prefix match rule.
 * A command is considered denied when the deny list has a matching prefix that is
 * at least as long as any matching allow list prefix.
 */
function isSubcommandDenied(command: string, allowedCommands: string[], deniedCommands: string[]): boolean {
	if (!command?.trim() || !deniedCommands?.length) {
		return false
	}

	const cmdWithoutRedirection = command.replace(/\d*>&\d*/, "").trim()
	const longestDeniedMatch = findLongestPrefixMatch(cmdWithoutRedirection, deniedCommands)

	if (!longestDeniedMatch) {
		return false
	}

	const longestAllowedMatch = findLongestPrefixMatch(cmdWithoutRedirection, allowedCommands || [])

	if (!longestAllowedMatch) {
		return true
	}

	// Deny list wins when its match is longer or equal
	return longestDeniedMatch.length >= longestAllowedMatch.length
}

/**
 * Get the list of denied sub-commands from a full command string.
 * Parses the command into sub-commands (splitting by &&, ||, ;, |, etc.)
 * and returns the ones that match the deny list.
 *
 * @param command - Full command string (may contain chained commands)
 * @param allowedCommands - List of allowed command prefixes
 * @param deniedCommands - List of denied command prefixes
 * @returns Array of sub-command strings that are denied
 */
export function getDeniedSubcommands(command: string, allowedCommands: string[], deniedCommands: string[]): string[] {
	if (!command?.trim() || !deniedCommands?.length) {
		return []
	}

	const subCommands = parseCommand(command)

	return subCommands.filter((cmd) => {
		const trimmed = cmd.trim()
		return trimmed && isSubcommandDenied(trimmed, allowedCommands, deniedCommands)
	})
}
