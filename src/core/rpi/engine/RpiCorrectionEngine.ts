import type { RpiToolObservation } from "../RpiAutopilot"

interface RpiCorrectionContext {
	failedToolName: string
	errorMessage: string
	observation: RpiToolObservation
	recentObservations: RpiToolObservation[]
	attemptCount: number
}

export interface RpiCorrectionSuggestion {
	action:
		| "retry_with_modification"
		| "skip_step"
		| "decompose_further"
		| "ask_user"
		| "alternative_approach"
		| "phase_regression"
	reasoning: string
	suggestedToolHint?: string
	escalationLevel: 1 | 2 | 3
}

// Error patterns for rule-based correction
const APPLY_DIFF_MISMATCH = /content mismatch|unable to apply|does not exist/i
const PERMISSION_DENIED = /permission denied|access denied|EACCES/i
const FILE_NOT_FOUND = /ENOENT|no such file|file not found|does not exist/i
const NO_RESULTS = /no results|no matches|0 results/i
const COMMAND_FAILED = /exit code|exited with|non-zero/i

export class RpiCorrectionEngine {
	analyze(context: RpiCorrectionContext): RpiCorrectionSuggestion {
		const { attemptCount } = context

		// Escalation levels inspired by Manus AI (3 levels)
		if (attemptCount >= 3) {
			return this.escalateToUser(context)
		}
		if (attemptCount >= 2) {
			return this.suggestAlternativeApproach(context)
		}
		return this.suggestRetryWithModification(context)
	}

	private suggestRetryWithModification(context: RpiCorrectionContext): RpiCorrectionSuggestion {
		const { failedToolName, errorMessage } = context

		// apply_diff content mismatch → read_file first, then retry
		if (failedToolName === "apply_diff" && APPLY_DIFF_MISMATCH.test(errorMessage)) {
			return {
				action: "retry_with_modification",
				reasoning:
					"Diff content mismatch. Read the file first to get current content, then retry with updated diff.",
				suggestedToolHint: "read_file",
				escalationLevel: 1,
			}
		}

		// File not found → verify path exists
		if (FILE_NOT_FOUND.test(errorMessage)) {
			return {
				action: "retry_with_modification",
				reasoning: "File not found. Verify the path with list_files or search_files before retrying.",
				suggestedToolHint: "list_files",
				escalationLevel: 1,
			}
		}

		// Permission denied → check path
		if (PERMISSION_DENIED.test(errorMessage)) {
			return {
				action: "retry_with_modification",
				reasoning: "Permission denied. Verify the file path and check if it's in a protected location.",
				suggestedToolHint: "list_files",
				escalationLevel: 1,
			}
		}

		// Search with no results → broaden query
		if (
			(failedToolName === "search_files" || failedToolName === "codebase_search") &&
			NO_RESULTS.test(errorMessage)
		) {
			return {
				action: "retry_with_modification",
				reasoning:
					"Search returned no results. Try broadening the query or searching in a different directory.",
				escalationLevel: 1,
			}
		}

		// Command failed → retry with adjusted flags
		if (failedToolName === "execute_command" && COMMAND_FAILED.test(errorMessage)) {
			return {
				action: "retry_with_modification",
				reasoning: "Command failed. Check the error output and retry with adjusted arguments.",
				escalationLevel: 1,
			}
		}

		// Generic retry
		return {
			action: "retry_with_modification",
			reasoning: `Tool ${failedToolName} failed: ${errorMessage.slice(0, 100)}. Review the error and retry with corrections.`,
			escalationLevel: 1,
		}
	}

	private suggestAlternativeApproach(context: RpiCorrectionContext): RpiCorrectionSuggestion {
		const { failedToolName } = context

		// apply_diff failing repeatedly → use write_to_file instead
		if (failedToolName === "apply_diff") {
			return {
				action: "alternative_approach",
				reasoning:
					"apply_diff failed repeatedly. Consider using write_to_file to replace the entire file content.",
				suggestedToolHint: "write_to_file",
				escalationLevel: 2,
			}
		}

		// Search failing → try different discovery approach
		if (failedToolName === "search_files" || failedToolName === "codebase_search") {
			return {
				action: "alternative_approach",
				reasoning: "Search failed repeatedly. Try list_files + read_file to manually explore the codebase.",
				suggestedToolHint: "list_files",
				escalationLevel: 2,
			}
		}

		// Same file failing 3+ times → regress to discovery
		if (this.hasSameFileFailures(context.recentObservations, 3)) {
			return {
				action: "phase_regression",
				reasoning:
					"Multiple failures on the same file. Re-read the file to understand current state before continuing.",
				suggestedToolHint: "read_file",
				escalationLevel: 2,
			}
		}

		// Generic alternative
		return {
			action: "alternative_approach",
			reasoning: `Tool ${failedToolName} failed twice. Consider a fundamentally different approach to achieve the same goal.`,
			escalationLevel: 2,
		}
	}

	private escalateToUser(context: RpiCorrectionContext): RpiCorrectionSuggestion {
		return {
			action: "ask_user",
			reasoning: `Tool ${context.failedToolName} has failed ${context.attemptCount} times. User guidance may be needed to proceed.`,
			escalationLevel: 3,
		}
	}

	private hasSameFileFailures(observations: RpiToolObservation[], minCount: number): boolean {
		const failedFiles = observations
			.filter((o) => !o.success && o.filesAffected && o.filesAffected.length > 0)
			.flatMap((o) => o.filesAffected!)

		const counts = new Map<string, number>()
		for (const file of failedFiles) {
			counts.set(file, (counts.get(file) ?? 0) + 1)
		}

		for (const count of counts.values()) {
			if (count >= minCount) {
				return true
			}
		}
		return false
	}
}
