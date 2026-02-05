import fs from "fs/promises"
import path from "path"
import crypto from "crypto"

import {
	CheckpointMetadata,
	CheckpointCategory,
	CheckpointStats,
	ConversationContext,
	CheckpointSaveOptions,
	CheckpointFilter,
	CheckpointSearchQuery,
} from "./types"

/**
 * Service for managing checkpoint metadata
 * Stores metadata in a JSON file alongside the shadow git repository
 */
export class CheckpointMetadataService {
	private readonly metadataFilePath: string
	private metadata: Map<string, CheckpointMetadata> = new Map()
	private initialized = false

	constructor(checkpointsDir: string) {
		this.metadataFilePath = path.join(checkpointsDir, "checkpoint-metadata.json")
	}

	/**
	 * Initialize the metadata service by loading existing metadata
	 */
	async initialize(): Promise<void> {
		if (this.initialized) {
			return
		}

		try {
			const data = await fs.readFile(this.metadataFilePath, "utf-8")
			const parsed = JSON.parse(data) as CheckpointMetadata[]

			// Convert dates from strings
			for (const item of parsed) {
				item.timestamp = new Date(item.timestamp)
				this.metadata.set(item.id, item)
			}
		} catch (error) {
			// File doesn't exist yet, start with empty metadata
			this.metadata = new Map()
		}

		this.initialized = true
	}

	/**
	 * Save metadata to file
	 */
	private async persistMetadata(): Promise<void> {
		const data = Array.from(this.metadata.values())
		await fs.writeFile(this.metadataFilePath, JSON.stringify(data, null, 2), "utf-8")
	}

	/**
	 * Generate a unique ID for a checkpoint
	 */
	private generateId(): string {
		return crypto.randomUUID()
	}

	/**
	 * Create metadata for a new checkpoint
	 */
	async createMetadata(
		commitHash: string,
		taskId: string,
		stats: CheckpointStats,
		options?: CheckpointSaveOptions,
	): Promise<CheckpointMetadata> {
		const id = this.generateId()

		const metadata: CheckpointMetadata = {
			id,
			commitHash,
			taskId,
			timestamp: new Date(),
			name: options?.name,
			description: options?.description,
			tags: options?.tags ?? [],
			category: options?.category ?? CheckpointCategory.AUTO,
			stats,
			children: [],
			isStarred: false,
			isLocked: false,
			conversationContext: options?.conversationContext,
		}

		this.metadata.set(id, metadata)
		await this.persistMetadata()

		return metadata
	}

	/**
	 * Get metadata by ID
	 */
	getMetadataById(id: string): CheckpointMetadata | undefined {
		return this.metadata.get(id)
	}

	/**
	 * Get metadata by commit hash
	 */
	getMetadataByCommitHash(commitHash: string): CheckpointMetadata | undefined {
		for (const metadata of this.metadata.values()) {
			if (metadata.commitHash === commitHash) {
				return metadata
			}
		}
		return undefined
	}

	/**
	 * Get all metadata for a task
	 */
	getMetadataByTaskId(taskId: string): CheckpointMetadata[] {
		return Array.from(this.metadata.values()).filter((m) => m.taskId === taskId)
	}

	/**
	 * Get all metadata
	 */
	getAllMetadata(): CheckpointMetadata[] {
		return Array.from(this.metadata.values())
	}

	/**
	 * Update existing metadata
	 */
	async updateMetadata(id: string, updates: Partial<CheckpointMetadata>): Promise<CheckpointMetadata | undefined> {
		const existing = this.metadata.get(id)

		if (!existing) {
			return undefined
		}

		const updated: CheckpointMetadata = {
			...existing,
			...updates,
			// Never update these fields via updates
			id: existing.id,
			commitHash: existing.commitHash,
			timestamp: existing.timestamp,
		}

		this.metadata.set(id, updated)
		await this.persistMetadata()

		return updated
	}

	/**
	 * Rename a checkpoint
	 */
	async renameCheckpoint(id: string, name: string): Promise<CheckpointMetadata | undefined> {
		return this.updateMetadata(id, { name })
	}

	/**
	 * Star/unstar a checkpoint
	 */
	async toggleStar(id: string): Promise<CheckpointMetadata | undefined> {
		const existing = this.metadata.get(id)
		if (!existing) {
			return undefined
		}
		return this.updateMetadata(id, { isStarred: !existing.isStarred })
	}

	/**
	 * Lock/unlock a checkpoint
	 */
	async toggleLock(id: string): Promise<CheckpointMetadata | undefined> {
		const existing = this.metadata.get(id)
		if (!existing) {
			return undefined
		}
		return this.updateMetadata(id, { isLocked: !existing.isLocked })
	}

	/**
	 * Add tags to a checkpoint
	 */
	async addTags(id: string, newTags: string[]): Promise<CheckpointMetadata | undefined> {
		const existing = this.metadata.get(id)
		if (!existing) {
			return undefined
		}
		const tags = [...new Set([...existing.tags, ...newTags])]
		return this.updateMetadata(id, { tags })
	}

	/**
	 * Remove tags from a checkpoint
	 */
	async removeTags(id: string, tagsToRemove: string[]): Promise<CheckpointMetadata | undefined> {
		const existing = this.metadata.get(id)
		if (!existing) {
			return undefined
		}
		const tags = existing.tags.filter((t) => !tagsToRemove.includes(t))
		return this.updateMetadata(id, { tags })
	}

	/**
	 * Delete metadata
	 */
	async deleteMetadata(id: string): Promise<boolean> {
		const existing = this.metadata.get(id)

		// Cannot delete locked checkpoints
		if (existing?.isLocked) {
			return false
		}

		const deleted = this.metadata.delete(id)

		if (deleted) {
			await this.persistMetadata()
		}

		return deleted
	}

	/**
	 * Filter checkpoints based on criteria
	 */
	filterCheckpoints(filter: CheckpointFilter): CheckpointMetadata[] {
		let results = Array.from(this.metadata.values())

		if (filter.categories && filter.categories.length > 0) {
			results = results.filter((m) => filter.categories!.includes(m.category))
		}

		if (filter.tags && filter.tags.length > 0) {
			results = results.filter((m) => filter.tags!.some((t) => m.tags.includes(t)))
		}

		if (filter.dateRange) {
			results = results.filter(
				(m) => m.timestamp >= filter.dateRange!.start && m.timestamp <= filter.dateRange!.end,
			)
		}

		if (filter.onlyStarred) {
			results = results.filter((m) => m.isStarred)
		}

		if (filter.onlyLocked) {
			results = results.filter((m) => m.isLocked)
		}

		return results
	}

	/**
	 * Search checkpoints based on query
	 */
	searchCheckpoints(query: CheckpointSearchQuery): CheckpointMetadata[] {
		let results = Array.from(this.metadata.values())

		if (query.text) {
			const searchText = query.text.toLowerCase()
			results = results.filter(
				(m) =>
					m.name?.toLowerCase().includes(searchText) ||
					m.description?.toLowerCase().includes(searchText) ||
					m.tags.some((t) => t.toLowerCase().includes(searchText)),
			)
		}

		if (query.category) {
			results = results.filter((m) => m.category === query.category)
		}

		if (query.tags && query.tags.length > 0) {
			results = results.filter((m) => query.tags!.some((t) => m.tags.includes(t)))
		}

		if (query.timeRange) {
			results = results.filter(
				(m) => m.timestamp >= query.timeRange!.start && m.timestamp <= query.timeRange!.end,
			)
		}

		if (query.conversationQuery) {
			const searchText = query.conversationQuery.toLowerCase()
			results = results.filter(
				(m) =>
					m.conversationContext?.userMessage.toLowerCase().includes(searchText) ||
					m.conversationContext?.aiResponse.toLowerCase().includes(searchText) ||
					m.conversationContext?.intent.toLowerCase().includes(searchText),
			)
		}

		// Sort by timestamp descending (most recent first)
		return results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
	}

	/**
	 * Get checkpoints organized as a timeline
	 */
	getTimeline(taskId?: string): CheckpointMetadata[] {
		let results = Array.from(this.metadata.values())

		if (taskId) {
			results = results.filter((m) => m.taskId === taskId)
		}

		// Sort by timestamp ascending for timeline
		return results.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
	}

	/**
	 * Get statistics about checkpoints
	 */
	getStatistics(taskId?: string): {
		total: number
		byCategory: Record<CheckpointCategory, number>
		starred: number
		locked: number
	} {
		let checkpoints = Array.from(this.metadata.values())

		if (taskId) {
			checkpoints = checkpoints.filter((m) => m.taskId === taskId)
		}

		const byCategory: Record<CheckpointCategory, number> = {
			[CheckpointCategory.AUTO]: 0,
			[CheckpointCategory.MANUAL]: 0,
			[CheckpointCategory.MILESTONE]: 0,
			[CheckpointCategory.EXPERIMENT]: 0,
			[CheckpointCategory.BACKUP]: 0,
			[CheckpointCategory.RECOVERY]: 0,
		}

		for (const cp of checkpoints) {
			byCategory[cp.category]++
		}

		return {
			total: checkpoints.length,
			byCategory,
			starred: checkpoints.filter((c) => c.isStarred).length,
			locked: checkpoints.filter((c) => c.isLocked).length,
		}
	}

	/**
	 * Set parent-child relationship between checkpoints
	 */
	async setParent(childId: string, parentId: string): Promise<boolean> {
		const child = this.metadata.get(childId)
		const parent = this.metadata.get(parentId)

		if (!child || !parent) {
			return false
		}

		// Update child's parent
		child.parentId = parentId

		// Add child to parent's children
		if (!parent.children.includes(childId)) {
			parent.children.push(childId)
		}

		await this.persistMetadata()
		return true
	}

	/**
	 * Get the branch/tree structure starting from a checkpoint
	 */
	getCheckpointTree(rootId?: string): CheckpointMetadata[] {
		if (!rootId) {
			// Get all root checkpoints (no parent)
			return Array.from(this.metadata.values()).filter((m) => !m.parentId)
		}

		const root = this.metadata.get(rootId)
		if (!root) {
			return []
		}

		const result: CheckpointMetadata[] = [root]
		const queue = [...root.children]

		while (queue.length > 0) {
			const childId = queue.shift()!
			const child = this.metadata.get(childId)
			if (child) {
				result.push(child)
				queue.push(...child.children)
			}
		}

		return result
	}
}
