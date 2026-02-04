/**
 * Relevance Ranker - Ranks context items by relevance
 *
 * Uses multiple signals including semantic similarity, proximity,
 * recency, dependencies, history, and user preferences.
 */

import { ContextType } from "./context-builder"

/**
 * Individual context item to rank
 */
export interface ContextItem {
	type: ContextType
	content: string
	source: string
	relevance?: number
	priority?: number
	tokens?: number
	metadata?: Record<string, unknown>
}

/**
 * User context for ranking
 */
export interface UserContext {
	currentFile?: string
	openFiles?: string[]
	userId?: string
	behavioralContext?: {
		focusArea?: string
		recentFiles?: string[]
		inferredTask?: string
	}
}

/**
 * Ranked context result
 */
export interface RankedContext {
	item: ContextItem
	totalScore: number
	breakdown: ScoreBreakdown
	rank: number
}

/**
 * Score breakdown by category
 */
export interface ScoreBreakdown {
	semantic: number
	proximity: number
	recency: number
	dependency: number
	historical: number
	preference: number
}

/**
 * Ranking weights configuration
 */
export interface RankingWeights {
	semantic: number
	proximity: number
	recency: number
	dependency: number
	historical: number
	preference: number
}

/**
 * Default ranking weights
 */
export const DEFAULT_WEIGHTS: RankingWeights = {
	semantic: 0.3,
	proximity: 0.2,
	recency: 0.15,
	dependency: 0.15,
	historical: 0.1,
	preference: 0.1,
}

/**
 * Relevance Ranker Interface
 */
export interface IRelevanceRanker {
	/**
	 * Rank context items by relevance
	 */
	rankContextItems(items: ContextItem[], query: string, userContext: UserContext): Promise<RankedContext[]>

	/**
	 * Calculate individual item score
	 */
	calculateScores(
		item: ContextItem,
		query: string,
		userContext: UserContext,
	): Promise<ScoreBreakdown>

	/**
	 * Set custom weights
	 */
	setWeights(weights: Partial<RankingWeights>): void

	/**
	 * Get current weights
	 */
	getWeights(): RankingWeights
}

/**
 * Relevance Ranker Implementation
 */
export class RelevanceRanker implements IRelevanceRanker {
	private weights: RankingWeights
	private historicalScores: Map<string, number>
	private userPreferences: Map<string, number>

	constructor(weights?: Partial<RankingWeights>) {
		this.weights = { ...DEFAULT_WEIGHTS, ...weights }
		this.historicalScores = new Map()
		this.userPreferences = new Map()
	}

	async rankContextItems(
		items: ContextItem[],
		query: string,
		userContext: UserContext,
	): Promise<RankedContext[]> {
		const scoredItems: RankedContext[] = []

		for (const item of items) {
			const scores = await this.calculateScores(item, query, userContext)
			const totalScore = this.combineScores(scores)

			scoredItems.push({
				item,
				totalScore,
				breakdown: scores,
				rank: 0, // Will be set after sorting
			})
		}

		// Sort by total score descending
		scoredItems.sort((a, b) => b.totalScore - a.totalScore)

		// Assign ranks
		for (let i = 0; i < scoredItems.length; i++) {
			scoredItems[i].rank = i + 1
		}

		return scoredItems
	}

	async calculateScores(
		item: ContextItem,
		query: string,
		userContext: UserContext,
	): Promise<ScoreBreakdown> {
		const [semantic, proximity, recency, dependency, historical, preference] = await Promise.all([
			this.calculateSemanticScore(item, query),
			this.calculateProximityScore(item, userContext),
			this.calculateRecencyScore(item),
			this.calculateDependencyScore(item, userContext),
			this.calculateHistoricalScore(item, query),
			this.calculatePreferenceScore(item, userContext),
		])

		return {
			semantic,
			proximity,
			recency,
			dependency,
			historical,
			preference,
		}
	}

	private async calculateSemanticScore(item: ContextItem, query: string): Promise<number> {
		// Simple keyword-based scoring for now
		// In production, this would use embeddings
		const queryWords = query.toLowerCase().split(/\s+/)
		const contentWords = item.content.toLowerCase().split(/\s+/)

		let matches = 0
		for (const queryWord of queryWords) {
			if (queryWord.length < 3) continue // Skip short words
			for (const contentWord of contentWords) {
				if (contentWord.includes(queryWord) || queryWord.includes(contentWord)) {
					matches++
					break
				}
			}
		}

		// Normalize by query length
		const normalizedScore = queryWords.filter((w) => w.length >= 3).length > 0
			? matches / queryWords.filter((w) => w.length >= 3).length
			: 0

		return Math.min(normalizedScore, 1)
	}

	private calculateProximityScore(item: ContextItem, userContext: UserContext): number {
		const focusFile = userContext.behavioralContext?.focusArea
		const currentFile = userContext.currentFile
		const openFiles = userContext.openFiles || []

		if (!focusFile && !currentFile && openFiles.length === 0) {
			return 0.5 // Default score when no context
		}

		// Check if item source matches current file
		if (currentFile && item.source === currentFile) {
			return 1.0
		}

		// Check if item source is in open files
		if (openFiles.includes(item.source)) {
			return 0.8
		}

		// Check if item source matches focus area
		if (focusFile && item.source.includes(focusFile)) {
			return 0.7
		}

		// Check for partial matches
		const itemDir = item.source.split("/").slice(0, -1).join("/")
		const currentDir = currentFile?.split("/").slice(0, -1).join("/")

		if (currentDir && itemDir === currentDir) {
			return 0.5
		}

		return 0.2
	}

	private calculateRecencyScore(item: ContextItem): number {
		// Check for timestamp in metadata
		const metadata = item.metadata as { timestamp?: number } | undefined

		if (!metadata?.timestamp) {
			return 0.5 // Default for items without timestamp
		}

		const now = Date.now()
		const ageMs = now - metadata.timestamp

		// Within 5 minutes = 1.0
		// Within 1 hour = 0.8
		// Within 1 day = 0.5
		// Within 1 week = 0.3
		// Older = 0.1

		if (ageMs < 5 * 60 * 1000) {
			return 1.0
		} else if (ageMs < 60 * 60 * 1000) {
			return 0.8
		} else if (ageMs < 24 * 60 * 60 * 1000) {
			return 0.5
		} else if (ageMs < 7 * 24 * 60 * 60 * 1000) {
			return 0.3
		} else {
			return 0.1
		}
	}

	private async calculateDependencyScore(item: ContextItem, userContext: UserContext): Promise<number> {
		// Simple dependency scoring based on type
		// In production, this would query the dependency graph

		const typeScores: Record<ContextType, number> = {
			[ContextType.CODE]: 0.8,
			[ContextType.CONVERSATION]: 0.5,
			[ContextType.PATTERN]: 0.6,
			[ContextType.DECISION]: 0.7,
			[ContextType.ARCHITECTURE]: 0.9,
			[ContextType.BEHAVIOR]: 0.4,
			[ContextType.SYMBOL]: 0.85,
		}

		return typeScores[item.type] || 0.5
	}

	private async calculateHistoricalScore(item: ContextItem, query: string): Promise<number> {
		// Check historical score cache
		const key = `${item.source}:${item.type}`
		const cachedScore = this.historicalScores.get(key)

		if (cachedScore !== undefined) {
			return cachedScore
		}

		// Simple query-based historical scoring
		const queryWords = query.toLowerCase().split(/\s+/)
		const contentWords = item.content.toLowerCase().split(/\s+/)

		let matches = 0
		for (const queryWord of queryWords) {
			if (queryWord.length < 3) continue
			for (const contentWord of contentWords) {
				if (contentWord.includes(queryWord) || queryWord.includes(contentWord)) {
					matches++
					break
				}
			}
		}

		// Cache the score
		const score = matches > 0 ? 0.7 : 0.3
		this.historicalScores.set(key, score)

		return score
	}

	private async calculatePreferenceScore(item: ContextItem, userContext: UserContext): Promise<number> {
		// Check user preferences
		const key = `${item.type}:${item.source}`
		const preferenceScore = this.userPreferences.get(key)

		if (preferenceScore !== undefined) {
			return preferenceScore
		}

		// Boost scores for current file type
		if (userContext.currentFile) {
			const currentExt = userContext.currentFile.split(".").pop()
			const itemExt = item.source.split(".").pop()

			if (currentExt === itemExt) {
				return 0.8
			}
		}

		// Boost for inferred task type
		const inferredTask = userContext.behavioralContext?.inferredTask
		if (inferredTask) {
			const taskTypeMap: Record<string, ContextType[]> = {
				coding: [ContextType.CODE, ContextType.PATTERN],
				debugging: [ContextType.CODE, ContextType.CONVERSATION],
				reviewing: [ContextType.CODE, ContextType.DECISION],
				reading: [ContextType.CODE],
			}

			const relevantTypes = taskTypeMap[inferredTask] || []
			if (relevantTypes.includes(item.type)) {
				return 0.7
			}
		}

		return 0.5
	}

	private combineScores(scores: ScoreBreakdown): number {
		return (
			scores.semantic * this.weights.semantic +
			scores.proximity * this.weights.proximity +
			scores.recency * this.weights.recency +
			scores.dependency * this.weights.dependency +
			scores.historical * this.weights.historical +
			scores.preference * this.weights.preference
		)
	}

	setWeights(weights: Partial<RankingWeights>): void {
		this.weights = { ...this.weights, ...weights }
	}

	getWeights(): RankingWeights {
		return { ...this.weights }
	}

	/**
	 * Update historical score for an item
	 */
	updateHistoricalScore(source: string, type: ContextType, score: number): void {
		const key = `${source}:${type}`
		this.historicalScores.set(key, score)
	}

	/**
	 * Update user preference for an item
	 */
	updateUserPreference(source: string, type: ContextType, score: number): void {
		const key = `${type}:${source}`
		this.userPreferences.set(key, score)
	}
}

/**
 * Factory function to create RelevanceRanker
 */
export function createRelevanceRanker(weights?: Partial<RankingWeights>): RelevanceRanker {
	return new RelevanceRanker(weights)
}
