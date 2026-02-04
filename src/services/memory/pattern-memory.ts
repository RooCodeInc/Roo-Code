import { SQLiteAdapter } from "./storage/sqlite-adapter"
import { v4 as uuidv4 } from "uuid"

/**
 * Pattern Memory - Handles learning and retrieval of code patterns
 * with similarity-based suggestions.
 */

export interface CodePattern {
	id: string
	hash: string
	template: string
	occurrences: number
	firstSeen: number
	lastSeen: number
	context: PatternContext
	metadata?: Record<string, unknown>
}

export interface PatternContext {
	language: string
	fileType: string
	framework?: string
	projectType?: string
	tags: string[]
}

export interface PatternOccurrence {
	id: string
	patternId: string
	filePath: string
	code: string
	lineNumber: number
	timestamp: number
	metadata?: Record<string, unknown>
}

export interface PatternSuggestion {
	pattern: CodePattern
	similarity: number
	suggestion: string
}

export interface PatternQuery {
	language?: string
	fileType?: string
	framework?: string
	tags?: string[]
	limit?: number
}

export interface PatternMemory {
	/**
	 * Learn a code pattern from the codebase
	 */
	learnPattern(code: string, context: PatternContext): Promise<string>

	/**
	 * Get a pattern by ID
	 */
	getPattern(id: string): Promise<CodePattern | null>

	/**
	 * Get a pattern by hash
	 */
	getPatternByHash(hash: string): Promise<CodePattern | null>

	/**
	 * List patterns with optional filtering
	 */
	listPatterns(query?: PatternQuery): Promise<CodePattern[]>

	/**
	 * Get most frequently used patterns
	 */
	getFrequentPatterns(limit?: number): Promise<CodePattern[]>

	/**
	 * Get recently seen patterns
	 */
	getRecentPatterns(limit?: number): Promise<CodePattern[]>

	/**
	 * Suggest similar patterns for given code
	 */
	suggestSimilarPatterns(code: string, limit?: number): Promise<PatternSuggestion[]>

	/**
	 * Increment pattern occurrence count
	 */
	recordOccurrence(patternId: string, filePath: string, lineNumber: number): Promise<void>

	/**
	 * Get occurrences of a pattern
	 */
	getOccurrences(patternId: string): Promise<PatternOccurrence[]>

	/**
	 * Delete a pattern
	 */
	deletePattern(id: string): Promise<boolean>

	/**
	 * Get pattern statistics
	 */
	getStatistics(): Promise<PatternStatistics>
}

export interface PatternStatistics {
	totalPatterns: number
	totalOccurrences: number
	patternsByLanguage: { language: string; count: number }[]
	topPatterns: { template: string; occurrences: number }[]
}

export class PatternMemoryImpl implements PatternMemory {
	private storage: SQLiteAdapter
	private initialized: boolean = false

	constructor(storage: SQLiteAdapter) {
		this.storage = storage
	}

	async initialize(): Promise<void> {
		if (this.initialized) return

		// Create tables if they don't exist
		await this.storage.run(`
			CREATE TABLE IF NOT EXISTS code_patterns (
				id TEXT PRIMARY KEY,
				hash TEXT UNIQUE NOT NULL,
				template TEXT NOT NULL,
				occurrences INTEGER DEFAULT 1,
				first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
				last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
				context TEXT NOT NULL,
				metadata TEXT
			)
		`)

		await this.storage.run(`
			CREATE TABLE IF NOT EXISTS pattern_occurrences (
				id TEXT PRIMARY KEY,
				pattern_id TEXT NOT NULL,
				file_path TEXT NOT NULL,
				code TEXT,
				line_number INTEGER,
				timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
				metadata TEXT,
				FOREIGN KEY (pattern_id) REFERENCES code_patterns(id) ON DELETE CASCADE
			)
		`)

		await this.storage.run(`
			CREATE INDEX IF NOT EXISTS idx_patterns_hash ON code_patterns(hash)
		`)

		await this.storage.run(`
			CREATE INDEX IF NOT EXISTS idx_patterns_occurrences ON code_patterns(occurrences DESC)
		`)

		await this.storage.run(`
			CREATE INDEX IF NOT EXISTS idx_occurrences_pattern_id ON pattern_occurrences(pattern_id)
		`)

		this.initialized = true
	}

	private ensureInitialized(): void {
		if (!this.initialized) {
			throw new Error("PatternMemory not initialized. Call initialize() first.")
		}
	}

	/**
	 * Generate a hash for code pattern
	 */
	private hashPattern(code: string): string {
		// Normalize the code for pattern matching
		const normalized = this.normalizePattern(code)
		// Simple hash function
		let hash = 0
		for (let i = 0; i < normalized.length; i++) {
			const char = normalized.charCodeAt(i)
			hash = ((hash << 5) - hash) + char
			hash = hash & hash // Convert to 32bit integer
		}
		return Math.abs(hash).toString(16)
	}

	/**
	 * Normalize a code pattern for comparison
	 */
	private normalizePattern(code: string): string {
		return code
			// Remove comments
			.replace(/\/\/.*$/gm, "")
			.replace(/\/\*[\s\S]*?\*\//g, "")
			// Remove string literals
			.replace(/"[^"]*"/g, '"..."')
			.replace(/'[^']*'/g, "'...'")
			.replace(/`[^`]*`/g, "`...`")
			// Remove numbers
			.replace(/\b\d+\b/g, "N")
			// Normalize whitespace
			.replace(/\s+/g, " ")
			.trim()
	}

	async learnPattern(code: string, context: PatternContext): Promise<string> {
		this.ensureInitialized()

		const hash = this.hashPattern(code)
		const normalizedTemplate = this.normalizePattern(code)
		const now = Date.now()

		// Check if pattern already exists
		const existing = await this.getPatternByHash(hash)

		if (existing) {
			// Update occurrence count
			await this.storage.run(
				`UPDATE code_patterns SET 
				occurrences = occurrences + 1,
				last_seen = ?
				WHERE hash = ?`,
				[now, hash],
			)

			// Record this occurrence
			await this.recordOccurrence(existing.id, "", 0)

			return existing.id
		}

		// Create new pattern
		const id = uuidv4()

		await this.storage.run(
			`INSERT INTO code_patterns 
			(id, hash, template, occurrences, first_seen, last_seen, context, metadata) 
			VALUES (?, ?, ?, 1, ?, ?, ?, ?)`,
			[id, hash, normalizedTemplate, now, now, JSON.stringify(context), null],
		)

		// Record the initial occurrence
		await this.recordOccurrence(id, "", 0)

		return id
	}

	async getPattern(id: string): Promise<CodePattern | null> {
		this.ensureInitialized()

		const result = await this.storage.get<{
			id: string
			hash: string
			template: string
			occurrences: number
			first_seen: number
			last_seen: number
			context: string
			metadata: string | null
		}>(
			`SELECT id, hash, template, occurrences, first_seen, last_seen, context, metadata 
			FROM code_patterns WHERE id = ?`,
			[id],
		)

		if (!result) return null

		return {
			id: result.id,
			hash: result.hash,
			template: result.template,
			occurrences: result.occurrences,
			firstSeen: result.first_seen,
			lastSeen: result.last_seen,
			context: JSON.parse(result.context),
			metadata: result.metadata ? JSON.parse(result.metadata) : undefined,
		}
	}

	async getPatternByHash(hash: string): Promise<CodePattern | null> {
		this.ensureInitialized()

		const result = await this.storage.get<{
			id: string
			hash: string
			template: string
			occurrences: number
			first_seen: number
			last_seen: number
			context: string
			metadata: string | null
		}>(
			`SELECT id, hash, template, occurrences, first_seen, last_seen, context, metadata 
			FROM code_patterns WHERE hash = ?`,
			[hash],
		)

		if (!result) return null

		return {
			id: result.id,
			hash: result.hash,
			template: result.template,
			occurrences: result.occurrences,
			firstSeen: result.first_seen,
			lastSeen: result.last_seen,
			context: JSON.parse(result.context),
			metadata: result.metadata ? JSON.parse(result.metadata) : undefined,
		}
	}

	async listPatterns(query?: PatternQuery): Promise<CodePattern[]> {
		this.ensureInitialized()

		const limit = query?.limit || 50
		const conditions: string[] = []
		const params: unknown[] = []

		if (query?.language) {
			conditions.push("context LIKE ?")
			params.push(`%"language":"${query.language}"%`)
		}

		if (query?.fileType) {
			conditions.push("context LIKE ?")
			params.push(`%"fileType":"${query.fileType}"%`)
		}

		if (query?.framework) {
			conditions.push("context LIKE ?")
			params.push(`%"framework":"${query.framework}"%`)
		}

		const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

		const results = await this.storage.all<{
			id: string
			hash: string
			template: string
			occurrences: number
			first_seen: number
			last_seen: number
			context: string
			metadata: string | null
		}>(
			`SELECT id, hash, template, occurrences, first_seen, last_seen, context, metadata 
			FROM code_patterns 
			${whereClause} 
			ORDER BY last_seen DESC 
			LIMIT ?`,
			[...params, limit],
		)

		return results.map((r) => ({
			id: r.id,
			hash: r.hash,
			template: r.template,
			occurrences: r.occurrences,
			firstSeen: r.first_seen,
			lastSeen: r.last_seen,
			context: JSON.parse(r.context),
			metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
		}))
	}

	async getFrequentPatterns(limit: number = 10): Promise<CodePattern[]> {
		this.ensureInitialized()

		const results = await this.storage.all<{
			id: string
			hash: string
			template: string
			occurrences: number
			first_seen: number
			last_seen: number
			context: string
			metadata: string | null
		}>(
			`SELECT id, hash, template, occurrences, first_seen, last_seen, context, metadata 
			FROM code_patterns 
			ORDER BY occurrences DESC 
			LIMIT ?`,
			[limit],
		)

		return results.map((r) => ({
			id: r.id,
			hash: r.hash,
			template: r.template,
			occurrences: r.occurrences,
			firstSeen: r.first_seen,
			lastSeen: r.last_seen,
			context: JSON.parse(r.context),
			metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
		}))
	}

	async getRecentPatterns(limit: number = 10): Promise<CodePattern[]> {
		this.ensureInitialized()

		const results = await this.storage.all<{
			id: string
			hash: string
			template: string
			occurrences: number
			first_seen: number
			last_seen: number
			context: string
			metadata: string | null
		}>(
			`SELECT id, hash, template, occurrences, first_seen, last_seen, context, metadata 
			FROM code_patterns 
			ORDER BY last_seen DESC 
			LIMIT ?`,
			[limit],
		)

		return results.map((r) => ({
			id: r.id,
			hash: r.hash,
			template: r.template,
			occurrences: r.occurrences,
			firstSeen: r.first_seen,
			lastSeen: r.last_seen,
			context: JSON.parse(r.context),
			metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
		}))
	}

	async suggestSimilarPatterns(code: string, limit: number = 5): Promise<PatternSuggestion[]> {
		this.ensureInitialized()

		const normalizedInput = this.normalizePattern(code)
		const inputHash = this.hashPattern(code)

		// First check for exact or very similar matches
		const patterns = await this.storage.all<{
			id: string
			hash: string
			template: string
			occurrences: number
			first_seen: number
			last_seen: number
			context: string
		}>(
			`SELECT id, hash, template, occurrences, first_seen, last_seen, context 
			FROM code_patterns 
			ORDER BY occurrences DESC 
			LIMIT ?`,
			[limit * 2],
		)

		const suggestions: PatternSuggestion[] = []

		for (const pattern of patterns) {
			// Skip exact same pattern
			if (pattern.hash === inputHash) continue

			// Calculate similarity using Levenshtein distance (simplified)
			const similarity = this.calculateSimilarity(normalizedInput, pattern.template)

			if (similarity > 0.3) {
				suggestions.push({
					pattern: {
						id: pattern.id,
						hash: pattern.hash,
						template: pattern.template,
						occurrences: pattern.occurrences,
						firstSeen: pattern.first_seen,
						lastSeen: pattern.last_seen,
						context: JSON.parse(pattern.context),
					},
					similarity,
					suggestion: this.generateSuggestion(pattern.template, normalizedInput),
				})
			}
		}

		return suggestions.sort((a, b) => b.similarity - a.similarity).slice(0, limit)
	}

	/**
	 * Calculate similarity between two patterns (0-1)
	 */
	private calculateSimilarity(pattern1: string, pattern2: string): number {
		const longer = pattern1.length > pattern2.length ? pattern1 : pattern2
		const shorter = pattern1.length > pattern2.length ? pattern2 : pattern1

		if (longer.length === 0) return 1.0

		const editDistance = this.levenshteinDistance(longer, shorter)
		return (longer.length - editDistance) / longer.length
	}

	/**
	 * Calculate Levenshtein distance
	 */
	private levenshteinDistance(str1: string, str2: string): number {
		const m = str1.length
		const n = str2.length

		// Create matrix
		const dp: number[][] = Array(m + 1)
			.fill(null)
			.map(() => Array(n + 1).fill(0))

		for (let i = 0; i <= m; i++) dp[i][0] = i
		for (let j = 0; j <= n; j++) dp[0][j] = j

		for (let i = 1; i <= m; i++) {
			for (let j = 1; j <= n; j++) {
				if (str1[i - 1] === str2[j - 1]) {
					dp[i][j] = dp[i - 1][j - 1]
				} else {
					dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
				}
			}
		}

		return dp[m][n]
	}

	/**
	 * Generate a suggestion message
	 */
	private generateSuggestion(existingTemplate: string, inputTemplate: string): string {
		return `Similar pattern found with ${Math.round(this.calculateSimilarity(inputTemplate, existingTemplate) * 100)}% similarity`
	}

	async recordOccurrence(patternId: string, filePath: string, lineNumber: number): Promise<void> {
		this.ensureInitialized()

		const id = uuidv4()
		const now = Date.now()

		await this.storage.run(
			`INSERT INTO pattern_occurrences 
			(id, pattern_id, file_path, line_number, timestamp) 
			VALUES (?, ?, ?, ?, ?)`,
			[id, patternId, filePath, lineNumber, now],
		)
	}

	async getOccurrences(patternId: string): Promise<PatternOccurrence[]> {
		this.ensureInitialized()

		const results = await this.storage.all<{
			id: string
			pattern_id: string
			file_path: string
			code: string | null
			line_number: number
			timestamp: number
			metadata: string | null
		}>(
			`SELECT id, pattern_id, file_path, code, line_number, timestamp, metadata 
			FROM pattern_occurrences 
			WHERE pattern_id = ? 
			ORDER BY timestamp DESC`,
			[patternId],
		)

		return results.map((r) => ({
			id: r.id,
			patternId: r.pattern_id,
			filePath: r.file_path,
			code: r.code || "",
			lineNumber: r.line_number,
			timestamp: r.timestamp,
			metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
		}))
	}

	async deletePattern(id: string): Promise<boolean> {
		this.ensureInitialized()

		// Use COUNT to verify the pattern exists before deletion
		const result = await this.storage.get<{ count: number }>(
			"SELECT COUNT(*) as count FROM code_patterns WHERE id = ?",
			[id],
		)
		const exists = (result?.count || 0) > 0

		if (exists) {
			await this.storage.run("DELETE FROM code_patterns WHERE id = ?", [id])
			return true
		}
		return false
	}

	async getStatistics(): Promise<PatternStatistics> {
		this.ensureInitialized()

		const totalResult = await this.storage.get<{ count: number }>(
			"SELECT COUNT(*) as count FROM code_patterns",
		)
		const totalPatterns = totalResult?.count || 0

		const occurrenceResult = await this.storage.get<{ count: number }>(
			"SELECT COUNT(*) as count FROM pattern_occurrences",
		)
		const totalOccurrences = occurrenceResult?.count || 0

		// Get patterns by language
		const languageResults = await this.storage.all<{ context: string; count: number }>(
			`SELECT context, COUNT(*) as count FROM code_patterns GROUP BY context`,
		)

		const patternsByLanguage = languageResults.map((r) => {
			const ctx = JSON.parse(r.context) as PatternContext
			return { language: ctx.language || "unknown", count: r.count }
		})

		// Get top patterns
		const topResults = await this.storage.all<{ template: string; occurrences: number }>(
			`SELECT template, occurrences FROM code_patterns ORDER BY occurrences DESC LIMIT 10`,
		)

		return {
			totalPatterns,
			totalOccurrences,
			patternsByLanguage,
			topPatterns: topResults.map((r) => ({
				template: r.template.substring(0, 50) + (r.template.length > 50 ? "..." : ""),
				occurrences: r.occurrences,
			})),
		}
	}
}

/**
 * Factory function to create a PatternMemory instance
 */
export async function createPatternMemory(
	storagePath: string,
	dbName?: string,
): Promise<PatternMemory> {
	const storage = new SQLiteAdapter(storagePath, dbName)
	await storage.initialize()

	const memory = new PatternMemoryImpl(storage)
	await memory.initialize()

	return memory
}
