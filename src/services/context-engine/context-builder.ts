/**
 * Context Builder - Builds intelligent context for AI assistance
 *
 * Combines code index, memory systems, and behavioral context
 * to create comprehensive context for AI operations.
 */

import { IMemoryManager } from "../memory/interfaces"
import { ConversationMemory } from "../memory/conversation-memory"
import { ProjectMemory } from "../memory/project-memory"
import { PatternMemory } from "../memory/pattern-memory"
import { ContextCompressor } from "../context-compression/interfaces"

/**
 * Request for building context
 */
export interface ContextRequest {
	/** User query or intent */
	query: string
	/** Current file being worked on */
	currentFile?: string
	/** Open files in editor */
	openFiles?: string[]
	/** Maximum tokens for context */
	maxTokens?: number
	/** Priority items to include */
	priorityItems?: PriorityItem[]
	/** Exclude certain types of context */
	excludeTypes?: ContextType[]
	/** Include conversation history */
	includeHistory?: boolean
	/** Include patterns */
	includePatterns?: boolean
	/** Include design decisions */
	includeDecisions?: boolean
}

/**
 * Priority item to include in context
 */
export interface PriorityItem {
	/** Type of item */
	type: PriorityType
	/** Target (file path, pattern ID, etc.) */
	target: string
	/** Priority level (1-10, higher is more important) */
	priority: number
}

/**
 * Priority types
 */
export enum PriorityType {
	FILE = "file",
	PATTERN = "pattern",
	DECISION = "decision",
	CONVERSATION = "conversation",
	SYMBOL = "symbol",
}

/**
 * Context types that can be included
 */
export enum ContextType {
	CODE = "code",
	CONVERSATION = "conversation",
	PATTERN = "pattern",
	DECISION = "decision",
	ARCHITECTURE = "architecture",
	BEHAVIOR = "behavior",
	SYMBOL = "symbol",
}

/**
 * Built context result
 */
export interface BuiltContext {
	/** Context items included */
	items: ContextItem[]
	/** Total tokens used */
	totalTokens: number
	/** Token breakdown by type */
	tokenBreakdown: Record<ContextType, number>
	/** Files referenced */
	files: string[]
	/** Metadata */
	metadata: ContextMetadata
}

/**
 * Individual context item
 */
export interface ContextItem {
	/** Type of context */
	type: ContextType
	/** Content of the item */
	content: string
	/** Token count */
	tokens: number
	/** Source (file path, memory ID, etc.) */
	source: string
	/** Relevance score (0-1) */
	relevance: number
	/** Priority level (1-10) */
	priority: number
	/** Metadata */
	metadata?: Record<string, unknown>
}

/**
 * Context metadata
 */
export interface ContextMetadata {
	/** Time taken to build context (ms) */
	buildTimeMs: number
	/** Number of items considered */
	itemsConsidered: number
	/** Items excluded due to token limits */
	itemsExcluded: number
	/** Compression applied */
	compressionApplied: boolean
	/** Original token count before compression */
	originalTokens: number
}

/**
 * Relevant code result
 */
export interface RelevantCode {
	/** File path */
	filePath: string
	/** Code content */
	content: string
	/** Relevance score */
	relevance: number
	/** Type of match (exact, related, dependency) */
	matchType: MatchType
	/** Symbols found */
	symbols?: string[]
}

/**
 * Type of code match
 */
export enum MatchType {
	EXACT = "exact",
	RELATED = "related",
	DEPENDENCY = "dependency",
	SIMILAR = "similar",
}

/**
 * Context Builder Interface
 */
export interface IContextBuilder {
	/**
	 * Build comprehensive context for a request
	 */
	buildContext(request: ContextRequest): Promise<BuiltContext>

	/**
	 * Get relevant code from index
	 */
	getRelevantCode(query: string, currentFile?: string): Promise<RelevantCode[]>

	/**
	 * Get relevant memories
	 */
	getRelevantMemories(request: ContextRequest): Promise<ContextItem[]>

	/**
	 * Compress context to fit token limit
	 */
	compressContext(items: ContextItem[], maxTokens: number): Promise<ContextItem[]>

	/**
	 * Estimate tokens for content
	 */
	estimateTokens(content: string): number
}

/**
 * Context Builder Implementation
 */
export class ContextBuilder implements IContextBuilder {
	private memoryManager: IMemoryManager
	private conversationMemory?: ConversationMemory
	private projectMemory?: ProjectMemory
	private patternMemory?: PatternMemory
	private compressor?: ContextCompressor
	private initialized: boolean = false

	constructor(
		memoryManager: IMemoryManager,
		options?: {
			conversationMemory?: ConversationMemory
			projectMemory?: ProjectMemory
			patternMemory?: PatternMemory
			compressor?: ContextCompressor
		},
	) {
		this.memoryManager = memoryManager
		this.conversationMemory = options?.conversationMemory
		this.projectMemory = options?.projectMemory
		this.patternMemory = options?.patternMemory
		this.compressor = options?.compressor
	}

	async initialize(): Promise<void> {
		if (this.initialized) return
		this.initialized = true
	}

	private ensureInitialized(): void {
		if (!this.initialized) {
			throw new Error("ContextBuilder not initialized. Call initialize() first.")
		}
	}

	async buildContext(request: ContextRequest): Promise<BuiltContext> {
		this.ensureInitialized()

		const startTime = Date.now()
		const maxTokens = request.maxTokens || 8000

			// Step 1: Gather current state
		const currentState = await this.gatherCurrentState(request)

		// Step 2: Get relevant code from index
		const relevantCode = await this.getRelevantCode(request.query, request.currentFile)

		// Step 3: Get relevant memories
		const memories = await this.getRelevantMemories(request)

		// Step 4: Get priority items
		const priorityItems = await this.getPriorityItems(request)

		// Step 5: Combine all context items
		const allItems = [...relevantCode.map(this.codeToContextItem), ...memories, ...priorityItems]

		// Step 6: Sort by priority and relevance
		const sortedItems = this.sortItems(allItems)

		// Step 7: Compress to fit token limit
		const compressedItems = await this.compressContext(sortedItems, maxTokens)

		// Step 8: Final filtering
		const finalItems = this.filterByTokens(compressedItems, maxTokens)

		// Calculate totals
		const totalTokens = finalItems.reduce((sum, item) => sum + item.tokens, 0)
		const tokenBreakdown = this.calculateTokenBreakdown(finalItems)
		const files = this.extractFiles(finalItems, request.currentFile)

		const buildTimeMs = Date.now() - startTime

		return {
			items: finalItems,
			totalTokens,
			tokenBreakdown,
			files,
			metadata: {
				buildTimeMs,
				itemsConsidered: allItems.length,
				itemsExcluded: allItems.length - finalItems.length,
				compressionApplied: allItems.length > finalItems.length,
				originalTokens: allItems.reduce((sum, item) => sum + item.tokens, 0),
			},
		}
	}

	private async gatherCurrentState(request: ContextRequest): Promise<CurrentState> {
		return {
			currentFile: request.currentFile || "",
			openFiles: request.openFiles || [],
			query: request.query,
			timestamp: Date.now(),
		}
	}

	async getRelevantCode(query: string, currentFile?: string): Promise<RelevantCode[]> {
		// For now, return mock data - this would integrate with the code index
		// In a real implementation, this would search the vector store
		return []
	}

	private codeToContextItem(code: RelevantCode): ContextItem {
		return {
			type: ContextType.CODE,
			content: code.content,
			tokens: this.estimateTokens(code.content),
			source: code.filePath,
			relevance: code.relevance,
			priority: 5,
			metadata: { matchType: code.matchType, symbols: code.symbols },
		}
	}

	async getRelevantMemories(request: ContextRequest): Promise<ContextItem[]> {
		this.ensureInitialized()

		const items: ContextItem[] = []

		// Get conversation memories
		if (this.conversationMemory && request.includeHistory !== false) {
			const conversations = await this.conversationMemory.searchConversations(request.query, 3)
			for (const conv of conversations) {
				const content = this.summarizeConversation(conv)
				items.push({
					type: ContextType.CONVERSATION,
					content,
					tokens: this.estimateTokens(content),
					source: conv.conversation.id,
					relevance: conv.relevanceScore,
					priority: 3,
					metadata: { timestamp: conv.conversation.updatedAt },
				})
			}
		}

		// Get pattern memories
		if (this.patternMemory && request.includePatterns !== false) {
			const patterns = await this.patternMemory.suggestSimilarPatterns(request.query, 3)
			for (const pattern of patterns) {
				items.push({
					type: ContextType.PATTERN,
					content: pattern.pattern.template,
					tokens: this.estimateTokens(pattern.pattern.template),
					source: pattern.pattern.id,
					relevance: pattern.similarity,
					priority: 4,
					metadata: { occurrences: pattern.pattern.occurrences },
				})
			}
		}

		// Get design decisions
		if (this.projectMemory && request.includeDecisions !== false) {
			const searchResult = await this.projectMemory.search(request.query)
			const decisions = searchResult.decisions || []
			for (const decision of decisions.slice(0, 2)) {
				const content = this.formatDecision(decision)
				items.push({
					type: ContextType.DECISION,
					content,
					tokens: this.estimateTokens(content),
					source: decision.id,
					relevance: 0.5,
					priority: 4,
					metadata: { status: decision.status },
				})
			}
		}

		return items
	}

	private async getPriorityItems(request: ContextRequest): Promise<ContextItem[]> {
		if (!request.priorityItems || request.priorityItems.length === 0) {
			return []
		}

		const items: ContextItem[] = []

		for (const priority of request.priorityItems) {
			switch (priority.type) {
				case PriorityType.FILE:
					// Would read file content here
					break
				case PriorityType.PATTERN:
					if (this.patternMemory) {
						const pattern = await this.patternMemory.getPatternByHash(priority.target)
						if (pattern) {
							items.push({
								type: ContextType.PATTERN,
								content: pattern.template,
								tokens: this.estimateTokens(pattern.template),
								source: pattern.id,
								relevance: 1,
								priority: priority.priority,
								metadata: { occurrences: pattern.occurrences },
							})
						}
					}
					break
				case PriorityType.DECISION:
					if (this.projectMemory) {
						const decision = await this.projectMemory.getDesignDecision(priority.target)
						if (decision) {
							items.push({
								type: ContextType.DECISION,
								content: this.formatDecision(decision),
								tokens: this.estimateTokens(this.formatDecision(decision)),
								source: decision.id,
								relevance: 1,
								priority: priority.priority,
								metadata: { status: decision.status },
							})
						}
					}
					break
			}
		}

		return items
	}

	private sortItems(items: ContextItem[]): ContextItem[] {
		return [...items].sort((a, b) => {
			// First sort by priority (higher first)
			if (b.priority !== a.priority) {
				return b.priority - a.priority
			}
			// Then by relevance (higher first)
			return b.relevance - a.relevance
		})
	}

	async compressContext(items: ContextItem[], maxTokens: number): Promise<ContextItem[]> {
		if (!this.compressor) {
			return items
		}

		const compressed: ContextItem[] = []

		for (const item of items) {
			const currentTokens = compressed.reduce((sum, i) => sum + i.tokens, 0)
			const remainingTokens = maxTokens - currentTokens

			if (remainingTokens <= 0) {
				break
			}

			if (item.tokens > remainingTokens) {
				// Compress the item
				const compressedContent = await this.compressor.compressFile(
					item.content,
					remainingTokens,
					item.source,
				)
				const compressedItem: ContextItem = {
					...item,
					content: compressedContent,
					tokens: this.estimateTokens(compressedContent),
					metadata: {
						...item.metadata,
						compressed: true,
					},
				}
				compressed.push(compressedItem)
			} else {
				compressed.push(item)
			}
		}

		return compressed
	}

	private filterByTokens(items: ContextItem[], maxTokens: number): ContextItem[] {
		const filtered: ContextItem[] = []
		let currentTokens = 0

		for (const item of items) {
			if (currentTokens + item.tokens <= maxTokens) {
				filtered.push(item)
				currentTokens += item.tokens
			} else {
				break
			}
		}

		return filtered
	}

	private calculateTokenBreakdown(items: ContextItem[]): Record<ContextType, number> {
		const breakdown: Record<ContextType, number> = {
			[ContextType.CODE]: 0,
			[ContextType.CONVERSATION]: 0,
			[ContextType.PATTERN]: 0,
			[ContextType.DECISION]: 0,
			[ContextType.ARCHITECTURE]: 0,
			[ContextType.BEHAVIOR]: 0,
			[ContextType.SYMBOL]: 0,
		}

		for (const item of items) {
			breakdown[item.type] = (breakdown[item.type] || 0) + item.tokens
		}

		return breakdown
	}

	private extractFiles(items: ContextItem[], currentFile?: string): string[] {
		const files = new Set<string>()
		
		// Add current file if provided
		if (currentFile) {
			files.add(currentFile)
		}
		
		for (const item of items) {
			if (item.type === ContextType.CODE && item.source) {
				files.add(item.source)
			}
		}
		return Array.from(files)
	}

	estimateTokens(content: string): number {
		// Simple synchronous token estimation
		// Average token is ~4 characters for English text
		// For code, it's typically 3-4 characters per token
		if (!content || content.length === 0) {
			return 0
		}
		return Math.ceil(content.length / 4)
	}

	private summarizeConversation(conv: { conversation: { id: string; summary?: string } }): string {
		return conv.conversation.summary || `Conversation: ${conv.conversation.id}`
	}

	private formatDecision(decision: { title: string; rationale: string; status: string }): string {
		return `**${decision.title}**\n\nRationale: ${decision.rationale}\nStatus: ${decision.status}`
	}
}

/**
 * Current state for context building
 */
interface CurrentState {
	currentFile: string
	openFiles: string[]
	query: string
	timestamp: number
}

/**
 * Factory function to create ContextBuilder
 */
export async function createContextBuilder(
	memoryManager: IMemoryManager,
	options?: {
		conversationMemory?: ConversationMemory
		projectMemory?: ProjectMemory
		patternMemory?: PatternMemory
		compressor?: ContextCompressor
	},
): Promise<ContextBuilder> {
	const builder = new ContextBuilder(memoryManager, options)
	await builder.initialize()
	return builder
}
