import { memo, useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Star, Lock, Trash2, Edit2, RotateCcw, GitCompare, MoreVertical, Check, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button, Input } from "@/components/ui"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui"

import type { CheckpointMetadataUI } from "./CheckpointTimeline"

/**
 * Props for the CheckpointNode component
 */
interface CheckpointNodeProps {
	checkpoint: CheckpointMetadataUI
	isCurrent: boolean
	categoryColor: string
	categoryIcon: React.ReactNode
	onRestore: () => void
	onDiff: () => void
	onRename: (name: string) => void
	onStar: () => void
	onDelete: () => void
}

/**
 * Format a timestamp for display
 */
function formatTimestamp(timestamp: string): string {
	const date = new Date(timestamp)
	const now = new Date()
	const diff = now.getTime() - date.getTime()

	// Less than 1 minute
	if (diff < 60000) {
		return "Just now"
	}

	// Less than 1 hour
	if (diff < 3600000) {
		const minutes = Math.floor(diff / 60000)
		return `${minutes}m ago`
	}

	// Less than 24 hours
	if (diff < 86400000) {
		const hours = Math.floor(diff / 3600000)
		return `${hours}h ago`
	}

	// Format as date
	return date.toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	})
}

/**
 * Individual checkpoint node in the timeline
 */
export const CheckpointNode = memo(function CheckpointNode({
	checkpoint,
	isCurrent,
	categoryColor,
	categoryIcon,
	onRestore,
	onDiff,
	onRename,
	onStar,
	onDelete,
}: CheckpointNodeProps) {
	const { t } = useTranslation()
	const [isEditing, setIsEditing] = useState(false)
	const [editName, setEditName] = useState(checkpoint.name || "")
	const [showActions, setShowActions] = useState(false)
	const [confirmDelete, setConfirmDelete] = useState(false)

	const handleRename = useCallback(() => {
		if (editName.trim()) {
			onRename(editName.trim())
		}
		setIsEditing(false)
	}, [editName, onRename])

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter") {
				handleRename()
			} else if (e.key === "Escape") {
				setIsEditing(false)
				setEditName(checkpoint.name || "")
			}
		},
		[handleRename, checkpoint.name],
	)

	const handleDelete = useCallback(() => {
		if (confirmDelete) {
			onDelete()
			setConfirmDelete(false)
		} else {
			setConfirmDelete(true)
		}
	}, [confirmDelete, onDelete])

	const displayName = checkpoint.name || `Checkpoint ${checkpoint.commitHash.slice(0, 7)}`

	return (
		<div
			className={cn(
				"group relative flex items-start gap-2 p-2 rounded-md transition-colors",
				"hover:bg-accent/50",
				isCurrent && "bg-accent ring-1 ring-primary",
			)}
			onMouseEnter={() => setShowActions(true)}
			onMouseLeave={() => {
				setShowActions(false)
				setConfirmDelete(false)
			}}>
			{/* Category icon */}
			<div className={cn("flex-shrink-0 mt-1", categoryColor)}>{categoryIcon}</div>

			{/* Content */}
			<div className="flex-1 min-w-0">
				{/* Name row */}
				<div className="flex items-center gap-2">
					{isEditing ? (
						<div className="flex items-center gap-1 flex-1">
							<Input
								type="text"
								value={editName}
								onChange={(e) => setEditName(e.target.value)}
								onKeyDown={handleKeyDown}
								onBlur={handleRename}
								className="h-6 text-sm"
								autoFocus
							/>
							<Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleRename}>
								<Check className="w-3 h-3" />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								className="h-6 w-6"
								onClick={() => {
									setIsEditing(false)
									setEditName(checkpoint.name || "")
								}}>
								<X className="w-3 h-3" />
							</Button>
						</div>
					) : (
						<>
							<span className="font-medium text-sm truncate">{displayName}</span>
							{checkpoint.isStarred && (
								<Star className="w-3 h-3 fill-yellow-400 text-yellow-400 flex-shrink-0" />
							)}
							{checkpoint.isLocked && <Lock className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
							{isCurrent && (
								<span className="text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">
									{t("chat:checkpoint.current", "Current")}
								</span>
							)}
						</>
					)}
				</div>

				{/* Stats row */}
				<div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
					<span>{formatTimestamp(checkpoint.timestamp)}</span>
					<span className="flex items-center gap-1">
						<span className="text-green-400">+{checkpoint.stats.additions}</span>
						<span className="text-red-400">-{checkpoint.stats.deletions}</span>
					</span>
					<span>{checkpoint.stats.filesChanged} files</span>
				</div>

				{/* Tags */}
				{checkpoint.tags.length > 0 && (
					<div className="flex flex-wrap gap-1 mt-1">
						{checkpoint.tags.map((tag) => (
							<span
								key={tag}
								className="text-xs bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded">
								{tag}
							</span>
						))}
					</div>
				)}

				{/* Description */}
				{checkpoint.description && (
					<p className="text-xs text-muted-foreground mt-1 line-clamp-2">{checkpoint.description}</p>
				)}
			</div>

			{/* Actions */}
			<div
				className={cn("flex items-center gap-1 transition-opacity", showActions ? "opacity-100" : "opacity-0")}>
				<Button
					variant="ghost"
					size="icon"
					className="h-7 w-7"
					onClick={onDiff}
					title={t("chat:checkpoint.viewDiff", "View changes")}>
					<GitCompare className="w-4 h-4" />
				</Button>
				<Button
					variant="ghost"
					size="icon"
					className="h-7 w-7"
					onClick={onRestore}
					title={t("chat:checkpoint.restore", "Restore")}>
					<RotateCcw className="w-4 h-4" />
				</Button>
				<Popover>
					<PopoverTrigger asChild>
						<Button variant="ghost" size="icon" className="h-7 w-7">
							<MoreVertical className="w-4 h-4" />
						</Button>
					</PopoverTrigger>
					<PopoverContent align="end" className="w-40 p-1">
						<Button
							variant="ghost"
							size="sm"
							className="w-full justify-start"
							onClick={() => setIsEditing(true)}>
							<Edit2 className="w-4 h-4 mr-2" />
							{t("chat:checkpoint.rename", "Rename")}
						</Button>
						<Button variant="ghost" size="sm" className="w-full justify-start" onClick={onStar}>
							<Star
								className={cn(
									"w-4 h-4 mr-2",
									checkpoint.isStarred && "fill-yellow-400 text-yellow-400",
								)}
							/>
							{checkpoint.isStarred
								? t("chat:checkpoint.unstar", "Unstar")
								: t("chat:checkpoint.star", "Star")}
						</Button>
						{!checkpoint.isLocked && (
							<Button
								variant="ghost"
								size="sm"
								className={cn(
									"w-full justify-start",
									confirmDelete && "text-destructive hover:text-destructive",
								)}
								onClick={handleDelete}>
								<Trash2 className="w-4 h-4 mr-2" />
								{confirmDelete
									? t("chat:checkpoint.confirmDelete", "Click to confirm")
									: t("chat:checkpoint.delete", "Delete")}
							</Button>
						)}
					</PopoverContent>
				</Popover>
			</div>
		</div>
	)
})
