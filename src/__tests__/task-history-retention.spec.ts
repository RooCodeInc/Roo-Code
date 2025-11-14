// npx vitest run __tests__/task-history-retention.spec.ts
import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"

import { describe, it, expect } from "vitest"

// Ensure purge uses the provided base path without touching VS Code config
vi.mock("../utils/storage", () => ({
	getStorageBasePath: (p: string) => Promise.resolve(p),
}))

import { purgeOldTasks } from "../utils/task-history-retention"
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
})
