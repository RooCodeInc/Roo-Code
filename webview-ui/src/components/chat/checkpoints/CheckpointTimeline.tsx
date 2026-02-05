import { memo, useState, useMemo, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { GitCommitVertical, Star, Lock, Search, Filter, Calendar, List, GitBranch } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button, Input } from "@/components/ui"

import { CheckpointNode } from "./CheckpointNode"

/**
 * Checkpoint category enum mirrored from backend
 */
export enum CheckpointCategory {
	AUTO = "auto",
	MANUAL = "manual",
	MILESTONE = "milestone",
	EXPERIMENT = "experiment",
	BACKUP = "backup",
	RECOVERY = "recovery",
}

/**
 * Checkpoint metadata interface for UI
 */
export interface CheckpointMetadataUI {
	id: string
	commitHash: string
	taskId: string
	timestamp: string // ISO string
	name?: string
	description?: string
	tags: string[]
	category: CheckpointCategory
	stats: {
		filesChanged: number
		additions: number
		deletions: number
	}
	isStarred: boolean
	isLocked: boolean
	isCurrent?: boolean
}

/**
 * View mode options
 */
export type TimelineViewMode = "tree" | "list" | "calendar"

/**
 * Filter options for the timeline
 */
interface TimelineFilter {
	categories?: CheckpointCategory[]
	onlyStarred?: boolean
	searchText?: string
}

/**
 * Props for the CheckpointTimeline component
 */
interface CheckpointTimelineProps {
	checkpoints: CheckpointMetadataUI[]
	currentCheckpointId?: string
	onRestore: (commitHash: string) => void
	onDiff: (fromHash: string, toHash?: string) => void
	onRename: (id: string, name: string) => void
	onStar: (id: string) => void
	onDelete: (id: string) => void
}

/**
 * Category colors for visual distinction
 */
const CATEGORY_COLORS: Record<CheckpointCategory, string> = {
	[CheckpointCategory.AUTO]: "text-blue-400",
	[CheckpointCategory.MANUAL]: "text-green-400",
	[CheckpointCategory.MILESTONE]: "text-yellow-400",
	[CheckpointCategory.EXPERIMENT]: "text-purple-400",
	[CheckpointCategory.BACKUP]: "text-orange-400",
	[CheckpointCategory.RECOVERY]: "text-red-400",
}

/**
 * Category icons
 */
const CATEGORY_ICONS: Record<CheckpointCategory, React.ReactNode> = {
	[CheckpointCategory.AUTO]: <GitCommitVertical className="w-4 h-4" />,
	[CheckpointCategory.MANUAL]: <GitCommitVertical className="w-4 h-4" />,
	[CheckpointCategory.MILESTONE]: <Star className="w-4 h-4" />,
	[CheckpointCategory.EXPERIMENT]: <GitBranch className="w-4 h-4" />,
	[CheckpointCategory.BACKUP]: <Lock className="w-4 h-4" />,
	[CheckpointCategory.RECOVERY]: <GitCommitVertical className="w-4 h-4" />,
}

/**
 * Main timeline component for displaying checkpoints
 */
export const CheckpointTimeline = memo(function CheckpointTimeline({
	checkpoints,
	currentCheckpointId,
	onRestore,
	onDiff,
	onRename,
	onStar,
	onDelete,
}: CheckpointTimelineProps) {
	const { t } = useTranslation()
	const [viewMode, setViewMode] = useState<TimelineViewMode>("list")
	const [filter, setFilter] = useState<TimelineFilter>({})
	const [showFilters, setShowFilters] = useState(false)

	// Filter checkpoints
	const filteredCheckpoints = useMemo(() => {
		let result = [...checkpoints]

		if (filter.categories && filter.categories.length > 0) {
			result = result.filter((cp) => filter.categories!.includes(cp.category))
		}

		if (filter.onlyStarred) {
			result = result.filter((cp) => cp.isStarred)
		}

		if (filter.searchText) {
			const search = filter.searchText.toLowerCase()
			result = result.filter(
				(cp) =>
					cp.name?.toLowerCase().includes(search) ||
					cp.description?.toLowerCase().includes(search) ||
					cp.tags.some((t) => t.toLowerCase().includes(search)),
			)
		}

		// Sort by timestamp descending (most recent first)
		return result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
	}, [checkpoints, filter])

	// Group checkpoints by date for calendar view
	const groupedByDate = useMemo(() => {
		const groups = new Map<string, CheckpointMetadataUI[]>()
		for (const cp of filteredCheckpoints) {
			const date = new Date(cp.timestamp).toLocaleDateString()
			if (!groups.has(date)) {
				groups.set(date, [])
			}
			groups.get(date)!.push(cp)
		}
		return groups
	}, [filteredCheckpoints])

	const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		setFilter((prev) => ({ ...prev, searchText: e.target.value }))
	}, [])

	const toggleCategoryFilter = useCallback((category: CheckpointCategory) => {
		setFilter((prev) => {
			const current = prev.categories || []
			if (current.includes(category)) {
				return { ...prev, categories: current.filter((c) => c !== category) }
			}
			return { ...prev, categories: [...current, category] }
		})
	}, [])

	const toggleStarredFilter = useCallback(() => {
		setFilter((prev) => ({ ...prev, onlyStarred: !prev.onlyStarred }))
	}, [])

	return (
		<div className="flex flex-col h-full bg-background">
			{/* Header with search and view controls */}
			<div className="flex flex-col gap-2 p-3 border-b border-border">
				<div className="flex items-center gap-2">
					<div className="relative flex-1">
						<Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
						<Input
							type="text"
							placeholder={t("chat:checkpoint.search", "Search checkpoints...")}
							value={filter.searchText || ""}
							onChange={handleSearchChange}
							className="pl-8 h-8"
						/>
					</div>
					<Button
						variant="ghost"
						size="icon"
						onClick={() => setShowFilters(!showFilters)}
						className={cn(showFilters && "bg-accent")}>
						<Filter className="w-4 h-4" />
					</Button>
				</div>

				{/* View mode toggle */}
				<div className="flex items-center gap-1">
					<Button
						variant={viewMode === "list" ? "secondary" : "ghost"}
						size="sm"
						onClick={() => setViewMode("list")}>
						<List className="w-4 h-4 mr-1" />
						{t("chat:checkpoint.listView", "List")}
					</Button>
					<Button
						variant={viewMode === "tree" ? "secondary" : "ghost"}
						size="sm"
						onClick={() => setViewMode("tree")}>
						<GitBranch className="w-4 h-4 mr-1" />
						{t("chat:checkpoint.treeView", "Tree")}
					</Button>
					<Button
						variant={viewMode === "calendar" ? "secondary" : "ghost"}
						size="sm"
						onClick={() => setViewMode("calendar")}>
						<Calendar className="w-4 h-4 mr-1" />
						{t("chat:checkpoint.calendarView", "Calendar")}
					</Button>
				</div>

				{/* Filters panel */}
				{showFilters && (
					<div className="flex flex-wrap gap-2 pt-2 border-t border-border">
						{Object.values(CheckpointCategory).map((category) => (
							<Button
								key={category}
								variant={filter.categories?.includes(category) ? "secondary" : "outline"}
								size="sm"
								onClick={() => toggleCategoryFilter(category)}
								className={cn("text-xs", CATEGORY_COLORS[category])}>
								{CATEGORY_ICONS[category]}
								<span className="ml-1 capitalize">{category}</span>
							</Button>
						))}
						<Button
							variant={filter.onlyStarred ? "secondary" : "outline"}
							size="sm"
							onClick={toggleStarredFilter}
							className="text-xs">
							<Star className={cn("w-3 h-3 mr-1", filter.onlyStarred && "fill-yellow-400")} />
							{t("chat:checkpoint.starred", "Starred")}
						</Button>
					</div>
				)}
			</div>

			{/* Checkpoint list */}
			<div className="flex-1 overflow-y-auto">
				{filteredCheckpoints.length === 0 ? (
					<div className="flex items-center justify-center h-32 text-muted-foreground">
						{t("chat:checkpoint.noCheckpoints", "No checkpoints found")}
					</div>
				) : viewMode === "calendar" ? (
					// Calendar view - grouped by date
					<div className="p-2 space-y-4">
						{Array.from(groupedByDate.entries()).map(([date, cps]) => (
							<div key={date} className="space-y-2">
								<div className="text-sm font-medium text-muted-foreground sticky top-0 bg-background py-1">
									{date}
								</div>
								{cps.map((checkpoint) => (
									<CheckpointNode
										key={checkpoint.id}
										checkpoint={checkpoint}
										isCurrent={checkpoint.commitHash === currentCheckpointId}
										categoryColor={CATEGORY_COLORS[checkpoint.category]}
										categoryIcon={CATEGORY_ICONS[checkpoint.category]}
										onRestore={() => onRestore(checkpoint.commitHash)}
										onDiff={() => onDiff(checkpoint.commitHash)}
										onRename={(name) => onRename(checkpoint.id, name)}
										onStar={() => onStar(checkpoint.id)}
										onDelete={() => onDelete(checkpoint.id)}
									/>
								))}
							</div>
						))}
					</div>
				) : (
					// List/Tree view
					<div className="p-2 space-y-1">
						{filteredCheckpoints.map((checkpoint, index) => (
							<div key={checkpoint.id} className="relative">
								{/* Tree connector line */}
								{viewMode === "tree" && index > 0 && (
									<div className="absolute left-4 -top-1 w-0.5 h-2 bg-border" />
								)}
								<CheckpointNode
									checkpoint={checkpoint}
									isCurrent={checkpoint.commitHash === currentCheckpointId}
									categoryColor={CATEGORY_COLORS[checkpoint.category]}
									categoryIcon={CATEGORY_ICONS[checkpoint.category]}
									onRestore={() => onRestore(checkpoint.commitHash)}
									onDiff={() => onDiff(checkpoint.commitHash)}
									onRename={(name) => onRename(checkpoint.id, name)}
									onStar={() => onStar(checkpoint.id)}
									onDelete={() => onDelete(checkpoint.id)}
								/>
							</div>
						))}
					</div>
				)}
			</div>

			{/* Footer with stats */}
			<div className="flex items-center justify-between px-3 py-2 border-t border-border text-xs text-muted-foreground">
				<span>
					{filteredCheckpoints.length} {t("chat:checkpoint.checkpoints", "checkpoints")}
				</span>
				<span>
					{filteredCheckpoints.filter((c) => c.isStarred).length} {t("chat:checkpoint.starred", "starred")}
				</span>
			</div>
		</div>
	)
})
