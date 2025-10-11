/**
 * Explicit Completion Markers Module
 *
 * This module provides explicit START/END markers for terminal commands
 * to enable precise command completion detection, especially useful for
 * PowerShell and other shells with complex output patterns.
 */

import * as crypto from "crypto"

export interface MarkerConfig {
	enabled: boolean
	startMarker?: string
	endMarker?: string
	includeExitCode: boolean
	includeTimestamp: boolean
	useNonce: boolean
}

export class CompletionMarkers {
	private static readonly DEFAULT_START_MARKER = "▶▶▶ ROOCODE_CMD_START"
	private static readonly DEFAULT_END_MARKER = "◀◀◀ ROOCODE_CMD_END"

	private config: MarkerConfig
	private currentNonce: string | null = null

	constructor(config?: Partial<MarkerConfig>) {
		this.config = {
			enabled: false,
			startMarker: CompletionMarkers.DEFAULT_START_MARKER,
			endMarker: CompletionMarkers.DEFAULT_END_MARKER,
			includeExitCode: true,
			includeTimestamp: false,
			useNonce: true,
			...config,
		}
	}

	/**
	 * Enable or disable completion markers
	 */
	public setEnabled(enabled: boolean): void {
		this.config.enabled = enabled
	}

	/**
	 * Check if markers are enabled
	 */
	public isEnabled(): boolean {
		return this.config.enabled
	}

	/**
	 * Generate a unique nonce for this command execution
	 */
	private generateNonce(): string {
		return crypto.randomBytes(8).toString("hex")
	}

	/**
	 * Get the start marker for a command
	 */
	public getStartMarker(): string {
		if (!this.config.enabled) {
			return ""
		}

		this.currentNonce = this.config.useNonce ? this.generateNonce() : null

		let marker = this.config.startMarker || CompletionMarkers.DEFAULT_START_MARKER

		if (this.config.useNonce && this.currentNonce) {
			marker += `:${this.currentNonce}`
		}

		if (this.config.includeTimestamp) {
			marker += `:${Date.now()}`
		}

		return marker
	}

	/**
	 * Get the end marker for a command
	 */
	public getEndMarker(exitCode?: number): string {
		if (!this.config.enabled) {
			return ""
		}

		let marker = this.config.endMarker || CompletionMarkers.DEFAULT_END_MARKER

		if (this.config.useNonce && this.currentNonce) {
			marker += `:${this.currentNonce}`
		}

		if (this.config.includeExitCode && exitCode !== undefined) {
			marker += `:EXIT_CODE=${exitCode}`
		}

		if (this.config.includeTimestamp) {
			marker += `:${Date.now()}`
		}

		return marker
	}

	/**
	 * Wrap a command with start and end markers
	 * This is for PowerShell specifically
	 */
	public wrapCommandForPowerShell(command: string): string {
		if (!this.config.enabled) {
			return command
		}

		const startMarker = this.getStartMarker()
		const nonce = this.currentNonce || ""

		// PowerShell command wrapper that captures exit code
		return `
Write-Host "${startMarker}"
try {
	${command}
	$__exitCode = $LASTEXITCODE
	if ($null -eq $__exitCode) { $__exitCode = 0 }
} catch {
	Write-Error $_
	$__exitCode = 1
}
Write-Host "${this.config.endMarker}${nonce ? ":" + nonce : ""}:EXIT_CODE=$__exitCode"
exit $__exitCode
`.trim()
	}

	/**
	 * Wrap a command with markers for bash/zsh
	 */
	public wrapCommandForBash(command: string): string {
		if (!this.config.enabled) {
			return command
		}

		const startMarker = this.getStartMarker()
		const nonce = this.currentNonce || ""

		// Bash command wrapper that captures exit code
		return `
echo "${startMarker}"
${command}
__exit_code=$?
echo "${this.config.endMarker}${nonce ? ":" + nonce : ""}:EXIT_CODE=$__exit_code"
exit $__exit_code
`.trim()
	}

	/**
	 * Check if output contains the start marker
	 */
	public hasStartMarker(output: string): boolean {
		if (!this.config.enabled || !this.config.startMarker) {
			return false
		}

		if (this.config.useNonce && this.currentNonce) {
			return output.includes(`${this.config.startMarker}:${this.currentNonce}`)
		}

		return output.includes(this.config.startMarker)
	}

	/**
	 * Check if output contains the end marker
	 */
	public hasEndMarker(output: string): boolean {
		if (!this.config.enabled || !this.config.endMarker) {
			return false
		}

		if (this.config.useNonce && this.currentNonce) {
			return output.includes(`${this.config.endMarker}:${this.currentNonce}`)
		}

		return output.includes(this.config.endMarker)
	}

	/**
	 * Extract content between markers
	 */
	public extractContentBetweenMarkers(output: string): { content: string; exitCode?: number } | null {
		if (!this.config.enabled) {
			return null
		}

		const startPattern =
			this.config.useNonce && this.currentNonce
				? `${this.config.startMarker}:${this.currentNonce}`
				: this.config.startMarker

		const endPattern =
			this.config.useNonce && this.currentNonce
				? `${this.config.endMarker}:${this.currentNonce}`
				: this.config.endMarker

		const startIndex = output.indexOf(startPattern!)
		const endIndex = output.indexOf(endPattern!)

		if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
			return null
		}

		// Extract content between markers
		const startOffset = startIndex + startPattern!.length
		const content = output.substring(startOffset, endIndex).trim()

		// Try to extract exit code if present
		let exitCode: number | undefined
		const exitCodeMatch = output.substring(endIndex).match(/EXIT_CODE=(\d+)/)
		if (exitCodeMatch) {
			exitCode = parseInt(exitCodeMatch[1], 10)
		}

		return { content, exitCode }
	}

	/**
	 * Remove markers from output
	 */
	public removeMarkers(output: string): string {
		if (!this.config.enabled) {
			return output
		}

		let cleaned = output

		// Remove start marker line
		const startPattern =
			this.config.useNonce && this.currentNonce
				? new RegExp(
						`^.*${this.escapeRegex(this.config.startMarker!)}:${this.escapeRegex(this.currentNonce)}.*$`,
						"gm",
					)
				: new RegExp(`^.*${this.escapeRegex(this.config.startMarker!)}.*$`, "gm")

		cleaned = cleaned.replace(startPattern, "")

		// Remove end marker line
		const endPattern =
			this.config.useNonce && this.currentNonce
				? new RegExp(
						`^.*${this.escapeRegex(this.config.endMarker!)}:${this.escapeRegex(this.currentNonce)}.*$`,
						"gm",
					)
				: new RegExp(`^.*${this.escapeRegex(this.config.endMarker!)}.*$`, "gm")

		cleaned = cleaned.replace(endPattern, "")

		// Clean up any resulting empty lines
		cleaned = cleaned.replace(/^\s*[\r\n]/gm, "")

		return cleaned.trim()
	}

	/**
	 * Escape special regex characters
	 */
	private escapeRegex(str: string): string {
		return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
	}

	/**
	 * Reset the current nonce
	 */
	public reset(): void {
		this.currentNonce = null
	}

	/**
	 * Create markers from configuration
	 */
	public static fromConfig(config: Partial<MarkerConfig>): CompletionMarkers {
		return new CompletionMarkers(config)
	}

	/**
	 * Get PowerShell initialization script for markers
	 */
	public static getPowerShellInitScript(): string {
		return `
# Roo Code Completion Markers Setup
function Invoke-RooCodeCommand {
	param([string]$Command)
	
	$startMarker = "▶▶▶ ROOCODE_CMD_START:$(Get-Random)"
	$endMarker = "◀◀◀ ROOCODE_CMD_END"
	
	Write-Host $startMarker
	try {
		Invoke-Expression $Command
		$exitCode = $LASTEXITCODE
		if ($null -eq $exitCode) { $exitCode = 0 }
	} catch {
		Write-Error $_
		$exitCode = 1
	}
	Write-Host "$endMarker:EXIT_CODE=$exitCode"
	return $exitCode
}

# Alias for convenience
Set-Alias -Name roo -Value Invoke-RooCodeCommand
`.trim()
	}

	/**
	 * Get Bash initialization script for markers
	 */
	public static getBashInitScript(): string {
		return `
# Roo Code Completion Markers Setup
roo_code_command() {
	local start_marker="▶▶▶ ROOCODE_CMD_START:$$"
	local end_marker="◀◀◀ ROOCODE_CMD_END"
	
	echo "$start_marker"
	eval "$@"
	local exit_code=$?
	echo "$end_marker:EXIT_CODE=$exit_code"
	return $exit_code
}

# Alias for convenience
alias roo='roo_code_command'
`.trim()
	}
}
