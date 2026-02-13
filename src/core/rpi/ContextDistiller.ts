import type { RpiToolObservation } from "./RpiAutopilot"

export type VisibilityLevel = "full" | "summary" | "goal_only"

export interface DistilledContext {
	goal: string
	constraints: string[]
	relevantFilePaths: string[]
	priorFindings: string[]
	formattedMessage: string
	visibilityLevel: VisibilityLevel
}

export interface DistillInput {
	parentMessage: string
	parentObservations: RpiToolObservation[]
	parentPlan?: { taskSummary: string; steps: Array<{ description: string; status: string; phase: string }> }
	targetMode: string
	maxContextChars: number
}

export interface DistillCompletionInput {
	childResult: string
	childObservations: RpiToolObservation[]
	maxResultChars: number
}

const FILE_PATH_REGEX =
	/(?:^|\s|[`"'(])([a-zA-Z0-9_\-./\\]+\.(?:ts|tsx|js|jsx|py|rs|go|java|css|html|json|md|yaml|yml|toml|vue|svelte|rb|php|c|cpp|h|hpp|cs|swift|kt))\b/g

const GOAL_PATTERNS = [
	/(?:please|need to|should|must|want to|goal is to|task is to|objective is to)\s+(.{10,120})/i,
	/(?:implement|create|fix|refactor|add|update|remove|delete|modify|build|design|test|debug)\s+(.{5,120})/i,
]

const CONSTRAINT_PATTERNS = [
	/(?:don'?t|do not|never|avoid|must not|should not|shouldn'?t)\s+(.{5,100})/gi,
	/(?:only|exclusively|restrict(?:ed)?(?:\s+to)?)\s+(.{5,100})/gi,
	/(?:constraint|requirement|limitation|restriction):\s*(.{5,100})/gi,
]

export class ContextDistiller {
	/**
	 * Distill parent context into a structured, focused context for a child task.
	 */
	distill(input: DistillInput): DistilledContext {
		const { parentMessage, parentObservations, parentPlan, targetMode, maxContextChars } = input

		const goal = this.extractGoal(parentMessage)
		const constraints = this.extractConstraints(parentMessage)
		const relevantFilePaths = this.extractFilePaths(parentMessage, parentObservations)
		const priorFindings = this.extractPriorFindings(parentObservations, parentPlan)
		const visibilityLevel = this.determineVisibility(targetMode)

		const formattedMessage = this.formatMessage(
			{
				goal,
				constraints,
				relevantFilePaths,
				priorFindings,
				originalMessage: parentMessage,
				visibilityLevel,
			},
			maxContextChars,
		)

		return {
			goal,
			constraints,
			relevantFilePaths,
			priorFindings,
			formattedMessage,
			visibilityLevel,
		}
	}

	/**
	 * Distill a child's completion result into a concise summary for the parent.
	 */
	distillCompletionResult(input: DistillCompletionInput): string {
		const { childResult, childObservations, maxResultChars } = input

		const lines: string[] = []

		// Extract key outcomes from observations
		const successObs = childObservations.filter((o) => o.success)
		const failedObs = childObservations.filter((o) => !o.success)
		const filesAffected = new Set<string>()
		for (const obs of childObservations) {
			if (obs.filesAffected) {
				for (const f of obs.filesAffected) {
					filesAffected.add(f)
				}
			}
		}

		// Summary line
		lines.push(`Result: ${childResult.slice(0, 200)}`)

		// Key metrics
		if (successObs.length > 0 || failedObs.length > 0) {
			lines.push(`Operations: ${successObs.length} succeeded, ${failedObs.length} failed`)
		}

		// Files affected
		if (filesAffected.size > 0) {
			const fileList = Array.from(filesAffected).slice(0, 10).join(", ")
			lines.push(`Files affected: ${fileList}`)
		}

		// Notable failures
		if (failedObs.length > 0) {
			const topFailures = failedObs.slice(0, 3).map((o) => `- ${o.toolName}: ${o.error ?? o.summary}`)
			lines.push("Notable issues:", ...topFailures)
		}

		const result = lines.join("\n")
		return result.length > maxResultChars ? result.slice(0, maxResultChars - 3) + "..." : result
	}

	private extractGoal(message: string): string {
		for (const pattern of GOAL_PATTERNS) {
			const match = pattern.exec(message)
			if (match?.[1]) {
				return match[1].trim().replace(/[.!?]+$/, "")
			}
		}
		// Fallback: first sentence or first 150 chars
		const firstSentence = message.match(/^[^.!?\n]{10,150}[.!?]?/)
		if (firstSentence) {
			return firstSentence[0].trim()
		}
		return message.slice(0, 150).trim()
	}

	private extractConstraints(message: string): string[] {
		const constraints: string[] = []
		for (const pattern of CONSTRAINT_PATTERNS) {
			let match: RegExpExecArray | null
			while ((match = pattern.exec(message)) !== null) {
				if (match[1]) {
					const constraint = match[1].trim().replace(/[.!?]+$/, "")
					if (!constraints.includes(constraint)) {
						constraints.push(constraint)
					}
				}
			}
		}
		return constraints.slice(0, 8)
	}

	private extractFilePaths(message: string, observations: RpiToolObservation[]): string[] {
		const paths = new Set<string>()

		// From message text
		let match: RegExpExecArray | null
		while ((match = FILE_PATH_REGEX.exec(message)) !== null) {
			if (match[1]) {
				paths.add(match[1])
			}
		}

		// From observations (affected files)
		for (const obs of observations) {
			if (obs.filesAffected) {
				for (const f of obs.filesAffected) {
					paths.add(f)
				}
			}
		}

		return Array.from(paths).slice(0, 20)
	}

	private extractPriorFindings(
		observations: RpiToolObservation[],
		plan?: { taskSummary: string; steps: Array<{ description: string; status: string; phase: string }> },
	): string[] {
		const findings: string[] = []

		// From plan: completed steps
		if (plan) {
			const completedSteps = plan.steps.filter((s) => s.status === "completed")
			for (const step of completedSteps.slice(-5)) {
				findings.push(`Completed: ${step.description}`)
			}
		}

		// From observations: failures and important results
		const failedObs = observations.filter((o) => !o.success)
		for (const obs of failedObs.slice(-3)) {
			findings.push(`Failed [${obs.toolName}]: ${obs.error ?? obs.summary}`)
		}

		return findings.slice(0, 10)
	}

	private determineVisibility(targetMode: string): VisibilityLevel {
		const mode = targetMode.toLowerCase()
		// Orchestrator children get summary, leaf tasks get goal_only for isolation
		if (mode === "orchestrator") {
			return "full"
		}
		if (mode === "architect" || mode === "ask") {
			return "summary"
		}
		return "summary"
	}

	private formatMessage(
		context: {
			goal: string
			constraints: string[]
			relevantFilePaths: string[]
			priorFindings: string[]
			originalMessage: string
			visibilityLevel: VisibilityLevel
		},
		maxChars: number,
	): string {
		const { goal, constraints, relevantFilePaths, priorFindings, originalMessage, visibilityLevel } = context

		if (visibilityLevel === "goal_only") {
			const lines = [`Goal: ${goal}`]
			if (constraints.length > 0) {
				lines.push(`Constraints: ${constraints.join("; ")}`)
			}
			const result = lines.join("\n")
			return result.length > maxChars ? result.slice(0, maxChars - 3) + "..." : result
		}

		if (visibilityLevel === "summary") {
			const lines = [`Goal: ${goal}`]
			if (constraints.length > 0) {
				lines.push(`Constraints: ${constraints.join("; ")}`)
			}
			if (relevantFilePaths.length > 0) {
				lines.push(`Relevant files: ${relevantFilePaths.slice(0, 10).join(", ")}`)
			}
			if (priorFindings.length > 0) {
				lines.push("Prior findings:", ...priorFindings.map((f) => `- ${f}`))
			}
			const result = lines.join("\n")
			return result.length > maxChars ? result.slice(0, maxChars - 3) + "..." : result
		}

		// Full visibility: original message enriched with context
		const lines: string[] = [originalMessage]
		if (priorFindings.length > 0) {
			lines.push("", "Context from parent:", ...priorFindings.map((f) => `- ${f}`))
		}
		const result = lines.join("\n")
		return result.length > maxChars ? result.slice(0, maxChars - 3) + "..." : result
	}
}
