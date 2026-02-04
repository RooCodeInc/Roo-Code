import initSqlJs, { Database, QueryExecResult } from "sql.js"
import * as fs from "fs/promises"
import * as path from "path"

export interface StorageAdapter {
	initialize(): Promise<void>
	close(): Promise<void>
	run<T>(sql: string, params?: any[]): Promise<{ changes: number }>
	get<T>(sql: string, params?: any[]): Promise<T | undefined>
	all<T>(sql: string, params?: any[]): Promise<T[]>
}

export class SQLiteAdapter implements StorageAdapter {
	private db: Database | null = null
	private dbPath: string
	private isMemory: boolean = false

	constructor(storagePath: string, dbName: string = "roo_memory.db") {
		// If explicitly :memory:, treat as such
		if (dbName === ":memory:" || storagePath === ":memory:") {
			this.dbPath = ":memory:"
			this.isMemory = true
		} else {
			this.dbPath = storagePath ? path.join(storagePath, dbName) : dbName
		}
	}

	async initialize(): Promise<void> {
		try {
			const SQL = await initSqlJs()

			if (this.isMemory) {
				this.db = new SQL.Database()
			} else {
				// Ensure directory exists
				await fs.mkdir(path.dirname(this.dbPath), { recursive: true })

				let data: Buffer | undefined
				try {
					data = await fs.readFile(this.dbPath)
				} catch (e) {
					// File doesn't exist, create new
				}
				this.db = new SQL.Database(data)
			}

			await this.migrate()

			console.log(`[SQLiteAdapter] Initialized database at ${this.dbPath}`)
		} catch (error) {
			console.error("[SQLiteAdapter] Failed to initialize database:", error)
			throw error
		}
	}

	async close(): Promise<void> {
		if (this.db) {
			if (!this.isMemory) {
				await this.save()
			}
			this.db.close()
			this.db = null
		}
	}

	private async save(): Promise<void> {
		if (!this.db || this.isMemory) return
		const data = this.db.export()
		await fs.writeFile(this.dbPath, Buffer.from(data))
	}

	private async migrate(): Promise<void> {
		if (!this.db) return

		// Create migrations table
		this.db.run(`
			CREATE TABLE IF NOT EXISTS migrations (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				name TEXT NOT NULL UNIQUE,
				applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
			)
		`)

		const migrations = [
			{
				name: "001_initial_schema",
				up: `
					CREATE TABLE IF NOT EXISTS conversations (
						id TEXT PRIMARY KEY,
						title TEXT,
						created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
						updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
						summary TEXT,
						outcome TEXT,
						files_modified TEXT,
						metadata TEXT
					);

					CREATE TABLE IF NOT EXISTS messages (
						id TEXT PRIMARY KEY,
						conversation_id TEXT NOT NULL,
						role TEXT NOT NULL,
						content TEXT NOT NULL,
						timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
						metadata TEXT,
						FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
					);

					CREATE TABLE IF NOT EXISTS project_memory (
						key TEXT PRIMARY KEY,
						value TEXT NOT NULL,
						type TEXT NOT NULL,
						created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
						updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
					);

					CREATE TABLE IF NOT EXISTS patterns (
						hash TEXT PRIMARY KEY,
						template TEXT NOT NULL,
						occurrences INTEGER DEFAULT 1,
						first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
						last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
						metadata TEXT
					);

					CREATE TABLE IF NOT EXISTS design_decisions (
						id TEXT PRIMARY KEY,
						title TEXT NOT NULL,
						description TEXT,
						rationale TEXT,
						status TEXT,
						created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
						updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
						tags TEXT
					);

					CREATE TABLE IF NOT EXISTS conversation_files (
						conversation_id TEXT NOT NULL,
						file_path TEXT NOT NULL,
						modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
						PRIMARY KEY (conversation_id, file_path),
						FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
					);
				`
			},
			{
				name: "002_add_indexes",
				up: `
					CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
					CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
					CREATE INDEX IF NOT EXISTS idx_patterns_occurrences ON patterns(occurrences DESC);
					CREATE INDEX IF NOT EXISTS idx_conversation_files_file_path ON conversation_files(file_path);
				`
			}
		]

		// Check applied migrations
		let applied = new Set<string>()
		try {
			const res = this.db.exec("SELECT name FROM migrations")
			if (res.length > 0 && res[0].values) {
				res[0].values.forEach(row => applied.add(row[0] as string))
			}
		} catch (e) {
			// Table might not exist yet if run failed or something, but we created it above
		}

		for (const migration of migrations) {
			if (!applied.has(migration.name)) {
				console.log(`[SQLiteAdapter] Applying migration: ${migration.name}`)
				this.db.run(migration.up)
				this.db.run("INSERT INTO migrations (name) VALUES (?)", [migration.name])
			}
		}

		if (!this.isMemory) {
			await this.save()
		}
	}

	async run<T>(sql: string, params: any[] = []): Promise<{ changes: number }> {
		if (!this.db) throw new Error("Database not initialized")
		const changes = this.db.getRowsModified()
		this.db.run(sql, params)
		if (!this.isMemory) {
			await this.save() // Auto-save for persistence
		}
		return { changes }
	}

	async get<T>(sql: string, params: any[] = []): Promise<T | undefined> {
		if (!this.db) throw new Error("Database not initialized")
		const stmt = this.db.prepare(sql)
		stmt.bind(params)
		let result: T | undefined
		if (stmt.step()) {
			result = stmt.getAsObject() as unknown as T
		}
		stmt.free()
		return result
	}

	async all<T>(sql: string, params: any[] = []): Promise<T[]> {
		if (!this.db) throw new Error("Database not initialized")
		const stmt = this.db.prepare(sql)
		stmt.bind(params)
		const results: T[] = []
		while (stmt.step()) {
			results.push(stmt.getAsObject() as unknown as T)
		}
		stmt.free()
		return results
	}
}
