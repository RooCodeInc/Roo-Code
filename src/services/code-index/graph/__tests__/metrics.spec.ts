/**
 * MetricsCollector Unit Tests
 */

import { describe, it, expect, beforeEach } from "vitest"
import { MetricsCollector } from "../metrics"

describe("MetricsCollector", () => {
	let collector: MetricsCollector

	beforeEach(() => {
		collector = new MetricsCollector()
	})

	describe("recordParse", () => {
		it("should record parse operations", () => {
			collector.recordParse(100, true)
			collector.recordParse(200, true)
			collector.recordParse(50, false)

			const metrics = collector.getMetrics()

			expect(metrics.totalParses).toBe(3)
			expect(metrics.parseSuccesses).toBe(2)
			expect(metrics.parseFailures).toBe(1)
			expect(metrics.averageParseDuration).toBeCloseTo((100 + 200 + 50) / 3)
		})
	})

	describe("recordQuery", () => {
		it("should record query operations", () => {
			collector.recordQuery(10, "dependencies", true, 5)
			collector.recordQuery(20, "dependents", false, 3)

			const metrics = collector.getMetrics()

			expect(metrics.totalQueries).toBe(2)
			expect(metrics.queryHits).toBe(1)
			expect(metrics.queryMisses).toBe(1)
		})

		it("should track recent queries", () => {
			collector.recordQuery(10, "dependencies", true, 5)
			collector.recordQuery(20, "dependents", false, 3)

			const recent = collector.getRecentQueries(10)

			expect(recent).toHaveLength(2)
			expect(recent[0].queryType).toBe("dependencies")
			expect(recent[1].queryType).toBe("dependents")
		})
	})

	describe("recordBuild", () => {
		it("should record build operations", () => {
			collector.recordBuild(1000, true)
			collector.recordBuild(2000, true)
			collector.recordBuild(500, false)

			const metrics = collector.getMetrics()

			expect(metrics.totalBuilds).toBe(3)
			expect(metrics.buildErrors).toBe(1)
			expect(metrics.lastBuildDuration).toBe(500)
			expect(metrics.averageBuildDuration).toBeCloseTo((1000 + 2000 + 500) / 3)
		})
	})

	describe("recordSave and recordLoad", () => {
		it("should record save operations", () => {
			collector.recordSave(100)
			collector.recordSave(200)

			const metrics = collector.getMetrics()

			expect(metrics.saveOperations).toBe(2)
			expect(metrics.averageSaveDuration).toBe(150)
		})

		it("should record load operations", () => {
			collector.recordLoad(50)
			collector.recordLoad(150)

			const metrics = collector.getMetrics()

			expect(metrics.loadOperations).toBe(2)
			expect(metrics.averageLoadDuration).toBe(100)
		})
	})

	describe("updateGraphSize", () => {
		it("should track peak values", () => {
			collector.updateGraphSize(100, 200)
			collector.updateGraphSize(50, 100)
			collector.updateGraphSize(150, 250)

			const metrics = collector.getMetrics()

			expect(metrics.peakNodeCount).toBe(150)
			expect(metrics.peakEdgeCount).toBe(250)
		})
	})

	describe("getCacheHitRate", () => {
		it("should calculate cache hit rate correctly", () => {
			collector.recordQuery(10, "test", true, 1)
			collector.recordQuery(10, "test", true, 1)
			collector.recordQuery(10, "test", false, 1)
			collector.recordQuery(10, "test", false, 1)

			expect(collector.getCacheHitRate()).toBe(0.5)
		})

		it("should return 0 for no queries", () => {
			expect(collector.getCacheHitRate()).toBe(0)
		})
	})

	describe("getParseSuccessRate", () => {
		it("should calculate parse success rate correctly", () => {
			collector.recordParse(10, true)
			collector.recordParse(10, true)
			collector.recordParse(10, true)
			collector.recordParse(10, false)

			expect(collector.getParseSuccessRate()).toBe(0.75)
		})

		it("should return 0 for no parses", () => {
			expect(collector.getParseSuccessRate()).toBe(0)
		})
	})

	describe("reset", () => {
		it("should reset all metrics", () => {
			collector.recordParse(100, true)
			collector.recordQuery(10, "test", true, 1)
			collector.recordBuild(1000, true)

			collector.reset()

			const metrics = collector.getMetrics()

			expect(metrics.totalParses).toBe(0)
			expect(metrics.totalQueries).toBe(0)
			expect(metrics.totalBuilds).toBe(0)
		})
	})

	describe("exportMetrics", () => {
		it("should export metrics for external monitoring", () => {
			collector.recordParse(100, true)
			collector.recordQuery(10, "test", true, 1)

			const exported = collector.exportMetrics()

			expect(exported).toHaveProperty("graph.parses.total")
			expect(exported).toHaveProperty("graph.queries.total")
			expect(exported).toHaveProperty("graph.queries.cache_hit_rate")
		})
	})
})
