import { CheckpointMetadata, CheckpointCategory, CheckpointFilter } from "./types"
import { CheckpointMetadataService } from "./checkpoint-metadata"

/**
 * View mode for the timeline display
 */
export type TimelineViewMode = "tree" | "list" | "calendar"

/**
 * Timeline node with visual position information
 */
export interface TimelineNode {
	metadata: CheckpointMetadata
	level: number // Indent level for tree view
	isLeaf: boolean // No children
	isBranchStart: boolean // Start of a new branch
	connectorType: "none" | "vertical" | "branch" | "merge"
}

/**
 * Grouped checkpoints by date for calendar view
 */
export interface CalendarDay {
	date: string // YYYY-MM-DD
	checkpoints: CheckpointMetadata[]
}

/**
 * Service for managing checkpoint timeline display
 */
export class CheckpointTimelineService {
	private metadataService: CheckpointMetadataService

	constructor(metadataService: CheckpointMetadataService) {
		this.metadataService = metadataService
	}

	/**
	 * Get timeline as a flat list sorted by timestamp
	 */
	getListView(taskId?: string, filter?: CheckpointFilter): CheckpointMetadata[] {
		let checkpoints = this.metadataService.getTimeline(taskId)

		if (filter) {
			checkpoints = this.applyFilter(checkpoints, filter)
		}

		return checkpoints
	}

	/**
	 * Get timeline as a tree structure with visual information
	 */
	getTreeView(taskId?: string, filter?: CheckpointFilter): TimelineNode[] {
		let checkpoints = this.metadataService.getTimeline(taskId)

		if (filter) {
			checkpoints = this.applyFilter(checkpoints, filter)
		}

		const nodes: TimelineNode[] = []
		const processed = new Set<string>()

		// Build tree from roots
		const roots = checkpoints.filter((c) => !c.parentId)

		for (const root of roots) {
			this.buildTreeNodes(root, checkpoints, nodes, processed, 0)
		}

		// Add any orphaned nodes (parent was deleted or not in filter)
		for (const checkpoint of checkpoints) {
			if (!processed.has(checkpoint.id)) {
				nodes.push({
					metadata: checkpoint,
					level: 0,
					isLeaf: checkpoint.children.length === 0,
					isBranchStart: false,
					connectorType: "none",
				})
			}
		}

		return nodes
	}

	/**
	 * Recursively build tree nodes
	 */
	private buildTreeNodes(
		checkpoint: CheckpointMetadata,
		allCheckpoints: CheckpointMetadata[],
		nodes: TimelineNode[],
		processed: Set<string>,
		level: number,
	): void {
		if (processed.has(checkpoint.id)) {
			return
		}
		processed.add(checkpoint.id)

		const children = allCheckpoints.filter((c) => c.parentId === checkpoint.id)
		const isBranchStart = level > 0 && children.length > 0

		let connectorType: TimelineNode["connectorType"] = "none"
		if (level > 0) {
			connectorType = isBranchStart ? "branch" : "vertical"
		}

		nodes.push({
			metadata: checkpoint,
			level,
			isLeaf: children.length === 0,
			isBranchStart,
			connectorType,
		})

		// Process children
		for (const child of children) {
			this.buildTreeNodes(child, allCheckpoints, nodes, processed, level + 1)
		}
	}

	/**
	 * Get timeline grouped by calendar day
	 */
	getCalendarView(taskId?: string, filter?: CheckpointFilter): CalendarDay[] {
		let checkpoints = this.metadataService.getTimeline(taskId)

		if (filter) {
			checkpoints = this.applyFilter(checkpoints, filter)
		}

		const grouped = new Map<string, CheckpointMetadata[]>()

		for (const checkpoint of checkpoints) {
			const dateStr = checkpoint.timestamp.toISOString().split("T")[0]
			if (!grouped.has(dateStr)) {
				grouped.set(dateStr, [])
			}
			grouped.get(dateStr)!.push(checkpoint)
		}

		const result: CalendarDay[] = []
		for (const [date, dayCheckpoints] of grouped) {
			result.push({
				date,
				checkpoints: dayCheckpoints.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
			})
		}

		return result.sort((a, b) => a.date.localeCompare(b.date))
	}

	/**
	 * Apply filter to checkpoints
	 */
	private applyFilter(checkpoints: CheckpointMetadata[], filter: CheckpointFilter): CheckpointMetadata[] {
		return this.metadataService.filterCheckpoints(filter).filter((c) => checkpoints.some((cp) => cp.id === c.id))
	}

	/**
	 * Get summary statistics for the timeline
	 */
	getTimelineStats(taskId?: string): {
		totalCheckpoints: number
		byCategory: Record<CheckpointCategory, number>
		dateRange: { first: Date; last: Date } | null
		averagePerDay: number
	} {
		const stats = this.metadataService.getStatistics(taskId)
		const timeline = this.metadataService.getTimeline(taskId)

		let dateRange = null
		let averagePerDay = 0

		if (timeline.length > 0) {
			const first = timeline[0].timestamp
			const last = timeline[timeline.length - 1].timestamp
			dateRange = { first, last }

			const daysDiff = Math.max(1, Math.ceil((last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24)))
			averagePerDay = timeline.length / daysDiff
		}

		return {
			totalCheckpoints: stats.total,
			byCategory: stats.byCategory,
			dateRange,
			averagePerDay,
		}
	}

	/**
	 * Get checkpoints around a specific timestamp
	 */
	getCheckpointsAroundTime(
		timestamp: Date,
		count: number = 5,
	): {
		before: CheckpointMetadata[]
		after: CheckpointMetadata[]
	} {
		const all = this.metadataService.getAllMetadata().sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

		const targetTime = timestamp.getTime()
		let splitIndex = all.findIndex((c) => c.timestamp.getTime() > targetTime)

		if (splitIndex === -1) {
			splitIndex = all.length
		}

		return {
			before: all.slice(Math.max(0, splitIndex - count), splitIndex),
			after: all.slice(splitIndex, splitIndex + count),
		}
	}

	/**
	 * Get the path from a checkpoint to the root
	 */
	getPathToRoot(checkpointId: string): CheckpointMetadata[] {
		const path: CheckpointMetadata[] = []
		let current = this.metadataService.getMetadataById(checkpointId)

		while (current) {
			path.unshift(current)
			if (current.parentId) {
				current = this.metadataService.getMetadataById(current.parentId)
			} else {
				break
			}
		}

		return path
	}

	/**
	 * Find common ancestor of two checkpoints
	 */
	findCommonAncestor(checkpointId1: string, checkpointId2: string): CheckpointMetadata | null {
		const path1 = this.getPathToRoot(checkpointId1)
		const path2 = this.getPathToRoot(checkpointId2)

		const path1Ids = new Set(path1.map((c) => c.id))

		for (const checkpoint of path2) {
			if (path1Ids.has(checkpoint.id)) {
				return checkpoint
			}
		}

		return null
	}

	/**
	 * Get recent checkpoints for quick access
	 */
	getRecentCheckpoints(count: number = 10, taskId?: string): CheckpointMetadata[] {
		let checkpoints = this.metadataService.getAllMetadata()

		if (taskId) {
			checkpoints = checkpoints.filter((c) => c.taskId === taskId)
		}

		return checkpoints.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, count)
	}

	/**
	 * Get starred checkpoints for quick access
	 */
	getStarredCheckpoints(taskId?: string): CheckpointMetadata[] {
		return this.metadataService
			.filterCheckpoints({
				onlyStarred: true,
			})
			.filter((c) => !taskId || c.taskId === taskId)
	}

	/**
	 * Get milestones for timeline highlights
	 */
	getMilestones(taskId?: string): CheckpointMetadata[] {
		return this.metadataService
			.filterCheckpoints({
				categories: [CheckpointCategory.MILESTONE],
			})
			.filter((c) => !taskId || c.taskId === taskId)
	}
}
