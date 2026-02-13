import fs from "fs/promises"
import os from "os"
import path from "path"
import { afterEach, describe, expect, it } from "vitest"

import { RpiMemory } from "../RpiMemory"

describe("RpiMemory", () => {
	const createdDirs: string[] = []

	afterEach(async () => {
		await Promise.all(
			createdDirs.splice(0).map(async (dir) => {
				await fs.rm(dir, { recursive: true, force: true })
			}),
		)
	})

	const createMemory = async (): Promise<RpiMemory> => {
		const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "rpi-memory-"))
		createdDirs.push(tmpDir)
		return new RpiMemory(tmpDir)
	}

	it("remembers and recalls entries by keyword matching", async () => {
		const memory = await createMemory()

		await memory.remember({
			taskId: "task-1",
			type: "pattern",
			content: "Use JWT v9 for authentication tokens",
			tags: ["jwt", "authentication", "tokens"],
			source: "completion",
		})

		await memory.remember({
			taskId: "task-2",
			type: "pitfall",
			content: "ESLint config needs flat format",
			tags: ["eslint", "config", "linting"],
			source: "correction",
		})

		const results = await memory.recall("implement authentication with JWT")
		expect(results.length).toBe(1)
		expect(results[0].content).toContain("JWT")
	})

	it("returns empty array when no matching keywords", async () => {
		const memory = await createMemory()

		await memory.remember({
			taskId: "task-1",
			type: "pattern",
			content: "Database connection pooling pattern",
			tags: ["database", "connection", "pooling"],
			source: "completion",
		})

		const results = await memory.recall("fix the CSS styling bug")
		expect(results.length).toBe(0)
	})

	it("inherits entries from parent task", async () => {
		const memory = await createMemory()

		await memory.remember({
			taskId: "parent-1",
			type: "convention",
			content: "Always use async/await instead of .then()",
			tags: ["async", "await", "convention"],
			source: "manual",
		})

		await memory.remember({
			taskId: "other-task",
			type: "pattern",
			content: "Unrelated entry",
			tags: ["other"],
			source: "completion",
		})

		const inherited = await memory.inheritFromParent("parent-1")
		expect(inherited.length).toBe(1)
		expect(inherited[0].content).toContain("async/await")
	})

	it("prunes entries when over limit", async () => {
		const memory = await createMemory()

		for (let i = 0; i < 15; i++) {
			await memory.remember({
				taskId: `task-${i}`,
				type: "pattern",
				content: `Entry ${i}`,
				tags: [`tag-${i}`],
				source: "completion",
			})
		}

		await memory.prune(10)

		// Verify only 10 most recent entries remain
		const allResults = await memory.recall("tag-0")
		expect(allResults.length).toBe(0) // Oldest was pruned

		const recentResults = await memory.recall("tag-14")
		expect(recentResults.length).toBe(1) // Newest kept
	})

	it("handles empty/missing memory file gracefully", async () => {
		const memory = await createMemory()

		const results = await memory.recall("anything")
		expect(results).toEqual([])

		const inherited = await memory.inheritFromParent("nonexistent")
		expect(inherited).toEqual([])
	})

	it("limits recall results", async () => {
		const memory = await createMemory()

		for (let i = 0; i < 10; i++) {
			await memory.remember({
				taskId: `task-${i}`,
				type: "pattern",
				content: `Auth pattern ${i}`,
				tags: ["auth", "pattern"],
				source: "completion",
			})
		}

		const results = await memory.recall("auth pattern implementation", 3)
		expect(results.length).toBe(3)
	})
})
