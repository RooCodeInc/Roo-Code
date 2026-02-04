import { SQLiteAdapter } from "./storage/sqlite-adapter"
import { v4 as uuidv4 } from "uuid"

/**
 * Design decision record
 */
export interface DesignDecision {
	id: string
	title: string
	description: string
	rationale: string
	alternatives: string[]
	filesAffected: string[]
	status: "proposed" | "accepted" | "rejected" | "deprecated"
	tags: string[]
	createdAt: number
	updatedAt: number
}

/**
 * Best practice record
 */
export interface BestPractice {
	id: string
	category: string
	title: string
	description: string
	examples: string[]
	rationale: string
	files: string[]
	createdAt: number
}

/**
 * Project context information
 */
export interface ProjectContext {
	projectPath: string
	projectName: string
	architecture: string
	languages: string[]
	frameworks: string[]
	keyFiles: string[]
	lastUpdated: number
}

/**
 * Historical context result
 */
export interface HistoricalContext {
	decisions: DesignDecision[]
	bestPractices: BestPractice[]
}

/**
 * Search result
 */
export interface ProjectSearchResult {
	decisions: DesignDecision[]
	bestPractices: BestPractice[]
}

/**
 * Query options for listing design decisions
 */
export interface DesignDecisionQuery {
	status?: "proposed" | "accepted" | "rejected" | "deprecated"
	tags?: string[]
	limit?: number
}

/**
 * Project Memory Interface
 */
export interface ProjectMemory {
	initialize(): Promise<void>
	saveDesignDecision(decision: DesignDecision): Promise<string>
	getDesignDecision(id: string): Promise<DesignDecision | null>
	listDesignDecisions(query?: DesignDecisionQuery): Promise<DesignDecision[]>
	updateDesignDecisionStatus(
		id: string,
		status: "proposed" | "accepted" | "rejected" | "deprecated",
	): Promise<boolean>
	getDecisionsForFile(filePath: string): Promise<DesignDecision[]>
	saveBestPractice(practice: BestPractice): Promise<string>
	getBestPractices(category: string): Promise<BestPractice[]>
	getBestPracticesForFile(filePath: string): Promise<BestPractice[]>
	saveProjectContext(context: ProjectContext): Promise<void>
	getProjectContext(): Promise<ProjectContext | null>
	getHistoricalContext(filePath: string): Promise<HistoricalContext>
	search(query: string): Promise<ProjectSearchResult>
}

/**
 * Project Memory Implementation
 */
export class ProjectMemoryImpl implements ProjectMemory {
	private storage: SQLiteAdapter
	private initialized: boolean = false

	constructor(storage: SQLiteAdapter) {
		this.storage = storage
	}

	async initialize(): Promise<void> {
		if (this.initialized) return

		// Create design_decisions_v2 table with full schema
		await this.storage.run(`
			CREATE TABLE IF NOT EXISTS design_decisions_v2 (
				id TEXT PRIMARY KEY,
				title TEXT NOT NULL,
				description TEXT,
				rationale TEXT,
				alternatives TEXT,
				files_affected TEXT,
				status TEXT DEFAULT 'proposed',
				tags TEXT,
				created_at INTEGER,
				updated_at INTEGER
			)
		`)

		// Create best_practices table
		await this.storage.run(`
			CREATE TABLE IF NOT EXISTS best_practices (
				id TEXT PRIMARY KEY,
				category TEXT NOT NULL,
				title TEXT NOT NULL,
				description TEXT,
				examples TEXT,
				rationale TEXT,
				files TEXT,
				created_at INTEGER
			)
		`)

		// Create project_context table
		await this.storage.run(`
			CREATE TABLE IF NOT EXISTS project_context (
				key TEXT PRIMARY KEY,
				value TEXT NOT NULL,
				updated_at INTEGER
			)
		`)

		// Create indexes
		await this.storage.run(
			`CREATE INDEX IF NOT EXISTS idx_design_decisions_v2_status ON design_decisions_v2(status)`,
		)
		await this.storage.run(`CREATE INDEX IF NOT EXISTS idx_best_practices_category ON best_practices(category)`)

		this.initialized = true
	}

	private ensureInitialized(): void {
		if (!this.initialized) {
			throw new Error("ProjectMemory not initialized. Call initialize() first.")
		}
	}

	async saveDesignDecision(decision: DesignDecision): Promise<string> {
		this.ensureInitialized()

		const id = decision.id || uuidv4()
		const now = Date.now()

		await this.storage.run(
			`INSERT OR REPLACE INTO design_decisions_v2 
			(id, title, description, rationale, alternatives, files_affected, status, tags, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				id,
				decision.title,
				decision.description,
				decision.rationale,
				JSON.stringify(decision.alternatives),
				JSON.stringify(decision.filesAffected),
				decision.status,
				JSON.stringify(decision.tags),
				decision.createdAt || now,
				now,
			],
		)

		return id
	}

	async getDesignDecision(id: string): Promise<DesignDecision | null> {
		this.ensureInitialized()

		const row = await this.storage.get<{
			id: string
			title: string
			description: string
			rationale: string
			alternatives: string
			files_affected: string
			status: string
			tags: string
			created_at: number
			updated_at: number
		}>(`SELECT * FROM design_decisions_v2 WHERE id = ?`, [id])

		if (!row) return null

		return this.rowToDesignDecision(row)
	}

	async listDesignDecisions(query?: DesignDecisionQuery): Promise<DesignDecision[]> {
		this.ensureInitialized()

		let sql = `SELECT * FROM design_decisions_v2`
		const params: any[] = []
		const conditions: string[] = []

		if (query?.status) {
			conditions.push(`status = ?`)
			params.push(query.status)
		}

		if (conditions.length > 0) {
			sql += ` WHERE ${conditions.join(" AND ")}`
		}

		sql += ` ORDER BY updated_at DESC`

		if (query?.limit) {
			sql += ` LIMIT ?`
			params.push(query.limit)
		}

		const rows = await this.storage.all<{
			id: string
			title: string
			description: string
			rationale: string
			alternatives: string
			files_affected: string
			status: string
			tags: string
			created_at: number
			updated_at: number
		}>(sql, params)

		return rows.map((row) => this.rowToDesignDecision(row))
	}

	async updateDesignDecisionStatus(
		id: string,
		status: "proposed" | "accepted" | "rejected" | "deprecated",
	): Promise<boolean> {
		this.ensureInitialized()

		const result = await this.storage.run(
			`UPDATE design_decisions_v2 SET status = ?, updated_at = ? WHERE id = ?`,
			[status, Date.now(), id],
		)

		return result.changes > 0
	}

	async getDecisionsForFile(filePath: string): Promise<DesignDecision[]> {
		this.ensureInitialized()

		// Search for decisions that contain the file path in files_affected
		const rows = await this.storage.all<{
			id: string
			title: string
			description: string
			rationale: string
			alternatives: string
			files_affected: string
			status: string
			tags: string
			created_at: number
			updated_at: number
		}>(`SELECT * FROM design_decisions_v2 WHERE files_affected LIKE ?`, [`%${filePath}%`])

		return rows.map((row) => this.rowToDesignDecision(row))
	}

	async saveBestPractice(practice: BestPractice): Promise<string> {
		this.ensureInitialized()

		const id = practice.id || uuidv4()
		const now = Date.now()

		await this.storage.run(
			`INSERT OR REPLACE INTO best_practices 
			(id, category, title, description, examples, rationale, files, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				id,
				practice.category,
				practice.title,
				practice.description,
				JSON.stringify(practice.examples),
				practice.rationale,
				JSON.stringify(practice.files),
				practice.createdAt || now,
			],
		)

		return id
	}

	async getBestPractices(category: string): Promise<BestPractice[]> {
		this.ensureInitialized()

		const rows = await this.storage.all<{
			id: string
			category: string
			title: string
			description: string
			examples: string
			rationale: string
			files: string
			created_at: number
		}>(`SELECT * FROM best_practices WHERE category = ?`, [category])

		return rows.map((row) => this.rowToBestPractice(row))
	}

	async getBestPracticesForFile(filePath: string): Promise<BestPractice[]> {
		this.ensureInitialized()

		const rows = await this.storage.all<{
			id: string
			category: string
			title: string
			description: string
			examples: string
			rationale: string
			files: string
			created_at: number
		}>(`SELECT * FROM best_practices WHERE files LIKE ?`, [`%${filePath}%`])

		return rows.map((row) => this.rowToBestPractice(row))
	}

	async saveProjectContext(context: ProjectContext): Promise<void> {
		this.ensureInitialized()

		const now = Date.now()

		await this.storage.run(`INSERT OR REPLACE INTO project_context (key, value, updated_at) VALUES (?, ?, ?)`, [
			"main",
			JSON.stringify(context),
			now,
		])
	}

	async getProjectContext(): Promise<ProjectContext | null> {
		this.ensureInitialized()

		const row = await this.storage.get<{ value: string }>(`SELECT value FROM project_context WHERE key = ?`, [
			"main",
		])

		if (!row) return null

		return JSON.parse(row.value) as ProjectContext
	}

	async getHistoricalContext(filePath: string): Promise<HistoricalContext> {
		this.ensureInitialized()

		const decisions = await this.getDecisionsForFile(filePath)
		const bestPractices = await this.getBestPracticesForFile(filePath)

		return {
			decisions,
			bestPractices,
		}
	}

	async search(query: string): Promise<ProjectSearchResult> {
		this.ensureInitialized()

		const searchTerm = `%${query}%`

		// Search decisions
		const decisionRows = await this.storage.all<{
			id: string
			title: string
			description: string
			rationale: string
			alternatives: string
			files_affected: string
			status: string
			tags: string
			created_at: number
			updated_at: number
		}>(
			`SELECT * FROM design_decisions_v2 
			WHERE title LIKE ? OR description LIKE ? OR rationale LIKE ?`,
			[searchTerm, searchTerm, searchTerm],
		)

		// Search best practices
		const practiceRows = await this.storage.all<{
			id: string
			category: string
			title: string
			description: string
			examples: string
			rationale: string
			files: string
			created_at: number
		}>(
			`SELECT * FROM best_practices 
			WHERE title LIKE ? OR description LIKE ? OR rationale LIKE ? OR category LIKE ?`,
			[searchTerm, searchTerm, searchTerm, searchTerm],
		)

		return {
			decisions: decisionRows.map((row) => this.rowToDesignDecision(row)),
			bestPractices: practiceRows.map((row) => this.rowToBestPractice(row)),
		}
	}

	private rowToDesignDecision(row: {
		id: string
		title: string
		description: string
		rationale: string
		alternatives: string
		files_affected: string
		status: string
		tags: string
		created_at: number
		updated_at: number
	}): DesignDecision {
		return {
			id: row.id,
			title: row.title,
			description: row.description,
			rationale: row.rationale,
			alternatives: JSON.parse(row.alternatives || "[]"),
			filesAffected: JSON.parse(row.files_affected || "[]"),
			status: row.status as DesignDecision["status"],
			tags: JSON.parse(row.tags || "[]"),
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		}
	}

	private rowToBestPractice(row: {
		id: string
		category: string
		title: string
		description: string
		examples: string
		rationale: string
		files: string
		created_at: number
	}): BestPractice {
		return {
			id: row.id,
			category: row.category,
			title: row.title,
			description: row.description,
			examples: JSON.parse(row.examples || "[]"),
			rationale: row.rationale,
			files: JSON.parse(row.files || "[]"),
			createdAt: row.created_at,
		}
	}
}
