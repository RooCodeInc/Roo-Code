import type { RpiToolObservation } from "../RpiAutopilot"

type VerificationStrictness = "lenient" | "standard" | "strict"

interface RpiVerificationInput {
	observations: RpiToolObservation[]
	taskText: string
	mode: string
	strictness: VerificationStrictness
	writeOps: number
	commandOps: number
}

interface RpiVerificationCheck {
	name: string
	status: "passed" | "failed" | "warning" | "skipped"
	detail: string
}

export interface RpiVerificationResult {
	passed: boolean
	checks: RpiVerificationCheck[]
	suggestions: string[]
}

export class RpiVerificationEngine {
	evaluate(input: RpiVerificationInput): RpiVerificationResult {
		const checks: RpiVerificationCheck[] = []
		const suggestions: string[] = []

		// Gate 1: Implementation evidence (lenient+)
		checks.push(this.checkImplementationEvidence(input))

		// Gate 2: Last command success (standard+)
		if (input.strictness !== "lenient") {
			checks.push(this.checkLastCommandSuccess(input))
		}

		// Gate 3: No unresolved write errors (standard+)
		if (input.strictness !== "lenient") {
			checks.push(this.checkNoUnresolvedWriteErrors(input))
		}

		// Gate 4: Task keyword matching (strict only)
		if (input.strictness === "strict") {
			checks.push(this.checkTaskKeywordMatching(input))
		}

		const failed = checks.filter((c) => c.status === "failed")
		if (failed.length > 0) {
			for (const check of failed) {
				suggestions.push(`Fix: ${check.name} — ${check.detail}`)
			}
		}

		return {
			passed: failed.length === 0,
			checks,
			suggestions,
		}
	}

	private checkImplementationEvidence(input: RpiVerificationInput): RpiVerificationCheck {
		const successfulWriteTools = new Set(["write_to_file", "apply_diff", "search_and_replace", "edit_file"])
		const hasEvidence =
			input.observations.some((o) => o.success && successfulWriteTools.has(o.toolName)) ||
			input.observations.some((o) => o.success && o.toolName === "execute_command")
		return {
			name: "Implementation evidence",
			status: hasEvidence ? "passed" : "failed",
			detail: hasEvidence
				? `${input.writeOps} writes, ${input.commandOps} commands`
				: "No successful write or command operations recorded. Continue with code or command execution.",
		}
	}

	private checkLastCommandSuccess(input: RpiVerificationInput): RpiVerificationCheck {
		const commandObs = input.observations.filter((o) => o.toolName === "execute_command")
		if (commandObs.length === 0) {
			return {
				name: "Last command success",
				status: "skipped",
				detail: "No commands executed.",
			}
		}

		const lastCommand = commandObs[commandObs.length - 1]
		if (lastCommand.success) {
			return {
				name: "Last command success",
				status: "passed",
				detail: lastCommand.summary,
			}
		}

		return {
			name: "Last command success",
			status: "failed",
			detail: `Last command failed: ${lastCommand.error ?? lastCommand.summary}. Fix the issue before completing.`,
		}
	}

	private checkNoUnresolvedWriteErrors(input: RpiVerificationInput): RpiVerificationCheck {
		const writeObs = input.observations.filter(
			(o) =>
				o.toolName === "write_to_file" ||
				o.toolName === "apply_diff" ||
				o.toolName === "search_and_replace" ||
				o.toolName === "edit_file",
		)

		if (writeObs.length === 0) {
			return {
				name: "No unresolved write errors",
				status: "skipped",
				detail: "No write operations recorded.",
			}
		}

		const lastWrite = writeObs[writeObs.length - 1]
		if (lastWrite.success) {
			return {
				name: "No unresolved write errors",
				status: "passed",
				detail: lastWrite.summary,
			}
		}

		return {
			name: "No unresolved write errors",
			status: "failed",
			detail: `Last write failed: ${lastWrite.error ?? lastWrite.summary}. Resolve before completing.`,
		}
	}

	private checkTaskKeywordMatching(input: RpiVerificationInput): RpiVerificationCheck {
		const taskLower = input.taskText.toLowerCase()
		const toolNames = new Set(input.observations.map((o) => o.toolName))

		// If task mentions "test", verify a test command was executed
		if ((taskLower.includes("test") || taskLower.includes("spec")) && !toolNames.has("execute_command")) {
			return {
				name: "Task keyword matching",
				status: "failed",
				detail: "Task mentions tests but no command was executed. Run the tests before completing.",
			}
		}

		return {
			name: "Task keyword matching",
			status: "passed",
			detail: "Task keywords matched with executed tools.",
		}
	}
}
