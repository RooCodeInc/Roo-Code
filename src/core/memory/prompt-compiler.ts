import type { ScoredMemoryEntry } from "./types"
import { MEMORY_CONSTANTS } from "./types"

const HEADER = "USER PROFILE & PREFERENCES\n(Learned through conversation — continuously updated)\n\n"

// Rough token estimate (~chars/4)
export function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4)
}

/** Compile scored entries into a prose user-profile section for the system prompt. */
export function compileMemoryPrompt(entries: ScoredMemoryEntry[]): string {
	if (entries.length === 0) return ""

	// Group by category label
	const groups = new Map<string, string[]>()
	for (const entry of entries) {
		if (!groups.has(entry.categoryLabel)) {
			groups.set(entry.categoryLabel, [])
		}
		groups.get(entry.categoryLabel)!.push(entry.content)
	}

	// Build prose sections
	const sections: string[] = []
	for (const [label, contents] of Array.from(groups.entries())) {
		sections.push(`${label}: ${contents.join(". ")}.`)
	}

	const headerTokens = estimateTokens(HEADER)
	const cap = MEMORY_CONSTANTS.PROMPT_TOKEN_CAP - headerTokens

	// Token cap — drop lowest-priority sections (from the end) until within budget
	let prose = sections.join("\n\n")
	while (estimateTokens(prose) > cap && sections.length > 1) {
		sections.pop()
		prose = sections.join("\n\n")
	}

	// Edge case: single remaining section still exceeds cap — hard-truncate by chars
	if (estimateTokens(prose) > cap) {
		const maxChars = cap * 4
		prose = prose.slice(0, maxChars)
	}

	return `${HEADER}${prose}`
}

/** Compile entries into a machine-readable list for the analysis agent. */
export function compileMemoryForAgent(entries: ScoredMemoryEntry[]): string {
	if (entries.length === 0) return "No existing memory entries."

	return entries
		.map(
			(e) =>
				`[${e.id}] ${e.category} (score: ${e.computedScore.toFixed(2)}): ${e.content}`,
		)
		.join("\n")
}
