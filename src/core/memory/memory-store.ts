import initSqlJs, { type Database, type SqlValue } from "sql.js"
import * as fs from "fs"
import * as path from "path"
import * as crypto from "crypto"
import type { MemoryEntry, AnalysisLogEntry, ScoredMemoryEntry, MemoryCategorySlug } from "./types"
import { DEFAULT_MEMORY_CATEGORIES, MEMORY_CONSTANTS } from "./types"
import { computeScore } from "./scoring"

const SCHEMA_VERSION = 1

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memory_categories (
  slug TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  default_decay_rate REAL NOT NULL,
  priority_weight REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS memory_entries (
  id TEXT PRIMARY KEY,
  workspace_id TEXT,
  category TEXT NOT NULL REFERENCES memory_categories(slug),
  content TEXT NOT NULL,
  significance REAL NOT NULL,
  first_seen INTEGER NOT NULL,
  last_reinforced INTEGER NOT NULL,
  reinforcement_count INTEGER DEFAULT 1,
  decay_rate REAL NOT NULL,
  source_task_id TEXT,
  is_pinned INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS analysis_log (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  task_id TEXT,
  messages_analyzed INTEGER NOT NULL,
  tokens_used INTEGER NOT NULL,
  entries_created INTEGER NOT NULL,
  entries_reinforced INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_entries_category ON memory_entries(category);
CREATE INDEX IF NOT EXISTS idx_entries_workspace ON memory_entries(workspace_id);
CREATE INDEX IF NOT EXISTS idx_entries_last_reinforced ON memory_entries(last_reinforced);
`

/** SQLite-backed persistent store for user memory entries. */
export class MemoryStore {
	private db: Database | null = null
	private dbPath: string

	constructor(storagePath: string) {
		const memoryDir = path.join(storagePath, "memory")
		if (!fs.existsSync(memoryDir)) {
			fs.mkdirSync(memoryDir, { recursive: true })
		}
		this.dbPath = path.join(memoryDir, "user_memory.db")
	}

	/** Initialize the database, running schema creation and migrations. */
	async init(): Promise<void> {
		// sql.js needs to locate its WASM file. In a bundled extension, it's in dist/.
		// During tests/dev, resolve from node_modules.
		const SQL = await initSqlJs({
			locateFile: (file: string) => {
				// Try bundled location first (dist/)
				const bundledPath = path.join(__dirname, file)
				if (fs.existsSync(bundledPath)) {
					return bundledPath
				}
				// Fallback: resolve from node_modules (for tests/dev)
				try {
					const sqlJsMain = require.resolve("sql.js")
					const sqlJsDistDir = path.dirname(sqlJsMain)
					return path.join(sqlJsDistDir, file)
				} catch {
					return bundledPath
				}
			},
		})

		if (fs.existsSync(this.dbPath)) {
			const fileBuffer = fs.readFileSync(this.dbPath)
			this.db = new SQL.Database(fileBuffer)
		} else {
			this.db = new SQL.Database()
		}

		this.db.run(SCHEMA_SQL)
		this.initSchemaVersion()
		this.seedCategories()
		this.persist()
	}

	private initSchemaVersion(): void {
		const result = this.db!.exec("SELECT value FROM schema_meta WHERE key = 'version'")
		if (result.length === 0 || result[0].values.length === 0) {
			this.db!.run("INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('version', ?)", [
				String(SCHEMA_VERSION),
			])
		} else {
			const currentVersion = parseInt(result[0].values[0][0] as string, 10)
			this.runMigrations(currentVersion)
		}
	}

	private runMigrations(fromVersion: number): void {
		// Future migrations go here as: if (fromVersion < 2) { ... }
		// After all migrations, update version:
		if (fromVersion < SCHEMA_VERSION) {
			this.db!.run("UPDATE schema_meta SET value = ? WHERE key = 'version'", [String(SCHEMA_VERSION)])
		}
	}

	private seedCategories(): void {
		const stmt = this.db!.prepare(
			"INSERT OR IGNORE INTO memory_categories (slug, label, default_decay_rate, priority_weight) VALUES (?, ?, ?, ?)",
		)
		for (const cat of DEFAULT_MEMORY_CATEGORIES) {
			stmt.run([cat.slug, cat.label, cat.defaultDecayRate, cat.priorityWeight])
		}
		stmt.free()
	}

	private persist(): void {
		if (!this.db) return
		const data = this.db.export()
		const buffer = Buffer.from(data)
		const tmpPath = this.dbPath + ".tmp"
		fs.writeFileSync(tmpPath, buffer)
		fs.renameSync(tmpPath, this.dbPath)
	}

	/** Generate a random UUID for new entries. */
	generateId(): string {
		return crypto.randomUUID()
	}

	/** Insert a new memory entry, returning its ID. */
	insertEntry(entry: Omit<MemoryEntry, "id"> & { id?: string }): string {
		const id = entry.id || this.generateId()
		this.db!.run(
			`INSERT INTO memory_entries (id, workspace_id, category, content, significance, first_seen, last_reinforced, reinforcement_count, decay_rate, source_task_id, is_pinned)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				id,
				entry.workspaceId,
				entry.category,
				entry.content,
				entry.significance,
				entry.firstSeen,
				entry.lastReinforced,
				entry.reinforcementCount,
				entry.decayRate,
				entry.sourceTaskId,
				entry.isPinned ? 1 : 0,
			],
		)
		this.persist()
		return id
	}

	/** Bump the reinforcement count and timestamp for an existing entry. */
	reinforceEntry(id: string, taskId: string | null): void {
		this.db!.run(
			`UPDATE memory_entries SET last_reinforced = ?, reinforcement_count = reinforcement_count + 1, source_task_id = ? WHERE id = ?`,
			[Math.floor(Date.now() / 1000), taskId, id],
		)
		this.persist()
	}

	/** Update the content and significance of an existing entry. */
	updateEntry(id: string, content: string, significance: number, taskId: string | null): void {
		this.db!.run(
			`UPDATE memory_entries SET content = ?, significance = ?, last_reinforced = ?, reinforcement_count = reinforcement_count + 1, source_task_id = ? WHERE id = ?`,
			[content, significance, Math.floor(Date.now() / 1000), taskId, id],
		)
		this.persist()
	}

	/** Retrieve a single entry by ID, or null if not found. */
	getEntry(id: string): MemoryEntry | null {
		const result = this.db!.exec("SELECT * FROM memory_entries WHERE id = ?", [id])
		if (result.length === 0 || result[0].values.length === 0) return null
		return this.rowToEntry(result[0].columns, result[0].values[0])
	}

	/** List entries matching the given category and workspace scope. */
	getEntriesByCategory(category: string, workspaceId: string | null): MemoryEntry[] {
		const result = this.db!.exec(
			"SELECT * FROM memory_entries WHERE category = ? AND (workspace_id IS NULL OR workspace_id = ?) ORDER BY last_reinforced DESC",
			[category, workspaceId],
		)
		if (result.length === 0) return []
		return result[0].values.map((row: SqlValue[]) => this.rowToEntry(result[0].columns, row))
	}

	/** Return all entries ranked by computed relevance score. */
	getScoredEntries(workspaceId: string | null): ScoredMemoryEntry[] {
		const result = this.db!.exec(
			`SELECT e.*, c.priority_weight, c.label as category_label
			 FROM memory_entries e
			 JOIN memory_categories c ON e.category = c.slug
			 WHERE (e.workspace_id IS NULL OR e.workspace_id = ?)
			 ORDER BY e.last_reinforced DESC`,
			[workspaceId],
		)

		if (result.length === 0) return []

		const now = Math.floor(Date.now() / 1000)
		const entries: ScoredMemoryEntry[] = []

		for (const row of result[0].values) {
			const cols = result[0].columns
			const entry = this.rowToEntry(cols, row)
			const priorityWeight = row[cols.indexOf("priority_weight")] as number
			const categoryLabel = row[cols.indexOf("category_label")] as string
			const daysSinceReinforced = (now - entry.lastReinforced) / 86400

			const score = computeScore({
				significance: entry.significance,
				priorityWeight,
				reinforcementCount: entry.reinforcementCount,
				daysSinceReinforced,
				decayRate: entry.decayRate,
			})

			if (score >= MEMORY_CONSTANTS.SCORE_THRESHOLD) {
				entries.push({ ...entry, computedScore: score, categoryLabel })
			}
		}

		entries.sort((a, b) => b.computedScore - a.computedScore)
		return entries.slice(0, MEMORY_CONSTANTS.MAX_QUERY_ENTRIES)
	}

	/** Record an analysis run in the audit log. */
	logAnalysis(entry: AnalysisLogEntry): void {
		this.db!.run(
			`INSERT INTO analysis_log (id, timestamp, task_id, messages_analyzed, tokens_used, entries_created, entries_reinforced)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[
				entry.id,
				entry.timestamp,
				entry.taskId,
				entry.messagesAnalyzed,
				entry.tokensUsed,
				entry.entriesCreated,
				entry.entriesReinforced,
			],
		)
		this.persist()
	}

	/** Delete all entries from memory_entries and analysis_log tables. */
	deleteAllEntries(): void {
		this.db!.run("DELETE FROM memory_entries")
		this.db!.run("DELETE FROM analysis_log")
		this.persist()
	}

	/** Remove stale, low-score, unpinned entries and enforce the hard cap. */
	garbageCollect(): number {
		const now = Math.floor(Date.now() / 1000)
		const cutoff = now - MEMORY_CONSTANTS.GARBAGE_COLLECTION_DAYS * 86400

		// Delete entries that are old, low-scored, and not pinned
		// We compute score in JS since sql.js doesn't have LOG2/EXP natively
		const result = this.db!.exec(
			`SELECT e.id, e.significance, e.reinforcement_count, e.last_reinforced, e.decay_rate, e.is_pinned, c.priority_weight
			 FROM memory_entries e
			 JOIN memory_categories c ON e.category = c.slug
			 WHERE e.is_pinned = 0 AND e.last_reinforced < ?`,
			[cutoff],
		)

		if (result.length === 0) return 0

		const toDelete: string[] = []
		for (const row of result[0].values) {
			const cols = result[0].columns
			const significance = row[cols.indexOf("significance")] as number
			const count = row[cols.indexOf("reinforcement_count")] as number
			const lastReinforced = row[cols.indexOf("last_reinforced")] as number
			const decayRate = row[cols.indexOf("decay_rate")] as number
			const priorityWeight = row[cols.indexOf("priority_weight")] as number

			const score = computeScore({
				significance,
				priorityWeight,
				reinforcementCount: count,
				daysSinceReinforced: (now - lastReinforced) / 86400,
				decayRate,
			})

			if (score < MEMORY_CONSTANTS.GARBAGE_COLLECTION_SCORE_THRESHOLD) {
				toDelete.push(row[cols.indexOf("id")] as string)
			}
		}

		for (const id of toDelete) {
			this.db!.run("DELETE FROM memory_entries WHERE id = ?", [id])
		}

		// Hard cap enforcement
		const countResult = this.db!.exec("SELECT COUNT(*) FROM memory_entries")
		const totalCount = countResult[0].values[0][0] as number
		if (totalCount > MEMORY_CONSTANTS.MAX_ENTRIES) {
			const allResult = this.db!.exec(
				`SELECT e.id, e.significance, e.reinforcement_count, e.last_reinforced, e.decay_rate, e.is_pinned, c.priority_weight
				 FROM memory_entries e
				 JOIN memory_categories c ON e.category = c.slug
				 WHERE e.is_pinned = 0
				 ORDER BY e.last_reinforced ASC`,
			)
			if (allResult.length > 0) {
				const excess = totalCount - MEMORY_CONSTANTS.MAX_ENTRIES
				const scored = allResult[0].values
					.map((row) => {
						const cols = allResult[0].columns
						return {
							id: row[cols.indexOf("id")] as string,
							score: computeScore({
								significance: row[cols.indexOf("significance")] as number,
								priorityWeight: row[cols.indexOf("priority_weight")] as number,
								reinforcementCount: row[cols.indexOf("reinforcement_count")] as number,
								daysSinceReinforced:
									(now - (row[cols.indexOf("last_reinforced")] as number)) / 86400,
								decayRate: row[cols.indexOf("decay_rate")] as number,
							}),
						}
					})
					.sort((a, b) => a.score - b.score)

				for (let i = 0; i < Math.min(excess, scored.length); i++) {
					this.db!.run("DELETE FROM memory_entries WHERE id = ?", [scored[i].id])
					toDelete.push(scored[i].id)
				}
			}
		}

		if (toDelete.length > 0) this.persist()
		return toDelete.length
	}

	/** Delete all memory entries and persist the change. */
	deleteAllEntries(): void {
		this.db!.run("DELETE FROM memory_entries")
		this.persist()
	}

	/** Return the total number of stored entries. */
	getEntryCount(): number {
		const result = this.db!.exec("SELECT COUNT(*) FROM memory_entries")
		return result[0].values[0][0] as number
	}

	/** Close the database connection. */
	close(): void {
		if (this.db) {
			this.db.close()
			this.db = null
		}
	}

	private rowToEntry(columns: string[], row: unknown[]): MemoryEntry {
		const get = (col: string) => row[columns.indexOf(col)]
		return {
			id: get("id") as string,
			workspaceId: get("workspace_id") as string | null,
			category: get("category") as MemoryCategorySlug,
			content: get("content") as string,
			significance: get("significance") as number,
			firstSeen: get("first_seen") as number,
			lastReinforced: get("last_reinforced") as number,
			reinforcementCount: get("reinforcement_count") as number,
			decayRate: get("decay_rate") as number,
			sourceTaskId: get("source_task_id") as string | null,
			isPinned: (get("is_pinned") as number) === 1,
		}
	}
}
