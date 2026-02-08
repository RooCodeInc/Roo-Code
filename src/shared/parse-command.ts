import { parse } from "shell-quote"

export type ShellToken = string | { op: string } | { command: string }

/**
 * Result of quote validation.
 * - `valid: true` means the command has balanced quotes
 * - `valid: false` means the command has unbalanced quotes with details
 */
export type QuoteValidationResult =
	| { valid: true }
	| { valid: false; quoteType: "single" | "double"; position: number; context: string }

/**
 * Validates that a command has balanced quotes and won't cause the shell to hang
 * waiting for more input.
 *
 * This function detects:
 * - Unbalanced single quotes (')
 * - Unbalanced double quotes (")
 *
 * It correctly handles:
 * - Escaped quotes within strings (\' and \")
 * - Quotes nested within the opposite quote type ("it's" or 'say "hi"')
 * - Heredoc syntax (<<EOF, <<'EOF', <<"EOF") which legitimately spans lines
 * - ANSI-C quoting ($'...')
 *
 * @param command The shell command to validate
 * @returns QuoteValidationResult indicating if quotes are balanced
 */
export function validateCommandQuotes(command: string): QuoteValidationResult {
	if (!command || command.trim().length === 0) {
		return { valid: true }
	}

	// Check for heredoc patterns which legitimately expect more input
	// Common heredoc patterns: <<EOF, <<-EOF, <<'EOF', <<"EOF", << 'EOF'
	const heredocPattern = /<<-?\s*['"]?\w+['"]?\s*$/
	if (heredocPattern.test(command.trim())) {
		// Heredocs are valid multi-line constructs - don't flag as unbalanced
		return { valid: true }
	}

	let inSingleQuote = false
	let inDoubleQuote = false
	let singleQuoteStart = -1
	let doubleQuoteStart = -1
	let i = 0

	while (i < command.length) {
		const char = command[i]

		// Handle ANSI-C quoting: $'...' - treat as single quote
		if (char === "$" && i + 1 < command.length && command[i + 1] === "'") {
			if (!inSingleQuote && !inDoubleQuote) {
				inSingleQuote = true
				singleQuoteStart = i
				i += 2 // Skip $'
				continue
			}
		}

		// Count consecutive backslashes before this character
		// An even number of backslashes means the quote is NOT escaped
		// An odd number means it IS escaped
		const isEscaped = (): boolean => {
			let backslashCount = 0
			let j = i - 1
			while (j >= 0 && command[j] === "\\") {
				backslashCount++
				j--
			}
			// Odd number of backslashes = escaped
			return backslashCount % 2 === 1
		}

		// Handle single quotes
		if (char === "'") {
			// Inside double quotes, single quotes are literal
			if (inDoubleQuote) {
				i++
				continue
			}

			// Check for escape sequence (only valid outside quotes in some shells,
			// but we're conservative and check for \' pattern)
			// Note: In single quotes, backslash is literal, so \' doesn't escape
			// But outside quotes or at string boundaries, it can be an escape
			if (!inSingleQuote && isEscaped()) {
				// Escaped single quote outside any quotes - skip it
				i++
				continue
			}

			if (inSingleQuote) {
				// Closing single quote
				inSingleQuote = false
				singleQuoteStart = -1
			} else {
				// Opening single quote
				inSingleQuote = true
				singleQuoteStart = i
			}
		}

		// Handle double quotes
		if (char === '"') {
			// Inside single quotes, double quotes are literal
			if (inSingleQuote) {
				i++
				continue
			}

			// Check for escape sequence \" (valid inside double quotes)
			// Must account for escaped backslashes: \\" means backslash + unescaped quote
			if (isEscaped()) {
				// Escaped double quote - skip it
				i++
				continue
			}

			if (inDoubleQuote) {
				// Closing double quote
				inDoubleQuote = false
				doubleQuoteStart = -1
			} else {
				// Opening double quote
				inDoubleQuote = true
				doubleQuoteStart = i
			}
		}

		i++
	}

	// Check for unbalanced quotes
	if (inSingleQuote) {
		const contextStart = Math.max(0, singleQuoteStart - 10)
		const contextEnd = Math.min(command.length, singleQuoteStart + 20)
		const context = command.slice(contextStart, contextEnd)
		return {
			valid: false,
			quoteType: "single",
			position: singleQuoteStart,
			context: context,
		}
	}

	if (inDoubleQuote) {
		const contextStart = Math.max(0, doubleQuoteStart - 10)
		const contextEnd = Math.min(command.length, doubleQuoteStart + 20)
		const context = command.slice(contextStart, contextEnd)
		return {
			valid: false,
			quoteType: "double",
			position: doubleQuoteStart,
			context: context,
		}
	}

	return { valid: true }
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
 */
export function parseCommand(command: string): string[] {
	if (!command?.trim()) {
		return []
	}

	// Split by newlines first (handle different line ending formats)
	// This regex splits on \r\n (Windows), \n (Unix), or \r (old Mac)
	const lines = command.split(/\r\n|\r|\n/)
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
