import { computeScore, reinforcementBonus, temporalDecay } from "../scoring"

describe("reinforcementBonus", () => {
	it("should return ~1.0 for count of 1", () => {
		expect(reinforcementBonus(1)).toBeCloseTo(1.0, 1)
	})

	it("should increase with higher counts", () => {
		expect(reinforcementBonus(4)).toBeGreaterThan(reinforcementBonus(2))
	})

	it("should cap at 3.0", () => {
		expect(reinforcementBonus(100)).toBeLessThanOrEqual(3.0)
		expect(reinforcementBonus(1000)).toBeLessThanOrEqual(3.0)
	})
})

describe("temporalDecay", () => {
	it("should return 1.0 for 0 days", () => {
		expect(temporalDecay(0, 0.1)).toBeCloseTo(1.0)
	})

	it("should decrease over time", () => {
		expect(temporalDecay(30, 0.1)).toBeLessThan(temporalDecay(10, 0.1))
	})

	it("should decay faster with higher decay rate", () => {
		expect(temporalDecay(10, 0.3)).toBeLessThan(temporalDecay(10, 0.05))
	})

	it("should approach 0 for very old entries with high decay", () => {
		expect(temporalDecay(365, 0.3)).toBeLessThan(0.001)
	})
})

describe("computeScore", () => {
	it("should combine all factors", () => {
		const score = computeScore({
			significance: 0.8,
			priorityWeight: 0.9,
			reinforcementCount: 3,
			daysSinceReinforced: 5,
			decayRate: 0.05,
		})
		expect(score).toBeGreaterThan(0)
		expect(score).toBeLessThan(3) // bounded by reinforcement cap
	})

	it("should return 0 for zero significance", () => {
		const score = computeScore({
			significance: 0,
			priorityWeight: 0.9,
			reinforcementCount: 5,
			daysSinceReinforced: 1,
			decayRate: 0.05,
		})
		expect(score).toBe(0)
	})

	it("should return higher score for recently reinforced entry", () => {
		const recent = computeScore({
			significance: 0.8,
			priorityWeight: 0.9,
			reinforcementCount: 3,
			daysSinceReinforced: 1,
			decayRate: 0.1,
		})
		const old = computeScore({
			significance: 0.8,
			priorityWeight: 0.9,
			reinforcementCount: 3,
			daysSinceReinforced: 60,
			decayRate: 0.1,
		})
		expect(recent).toBeGreaterThan(old)
	})
})
