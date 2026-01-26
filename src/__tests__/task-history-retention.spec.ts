// npx vitest run __tests__/task-history-retention.spec.ts
import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"

import { describe, it, expect } from "vitest"

// Ensure purge uses the provided base path without touching VS Code config
vi.mock("../utils/storage", () => ({
	getStorageBasePath: (p: string) => Promise.resolve(p),
}))

import { purgeOldTasks, purgeOldCheckpoints } from "../utils/task-history-retention"
import { GlobalFileNames } from "../shared/globalFileNames"

// Helpers
async function exists(p: string): Promise<boolean> {
	try {
		await fs.access(p)
		return true
	} catch {
		return false
	}
}

async function mkTempBase(): Promise<string> {
	const base = await fs.mkdtemp(path.join(os.tmpdir(), "roo-retention-"))
	// Ensure <base>/tasks exists
	await fs.mkdir(path.join(base, "tasks"), { recursive: true })
	return base
}

async function createTask(base: string, id: string, ts?: number | "invalid"): Promise<string> {
	const dir = path.join(base, "tasks", id)
	await fs.mkdir(dir, { recursive: true })
	const metadataPath = path.join(dir, GlobalFileNames.taskMetadata)
	const metadata = ts === "invalid" ? "{ invalid json" : JSON.stringify({ ts: ts ?? Date.now() }, null, 2)
	await fs.writeFile(metadataPath, metadata, "utf8")
	return dir
}

describe("utils/task-history-retention.ts purgeOldTasks()", () => {
	it("purges tasks older than 7 days when retention is '7'", async () => {
		const base = await mkTempBase()
		try {
			const now = Date.now()
			const days = (n: number) => n * 24 * 60 * 60 * 1000

			const old = await createTask(base, "task-8d", now - days(8))
			const recent = await createTask(base, "task-6d", now - days(6))

			const { purgedCount } = await purgeOldTasks("7", base, () => {}, false)
			expect(purgedCount).toBe(1)
			expect(await exists(old)).toBe(false)
			expect(await exists(recent)).toBe(true)
		} finally {
			await fs.rm(base, { recursive: true, force: true })
		}
	})

	it("purges tasks older than 3 days when retention is '3'", async () => {
		const base = await mkTempBase()
		try {
			const now = Date.now()
			const days = (n: number) => n * 24 * 60 * 60 * 1000

			const old = await createTask(base, "task-4d", now - days(4))
			const recent = await createTask(base, "task-2d", now - days(2))

			const { purgedCount } = await purgeOldTasks("3", base, () => {}, false)
			expect(purgedCount).toBe(1)
			expect(await exists(old)).toBe(false)
			expect(await exists(recent)).toBe(true)
		} finally {
			await fs.rm(base, { recursive: true, force: true })
		}
	})

	it("does not delete anything in dry run mode but still reports purgedCount", async () => {
		const base = await mkTempBase()
		try {
			const now = Date.now()
			const days = (n: number) => n * 24 * 60 * 60 * 1000

			const old = await createTask(base, "task-8d", now - days(8))
			const recent = await createTask(base, "task-6d", now - days(6))

			const { purgedCount } = await purgeOldTasks("7", base, () => {}, true)
			expect(purgedCount).toBe(1)
			// In dry run, nothing is deleted
			expect(await exists(old)).toBe(true)
			expect(await exists(recent)).toBe(true)
		} finally {
			await fs.rm(base, { recursive: true, force: true })
		}
	})

	it("does nothing when retention is 'never'", async () => {
		const base = await mkTempBase()
		try {
			const now = Date.now()
			const oldTs = now - 45 * 24 * 60 * 60 * 1000 // 45 days ago
			const t1 = await createTask(base, "task-old", oldTs)
			const t2 = await createTask(base, "task-new", now)

			const { purgedCount, cutoff } = await purgeOldTasks("never", base, () => {})

			expect(purgedCount).toBe(0)
			expect(cutoff).toBeNull()
			expect(await exists(t1)).toBe(true)
			expect(await exists(t2)).toBe(true)
		} finally {
			await fs.rm(base, { recursive: true, force: true })
		}
	})

	it("purges tasks older than 30 days and keeps newer or invalid-metadata ones", async () => {
		const base = await mkTempBase()
		try {
			const now = Date.now()
			const days = (n: number) => n * 24 * 60 * 60 * 1000

			// One older than 30 days => delete
			const old = await createTask(base, "task-31d", now - days(31))
			// One newer than 30 days => keep
			const recent = await createTask(base, "task-29d", now - days(29))
			// Invalid metadata => skipped (kept)
			const invalid = await createTask(base, "task-invalid", "invalid")

			const { purgedCount, cutoff } = await purgeOldTasks("30", base, () => {})

			expect(typeof cutoff).toBe("number")
			expect(purgedCount).toBe(1)
			expect(await exists(old)).toBe(false)
			expect(await exists(recent)).toBe(true)
			expect(await exists(invalid)).toBe(true)
		} finally {
			await fs.rm(base, { recursive: true, force: true })
		}
	})

	it("deletes orphan checkpoint-only directories regardless of age", async () => {
		const base = await mkTempBase()
		try {
			const now = Date.now()
			const days = (n: number) => n * 24 * 60 * 60 * 1000

			// Create a normal task that is recent (should be kept)
			const normalTask = await createTask(base, "task-normal", now - days(1))

			// Create an orphan checkpoint-only directory (only has checkpoints/ subdirectory, no metadata)
			const orphanDir = path.join(base, "tasks", "task-orphan-checkpoints")
			await fs.mkdir(orphanDir, { recursive: true })
			const checkpointsDir = path.join(orphanDir, "checkpoints")
			await fs.mkdir(checkpointsDir, { recursive: true })
			// Add a dummy file inside checkpoints to make it realistic
			await fs.writeFile(path.join(checkpointsDir, "checkpoint-1.json"), "{}", "utf8")

			// Create another orphan with just checkpoints (no other files)
			const orphanDir2 = path.join(base, "tasks", "task-orphan-empty")
			await fs.mkdir(orphanDir2, { recursive: true })
			const checkpointsDir2 = path.join(orphanDir2, "checkpoints")
			await fs.mkdir(checkpointsDir2, { recursive: true })

			// Run purge with 7 day retention - orphans should be deleted regardless of age
			const { purgedCount } = await purgeOldTasks("7", base, () => {})

			// Orphan directories should be deleted even though they're "recent"
			expect(await exists(orphanDir)).toBe(false)
			expect(await exists(orphanDir2)).toBe(false)
			// Normal task should still exist (it's recent)
			expect(await exists(normalTask)).toBe(true)
			// Should have deleted 2 orphan directories
			expect(purgedCount).toBe(2)
		} finally {
			await fs.rm(base, { recursive: true, force: true })
		}
	})

	it("does not delete directories with checkpoints AND other content", async () => {
		const base = await mkTempBase()
		try {
			const now = Date.now()
			const days = (n: number) => n * 24 * 60 * 60 * 1000

			// Create a task directory with both checkpoints and other files (but recent, so should be kept)
			const taskDir = path.join(base, "tasks", "task-with-content")
			await fs.mkdir(taskDir, { recursive: true })
			const checkpointsDir = path.join(taskDir, "checkpoints")
			await fs.mkdir(checkpointsDir, { recursive: true })
			await fs.writeFile(path.join(checkpointsDir, "checkpoint-1.json"), "{}", "utf8")
			// Add other files (not just checkpoints)
			await fs.writeFile(path.join(taskDir, "some-file.txt"), "content", "utf8")
			// Note: No metadata file, so it's technically invalid but has content

			const { purgedCount } = await purgeOldTasks("7", base, () => {})

			// Should NOT be deleted because it has content besides checkpoints
			expect(await exists(taskDir)).toBe(true)
			expect(purgedCount).toBe(0)
		} finally {
			await fs.rm(base, { recursive: true, force: true })
		}
	})

	it("falls back to directory mtime for legacy tasks without metadata", async () => {
		const base = await mkTempBase()
		try {
			const now = Date.now()
			const days = (n: number) => n * 24 * 60 * 60 * 1000

			// Create a legacy task directory without any metadata file
			const oldLegacyDir = path.join(base, "tasks", "task-legacy-old")
			await fs.mkdir(oldLegacyDir, { recursive: true })
			// Add some content file
			await fs.writeFile(path.join(oldLegacyDir, "content.txt"), "old task", "utf8")
			// Manually set mtime to 10 days ago by touching the directory
			const oldTime = new Date(now - days(10))
			await fs.utimes(oldLegacyDir, oldTime, oldTime)

			// Create another legacy task that is recent
			const recentLegacyDir = path.join(base, "tasks", "task-legacy-recent")
			await fs.mkdir(recentLegacyDir, { recursive: true })
			await fs.writeFile(path.join(recentLegacyDir, "content.txt"), "recent task", "utf8")
			// This one has recent mtime (now)

			// Run purge with 7 day retention
			const { purgedCount } = await purgeOldTasks("7", base, () => {})

			// Old legacy task should be deleted based on mtime
			expect(await exists(oldLegacyDir)).toBe(false)
			// Recent legacy task should be kept
			expect(await exists(recentLegacyDir)).toBe(true)
			expect(purgedCount).toBe(1)
		} finally {
			await fs.rm(base, { recursive: true, force: true })
		}
	})

	it("prioritizes metadata timestamp over mtime when both exist", async () => {
		const base = await mkTempBase()
		try {
			const now = Date.now()
			const days = (n: number) => n * 24 * 60 * 60 * 1000

			// Create task with old metadata ts but recent mtime
			const taskDir = path.join(base, "tasks", "task-priority-test")
			await fs.mkdir(taskDir, { recursive: true })
			const metadataPath = path.join(taskDir, GlobalFileNames.taskMetadata)
			// Metadata says it's 10 days old (should be deleted with 7 day retention)
			const metadata = JSON.stringify({ ts: now - days(10) }, null, 2)
			await fs.writeFile(metadataPath, metadata, "utf8")
			// But directory mtime is recent (could happen after editing)
			// (Directory mtime is automatically recent from mkdir/writeFile)

			const { purgedCount } = await purgeOldTasks("7", base, () => {})

			// Should be deleted based on metadata ts, not mtime
			expect(await exists(taskDir)).toBe(false)
			expect(purgedCount).toBe(1)
		} finally {
			await fs.rm(base, { recursive: true, force: true })
		}
	})
})

// Helper to create task with checkpoints
async function createTaskWithCheckpoints(
	base: string,
	id: string,
	ts: number,
): Promise<{ taskDir: string; checkpointsDir: string }> {
	const taskDir = path.join(base, "tasks", id)
	await fs.mkdir(taskDir, { recursive: true })
	const metadataPath = path.join(taskDir, GlobalFileNames.taskMetadata)
	const metadata = JSON.stringify({ ts }, null, 2)
	await fs.writeFile(metadataPath, metadata, "utf8")
	const checkpointsDir = path.join(taskDir, "checkpoints")
	await fs.mkdir(checkpointsDir, { recursive: true })
	// Add some checkpoint content
	await fs.writeFile(path.join(checkpointsDir, "checkpoint-1.json"), "{}", "utf8")
	return { taskDir, checkpointsDir }
}

describe("utils/task-history-retention.ts purgeOldCheckpoints()", () => {
	it("culls checkpoints from tasks older than 30 days", async () => {
		const base = await mkTempBase()
		try {
			const now = Date.now()
			const days = (n: number) => n * 24 * 60 * 60 * 1000

			// Old task (31 days) - checkpoints should be culled
			const old = await createTaskWithCheckpoints(base, "task-old", now - days(31))
			// Recent task (29 days) - checkpoints should be kept
			const recent = await createTaskWithCheckpoints(base, "task-recent", now - days(29))

			const { culledCount } = await purgeOldCheckpoints(base, () => {}, false)

			expect(culledCount).toBe(1)
			// Old task checkpoints should be removed, but task dir should remain
			expect(await exists(old.taskDir)).toBe(true)
			expect(await exists(old.checkpointsDir)).toBe(false)
			// Recent task should be completely intact
			expect(await exists(recent.taskDir)).toBe(true)
			expect(await exists(recent.checkpointsDir)).toBe(true)
		} finally {
			await fs.rm(base, { recursive: true, force: true })
		}
	})

	it("does not delete checkpoints in dry run mode but reports count", async () => {
		const base = await mkTempBase()
		try {
			const now = Date.now()
			const days = (n: number) => n * 24 * 60 * 60 * 1000

			const old = await createTaskWithCheckpoints(base, "task-old", now - days(31))

			const { culledCount } = await purgeOldCheckpoints(base, () => {}, true)

			expect(culledCount).toBe(1)
			// In dry run, checkpoints should still exist
			expect(await exists(old.checkpointsDir)).toBe(true)
		} finally {
			await fs.rm(base, { recursive: true, force: true })
		}
	})

	it("skips tasks without checkpoints directory", async () => {
		const base = await mkTempBase()
		try {
			const now = Date.now()
			const days = (n: number) => n * 24 * 60 * 60 * 1000

			// Create an old task WITHOUT checkpoints
			const taskDir = await createTask(base, "task-no-checkpoints", now - days(31))

			const { culledCount } = await purgeOldCheckpoints(base, () => {}, false)

			expect(culledCount).toBe(0)
			// Task should be completely intact
			expect(await exists(taskDir)).toBe(true)
		} finally {
			await fs.rm(base, { recursive: true, force: true })
		}
	})

	it("uses mtime fallback when no metadata timestamp", async () => {
		const base = await mkTempBase()
		try {
			const now = Date.now()
			const days = (n: number) => n * 24 * 60 * 60 * 1000

			// Create a task without metadata but with checkpoints
			const taskDir = path.join(base, "tasks", "task-no-metadata")
			await fs.mkdir(taskDir, { recursive: true })
			const checkpointsDir = path.join(taskDir, "checkpoints")
			await fs.mkdir(checkpointsDir, { recursive: true })
			await fs.writeFile(path.join(checkpointsDir, "checkpoint.json"), "{}", "utf8")
			// Set old mtime
			const oldTime = new Date(now - days(31))
			await fs.utimes(taskDir, oldTime, oldTime)

			const { culledCount } = await purgeOldCheckpoints(base, () => {}, false)

			expect(culledCount).toBe(1)
			// Task dir should remain, checkpoints should be gone
			expect(await exists(taskDir)).toBe(true)
			expect(await exists(checkpointsDir)).toBe(false)
		} finally {
			await fs.rm(base, { recursive: true, force: true })
		}
	})

	it("always uses 30-day hardcoded cutoff", async () => {
		const base = await mkTempBase()
		try {
			const now = Date.now()
			const days = (n: number) => n * 24 * 60 * 60 * 1000

			// Tasks at various ages around the 30-day boundary
			const day29 = await createTaskWithCheckpoints(base, "task-29d", now - days(29))
			const day30 = await createTaskWithCheckpoints(base, "task-30d", now - days(30))
			const day31 = await createTaskWithCheckpoints(base, "task-31d", now - days(31))

			const { culledCount, cutoff } = await purgeOldCheckpoints(base, () => {}, false)

			// Check cutoff is approximately 30 days ago
			const expectedCutoff = now - days(30)
			expect(cutoff).toBeGreaterThan(expectedCutoff - 1000) // Allow 1 second margin
			expect(cutoff).toBeLessThan(expectedCutoff + 1000)

			// 29 day task should keep checkpoints (younger than 30 days)
			expect(await exists(day29.checkpointsDir)).toBe(true)
			// 30 and 31 day tasks should lose checkpoints (>= 30 days)
			expect(await exists(day30.checkpointsDir)).toBe(false)
			expect(await exists(day31.checkpointsDir)).toBe(false)
			expect(culledCount).toBe(2)
		} finally {
			await fs.rm(base, { recursive: true, force: true })
		}
	})

	it("preserves task metadata and other files when culling checkpoints", async () => {
		const base = await mkTempBase()
		try {
			const now = Date.now()
			const days = (n: number) => n * 24 * 60 * 60 * 1000

			// Create task with checkpoints and other content
			const taskDir = path.join(base, "tasks", "task-with-content")
			await fs.mkdir(taskDir, { recursive: true })
			const metadataPath = path.join(taskDir, GlobalFileNames.taskMetadata)
			await fs.writeFile(metadataPath, JSON.stringify({ ts: now - days(31) }), "utf8")
			const checkpointsDir = path.join(taskDir, "checkpoints")
			await fs.mkdir(checkpointsDir, { recursive: true })
			await fs.writeFile(path.join(checkpointsDir, "checkpoint.json"), "{}", "utf8")
			// Add conversation history
			await fs.writeFile(path.join(taskDir, "conversation.json"), "[]", "utf8")

			const { culledCount } = await purgeOldCheckpoints(base, () => {}, false)

			expect(culledCount).toBe(1)
			// Task dir and metadata should remain
			expect(await exists(taskDir)).toBe(true)
			expect(await exists(metadataPath)).toBe(true)
			expect(await exists(path.join(taskDir, "conversation.json"))).toBe(true)
			// Only checkpoints should be removed
			expect(await exists(checkpointsDir)).toBe(false)
		} finally {
			await fs.rm(base, { recursive: true, force: true })
		}
	})
})
