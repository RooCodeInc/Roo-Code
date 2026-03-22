// src/core/memory/prompt-compiler.ts
import type { ScoredMemoryEntry } from "./types"
import { MEMORY_CONSTANTS } from "./types"

// Rough token estimate
function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4)
}

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
	for (const [label, contents] of groups) {
		sections.push(`${label}: ${contents.join(". ")}.`)
	}

	let prose = sections.join("\n\n")

	// Token cap — drop from the end (lowest priority sections) until within budget
	while (estimateTokens(prose) > MEMORY_CONSTANTS.PROMPT_TOKEN_CAP && sections.length > 1) {
		sections.pop()
		prose = sections.join("\n\n")
	}

	return `USER PROFILE & PREFERENCES\n(Learned through conversation — continuously updated)\n\n${prose}`
}

export function compileMemoryForAgent(entries: ScoredMemoryEntry[]): string {
	if (entries.length === 0) return "No existing memory entries."

	return entries
		.map(
			(e) =>
				`[${e.id}] ${e.category} (score: ${e.computedScore.toFixed(2)}): ${e.content}`,
		)
		.join("\n")
}
