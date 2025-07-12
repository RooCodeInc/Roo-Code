// Define the constant locally since it's a simple string
const COMMAND_OUTPUT_STRING = "Output:"

export interface ParsedCommand {
	command: string
	output: string
	suggestions: string[]
}

/**
 * Parses command text to extract the command, output, and suggestions.
 * Supports both <suggestions> JSON array format and individual <suggest> tags.
 */
export const parseCommandAndOutput = (text: string | undefined): ParsedCommand => {
	if (!text) {
		return { command: "", output: "", suggestions: [] }
	}

	// First, extract suggestions from the text
	const suggestions: string[] = []

	// Parse <suggestions> tag with JSON array
	const suggestionsMatch = text.match(/<suggestions>([\s\S]*?)<\/suggestions>/)
	if (suggestionsMatch) {
		try {
			const parsed = JSON.parse(suggestionsMatch[1])
			if (Array.isArray(parsed)) {
				suggestions.push(...parsed.filter((s: any) => typeof s === "string" && s.trim()))
			}
		} catch {
			// Invalid JSON, ignore
		}
		// Remove the suggestions tag from text
		text = text.replace(/<suggestions>[\s\S]*?<\/suggestions>/, "")
	}

	// Parse individual <suggest> tags
	let suggestMatch
	const suggestRegex = /<suggest>([\s\S]*?)<\/suggest>/g
	while ((suggestMatch = suggestRegex.exec(text)) !== null) {
		const suggestion = suggestMatch[1].trim()
		if (suggestion) {
			suggestions.push(suggestion)
		}
	}
	// Remove all suggest tags from text
	text = text.replace(/<suggest>[\s\S]*?<\/suggest>/g, "")

	// Now parse command and output
	const index = text.indexOf(COMMAND_OUTPUT_STRING)

	if (index === -1) {
		return { command: text.trim(), output: "", suggestions }
	}

	return {
		command: text.slice(0, index).trim(),
		output: text.slice(index + COMMAND_OUTPUT_STRING.length),
		suggestions,
	}
}
