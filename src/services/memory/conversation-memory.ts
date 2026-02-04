import { SQLiteAdapter } from "./storage/sqlite-adapter"
import { v4 as uuidv4 } from "uuid"

/**
 * Message in a conversation
 */
export interface Message {
	id: string
	role: "user" | "assistant" | "system"
	content: string
	timestamp: number
	metadata?: Record<string, unknown>
}

/**
 * Conversation record
 */
export interface Conversation {
	id: string
	title: string
	summary?: string
	outcome?: string
	filesModified: string[]
	messages: Message[]
	createdAt: number
	updatedAt: number
	metadata?: Record<string, unknown>
}

/**
 * Extracted knowledge from conversations
 */
export interface ExtractedKnowledge {
	id: string
	conversationId: string
	type: "decision" | "pattern" | "insight" | "warning"
	content: string
	confidence: number
	createdAt: number
}

/**
 * Conversation query options
 */
export interface ConversationQuery {
	limit?: number
	startTime?: number
	endTime?: number
	fileFilter?: string
}

/**
 * Semantic search result
 */
export interface SemanticSearchResult {
	conversation: Conversation
	relevance: number
	matchingMessages: Message[]
}

/**
 * Conversation Memory Interface
 */
export interface IConversationMemory {
	initialize(): Promise<void>
	saveConversation(conversation: Conversation): Promise<string>
	getConversation(id: string): Promise<Conversation | null>
	listConversations(query?: ConversationQuery): Promise<Conversation[]>
	addMessage(conversationId: string, message: Message): Promise<void>
	searchConversations(query: string, limit?: number): Promise<SemanticSearchResult[]>
	getConversationsForFile(filePath: string): Promise<Conversation[]>
	extractKnowledge(conversationId: string): Promise<ExtractedKnowledge[]>
	getRecentContext(limit?: number): Promise<string>
}

/**
 * Conversation Memory Implementation
 */
export class ConversationMemory implements IConversationMemory {
	private storage: SQLiteAdapter
	private initialized: boolean = false

	constructor(storage: SQLiteAdapter) {
		this.storage = storage
	}

	async initialize(): Promise<void> {
		if (this.initialized) return

		// Create conversations_v2 table
		await this.storage.run(`
			CREATE TABLE IF NOT EXISTS conversations_v2 (
				id TEXT PRIMARY KEY,
				title TEXT NOT NULL,
				summary TEXT,
				outcome TEXT,
				files_modified TEXT,
				created_at INTEGER,
				updated_at INTEGER,
				metadata TEXT
			)
		`)

		// Create messages_v2 table
		await this.storage.run(`
			CREATE TABLE IF NOT EXISTS messages_v2 (
				id TEXT PRIMARY KEY,
				conversation_id TEXT NOT NULL,
				role TEXT NOT NULL,
				content TEXT NOT NULL,
				timestamp INTEGER,
				metadata TEXT,
				FOREIGN KEY(conversation_id) REFERENCES conversations_v2(id) ON DELETE CASCADE
			)
		`)

		// Create extracted_knowledge table
		await this.storage.run(`
			CREATE TABLE IF NOT EXISTS extracted_knowledge (
				id TEXT PRIMARY KEY,
				conversation_id TEXT NOT NULL,
				type TEXT NOT NULL,
				content TEXT NOT NULL,
				confidence REAL,
				created_at INTEGER,
				FOREIGN KEY(conversation_id) REFERENCES conversations_v2(id) ON DELETE CASCADE
			)
		`)

		// Create indexes
		await this.storage.run(
			`CREATE INDEX IF NOT EXISTS idx_messages_v2_conversation_id ON messages_v2(conversation_id)`,
		)
		await this.storage.run(
			`CREATE INDEX IF NOT EXISTS idx_conversations_v2_updated_at ON conversations_v2(updated_at DESC)`,
		)
		await this.storage.run(
			`CREATE INDEX IF NOT EXISTS idx_extracted_knowledge_conversation ON extracted_knowledge(conversation_id)`,
		)

		this.initialized = true
	}

	private ensureInitialized(): void {
		if (!this.initialized) {
			throw new Error("ConversationMemory not initialized. Call initialize() first.")
		}
	}

	async saveConversation(conversation: Conversation): Promise<string> {
		this.ensureInitialized()

		const id = conversation.id || uuidv4()
		const now = Date.now()

		await this.storage.run(
			`INSERT OR REPLACE INTO conversations_v2 
			(id, title, summary, outcome, files_modified, created_at, updated_at, metadata)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				id,
				conversation.title,
				conversation.summary || null,
				conversation.outcome || null,
				JSON.stringify(conversation.filesModified),
				conversation.createdAt || now,
				now,
				JSON.stringify(conversation.metadata || {}),
			],
		)

		// Save messages
		for (const message of conversation.messages) {
			await this.addMessage(id, message)
		}

		return id
	}

	async getConversation(id: string): Promise<Conversation | null> {
		this.ensureInitialized()

		const row = await this.storage.get<{
			id: string
			title: string
			summary: string | null
			outcome: string | null
			files_modified: string
			created_at: number
			updated_at: number
			metadata: string
		}>(`SELECT * FROM conversations_v2 WHERE id = ?`, [id])

		if (!row) return null

		// Get messages
		const messages = await this.storage.all<{
			id: string
			role: string
			content: string
			timestamp: number
			metadata: string
		}>(`SELECT * FROM messages_v2 WHERE conversation_id = ? ORDER BY timestamp ASC`, [id])

		return {
			id: row.id,
			title: row.title,
			summary: row.summary || undefined,
			outcome: row.outcome || undefined,
			filesModified: JSON.parse(row.files_modified || "[]"),
			messages: messages.map((m) => ({
				id: m.id,
				role: m.role as Message["role"],
				content: m.content,
				timestamp: m.timestamp,
				metadata: JSON.parse(m.metadata || "{}"),
			})),
			createdAt: row.created_at,
			updatedAt: row.updated_at,
			metadata: JSON.parse(row.metadata || "{}"),
		}
	}

	async listConversations(query?: ConversationQuery): Promise<Conversation[]> {
		this.ensureInitialized()

		let sql = `SELECT * FROM conversations_v2`
		const params: any[] = []
		const conditions: string[] = []

		if (query?.startTime) {
			conditions.push(`created_at >= ?`)
			params.push(query.startTime)
		}

		if (query?.endTime) {
			conditions.push(`created_at <= ?`)
			params.push(query.endTime)
		}

		if (query?.fileFilter) {
			conditions.push(`files_modified LIKE ?`)
			params.push(`%${query.fileFilter}%`)
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
			summary: string | null
			outcome: string | null
			files_modified: string
			created_at: number
			updated_at: number
			metadata: string
		}>(sql, params)

		// Don't load all messages for listing - return empty array
		return rows.map((row) => ({
			id: row.id,
			title: row.title,
			summary: row.summary || undefined,
			outcome: row.outcome || undefined,
			filesModified: JSON.parse(row.files_modified || "[]"),
			messages: [], // Empty for performance
			createdAt: row.created_at,
			updatedAt: row.updated_at,
			metadata: JSON.parse(row.metadata || "{}"),
		}))
	}

	async addMessage(conversationId: string, message: Message): Promise<void> {
		this.ensureInitialized()

		const id = message.id || uuidv4()

		await this.storage.run(
			`INSERT OR REPLACE INTO messages_v2 
			(id, conversation_id, role, content, timestamp, metadata)
			VALUES (?, ?, ?, ?, ?, ?)`,
			[id, conversationId, message.role, message.content, message.timestamp || Date.now(), JSON.stringify(message.metadata || {})],
		)

		// Update conversation updated_at
		await this.storage.run(`UPDATE conversations_v2 SET updated_at = ? WHERE id = ?`, [Date.now(), conversationId])
	}

	async searchConversations(query: string, limit: number = 10): Promise<SemanticSearchResult[]> {
		this.ensureInitialized()

		const searchTerm = `%${query}%`

		// Search in messages
		const messageRows = await this.storage.all<{
			conversation_id: string
			id: string
			role: string
			content: string
			timestamp: number
			metadata: string
		}>(`SELECT * FROM messages_v2 WHERE content LIKE ? LIMIT 100`, [searchTerm])

		// Group by conversation
		const conversationMatches = new Map<
			string,
			{
				messages: Message[]
				relevance: number
			}
		>()

		for (const row of messageRows) {
			const convId = row.conversation_id
			if (!conversationMatches.has(convId)) {
				conversationMatches.set(convId, { messages: [], relevance: 0 })
			}
			const match = conversationMatches.get(convId)!
			match.messages.push({
				id: row.id,
				role: row.role as Message["role"],
				content: row.content,
				timestamp: row.timestamp,
				metadata: JSON.parse(row.metadata || "{}"),
			})
			// Simple relevance scoring based on match count
			match.relevance += this.calculateRelevance(row.content, query)
		}

		// Also search in conversation titles and summaries
		const convRows = await this.storage.all<{
			id: string
			title: string
			summary: string | null
		}>(`SELECT id, title, summary FROM conversations_v2 WHERE title LIKE ? OR summary LIKE ?`, [
			searchTerm,
			searchTerm,
		])

		for (const row of convRows) {
			if (!conversationMatches.has(row.id)) {
				conversationMatches.set(row.id, { messages: [], relevance: 0 })
			}
			const match = conversationMatches.get(row.id)!
			match.relevance += this.calculateRelevance(row.title + (row.summary || ""), query)
		}

		// Sort by relevance and limit
		const sortedConvIds = [...conversationMatches.entries()]
			.sort((a, b) => b[1].relevance - a[1].relevance)
			.slice(0, limit)
			.map(([id]) => id)

		// Fetch full conversations
		const results: SemanticSearchResult[] = []
		for (const id of sortedConvIds) {
			const conversation = await this.getConversation(id)
			if (conversation) {
				const match = conversationMatches.get(id)!
				results.push({
					conversation,
					relevance: match.relevance,
					matchingMessages: match.messages,
				})
			}
		}

		return results
	}

	async getConversationsForFile(filePath: string): Promise<Conversation[]> {
		this.ensureInitialized()

		const rows = await this.storage.all<{
			id: string
			title: string
			summary: string | null
			outcome: string | null
			files_modified: string
			created_at: number
			updated_at: number
			metadata: string
		}>(`SELECT * FROM conversations_v2 WHERE files_modified LIKE ?`, [`%${filePath}%`])

		return rows.map((row) => ({
			id: row.id,
			title: row.title,
			summary: row.summary || undefined,
			outcome: row.outcome || undefined,
			filesModified: JSON.parse(row.files_modified || "[]"),
			messages: [], // Empty for performance
			createdAt: row.created_at,
			updatedAt: row.updated_at,
			metadata: JSON.parse(row.metadata || "{}"),
		}))
	}

	async extractKnowledge(conversationId: string): Promise<ExtractedKnowledge[]> {
		this.ensureInitialized()

		// Get existing knowledge
		const existingKnowledge = await this.storage.all<{
			id: string
			conversation_id: string
			type: string
			content: string
			confidence: number
			created_at: number
		}>(`SELECT * FROM extracted_knowledge WHERE conversation_id = ?`, [conversationId])

		if (existingKnowledge.length > 0) {
			return existingKnowledge.map((row) => ({
				id: row.id,
				conversationId: row.conversation_id,
				type: row.type as ExtractedKnowledge["type"],
				content: row.content,
				confidence: row.confidence,
				createdAt: row.created_at,
			}))
		}

		// Extract knowledge from conversation
		const conversation = await this.getConversation(conversationId)
		if (!conversation) return []

		const knowledge: ExtractedKnowledge[] = []

		// Simple keyword-based extraction
		for (const message of conversation.messages) {
			if (message.role === "assistant") {
				// Extract decisions
				if (
					message.content.toLowerCase().includes("decision") ||
					message.content.toLowerCase().includes("decided")
				) {
					const extracted: ExtractedKnowledge = {
						id: uuidv4(),
						conversationId,
						type: "decision",
						content: this.extractSentence(message.content, "decision"),
						confidence: 0.7,
						createdAt: Date.now(),
					}
					knowledge.push(extracted)
				}

				// Extract patterns
				if (
					message.content.toLowerCase().includes("pattern") ||
					message.content.toLowerCase().includes("always")
				) {
					const extracted: ExtractedKnowledge = {
						id: uuidv4(),
						conversationId,
						type: "pattern",
						content: this.extractSentence(message.content, "pattern"),
						confidence: 0.6,
						createdAt: Date.now(),
					}
					knowledge.push(extracted)
				}

				// Extract warnings
				if (
					message.content.toLowerCase().includes("warning") ||
					message.content.toLowerCase().includes("careful") ||
					message.content.toLowerCase().includes("avoid")
				) {
					const extracted: ExtractedKnowledge = {
						id: uuidv4(),
						conversationId,
						type: "warning",
						content: this.extractSentence(message.content, "warning"),
						confidence: 0.8,
						createdAt: Date.now(),
					}
					knowledge.push(extracted)
				}
			}
		}

		// Save extracted knowledge
		for (const k of knowledge) {
			await this.storage.run(
				`INSERT INTO extracted_knowledge 
				(id, conversation_id, type, content, confidence, created_at)
				VALUES (?, ?, ?, ?, ?, ?)`,
				[k.id, k.conversationId, k.type, k.content, k.confidence, k.createdAt],
			)
		}

		return knowledge
	}

	async getRecentContext(limit: number = 5): Promise<string> {
		this.ensureInitialized()

		const conversations = await this.listConversations({ limit })

		const contextParts: string[] = []

		for (const conv of conversations) {
			if (conv.summary) {
				contextParts.push(`- ${conv.title}: ${conv.summary}`)
			} else {
				contextParts.push(`- ${conv.title}`)
			}
		}

		return contextParts.join("\n")
	}

	private calculateRelevance(text: string, query: string): number {
		const lowerText = text.toLowerCase()
		const lowerQuery = query.toLowerCase()
		const words = lowerQuery.split(/\s+/)

		let score = 0
		for (const word of words) {
			if (lowerText.includes(word)) {
				score += 1
			}
		}

		// Normalize by query length
		return score / words.length
	}

	private extractSentence(text: string, keyword: string): string {
		const sentences = text.split(/[.!?]+/)
		for (const sentence of sentences) {
			if (sentence.toLowerCase().includes(keyword)) {
				return sentence.trim()
			}
		}
		// Return first 200 characters if no matching sentence
		return text.substring(0, 200).trim()
	}
}
