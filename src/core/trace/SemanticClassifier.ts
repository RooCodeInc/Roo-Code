export type SemanticChangeType = "REFACTOR" | "EVOLUTION"

const REFACTOR_PATTERN = /\b(refactor|rewrite|rename|restructure|cleanup|simplif(y|ication))\b/i

function toSearchText(value: unknown): string {
	if (typeof value === "string") {
		return value
	}

	if (Array.isArray(value)) {
		return value.map((item) => toSearchText(item)).join(" ")
	}

	if (value && typeof value === "object") {
		return Object.values(value as Record<string, unknown>)
			.map((item) => toSearchText(item))
			.join(" ")
	}

	return ""
}

export function classifySemanticChange(input: {
	intentTitle?: unknown
	intentOperations?: unknown
	filePath?: string
}): SemanticChangeType {
	const corpus = [input.intentTitle, input.intentOperations, input.filePath].map((v) => toSearchText(v)).join(" ")
	return REFACTOR_PATTERN.test(corpus) ? "REFACTOR" : "EVOLUTION"
}
