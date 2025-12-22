import { parse } from "shell-quote"

export type ShellToken = string | { op: string } | { command: string }

/**
 * Join lines that are within quoted strings.
 *
 * This function scans through the input character by character, tracking
 * whether we're inside a quoted string. When we encounter a newline while
 * inside quotes, we preserve it rather than splitting the command.
 *
 * This approach:
 * - Preserves the original content exactly (no placeholder replacement/restoration)
 * - Properly handles both single and double quotes
 * - Handles escaped quotes within strings
 * - Handles different line ending formats (CRLF, LF, CR)
 *
 * @param command - The command string that may contain multiline quoted strings
 * @returns Array of logical command lines with multiline quotes joined
 */
export function joinQuotedLines(command: string): string[] {
	if (!command) {
		return []
	}

	const result: string[] = []
	let currentLine = ""
	let inDoubleQuote = false
	let inSingleQuote = false
	let i = 0

	while (i < command.length) {
		const char = command[i]

		// Handle escape sequences (only in double quotes, single quotes are literal)
		// Count consecutive backslashes before the current character
		// If odd count, the current character is escaped; if even, it's not
		// e.g., \" = escaped quote, \\" = escaped backslash + closing quote
		let backslashCount = 0
		if (inDoubleQuote) {
			let j = i - 1
			while (j >= 0 && command[j] === "\\") {
				backslashCount++
				j--
			}
		}
		const isEscaped = backslashCount % 2 === 1

		// Handle quote state changes
		if (char === '"' && !inSingleQuote && !isEscaped) {
			inDoubleQuote = !inDoubleQuote
			currentLine += char
		} else if (char === "'" && !inDoubleQuote) {
			// Single quotes can't be escaped, so we just toggle
			inSingleQuote = !inSingleQuote
			currentLine += char
		} else if (char === "\r" || char === "\n") {
			// Handle different line endings: \r\n, \n, or \r
			if (char === "\r" && command[i + 1] === "\n") {
				// CRLF - consume both characters
				if (inDoubleQuote || inSingleQuote) {
					// Inside quotes - preserve the newline in the command
					currentLine += "\r\n"
				} else {
					// Outside quotes - this is a line separator
					if (currentLine.trim()) {
						result.push(currentLine)
					}
					currentLine = ""
				}
				i++ // Skip the \n since we consumed it
			} else {
				// LF or CR alone
				if (inDoubleQuote || inSingleQuote) {
					// Inside quotes - preserve the newline in the command
					currentLine += char
				} else {
					// Outside quotes - this is a line separator
					if (currentLine.trim()) {
						result.push(currentLine)
					}
					currentLine = ""
				}
			}
		} else {
			currentLine += char
		}

		i++
	}

	// Don't forget the last line
	if (currentLine.trim()) {
		result.push(currentLine)
	}

	return result
}

/**
 * Split a command string into individual sub-commands by
 * chaining operators (&&, ||, ;, |, or &) and newlines.
 *
 * Uses shell-quote to properly handle:
 * - Quoted strings (preserves quotes)
 * - Subshell commands ($(cmd), `cmd`, <(cmd), >(cmd))
 * - PowerShell redirections (2>&1)
 * - Chain operators (&&, ||, ;, |, &)
 * - Newlines as command separators (respecting quoted strings)
 */
export function parseCommand(command: string): string[] {
	if (!command?.trim()) {
		return []
	}

	// Join lines that are within quoted strings first
	// This preserves multiline quoted content as single logical lines
	const lines = joinQuotedLines(command)
	const allCommands: string[] = []

	for (const line of lines) {
		// Skip empty lines
		if (!line.trim()) {
			continue
		}

		// Process each line through the existing parsing logic
		const lineCommands = parseCommandLine(line)
		allCommands.push(...lineCommands)
	}

	return allCommands
}

/**
 * Parse a single line of commands.
 */
function parseCommandLine(command: string): string[] {
	if (!command?.trim()) return []

	// Storage for replaced content
	const redirections: string[] = []
	const subshells: string[] = []
	const quotes: string[] = []
	const arrayIndexing: string[] = []
	const arithmeticExpressions: string[] = []
	const variables: string[] = []
	const parameterExpansions: string[] = []

	// First handle PowerShell redirections by temporarily replacing them
	let processedCommand = command.replace(/\d*>&\d*/g, (match) => {
		redirections.push(match)
		return `__REDIR_${redirections.length - 1}__`
	})

	// Handle arithmetic expressions: $((...)) pattern
	// Match the entire arithmetic expression including nested parentheses
	processedCommand = processedCommand.replace(/\$\(\([^)]*(?:\)[^)]*)*\)\)/g, (match) => {
		arithmeticExpressions.push(match)
		return `__ARITH_${arithmeticExpressions.length - 1}__`
	})

	// Handle $[...] arithmetic expressions (alternative syntax)
	processedCommand = processedCommand.replace(/\$\[[^\]]*\]/g, (match) => {
		arithmeticExpressions.push(match)
		return `__ARITH_${arithmeticExpressions.length - 1}__`
	})

	// Handle parameter expansions: ${...} patterns (including array indexing)
	// This covers ${var}, ${var:-default}, ${var:+alt}, ${#var}, ${var%pattern}, etc.
	processedCommand = processedCommand.replace(/\$\{[^}]+\}/g, (match) => {
		parameterExpansions.push(match)
		return `__PARAM_${parameterExpansions.length - 1}__`
	})

	// Handle process substitutions: <(...) and >(...)
	processedCommand = processedCommand.replace(/[<>]\(([^)]+)\)/g, (_, inner) => {
		subshells.push(inner.trim())
		return `__SUBSH_${subshells.length - 1}__`
	})

	// Handle simple variable references: $varname pattern
	// This prevents shell-quote from splitting $count into separate tokens
	processedCommand = processedCommand.replace(/\$[a-zA-Z_][a-zA-Z0-9_]*/g, (match) => {
		variables.push(match)
		return `__VAR_${variables.length - 1}__`
	})

	// Handle special bash variables: $?, $!, $#, $$, $@, $*, $-, $0-$9
	processedCommand = processedCommand.replace(/\$[?!#$@*\-0-9]/g, (match) => {
		variables.push(match)
		return `__VAR_${variables.length - 1}__`
	})

	// Then handle subshell commands $() and back-ticks
	processedCommand = processedCommand
		.replace(/\$\((.*?)\)/g, (_, inner) => {
			subshells.push(inner.trim())
			return `__SUBSH_${subshells.length - 1}__`
		})
		.replace(/`(.*?)`/g, (_, inner) => {
			subshells.push(inner.trim())
			return `__SUBSH_${subshells.length - 1}__`
		})

	// Then handle quoted strings
	processedCommand = processedCommand.replace(/"[^"]*"/g, (match) => {
		quotes.push(match)
		return `__QUOTE_${quotes.length - 1}__`
	})

	let tokens: ShellToken[]
	try {
		tokens = parse(processedCommand) as ShellToken[]
	} catch (error: any) {
		// If shell-quote fails to parse, fall back to simple splitting
		console.warn("shell-quote parse error:", error.message, "for command:", processedCommand)

		// Simple fallback: split by common operators
		const fallbackCommands = processedCommand
			.split(/(?:&&|\|\||;|\||&)/)
			.map((cmd) => cmd.trim())
			.filter((cmd) => cmd.length > 0)

		// Restore all placeholders for each command
		return fallbackCommands.map((cmd) =>
			restorePlaceholders(
				cmd,
				quotes,
				redirections,
				arrayIndexing,
				arithmeticExpressions,
				parameterExpansions,
				variables,
				subshells,
			),
		)
	}

	const commands: string[] = []
	let currentCommand: string[] = []

	for (const token of tokens) {
		if (typeof token === "object" && "op" in token) {
			// Chain operator - split command
			if (["&&", "||", ";", "|", "&"].includes(token.op)) {
				if (currentCommand.length > 0) {
					commands.push(currentCommand.join(" "))
					currentCommand = []
				}
			} else {
				// Other operators (>) are part of the command
				currentCommand.push(token.op)
			}
		} else if (typeof token === "string") {
			// Check if it's a subshell placeholder
			const subshellMatch = token.match(/__SUBSH_(\d+)__/)
			if (subshellMatch) {
				if (currentCommand.length > 0) {
					commands.push(currentCommand.join(" "))
					currentCommand = []
				}
				commands.push(subshells[parseInt(subshellMatch[1])])
			} else {
				currentCommand.push(token)
			}
		}
	}

	// Add any remaining command
	if (currentCommand.length > 0) {
		commands.push(currentCommand.join(" "))
	}

	// Restore quotes and redirections
	return commands.map((cmd) =>
		restorePlaceholders(
			cmd,
			quotes,
			redirections,
			arrayIndexing,
			arithmeticExpressions,
			parameterExpansions,
			variables,
			subshells,
		),
	)
}

/**
 * Helper function to restore placeholders in a command string.
 */
function restorePlaceholders(
	command: string,
	quotes: string[],
	redirections: string[],
	arrayIndexing: string[],
	arithmeticExpressions: string[],
	parameterExpansions: string[],
	variables: string[],
	subshells: string[],
): string {
	let result = command
	// Restore quotes
	result = result.replace(/__QUOTE_(\d+)__/g, (_, i) => quotes[parseInt(i)])
	// Restore redirections
	result = result.replace(/__REDIR_(\d+)__/g, (_, i) => redirections[parseInt(i)])
	// Restore array indexing expressions
	result = result.replace(/__ARRAY_(\d+)__/g, (_, i) => arrayIndexing[parseInt(i)])
	// Restore arithmetic expressions
	result = result.replace(/__ARITH_(\d+)__/g, (_, i) => arithmeticExpressions[parseInt(i)])
	// Restore parameter expansions
	result = result.replace(/__PARAM_(\d+)__/g, (_, i) => parameterExpansions[parseInt(i)])
	// Restore variable references
	result = result.replace(/__VAR_(\d+)__/g, (_, i) => variables[parseInt(i)])
	result = result.replace(/__SUBSH_(\d+)__/g, (_, i) => subshells[parseInt(i)])
	return result
}
