import { parse } from "shell-quote"

export type ShellToken = string | { op: string } | { command: string }

/**
 * Replace multiline quoted strings with placeholders before splitting by newlines.
 * This prevents quoted strings that span multiple lines from being incorrectly split.
 *
 * @param command - The command string to process
 * @returns An object with the processed command and arrays of replaced quotes
 */
function replaceMultilineQuotes(command: string): {
	processedCommand: string
	multilineDoubleQuotes: string[]
	multilineSingleQuotes: string[]
} {
	const multilineDoubleQuotes: string[] = []
	const multilineSingleQuotes: string[] = []

	// Replace multiline double-quoted strings with placeholders
	// This regex matches double-quoted strings that contain newlines
	let processedCommand = command.replace(/"([^"\\]|\\.)*"/gs, (match) => {
		if (/\r\n|\r|\n/.test(match)) {
			multilineDoubleQuotes.push(match)
			return `__MLQUOTE_D_${multilineDoubleQuotes.length - 1}__`
		}
		return match
	})

	// Replace multiline single-quoted strings with placeholders
	// Single quotes don't support escape sequences in shell, but we still need to handle them
	processedCommand = processedCommand.replace(/'[^']*'/gs, (match) => {
		if (/\r\n|\r|\n/.test(match)) {
			multilineSingleQuotes.push(match)
			return `__MLQUOTE_S_${multilineSingleQuotes.length - 1}__`
		}
		return match
	})

	return { processedCommand, multilineDoubleQuotes, multilineSingleQuotes }
}

/**
 * Restore multiline quoted string placeholders back to their original values.
 *
 * @param command - The command with placeholders
 * @param multilineDoubleQuotes - Array of replaced double-quoted strings
 * @param multilineSingleQuotes - Array of replaced single-quoted strings
 * @returns The command with placeholders restored
 */
function restoreMultilineQuotes(
	command: string,
	multilineDoubleQuotes: string[],
	multilineSingleQuotes: string[],
): string {
	let result = command
	result = result.replace(/__MLQUOTE_D_(\d+)__/g, (_, i) => multilineDoubleQuotes[parseInt(i)])
	result = result.replace(/__MLQUOTE_S_(\d+)__/g, (_, i) => multilineSingleQuotes[parseInt(i)])
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
 * - Newlines as command separators
 * - Multiline quoted strings (preserves them as single commands)
 */
export function parseCommand(command: string): string[] {
	if (!command?.trim()) {
		return []
	}

	// First, replace multiline quoted strings with placeholders
	// This prevents them from being incorrectly split when we split by newlines
	const { processedCommand, multilineDoubleQuotes, multilineSingleQuotes } = replaceMultilineQuotes(command)

	// Split by newlines (handle different line ending formats)
	// This regex splits on \r\n (Windows), \n (Unix), or \r (old Mac)
	const lines = processedCommand.split(/\r\n|\r|\n/)
	const allCommands: string[] = []

	for (const line of lines) {
		// Skip empty lines
		if (!line.trim()) {
			continue
		}

		// Process each line through the existing parsing logic
		const lineCommands = parseCommandLine(line)

		// Restore multiline quotes in each parsed command
		const restoredCommands = lineCommands.map((cmd) =>
			restoreMultilineQuotes(cmd, multilineDoubleQuotes, multilineSingleQuotes),
		)

		allCommands.push(...restoredCommands)
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
