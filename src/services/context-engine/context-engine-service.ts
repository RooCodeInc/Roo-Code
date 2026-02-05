/**
 * Context Engine Service
 * 
 * Main integration point that combines all context engine components
 * with the existing Roo Code infrastructure.
 */

import * as vscode from "vscode"
import { MemoryManager } from "../memory"
import { ConversationMemory } from "../memory/conversation-memory"
import { ProjectMemoryImpl } from "../memory/project-memory"
import { PatternMemoryImpl } from "../memory/pattern-memory"
import { ContextBuilder, type BuiltContext, type ContextRequest } from "./context-builder"
import { IntentDetector, type Intent, type UserContext } from "./intent-detector"
import { BehavioralAnalyzer, type BehavioralContext, type CursorPosition } from "./behavioral-analyzer"
import { RelevanceRanker } from "./relevance-ranker"
import { ContextCompressorV2 } from "./context-compressor-v2"

/**
 * Configuration for the Context Engine Service
 */
export interface ContextEngineConfig {
	storagePath: string
	maxTokens?: number
	enableBehavioralTracking?: boolean
	enablePatternLearning?: boolean
}

/**
 * Context Engine Service Result
 */
export interface ContextResult {
	context: BuiltContext
	intent: Intent
	behavioralContext?: BehavioralContext
	processingTimeMs: number
}

/**
 * Context Engine Service
 * 
 * Provides a unified interface for building intelligent context
 * by combining memory, intent detection, and behavioral analysis.
 */
export class ContextEngineService {
	private static instance: ContextEngineService | null = null

	private memoryManager: MemoryManager
	private conversationMemory?: ConversationMemory
	private projectMemory?: ProjectMemoryImpl
	private patternMemory?: PatternMemoryImpl
	private contextBuilder?: ContextBuilder
	private intentDetector: IntentDetector
	private behavioralAnalyzer: BehavioralAnalyzer
	private relevanceRanker: RelevanceRanker
	private compressor: ContextCompressorV2

	private config: ContextEngineConfig
	private initialized: boolean = false

	private constructor(config: ContextEngineConfig) {
		this.config = config
		this.memoryManager = new MemoryManager(config.storagePath)
		this.intentDetector = new IntentDetector()
		this.behavioralAnalyzer = new BehavioralAnalyzer()
		this.relevanceRanker = new RelevanceRanker()
		this.compressor = new ContextCompressorV2()
	}

	/**
	 * Get or create the singleton instance
	 */
	static getInstance(config?: ContextEngineConfig): ContextEngineService | null {
		if (!ContextEngineService.instance && config) {
			ContextEngineService.instance = new ContextEngineService(config)
		}
		return ContextEngineService.instance
	}

	/**
	 * Dispose the singleton instance
	 */
	static async dispose(): Promise<void> {
		if (ContextEngineService.instance) {
			await ContextEngineService.instance.shutdown()
			ContextEngineService.instance = null
		}
	}

	/**
	 * Initialize all services
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return

		// Initialize memory manager
		await this.memoryManager.initialize()

		// Initialize memory services
		const storage = this.memoryManager.getStorage()

		this.conversationMemory = new ConversationMemory(storage)
		await this.conversationMemory.initialize()

		this.projectMemory = new ProjectMemoryImpl(storage)
		await this.projectMemory.initialize()

		this.patternMemory = new PatternMemoryImpl(storage)
		await this.patternMemory.initialize()

		// Initialize context builder with memory services
		this.contextBuilder = new ContextBuilder(this.memoryManager, {
			conversationMemory: this.conversationMemory,
			projectMemory: this.projectMemory as any,
			patternMemory: this.patternMemory as any,
		})
		await this.contextBuilder.initialize()

		// Initialize intent detector
		await this.intentDetector.initialize()

		this.initialized = true
		console.log("[ContextEngineService] Initialized successfully")
	}

	/**
	 * Shutdown all services
	 */
	async shutdown(): Promise<void> {
		if (!this.initialized) return

		await this.memoryManager.shutdown()
		this.initialized = false
		console.log("[ContextEngineService] Shutdown complete")
	}

	/**
	 * Build context for a query with full intelligence
	 */
	async buildContext(
		query: string,
		userContext: UserContext,
		options?: Partial<ContextRequest>,
	): Promise<ContextResult> {
		this.ensureInitialized()

		const startTime = Date.now()

		// Detect intent
		const intent = await this.intentDetector.analyzeIntent(query, userContext)

		// Get behavioral context if enabled
		let behavioralContext: BehavioralContext | undefined
		if (this.config.enableBehavioralTracking) {
			behavioralContext = await this.behavioralAnalyzer.getCurrentContext()
		}

		// Build context request
		const request: ContextRequest = {
			query,
			currentFile: userContext.currentFile,
			openFiles: userContext.openFiles,
			maxTokens: this.config.maxTokens || 8000,
			includeHistory: true,
			includePatterns: this.config.enablePatternLearning,
			includeDecisions: true,
			...options,
		}

		// Build context
		const context = await this.contextBuilder!.buildContext(request)

		// Compress if needed
		let finalContext = context
		if (context.totalTokens > (this.config.maxTokens || 8000)) {
			const compressed = await this.compressor.compress(
				context,
				this.config.maxTokens || 8000,
			)
			finalContext = compressed.context
		}

		const processingTimeMs = Date.now() - startTime

		return {
			context: finalContext,
			intent,
			behavioralContext,
			processingTimeMs,
		}
	}

	/**
	 * Track cursor position for behavioral analysis
	 */
	trackCursor(position: CursorPosition, file: string): void {
		if (this.config.enableBehavioralTracking) {
			this.behavioralAnalyzer.trackCursorPosition(position, file)
		}
	}

	/**
	 * Track file access
	 */
	trackFileAccess(filePath: string, action: "open" | "close" | "switch"): void {
		if (this.config.enableBehavioralTracking) {
			this.behavioralAnalyzer.trackFileAccess(filePath, action)
		}
	}

	/**
	 * Learn a code pattern
	 */
	async learnPattern(
		code: string,
		context: { language: string; fileType: string; tags: string[] },
	): Promise<string | null> {
		if (!this.config.enablePatternLearning || !this.patternMemory) {
			return null
		}

		return this.patternMemory.learnPattern(code, context)
	}

	/**
	 * Get similar patterns for code
	 */
	async getSimilarPatterns(code: string, limit?: number) {
		if (!this.patternMemory) return []
		return this.patternMemory.suggestSimilarPatterns(code, limit)
	}

	/**
	 * Save a conversation
	 */
	async saveConversation(conversation: {
		title: string
		summary?: string
		filesModified: string[]
		messages: Array<{ role: "user" | "assistant"; content: string }>
	}): Promise<string | null> {
		if (!this.conversationMemory) return null

		return this.conversationMemory.saveConversation({
			id: "",
			title: conversation.title,
			summary: conversation.summary,
			filesModified: conversation.filesModified,
			messages: conversation.messages.map((m) => ({
				id: "",
				role: m.role,
				content: m.content,
				timestamp: Date.now(),
			})),
			createdAt: Date.now(),
			updatedAt: Date.now(),
		})
	}

	/**
	 * Search conversations
	 */
	async searchConversations(query: string, limit?: number) {
		if (!this.conversationMemory) return []
		return this.conversationMemory.searchConversations(query, limit)
	}

	/**
	 * Record a design decision
	 */
	async recordDecision(decision: {
		title: string
		description: string
		rationale: string
		alternatives?: string[]
		filesAffected?: string[]
		tags?: string[]
	}): Promise<string | null> {
		if (!this.projectMemory) return null

		return this.projectMemory.saveDesignDecision({
			id: "",
			title: decision.title,
			description: decision.description,
			rationale: decision.rationale,
			alternatives: decision.alternatives || [],
			filesAffected: decision.filesAffected || [],
			status: "accepted",
			tags: decision.tags || [],
			createdAt: Date.now(),
			updatedAt: Date.now(),
		})
	}

	/**
	 * Get decisions for a file
	 */
	async getDecisionsForFile(filePath: string) {
		if (!this.projectMemory) return []
		return this.projectMemory.getDecisionsForFile(filePath)
	}

	/**
	 * Get behavioral statistics
	 */
	getStatistics() {
		return this.behavioralAnalyzer.getStatistics()
	}

	private ensureInitialized(): void {
		if (!this.initialized) {
			throw new Error("ContextEngineService not initialized. Call initialize() first.")
		}
	}
}

/**
 * Factory function to create and initialize the Context Engine Service
 */
export async function createContextEngineService(
	context: vscode.ExtensionContext,
	options?: Partial<ContextEngineConfig>,
): Promise<ContextEngineService> {
	const config: ContextEngineConfig = {
		storagePath: context.globalStorageUri.fsPath,
		maxTokens: 8000,
		enableBehavioralTracking: true,
		enablePatternLearning: true,
		...options,
	}

	const service = ContextEngineService.getInstance(config)!
	await service.initialize()

	return service
}
