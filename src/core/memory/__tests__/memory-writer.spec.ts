import { containsPII, jaccardSimilarity } from "../memory-writer"

describe("containsPII", () => {
	it("should detect email addresses", () => {
		expect(containsPII("User email is john@example.com")).toBe(true)
	})

	it("should detect OpenAI API keys", () => {
		expect(containsPII("Uses key sk-abcdefghijklmnopqrstuvwxyz1234")).toBe(true)
	})

	it("should detect GitHub PATs", () => {
		expect(containsPII("Token ghp_abcdefghijklmnopqrstuvwxyz1234567890")).toBe(true)
	})

	it("should not flag normal coding preferences", () => {
		expect(containsPII("Prefers TypeScript over JavaScript")).toBe(false)
	})

	it("should not flag file paths", () => {
		expect(containsPII("Frequently edits src/auth/login.ts")).toBe(false)
	})
})

describe("jaccardSimilarity", () => {
	it("should return 1.0 for identical strings", () => {
		expect(jaccardSimilarity("prefers typescript", "prefers typescript")).toBeCloseTo(1.0)
	})

	it("should return 0.0 for completely different strings", () => {
		expect(jaccardSimilarity("cats dogs birds", "alpha beta gamma")).toBeCloseTo(0.0)
	})

	it("should return high similarity for near-duplicates", () => {
		const sim = jaccardSimilarity(
			"Prefers functional React components",
			"Prefers functional React component patterns",
		)
		expect(sim).toBeGreaterThanOrEqual(0.5)
	})

	it("should ignore short words (≤2 chars)", () => {
		const sim = jaccardSimilarity("I am a good coder", "I am a bad coder")
		// "I", "am", "a" are filtered, so it's {good, coder} vs {bad, coder}
		expect(sim).toBeLessThan(1.0)
	})
})
