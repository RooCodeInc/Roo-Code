/**
 * Command Classifier - Categorizes shell commands by risk level
 * Determines whether commands are safe to auto-execute or require HITL approval
 */

import { CommandClassification } from "./types"

export class CommandClassifier {
	// Safe read-only commands
	private static readonly SAFE_READ_PATTERNS = [
		/^cat\s/,
		/^ls\s/,
		/^ls$/,
		/^dir\s/,
		/^dir$/,
		/^grep\s/,
		/^find\s/,
		/^git\s+log/,
		/^git\s+status/,
		/^git\s+diff/,
		/^git\s+show/,
		/^pwd$/,
		/^echo\s/,
		/^head\s/,
		/^tail\s/,
		/^less\s/,
		/^more\s/,
	]

	// Safe build/test commands
	private static readonly SAFE_BUILD_PATTERNS = [
		/^npm\s+run\s+build/,
		/^npm\s+run\s+test/,
		/^npm\s+test/,
		/^yarn\s+build/,
		/^yarn\s+test/,
		/^pnpm\s+build/,
		/^pnpm\s+test/,
		/^tsc\s/,
		/^tsc$/,
		/^eslint\s/,
		/^prettier\s/,
		/^jest\s/,
		/^vitest\s/,
		/^cargo\s+build/,
		/^cargo\s+test/,
		/^go\s+build/,
		/^go\s+test/,
		/^mvn\s+test/,
		/^gradle\s+test/,
	]

	// Destructive commands requiring HITL
	private static readonly DESTRUCTIVE_PATTERNS = [
		/rm\s+-rf/,
		/rm\s+-fr/,
		/rm\s+.*-.*r.*f/,
		/git\s+push\s+.*--force/,
		/git\s+push\s+.*-f\s/,
		/DROP\s+TABLE/i,
		/DROP\s+DATABASE/i,
		/DELETE\s+FROM/i,
		/TRUNCATE/i,
		/mkfs\./,
		/dd\s+if=/,
		/>\/dev\//,
		/chmod\s+777/,
		/chown\s+-R/,
	]

	// Network commands requiring HITL
	private static readonly NETWORK_PATTERNS = [
		/^curl\s/,
		/^wget\s/,
		/^ssh\s/,
		/^scp\s/,
		/^sftp\s/,
		/^ftp\s/,
		/^nc\s/,
		/^netcat\s/,
		/^telnet\s/,
	]

	// Ambiguous commands requiring HITL
	private static readonly AMBIGUOUS_PATTERNS = [
		/^npx\s/,
		/^npm\s+install/,
		/^npm\s+i\s/,
		/^yarn\s+add/,
		/^pnpm\s+add/,
		/^pip\s+install/,
		/^gem\s+install/,
		/^cargo\s+install/,
	]

	/**
	 * Classify a shell command by risk level
	 * @param command The shell command to classify
	 * @returns CommandClassification enum value
	 */
	static classify(command: string): CommandClassification {
		const trimmedCommand = command.trim()

		// Check destructive patterns first (highest priority)
		if (this.matchesAny(trimmedCommand, this.DESTRUCTIVE_PATTERNS)) {
			return CommandClassification.DESTRUCTIVE
		}

		// Check network patterns
		if (this.matchesAny(trimmedCommand, this.NETWORK_PATTERNS)) {
			return CommandClassification.NETWORK
		}

		// Check ambiguous patterns
		if (this.matchesAny(trimmedCommand, this.AMBIGUOUS_PATTERNS)) {
			return CommandClassification.AMBIGUOUS
		}

		// Check safe build patterns
		if (this.matchesAny(trimmedCommand, this.SAFE_BUILD_PATTERNS)) {
			return CommandClassification.SAFE_BUILD
		}

		// Check safe read patterns
		if (this.matchesAny(trimmedCommand, this.SAFE_READ_PATTERNS)) {
			return CommandClassification.SAFE_READ
		}

		// Default to ambiguous for unknown commands
		return CommandClassification.AMBIGUOUS
	}

	/**
	 * Check if command requires HITL approval
	 * @param command The shell command
	 * @returns true if HITL approval required
	 */
	static requiresApproval(command: string): boolean {
		const classification = this.classify(command)
		return (
			classification === CommandClassification.DESTRUCTIVE ||
			classification === CommandClassification.NETWORK ||
			classification === CommandClassification.AMBIGUOUS
		)
	}

	/**
	 * Get human-readable description of command classification
	 * @param classification The classification enum
	 * @returns Description string
	 */
	static getDescription(classification: CommandClassification): string {
		switch (classification) {
			case CommandClassification.SAFE_READ:
				return "Safe read-only command"
			case CommandClassification.SAFE_BUILD:
				return "Safe build/test command"
			case CommandClassification.DESTRUCTIVE:
				return "Destructive command - may delete files or modify system state"
			case CommandClassification.NETWORK:
				return "Network command - may access external resources"
			case CommandClassification.AMBIGUOUS:
				return "Ambiguous command - may install packages or execute arbitrary code"
			default:
				return "Unknown command type"
		}
	}

	private static matchesAny(command: string, patterns: RegExp[]): boolean {
		return patterns.some((pattern) => pattern.test(command))
	}
}
