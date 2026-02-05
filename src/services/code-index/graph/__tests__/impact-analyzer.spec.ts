/**
 * ImpactAnalyzer Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { ImpactAnalyzer, ImpactLevel, RiskLevel, quickImpactCheck } from "../impact-analyzer"
import { IGraphStore } from "../interfaces"
import { DependencyType } from "../types"

describe("ImpactAnalyzer", () => {
	let analyzer: ImpactAnalyzer
	let mockGraphStore: IGraphStore

	beforeEach(() => {
		// Create mock graph store
		mockGraphStore = {
			updateNode: vi.fn(),
			removeNode: vi.fn(),
			batchUpdate: vi.fn(),
			getDependencies: vi.fn().mockResolvedValue([]),
			getDependents: vi.fn().mockResolvedValue([]),
			getTransitiveDependencies: vi.fn().mockResolvedValue(new Set()),
			getTransitiveDependents: vi.fn().mockResolvedValue(new Set()),
			findCommonDependencies: vi.fn().mockResolvedValue([]),
			save: vi.fn(),
			load: vi.fn(),
			snapshot: vi.fn(),
			clear: vi.fn(),
			needsUpdate: vi.fn(),
			getStats: vi.fn().mockReturnValue({
				nodeCount: 10,
				edgeCount: 20,
				averageDegree: 2,
				maxDegree: 5,
				connectedComponents: 1,
				cyclicDependencies: 0,
				memoryUsage: 1000,
				lastUpdated: Date.now(),
			}),
			updateRelationsRealtime: vi.fn(),
			quickImpactAnalysis: vi.fn(),
			getSmartSuggestions: vi.fn(),
		}

		analyzer = new ImpactAnalyzer(mockGraphStore)
	})

	describe("analyzeChanges", () => {
		it("should analyze changes with no dependents", async () => {
			const result = await analyzer.analyzeChanges([{ filePath: "/test.ts", changeType: "modified" }])

			expect(result.changes).toHaveLength(1)
			expect(result.affectedFiles).toHaveLength(0)
			expect(result.riskLevel).toBe(RiskLevel.MINIMAL)
		})

		it("should identify direct dependents", async () => {
			vi.mocked(mockGraphStore.getDependents).mockResolvedValue(["/consumer.ts"])
			vi.mocked(mockGraphStore.getTransitiveDependents).mockResolvedValue(new Set(["/consumer.ts"]))

			const result = await analyzer.analyzeChanges([{ filePath: "/test.ts", changeType: "modified" }])

			expect(result.affectedFiles).toHaveLength(1)
			expect(result.affectedFiles[0].impactLevel).toBe(ImpactLevel.DIRECT)
			expect(result.summary.directCount).toBe(1)
		})

		it("should identify transitive dependents", async () => {
			vi.mocked(mockGraphStore.getDependents).mockResolvedValue(["/direct.ts"])
			vi.mocked(mockGraphStore.getTransitiveDependents).mockResolvedValue(
				new Set(["/direct.ts", "/transitive.ts"]),
			)

			const result = await analyzer.analyzeChanges([{ filePath: "/test.ts", changeType: "modified" }])

			expect(result.affectedFiles.length).toBeGreaterThanOrEqual(1)
			expect(result.summary.transitiveCount).toBeGreaterThanOrEqual(0)
		})

		it("should assess high risk for many affected files", async () => {
			const manyDependents = Array.from({ length: 55 }, (_, i) => `/file${i}.ts`)
			vi.mocked(mockGraphStore.getDependents).mockResolvedValue(manyDependents)
			vi.mocked(mockGraphStore.getTransitiveDependents).mockResolvedValue(new Set(manyDependents))

			const result = await analyzer.analyzeChanges([{ filePath: "/test.ts", changeType: "modified" }])

			expect(result.riskLevel).toBe(RiskLevel.HIGH)
		})

		it("should assess critical risk for deleted files with dependents", async () => {
			vi.mocked(mockGraphStore.getDependents).mockResolvedValue(["/consumer.ts"])
			vi.mocked(mockGraphStore.getTransitiveDependents).mockResolvedValue(new Set(["/consumer.ts"]))

			const result = await analyzer.analyzeChanges([{ filePath: "/test.ts", changeType: "deleted" }])

			expect(result.riskLevel).toBe(RiskLevel.CRITICAL)
		})

		it("should provide recommendations", async () => {
			vi.mocked(mockGraphStore.getDependents).mockResolvedValue(["/consumer.ts"])
			vi.mocked(mockGraphStore.getTransitiveDependents).mockResolvedValue(new Set(["/consumer.ts"]))

			const result = await analyzer.analyzeChanges([{ filePath: "/test.ts", changeType: "modified" }])

			expect(result.recommendations.length).toBeGreaterThan(0)
		})
	})

	describe("analyzeFile", () => {
		it("should return file impact information", async () => {
			vi.mocked(mockGraphStore.getDependents).mockResolvedValue(["/a.ts", "/b.ts"])
			vi.mocked(mockGraphStore.getTransitiveDependents).mockResolvedValue(new Set(["/a.ts", "/b.ts", "/c.ts"]))
			vi.mocked(mockGraphStore.getDependencies).mockResolvedValue([
				{ target: "/dep.ts", type: DependencyType.IMPORT, lineNumber: 1, isTransitive: false, confidence: 1 },
			])

			const result = await analyzer.analyzeFile("/test.ts")

			expect(result.directDependents).toHaveLength(2)
			expect(result.transitiveDependents).toHaveLength(3)
			expect(result.dependencies).toHaveLength(1)
			expect(result.impactScore).toBeGreaterThan(0)
		})
	})

	describe("getDeleteImpact", () => {
		it("should allow safe delete when no dependents", async () => {
			vi.mocked(mockGraphStore.getDependents).mockResolvedValue([])

			const result = await analyzer.getDeleteImpact("/test.ts")

			expect(result.canSafelyDelete).toBe(true)
			expect(result.blockers).toHaveLength(0)
		})

		it("should block delete when has dependents", async () => {
			vi.mocked(mockGraphStore.getDependents).mockResolvedValue(["/consumer.ts"])

			const result = await analyzer.getDeleteImpact("/test.ts")

			expect(result.canSafelyDelete).toBe(false)
			expect(result.blockers).toContain("/consumer.ts")
			expect(result.breakingChanges).toHaveLength(1)
		})
	})

	describe("getBlastRadius", () => {
		it("should calculate blast radius layers", async () => {
			vi.mocked(mockGraphStore.getDependents)
				.mockResolvedValueOnce(["/layer1a.ts", "/layer1b.ts"]) // From center
				.mockResolvedValueOnce(["/layer2a.ts"]) // From layer1a
				.mockResolvedValueOnce([]) // From layer1b
				.mockResolvedValueOnce([]) // From layer2a

			const result = await analyzer.getBlastRadius("/center.ts", 2)

			expect(result.center).toBe("/center.ts")
			expect(result.layers.length).toBeGreaterThanOrEqual(1)
			expect(result.totalAffected).toBeGreaterThanOrEqual(2)
		})
	})
})

describe("quickImpactCheck", () => {
	it("should return minimal risk for no dependents", async () => {
		const mockStore = {
			getDependents: vi.fn().mockResolvedValue([]),
		} as unknown as IGraphStore

		const result = await quickImpactCheck(mockStore, "/test.ts")

		expect(result.hasDependents).toBe(false)
		expect(result.riskLevel).toBe(RiskLevel.MINIMAL)
	})

	it("should return appropriate risk based on dependent count", async () => {
		const mockStore = {
			getDependents: vi.fn().mockResolvedValue(Array.from({ length: 25 }, (_, i) => `/file${i}.ts`)),
		} as unknown as IGraphStore

		const result = await quickImpactCheck(mockStore, "/test.ts")

		expect(result.hasDependents).toBe(true)
		expect(result.dependentCount).toBe(25)
		expect(result.riskLevel).toBe(RiskLevel.HIGH)
	})
})
