/**
 * GraphStore Unit Tests
 */

import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { GraphStore } from "../store"
import { DependencyType, SymbolType, Accessibility, DependencyEdge, ExportSymbol } from "../types"

describe("GraphStore", () => {
	let tempDir: string
	let store: GraphStore

	beforeEach(async () => {
		// Create a temporary directory for each test
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "graph-store-test-"))
		store = new GraphStore(tempDir)
	})

	afterEach(async () => {
		// Clean up temporary directory
		try {
			await fs.rm(tempDir, { recursive: true, force: true })
		} catch {
			// Ignore cleanup errors
		}
	})

	describe("Core CRUD Operations", () => {
		it("should update node correctly", async () => {
			const imports: DependencyEdge[] = [
				{
					target: "./dependency",
					type: DependencyType.IMPORT,
					lineNumber: 1,
					isTransitive: false,
					confidence: 1.0,
				},
			]

			const exports: ExportSymbol[] = [
				{
					name: "myFunction",
					type: SymbolType.FUNCTION,
					lineNumber: 5,
					accessibility: Accessibility.PUBLIC,
					isDeprecated: false,
				},
			]

			await store.updateNode("/test/file.ts", "hash123", imports, exports)

			const deps = await store.getDependencies("/test/file.ts")
			expect(deps).toHaveLength(1)
			expect(deps[0].target).toBe("./dependency")
			expect(deps[0].type).toBe(DependencyType.IMPORT)
		})

		it("should remove node correctly", async () => {
			await store.updateNode("/test/file.ts", "hash123", [], [])
			await store.removeNode("/test/file.ts")

			const deps = await store.getDependencies("/test/file.ts")
			expect(deps).toHaveLength(0)
		})

		it("should handle batch update", async () => {
			const nodes = [
				{ filePath: "/test/a.ts", contentHash: "hash1", imports: [], exports: [] },
				{ filePath: "/test/b.ts", contentHash: "hash2", imports: [], exports: [] },
				{ filePath: "/test/c.ts", contentHash: "hash3", imports: [], exports: [] },
			]

			await store.batchUpdate(nodes)

			expect(store.getStats().nodeCount).toBe(3)
		})
	})

	describe("Query Operations", () => {
		beforeEach(async () => {
			// Set up a simple dependency graph:
			// a.ts -> b.ts -> c.ts
			await store.updateNode(
				"/test/a.ts",
				"hash1",
				[
					{
						target: "/test/b.ts",
						type: DependencyType.IMPORT,
						lineNumber: 1,
						isTransitive: false,
						confidence: 1,
					},
				],
				[],
			)
			await store.updateNode(
				"/test/b.ts",
				"hash2",
				[
					{
						target: "/test/c.ts",
						type: DependencyType.IMPORT,
						lineNumber: 1,
						isTransitive: false,
						confidence: 1,
					},
				],
				[],
			)
			await store.updateNode("/test/c.ts", "hash3", [], [])
		})

		it("should get direct dependencies", async () => {
			const deps = await store.getDependencies("/test/a.ts")
			expect(deps).toHaveLength(1)
			expect(deps[0].target).toBe("/test/b.ts")
		})

		it("should get direct dependents", async () => {
			const dependents = await store.getDependents("/test/b.ts")
			expect(dependents).toHaveLength(1)
			expect(dependents[0]).toBe("/test/a.ts")
		})

		it("should get transitive dependencies", async () => {
			const transitive = await store.getTransitiveDependencies("/test/a.ts")
			expect(transitive.size).toBe(2)
			expect(transitive.has("/test/b.ts")).toBe(true)
			expect(transitive.has("/test/c.ts")).toBe(true)
		})

		it("should get transitive dependents", async () => {
			const transitive = await store.getTransitiveDependents("/test/c.ts")
			expect(transitive.size).toBe(2)
			expect(transitive.has("/test/b.ts")).toBe(true)
			expect(transitive.has("/test/a.ts")).toBe(true)
		})

		it("should find common dependencies", async () => {
			// Add another file that depends on c.ts
			await store.updateNode(
				"/test/d.ts",
				"hash4",
				[
					{
						target: "/test/c.ts",
						type: DependencyType.IMPORT,
						lineNumber: 1,
						isTransitive: false,
						confidence: 1,
					},
				],
				[],
			)

			const common = await store.findCommonDependencies("/test/a.ts", "/test/d.ts")
			expect(common).toContain("/test/c.ts")
		})
	})

	describe("Persistence", () => {
		it("should save and load correctly", async () => {
			await store.updateNode("/test/file.ts", "hash123", [], [])

			const saveResult = await store.save()
			expect(saveResult.success).toBe(true)
			expect(saveResult.nodeCount).toBe(1)

			// Create a new store and load
			const newStore = new GraphStore(tempDir)
			const loadResult = await newStore.load()

			expect(loadResult.success).toBe(true)
			expect(loadResult.loadedFromDisk).toBe(true)
			expect(loadResult.nodeCount).toBe(1)
		})

		it("should handle missing file gracefully", async () => {
			const loadResult = await store.load()
			expect(loadResult.success).toBe(true)
			expect(loadResult.loadedFromDisk).toBe(false)
			expect(loadResult.nodeCount).toBe(0)
		})

		it("should handle corrupted file gracefully", async () => {
			// Create corrupt graph file
			const graphPath = path.join(tempDir, ".roo", "knowledge-graph.json")
			await fs.mkdir(path.dirname(graphPath), { recursive: true })
			await fs.writeFile(graphPath, "not valid json")

			const loadResult = await store.load()
			expect(loadResult.success).toBe(false)
			expect(loadResult.error).toBeDefined()
		})
	})

	describe("Cyclic Dependencies", () => {
		it("should handle cyclic dependencies without infinite loop", async () => {
			// Create a cycle: a -> b -> a
			await store.updateNode(
				"/test/a.ts",
				"hash1",
				[
					{
						target: "/test/b.ts",
						type: DependencyType.IMPORT,
						lineNumber: 1,
						isTransitive: false,
						confidence: 1,
					},
				],
				[],
			)
			await store.updateNode(
				"/test/b.ts",
				"hash2",
				[
					{
						target: "/test/a.ts",
						type: DependencyType.IMPORT,
						lineNumber: 1,
						isTransitive: false,
						confidence: 1,
					},
				],
				[],
			)

			// This should complete without hanging
			const transitive = await store.getTransitiveDependencies("/test/a.ts", 10)

			expect(transitive.has("/test/b.ts")).toBe(true)
			// Should not include itself in transitive deps
		})
	})

	describe("Statistics", () => {
		it("should return accurate statistics", async () => {
			await store.updateNode(
				"/test/a.ts",
				"hash1",
				[
					{
						target: "/test/b.ts",
						type: DependencyType.IMPORT,
						lineNumber: 1,
						isTransitive: false,
						confidence: 1,
					},
					{
						target: "/test/c.ts",
						type: DependencyType.IMPORT,
						lineNumber: 2,
						isTransitive: false,
						confidence: 1,
					},
				],
				[],
			)
			await store.updateNode("/test/b.ts", "hash2", [], [])
			await store.updateNode("/test/c.ts", "hash3", [], [])

			const stats = store.getStats()

			expect(stats.nodeCount).toBe(3)
			expect(stats.edgeCount).toBe(2)
			expect(stats.maxDegree).toBe(2)
			expect(stats.averageDegree).toBeCloseTo(2 / 3)
		})
	})

	describe("needsUpdate", () => {
		it("should return true for new files", async () => {
			const needs = await store.needsUpdate("/test/new.ts", "hash123")
			expect(needs).toBe(true)
		})

		it("should return false for unchanged files", async () => {
			await store.updateNode("/test/file.ts", "hash123", [], [])
			const needs = await store.needsUpdate("/test/file.ts", "hash123")
			expect(needs).toBe(false)
		})

		it("should return true for changed files", async () => {
			await store.updateNode("/test/file.ts", "hash123", [], [])
			const needs = await store.needsUpdate("/test/file.ts", "hash456")
			expect(needs).toBe(true)
		})
	})
})
