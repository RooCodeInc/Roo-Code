/**
 * CycleDetector Unit Tests
 */

import { describe, it, expect, beforeEach } from "vitest"
import { CycleDetector, CycleSeverity } from "../cycle-detector"
import { GraphNode, DependencyType, Accessibility, SymbolType } from "../types"

describe("CycleDetector", () => {
	let detector: CycleDetector
	let nodes: Map<string, GraphNode>

	const createNode = (id: string, imports: Array<{ target: string; type?: DependencyType }>): GraphNode => ({
		id,
		contentHash: `hash-${id}`,
		lastUpdated: Date.now(),
		imports: imports.map((imp) => ({
			target: imp.target,
			type: imp.type || DependencyType.IMPORT,
			lineNumber: 1,
			isTransitive: false,
			confidence: 1.0,
		})),
		exports: [],
		metadata: {
			fileSize: 100,
			lineCount: 10,
			parseDuration: 5,
			parseAttempts: 1,
		},
	})

	beforeEach(() => {
		detector = new CycleDetector()
		nodes = new Map()
	})

	describe("detect", () => {
		it("should detect no cycles in acyclic graph", () => {
			// A -> B -> C (no cycles)
			nodes.set("/a.ts", createNode("/a.ts", [{ target: "/b.ts" }]))
			nodes.set("/b.ts", createNode("/b.ts", [{ target: "/c.ts" }]))
			nodes.set("/c.ts", createNode("/c.ts", []))

			const result = detector.detect(nodes)

			expect(result.hasCycles).toBe(false)
			expect(result.cycleCount).toBe(0)
			expect(result.cycles).toHaveLength(0)
		})

		it("should detect self-cycle (critical)", () => {
			// A imports itself
			nodes.set("/a.ts", createNode("/a.ts", [{ target: "/a.ts" }]))

			const result = detector.detect(nodes)

			expect(result.hasCycles).toBe(true)
			expect(result.cycleCount).toBe(1)
			expect(result.cycles[0].severity).toBe(CycleSeverity.CRITICAL)
			expect(result.cycles[0].path).toContain("/a.ts")
		})

		it("should detect two-file cycle (high)", () => {
			// A -> B -> A
			nodes.set("/a.ts", createNode("/a.ts", [{ target: "/b.ts" }]))
			nodes.set("/b.ts", createNode("/b.ts", [{ target: "/a.ts" }]))

			const result = detector.detect(nodes)

			expect(result.hasCycles).toBe(true)
			expect(result.cycleCount).toBe(1)
			expect(result.cycles[0].severity).toBe(CycleSeverity.HIGH)
		})

		it("should detect three-file cycle (medium)", () => {
			// A -> B -> C -> A
			nodes.set("/a.ts", createNode("/a.ts", [{ target: "/b.ts" }]))
			nodes.set("/b.ts", createNode("/b.ts", [{ target: "/c.ts" }]))
			nodes.set("/c.ts", createNode("/c.ts", [{ target: "/a.ts" }]))

			const result = detector.detect(nodes)

			expect(result.hasCycles).toBe(true)
			expect(result.cycleCount).toBe(1)
		})

		it("should detect multiple cycles", () => {
			// Two separate cycles: A <-> B and C <-> D
			nodes.set("/a.ts", createNode("/a.ts", [{ target: "/b.ts" }]))
			nodes.set("/b.ts", createNode("/b.ts", [{ target: "/a.ts" }]))
			nodes.set("/c.ts", createNode("/c.ts", [{ target: "/d.ts" }]))
			nodes.set("/d.ts", createNode("/d.ts", [{ target: "/c.ts" }]))

			const result = detector.detect(nodes)

			expect(result.hasCycles).toBe(true)
			expect(result.cycleCount).toBe(2)
		})

		it("should handle empty graph", () => {
			const result = detector.detect(nodes)

			expect(result.hasCycles).toBe(false)
			expect(result.cycleCount).toBe(0)
			expect(result.filesAnalyzed).toBe(0)
		})

		it("should report duration", () => {
			nodes.set("/a.ts", createNode("/a.ts", []))

			const result = detector.detect(nodes)

			expect(result.duration).toBeGreaterThanOrEqual(0)
		})
	})

	describe("wouldCreateCycle", () => {
		it("should return true if adding edge would create cycle", () => {
			// A -> B, checking if B -> A would create cycle
			nodes.set("/a.ts", createNode("/a.ts", [{ target: "/b.ts" }]))
			nodes.set("/b.ts", createNode("/b.ts", []))

			const wouldCycle = detector.wouldCreateCycle(nodes, "/b.ts", "/a.ts")

			expect(wouldCycle).toBe(true)
		})

		it("should return false if adding edge would not create cycle", () => {
			// A -> B, checking if A -> C would create cycle
			nodes.set("/a.ts", createNode("/a.ts", [{ target: "/b.ts" }]))
			nodes.set("/b.ts", createNode("/b.ts", []))
			nodes.set("/c.ts", createNode("/c.ts", []))

			const wouldCycle = detector.wouldCreateCycle(nodes, "/a.ts", "/c.ts")

			expect(wouldCycle).toBe(false)
		})

		it("should detect transitive cycle creation", () => {
			// A -> B -> C, checking if C -> A would create cycle
			nodes.set("/a.ts", createNode("/a.ts", [{ target: "/b.ts" }]))
			nodes.set("/b.ts", createNode("/b.ts", [{ target: "/c.ts" }]))
			nodes.set("/c.ts", createNode("/c.ts", []))

			const wouldCycle = detector.wouldCreateCycle(nodes, "/c.ts", "/a.ts")

			expect(wouldCycle).toBe(true)
		})
	})

	describe("getFilesInCycles", () => {
		it("should return all files involved in cycles", () => {
			// A <-> B cycle, C is not in a cycle
			nodes.set("/a.ts", createNode("/a.ts", [{ target: "/b.ts" }]))
			nodes.set("/b.ts", createNode("/b.ts", [{ target: "/a.ts" }]))
			nodes.set("/c.ts", createNode("/c.ts", [{ target: "/b.ts" }]))

			const filesInCycles = detector.getFilesInCycles(nodes)

			expect(filesInCycles.has("/a.ts")).toBe(true)
			expect(filesInCycles.has("/b.ts")).toBe(true)
			expect(filesInCycles.has("/c.ts")).toBe(false)
		})

		it("should return empty set for acyclic graph", () => {
			nodes.set("/a.ts", createNode("/a.ts", [{ target: "/b.ts" }]))
			nodes.set("/b.ts", createNode("/b.ts", []))

			const filesInCycles = detector.getFilesInCycles(nodes)

			expect(filesInCycles.size).toBe(0)
		})
	})
})
