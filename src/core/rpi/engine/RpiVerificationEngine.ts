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
	private static normalizePath(p: string): string {
		return p.replace(/\\/g, "/").toLowerCase()
	}

	private static isRpiStateMutation(paths?: string[]): boolean {
		if (!paths || paths.length === 0) return false
		return paths.some((p) => {
			const n = this.normalizePath(p)
			return (n.includes("/.roo/rpi/") || n.startsWith(".roo/rpi/")) && n.endsWith("/state.json")
		})
	}

	private static isMcpWriteToolName(name: string | undefined): boolean {
		if (!name) return false
		return (
			name === "edit_file" ||
			name === "write_file" ||
			name === "write_to_file" ||
			name === "apply_diff" ||
			name === "apply_patch" ||
			name === "search_and_replace" ||
			name === "search_replace" ||
			name === "delete_file" ||
			name === "move_file" ||
			name === "rename_file" ||
			name === "create_file"
		)
	}

	private static isMcpCommandToolName(name: string | undefined): boolean {
		if (!name) return false
		return name === "execute_command" || name === "read_command_output" || name === "run_command"
	}

	private static isSuccessfulWriteObservation(o: RpiToolObservation): boolean {
		const successfulWriteTools = new Set(["write_to_file", "apply_diff", "search_and_replace", "edit_file"])

		if (o.toolName === "use_mcp_tool") {
			// Count MCP tools as write evidence only when they map to known write-like tools
			// AND they are not mutating RPI internal state artifacts.
			if (!this.isMcpWriteToolName(o.mcpToolName)) return false
			if (this.isRpiStateMutation(o.filesAffected)) return false
			return o.success
		}

		if (!o.success) return false
		if (!successfulWriteTools.has(o.toolName)) return false
		if (this.isRpiStateMutation(o.filesAffected)) return false
		return true
	}

	private static isSuccessfulCommandObservation(o: RpiToolObservation): boolean {
		if (o.toolName === "execute_command") return o.success
		if (o.toolName === "use_mcp_tool") return o.success && this.isMcpCommandToolName(o.mcpToolName)
		return false
	}

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
		const hasEvidence =
			input.observations.some((o) => RpiVerificationEngine.isSuccessfulWriteObservation(o)) ||
			input.observations.some((o) => RpiVerificationEngine.isSuccessfulCommandObservation(o))
		return {
			name: "Implementation evidence",
			status: hasEvidence ? "passed" : "failed",
			detail: hasEvidence
				? `${input.writeOps} writes, ${input.commandOps} commands`
				: "No successful write or command operations recorded. Continue with code or command execution.",
		}
	}

	private checkLastCommandSuccess(input: RpiVerificationInput): RpiVerificationCheck {
		const commandLikeObs = input.observations.filter((o) => {
			if (o.toolName === "execute_command") return true
			if (o.toolName === "use_mcp_tool") return RpiVerificationEngine.isMcpCommandToolName(o.mcpToolName)
			return false
		})

		if (commandLikeObs.length === 0) {
			return {
				name: "Last command success",
				status: "skipped",
				detail: "No commands executed.",
			}
		}

		const lastCommand = commandLikeObs[commandLikeObs.length - 1]
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
		const writeObs = input.observations.filter((o) => {
			if (o.toolName === "use_mcp_tool") {
				return (
					RpiVerificationEngine.isMcpWriteToolName(o.mcpToolName) &&
					!RpiVerificationEngine.isRpiStateMutation(o.filesAffected)
				)
			}
			return (
				(o.toolName === "write_to_file" ||
					o.toolName === "apply_diff" ||
					o.toolName === "search_and_replace" ||
					o.toolName === "edit_file") &&
				!RpiVerificationEngine.isRpiStateMutation(o.filesAffected)
			)
		})

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
		const hasAnyCommand = input.observations.some((o) => RpiVerificationEngine.isSuccessfulCommandObservation(o))

		// If task mentions "test", verify a test command was executed
		if (
			(taskLower.includes("test") || taskLower.includes("spec")) &&
			!(toolNames.has("execute_command") || hasAnyCommand)
		) {
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
