import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { MemoryManager } from "../memory-manager"
import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"

describe("MemoryManager", () => {
	let manager: MemoryManager
	let tmpDir: string

	beforeEach(async () => {
		tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "roo-memory-test-"))
		manager = new MemoryManager(tmpDir, "test-manager.db")
		await manager.initialize()
	})

	afterEach(async () => {
		await manager.shutdown()
		await fs.rm(tmpDir, { recursive: true, force: true })
	})

	it("should initialize storage", async () => {
		const storage = manager.getStorage()
		expect(storage).toBeDefined()
		
		// Verify DB is accessible
		const result = await storage.get<{ name: string }>(
			"SELECT name FROM sqlite_master WHERE type='table' LIMIT 1"
		)
		expect(result).toBeDefined()
	})

	it("should handle lifecycle correctly", async () => {
		await manager.shutdown()
		// Calling shutdown again should be safe
		await manager.shutdown()
		
		// Re-initialize
		await manager.initialize()
		const storage = manager.getStorage()
		expect(storage).toBeDefined()
	})
})
