/**
 * PowerShell Prompt Detection Module
 *
 * This module provides enhanced detection of PowerShell prompt patterns
 * to improve command completion detection in PowerShell terminals.
 */

export interface PromptPattern {
	name: string
	pattern: RegExp
	description: string
}

export class PowerShellPromptDetector {
	// Common PowerShell prompt patterns
	private static readonly DEFAULT_PATTERNS: PromptPattern[] = [
		{
			name: "standard",
			pattern: /^PS\s+[A-Z]:\\.*?>\s*$/m,
			description: "Standard PowerShell prompt (PS C:\\...>)",
		},
		{
			name: "standardWithNewline",
			pattern: /^PS\s+[A-Z]:\\.*?>\s*\r?\n$/m,
			description: "Standard PowerShell prompt with newline",
		},
		{
			name: "adminPrompt",
			pattern: /^Administrator:\s*.*?PS\s+[A-Z]:\\.*?>\s*$/m,
			description: "Administrator PowerShell prompt",
		},
		{
			name: "customFunction",
			pattern: /^PS>\s*$/m,
			description: "Simplified PS> prompt",
		},
		{
			name: "ohMyPosh",
			pattern: /[\u276F\u276E\u25B6\u25C0].*?>\s*$/m,
			description: "Oh My Posh styled prompts with special characters",
		},
		{
			name: "starship",
			pattern: /[\u276F\u2192\u279C].*?[$>]\s*$/m,
			description: "Starship prompt framework patterns",
		},
		{
			name: "poshGit",
			pattern: /\[.*?\]\s*.*?>\s*$/m,
			description: "Posh-Git prompts with git status in brackets",
		},
		{
			name: "genericEndPrompt",
			pattern: /[>$#]\s*$/m,
			description: "Generic prompt ending with >, $, or #",
		},
	]

	private customPatterns: PromptPattern[] = []
	private enabled: boolean = true
	private lastDetectedPrompt: string | null = null
	private detectionConfidence: number = 0

	constructor(customPatterns?: PromptPattern[]) {
		if (customPatterns) {
			this.customPatterns = customPatterns
		}
	}

	/**
	 * Enable or disable prompt detection
	 */
	public setEnabled(enabled: boolean): void {
		this.enabled = enabled
	}

	/**
	 * Add a custom prompt pattern
	 */
	public addCustomPattern(pattern: PromptPattern): void {
		this.customPatterns.push(pattern)
	}

	/**
	 * Clear all custom patterns
	 */
	public clearCustomPatterns(): void {
		this.customPatterns = []
	}

	/**
	 * Detect if the given output contains a PowerShell prompt
	 * @param output The terminal output to check
	 * @param useCustomPatternsOnly If true, only use custom patterns
	 * @returns True if a prompt is detected
	 */
	public detectPrompt(output: string, useCustomPatternsOnly: boolean = false): boolean {
		if (!this.enabled || !output) {
			return false
		}

		// Try custom patterns first (higher priority)
		for (const pattern of this.customPatterns) {
			if (pattern.pattern.test(output)) {
				this.lastDetectedPrompt = pattern.name
				this.detectionConfidence = 1.0 // Custom patterns have high confidence
				return true
			}
		}

		// If not using custom patterns only, try default patterns
		if (!useCustomPatternsOnly) {
			for (const pattern of PowerShellPromptDetector.DEFAULT_PATTERNS) {
				if (pattern.pattern.test(output)) {
					this.lastDetectedPrompt = pattern.name
					// Assign confidence based on pattern specificity
					this.detectionConfidence = this.calculateConfidence(pattern.name)
					return true
				}
			}
		}

		this.lastDetectedPrompt = null
		this.detectionConfidence = 0
		return false
	}

	/**
	 * Check if output ends with a prompt (more strict check)
	 */
	public endsWithPrompt(output: string): boolean {
		if (!this.enabled || !output) {
			return false
		}

		// Get the last line or last few characters
		const lines = output.split(/\r?\n/)
		const lastLine = lines[lines.length - 1] || lines[lines.length - 2] || ""

		// Check if the last line matches any prompt pattern
		return this.detectPrompt(lastLine)
	}

	/**
	 * Get the last detected prompt type
	 */
	public getLastDetectedPrompt(): string | null {
		return this.lastDetectedPrompt
	}

	/**
	 * Get the confidence level of the last detection (0-1)
	 */
	public getDetectionConfidence(): number {
		return this.detectionConfidence
	}

	/**
	 * Calculate confidence based on pattern type
	 */
	private calculateConfidence(patternName: string): number {
		switch (patternName) {
			case "standard":
			case "standardWithNewline":
			case "adminPrompt":
				return 0.95 // Very high confidence for standard prompts
			case "customFunction":
			case "poshGit":
			case "ohMyPosh":
			case "starship":
				return 0.85 // High confidence for known frameworks
			case "genericEndPrompt":
				return 0.6 // Lower confidence for generic patterns
			default:
				return 0.7
		}
	}

	/**
	 * Wait for prompt with timeout
	 * @param checkFunction Function that returns the current output
	 * @param timeout Maximum time to wait in milliseconds
	 * @param checkInterval How often to check in milliseconds
	 */
	public async waitForPrompt(
		checkFunction: () => string,
		timeout: number = 5000,
		checkInterval: number = 100,
	): Promise<boolean> {
		const startTime = Date.now()

		while (Date.now() - startTime < timeout) {
			const output = checkFunction()
			if (this.endsWithPrompt(output)) {
				return true
			}
			await new Promise((resolve) => setTimeout(resolve, checkInterval))
		}

		return false
	}

	/**
	 * Create a detector from a configuration string
	 * Format: "pattern1|pattern2|pattern3" where each pattern is a regex
	 */
	public static fromConfigString(configString: string): PowerShellPromptDetector {
		const patterns: PromptPattern[] = []

		if (configString && configString.trim()) {
			const parts = configString
				.split("|")
				.map((s) => s.trim())
				.filter((s) => s)

			parts.forEach((part, index) => {
				try {
					patterns.push({
						name: `custom_${index}`,
						pattern: new RegExp(part, "m"),
						description: `Custom pattern: ${part}`,
					})
				} catch (e) {
					console.warn(`Invalid regex pattern: ${part}`)
				}
			})
		}

		return new PowerShellPromptDetector(patterns)
	}
}
