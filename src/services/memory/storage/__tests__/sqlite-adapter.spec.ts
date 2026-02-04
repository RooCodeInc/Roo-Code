import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { SQLiteAdapter } from "../sqlite-adapter"
import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"

describe("SQLiteAdapter", () => {
	let adapter: SQLiteAdapter
	let tmpDir: string

	beforeEach(async () => {
		tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "roo-test-"))
		adapter = new SQLiteAdapter(tmpDir, "test.db")
		await adapter.initialize()
	})

	afterEach(async () => {
		await adapter.close()
		await fs.rm(tmpDir, { recursive: true, force: true })
	})

	it("should initialize database and run migrations", async () => {
		const tables = await adapter.all<{ name: string }>(
			"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
		)
		
		const tableNames = tables.map(t => t.name)
		expect(tableNames).toContain("conversations")
		expect(tableNames).toContain("messages")
		expect(tableNames).toContain("project_memory")
		expect(tableNames).toContain("patterns")
		expect(tableNames).toContain("migrations")
	})

	it("should insert and retrieve data", async () => {
		await adapter.run(
			"INSERT INTO conversations (id, title) VALUES (?, ?)",
			["123", "Test Conversation"]
		)

		const result = await adapter.get<{ id: string, title: string }>(
			"SELECT * FROM conversations WHERE id = ?",
			["123"]
		)

		expect(result).toBeDefined()
		expect(result?.id).toBe("123")
		expect(result?.title).toBe("Test Conversation")
	})

	it("should persist migrations across restarts", async () => {
		// Close current instance
		await adapter.close()

		// Re-open same DB
		const newAdapter = new SQLiteAdapter(tmpDir, "test.db")
		await newAdapter.initialize()

		// Check migrations table
		const migrations = await newAdapter.all<{ name: string }>(
			"SELECT name FROM migrations"
		)
		
		expect(migrations.length).toBeGreaterThanOrEqual(1)
		expect(migrations.some(m => m.name === "001_initial_schema")).toBe(true)
		
		await newAdapter.close()
	})
})
