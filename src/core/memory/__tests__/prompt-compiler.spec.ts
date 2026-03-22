import { compileMemoryPrompt, compileMemoryForAgent } from "../prompt-compiler"
import type { ScoredMemoryEntry, MemoryCategorySlug } from "../types"

const makeScoredEntry = (
	category: string,
	content: string,
	score: number,
	label: string = "Test",
): ScoredMemoryEntry => ({
	id: `test-${Math.random().toString(36).slice(2)}`,
	workspaceId: null,
	category: category as MemoryCategorySlug,
	content,
	significance: 0.8,
	firstSeen: 1000,
	lastReinforced: 2000,
	reinforcementCount: 3,
	decayRate: 0.05,
	sourceTaskId: null,
	isPinned: false,
	computedScore: score,
	categoryLabel: label,
})

describe("compileMemoryPrompt", () => {
	it("should return empty string for no entries", () => {
		expect(compileMemoryPrompt([])).toBe("")
	})

	it("should include USER PROFILE header", () => {
		const entries = [makeScoredEntry("coding-style", "Prefers TypeScript", 0.9, "Coding Style")]
		const result = compileMemoryPrompt(entries)
		expect(result).toContain("USER PROFILE & PREFERENCES")
	})

	it("should group entries by category", () => {
		const entries = [
			makeScoredEntry("coding-style", "Prefers TypeScript", 0.9, "Coding Style"),
			makeScoredEntry("coding-style", "Uses React hooks", 0.8, "Coding Style"),
			makeScoredEntry("communication-prefs", "Likes concise responses", 0.85, "Communication Preferences"),
		]
		const result = compileMemoryPrompt(entries)
		expect(result).toContain("Coding Style:")
		expect(result).toContain("Communication Preferences:")
	})

	it("should omit empty categories", () => {
		const entries = [makeScoredEntry("coding-style", "Prefers TypeScript", 0.9, "Coding Style")]
		const result = compileMemoryPrompt(entries)
		expect(result).not.toContain("Communication Preferences:")
	})

	it("should join multiple entries in same category with periods", () => {
		const entries = [
			makeScoredEntry("coding-style", "Prefers TypeScript", 0.9, "Coding Style"),
			makeScoredEntry("coding-style", "Uses React hooks", 0.8, "Coding Style"),
		]
		const result = compileMemoryPrompt(entries)
		expect(result).toContain("Prefers TypeScript. Uses React hooks.")
	})

	it("should respect token cap by dropping lowest-priority sections", () => {
		// Create many entries to exceed 1500 token cap
		const entries: ScoredMemoryEntry[] = []
		for (let i = 0; i < 100; i++) {
			entries.push(
				makeScoredEntry(
					"coding-style",
					`This is a very long preference statement number ${i} that contains lots of words to inflate the token count significantly`,
					0.9 - i * 0.001,
					`Category ${i}`,
				),
			)
		}
		const result = compileMemoryPrompt(entries)
		const estimatedTokens = Math.ceil(result.length / 4)
		expect(estimatedTokens).toBeLessThanOrEqual(1500)
	})
})

describe("compileMemoryForAgent", () => {
	it("should include entry IDs", () => {
		const entry = makeScoredEntry("coding-style", "Prefers TypeScript", 0.9, "Coding Style")
		const result = compileMemoryForAgent([entry])
		expect(result).toContain(entry.id)
	})

	it("should include scores", () => {
		const entries = [makeScoredEntry("coding-style", "Prefers TS", 0.87, "Coding Style")]
		const result = compileMemoryForAgent(entries)
		expect(result).toContain("0.87")
	})

	it("should return placeholder for empty entries", () => {
		const result = compileMemoryForAgent([])
		expect(result).toContain("No existing memory entries")
	})
})
