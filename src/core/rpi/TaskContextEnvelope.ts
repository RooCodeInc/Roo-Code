import type { VisibilityLevel, DistilledContext } from "./ContextDistiller"

export interface TaskContextEnvelope {
	version: 1
	goal: string
	scope: string[]
	constraints: string[]
	priorContext: string
	parentFindings: string[]
	visibilityLevel: VisibilityLevel
}

/**
 * Build a structured envelope from a distilled context.
 * The envelope wraps the child task's message with structured metadata
 * that can be parsed by the system prompt builder.
 */
export function buildEnvelope(distilled: DistilledContext): TaskContextEnvelope {
	return {
		version: 1,
		goal: distilled.goal,
		scope: distilled.relevantFilePaths,
		constraints: distilled.constraints,
		priorContext: distilled.formattedMessage,
		parentFindings: distilled.priorFindings,
		visibilityLevel: distilled.visibilityLevel,
	}
}

/**
 * Serialize an envelope into a structured XML-like block
 * that can be embedded in the child task's message.
 */
export function serializeEnvelope(envelope: TaskContextEnvelope): string {
	const lines: string[] = ["<task_context_envelope>"]

	lines.push(`<goal>${envelope.goal}</goal>`)

	if (envelope.scope.length > 0) {
		lines.push(`<scope>${envelope.scope.join(", ")}</scope>`)
	}

	if (envelope.constraints.length > 0) {
		lines.push("<constraints>")
		for (const c of envelope.constraints) {
			lines.push(`  - ${c}`)
		}
		lines.push("</constraints>")
	}

	if (envelope.parentFindings.length > 0) {
		lines.push("<prior_findings>")
		for (const f of envelope.parentFindings) {
			lines.push(`  - ${f}`)
		}
		lines.push("</prior_findings>")
	}

	lines.push(`<visibility>${envelope.visibilityLevel}</visibility>`)

	if (envelope.priorContext) {
		lines.push("<context>")
		lines.push(envelope.priorContext)
		lines.push("</context>")
	}

	lines.push("</task_context_envelope>")
	return lines.join("\n")
}

/**
 * Parse a serialized envelope from a message string.
 * Returns undefined if no envelope found.
 */
export function parseEnvelope(message: string): TaskContextEnvelope | undefined {
	const envelopeMatch = message.match(/<task_context_envelope>([\s\S]*?)<\/task_context_envelope>/)
	if (!envelopeMatch?.[1]) {
		return undefined
	}

	const content = envelopeMatch[1]
	const goalMatch = content.match(/<goal>([\s\S]*?)<\/goal>/)
	const scopeMatch = content.match(/<scope>([\s\S]*?)<\/scope>/)
	const constraintsMatch = content.match(/<constraints>([\s\S]*?)<\/constraints>/)
	const findingsMatch = content.match(/<prior_findings>([\s\S]*?)<\/prior_findings>/)
	const visibilityMatch = content.match(/<visibility>([\s\S]*?)<\/visibility>/)
	const contextMatch = content.match(/<context>([\s\S]*?)<\/context>/)

	const goal = goalMatch?.[1]?.trim() ?? ""
	const scope = scopeMatch?.[1]
		? scopeMatch[1]
				.trim()
				.split(",")
				.map((s) => s.trim())
				.filter(Boolean)
		: []
	const constraints = constraintsMatch?.[1]
		? constraintsMatch[1]
				.trim()
				.split("\n")
				.map((l) => l.replace(/^\s*-\s*/, "").trim())
				.filter(Boolean)
		: []
	const parentFindings = findingsMatch?.[1]
		? findingsMatch[1]
				.trim()
				.split("\n")
				.map((l) => l.replace(/^\s*-\s*/, "").trim())
				.filter(Boolean)
		: []
	const visibilityLevel = (visibilityMatch?.[1]?.trim() as VisibilityLevel) ?? "summary"
	const priorContext = contextMatch?.[1]?.trim() ?? ""

	return {
		version: 1,
		goal,
		scope,
		constraints,
		priorContext,
		parentFindings,
		visibilityLevel,
	}
}
