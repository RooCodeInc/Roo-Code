import { describe, it, expect } from "vitest"
import {
	getEngineerRoles,
	getEngineerRole,
	getRoleRecommendation,
	getAllRecommendations,
	getCloudSetupUrl,
	TASKS_PER_DAY,
	MODEL_TIMELINE,
	type ModelCandidate,
} from "../mock-recommendations"

describe("getEngineerRoles", () => {
	it("returns a non-empty array of roles", () => {
		const roles = getEngineerRoles()
		expect(roles.length).toBeGreaterThan(0)
	})

	it("every role has required fields", () => {
		for (const role of getEngineerRoles()) {
			expect(role.id).toBeTruthy()
			expect(role.name).toBeTruthy()
			expect(role.description).toBeTruthy()
			expect(role.bestFor.length).toBeGreaterThan(0)
			expect(role.strengths.length).toBeGreaterThan(0)
		}
	})

	it("every role has a unique id", () => {
		const roles = getEngineerRoles()
		const ids = roles.map((r) => r.id)
		expect(new Set(ids).size).toBe(ids.length)
	})
})

describe("getEngineerRole", () => {
	it("returns the correct role for a valid id", () => {
		const roles = getEngineerRoles()
		for (const role of roles) {
			const result = getEngineerRole(role.id)
			expect(result).toBeDefined()
			expect(result!.id).toBe(role.id)
		}
	})

	it("returns undefined for an invalid id", () => {
		expect(getEngineerRole("nonexistent")).toBeUndefined()
		expect(getEngineerRole("")).toBeUndefined()
	})
})

describe("getRoleRecommendation", () => {
	it("returns a recommendation for each known role", () => {
		const roles = getEngineerRoles()
		for (const role of roles) {
			const rec = getRoleRecommendation(role.id)
			expect(rec).toBeDefined()
			expect(rec!.roleId).toBe(role.id)
			expect(rec!.best.length).toBeGreaterThan(0)
			expect(rec!.allCandidates.length).toBeGreaterThan(0)
		}
	})

	it("returns undefined for an unknown role", () => {
		expect(getRoleRecommendation("nonexistent")).toBeUndefined()
	})
})

describe("getAllRecommendations", () => {
	it("returns one recommendation per role", () => {
		const roles = getEngineerRoles()
		const recs = getAllRecommendations()
		expect(recs.length).toBe(roles.length)
	})

	it("every recommendation has consistent totalEvalRuns and totalExercises", () => {
		const recs = getAllRecommendations()
		// All roles share the same pool of eval runs/exercises
		const firstRuns = recs[0]?.totalEvalRuns
		const firstExercises = recs[0]?.totalExercises
		for (const rec of recs) {
			expect(rec.totalEvalRuns).toBe(firstRuns)
			expect(rec.totalExercises).toBe(firstExercises)
		}
	})
})

describe("getCloudSetupUrl", () => {
	it("generates a valid URL with model parameters", () => {
		const candidate: ModelCandidate = {
			provider: "anthropic",
			modelId: "claude-opus-4-6",
			displayName: "Claude Opus 4.6",
			compositeScore: 90,
			tier: "best",
			tags: [],
			successRate: 85,
			avgCostPerTask: 1.25,
			estimatedDailyCost: 100,
			avgTimePerTask: 180,
			languageScores: { go: 80, java: 85, javascript: 90, python: 92, rust: 75 },
			settings: { temperature: 0 },
		}

		const url = getCloudSetupUrl(candidate)
		expect(url).toContain("https://app.roocode.com/sign-up")
		expect(url).toContain("claude-opus-4-6")
		expect(url).toContain("anthropic")
		// The URL is encoded via URLSearchParams, so = becomes %3D
		expect(url).toContain("temperature")
		expect(url).toContain("0")
	})
})

describe("TASKS_PER_DAY", () => {
	it("is a positive number", () => {
		expect(TASKS_PER_DAY).toBeGreaterThan(0)
	})
})

describe("MODEL_TIMELINE", () => {
	it("is a non-empty array", () => {
		expect(MODEL_TIMELINE.length).toBeGreaterThan(0)
	})

	it("entries have required fields", () => {
		for (const entry of MODEL_TIMELINE) {
			expect(entry.modelName).toBeTruthy()
			expect(entry.provider).toBeTruthy()
			expect(entry.releaseDate).toBeTruthy()
			expect(entry.score).toBeGreaterThan(0)
			expect(entry.costPerRun).toBeGreaterThan(0)
		}
	})

	it("entries are in chronological order", () => {
		for (let i = 1; i < MODEL_TIMELINE.length; i++) {
			expect(MODEL_TIMELINE[i]!.releaseDate >= MODEL_TIMELINE[i - 1]!.releaseDate).toBe(true)
		}
	})
})
