import React, { useState, useEffect } from "react"
import { vscode } from "@src/utils/vscode"

export type DeploymentStatus = "local" | "dry-run" | "deploying" | "deployed" | "failed"

export type FileChange = {
	path: string
	additions?: number
	deletions?: number
	status?: "modified" | "created" | "deleted"
	diff?: string // The actual diff content
	deploymentStatus?: DeploymentStatus
	timestamp?: number // When the change was made
	error?: string // Error message if deployment failed
}

export interface FileChangesProps {
	files: FileChange[]
	variant?: "list" | "detail"
	defaultCollapsed?: boolean
	onFileClick?: (path: string) => void
	onViewDiff?: (file: FileChange) => void
	className?: string
	taskId?: string // For localStorage key
}

export interface FileChangeItemProps {
	file: FileChange
	onFileClick?: (path: string) => void
	onViewDiff?: (file: FileChange) => void
	showStats?: boolean
	showDeploymentStatus?: boolean
}

// LocalStorage utilities for persisting file changes
const STORAGE_KEY_PREFIX = "fileChanges_"

export const saveFileChanges = (taskId: string, files: FileChange[]): void => {
	try {
		const key = `${STORAGE_KEY_PREFIX}${taskId}`
		localStorage.setItem(key, JSON.stringify(files))
	} catch (error) {
		console.error("Failed to save file changes to localStorage:", error)
	}
}

export const loadFileChanges = (taskId: string): FileChange[] => {
	try {
		const key = `${STORAGE_KEY_PREFIX}${taskId}`
		const data = localStorage.getItem(key)
		return data ? JSON.parse(data) : []
	} catch (error) {
		console.error("Failed to load file changes from localStorage:", error)
		return []
	}
}

export const clearFileChanges = (taskId: string): void => {
	try {
		const key = `${STORAGE_KEY_PREFIX}${taskId}`
		localStorage.removeItem(key)
	} catch (error) {
		console.error("Failed to clear file changes from localStorage:", error)
	}
}

// Get deployment status badge configuration
const getDeploymentStatusConfig = (status?: DeploymentStatus) => {
	switch (status) {
		case "local":
			return {
				label: "Local",
				icon: "codicon-file",
				color: "var(--vscode-charts-blue)",
				bgColor: "rgba(75, 166, 255, 0.15)",
			}
		case "dry-run":
			return {
				label: "Dry Run",
				icon: "codicon-debug-alt",
				color: "var(--vscode-charts-purple)",
				bgColor: "rgba(188, 143, 255, 0.15)",
			}
		case "deploying":
			return {
				label: "Deploying",
				icon: "codicon-sync~spin",
				color: "var(--vscode-charts-orange)",
				bgColor: "rgba(255, 171, 0, 0.15)",
			}
		case "deployed":
			return {
				label: "Deployed",
				icon: "codicon-check",
				color: "var(--vscode-charts-green)",
				bgColor: "rgba(115, 191, 105, 0.15)",
			}
		case "failed":
			return {
				label: "Failed",
				icon: "codicon-error",
				color: "var(--vscode-errorForeground)",
				bgColor: "rgba(244, 71, 71, 0.15)",
			}
		default:
			return null
	}
}

/**
 * Displays a single file change with optional statistics
 */
export const FileChangeItem: React.FC<FileChangeItemProps> = ({
	file,
	onFileClick,
	onViewDiff,
	showStats = true,
	showDeploymentStatus = true,
}) => {
	const handleClick = () => {
		if (!file.path) {
			console.warn("FileChangeItem: attempt to open file with undefined path", file)
			return
		}

		if (onFileClick) {
			onFileClick(file.path)
			return
		}

		// Default behavior: open file in VS Code
		try {
			vscode.postMessage({ type: "openFile", text: file.path })
		} catch (err) {
			console.error("Failed to send openFile message", err, file.path)
		}
	}

	const handleViewDiff = (e: React.MouseEvent) => {
		e.stopPropagation()
		if (onViewDiff && file.diff) {
			onViewDiff(file)
		}
	}

	// Get status icon
	const getStatusIcon = () => {
		switch (file.status) {
			case "created":
				return "codicon-diff-added"
			case "deleted":
				return "codicon-diff-removed"
			case "modified":
				return "codicon-diff-modified"
			default:
				return "codicon-file"
		}
	}

	// Get status color
	const getStatusColor = () => {
		switch (file.status) {
			case "created":
				return "var(--vscode-gitDecoration-addedResourceForeground)"
			case "deleted":
				return "var(--vscode-gitDecoration-deletedResourceForeground)"
			case "modified":
				return "var(--vscode-gitDecoration-modifiedResourceForeground)"
			default:
				return "var(--vscode-editor-foreground)"
		}
	}

	const hasStats =
		showStats &&
		((file.additions !== undefined && file.additions !== 0) ||
			(file.deletions !== undefined && file.deletions !== 0))

	const deploymentConfig = showDeploymentStatus ? getDeploymentStatusConfig(file.deploymentStatus) : null

	return (
		<div className="flex items-center gap-2 text-xs py-1 hover:bg-vscode-list-hoverBackground rounded px-1">
			<span className={`codicon ${getStatusIcon()}`} style={{ color: getStatusColor() }} />
			<button
				onClick={handleClick}
				className="truncate text-left text-xs text-vscode-editor-foreground hover:underline flex-1">
				{file.path}
			</button>

			{/* Show additions/deletions only when non-zero values are provided */}
			{hasStats && (
				<div className="flex items-center gap-1">
					{file.additions !== undefined && file.additions !== 0 && (
						<span
							style={{
								fontSize: "11px",
								color: "var(--vscode-charts-green)",
								fontFamily: "monospace",
								fontWeight: "bold",
							}}>
							+{file.additions}
						</span>
					)}

					{file.deletions !== undefined && file.deletions !== 0 && (
						<span
							style={{
								fontSize: "11px",
								color: "var(--vscode-errorForeground)",
								fontFamily: "monospace",
								fontWeight: "bold",
							}}>
							-{file.deletions}
						</span>
					)}
				</div>
			)}

			{/* Deployment status badge */}
			{deploymentConfig && (
				<span
					className="flex items-center gap-1 px-2 py-0.5 rounded text-xs"
					style={{
						color: deploymentConfig.color,
						backgroundColor: deploymentConfig.bgColor,
						fontSize: "10px",
						fontWeight: "600",
					}}
					title={file.error || deploymentConfig.label}>
					<span className={`codicon ${deploymentConfig.icon}`} style={{ fontSize: "10px" }} />
					<span>{deploymentConfig.label}</span>
				</span>
			)}

			{/* View Diff button */}
			{file.diff && onViewDiff && (
				<button
					onClick={handleViewDiff}
					className="codicon codicon-diff text-xs hover:bg-vscode-button-hoverBackground p-1 rounded"
					title="View Diff"
					style={{ fontSize: "12px" }}
				/>
			)}
		</div>
	)
}

/**
 * Main FileChanges component with two variants:
 * - "list": Shows a collapsible list of file changes (default)
 * - "detail": Shows detailed view with statistics for each file
 */
export const FileChanges: React.FC<FileChangesProps> = ({
	files,
	variant = "list",
	defaultCollapsed = true,
	onFileClick,
	onViewDiff,
	className = "",
	taskId,
}) => {
	const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)

	// Persist file changes to localStorage when they change
	useEffect(() => {
		if (taskId && files.length > 0) {
			saveFileChanges(taskId, files)
		}
	}, [files, taskId])

	// Load file changes from localStorage on mount
	useEffect(() => {
		if (taskId) {
			const savedFiles = loadFileChanges(taskId)
			// You can merge savedFiles with current files if needed
			// For now, we just log them
			if (savedFiles.length > 0) {
				console.debug("Loaded file changes from localStorage:", savedFiles)
			}
		}
	}, [taskId])

	if (files.length === 0) {
		return null
	}

	const validFiles = files.filter((f) => !!f?.path)
	const filesLabel = `${files.length} file${files.length === 1 ? "" : "s"} changed`

	// Calculate total additions and deletions
	const totalAdditions = validFiles.reduce((sum, f) => sum + (f.additions || 0), 0)
	const totalDeletions = validFiles.reduce((sum, f) => sum + (f.deletions || 0), 0)

	// Count files by deployment status
	const statusCounts = validFiles.reduce(
		(acc, f) => {
			if (f.deploymentStatus) {
				acc[f.deploymentStatus] = (acc[f.deploymentStatus] || 0) + 1
			}
			return acc
		},
		{} as Record<DeploymentStatus, number>,
	)

	if (variant === "detail") {
		// Detail variant: shows expanded view with statistics prominently
		return (
			<div className={`flex-initial ${className}`}>
				<div className="border border-vscode-panel-border rounded p-3">
					{/* Header with summary */}
					<div className="flex items-center gap-3 mb-3 pb-2 border-b border-vscode-panel-border">
						<span className="codicon codicon-diff text-base" />
						<div className="flex-1">
							<div className="font-bold text-sm text-vscode-editor-foreground">{filesLabel}</div>
							{(totalAdditions > 0 || totalDeletions > 0) && (
								<div className="text-xs mt-1">
									{totalAdditions > 0 && (
										<span
											style={{
												color: "var(--vscode-charts-green)",
												fontFamily: "monospace",
												fontWeight: "bold",
												marginRight: 8,
											}}>
											+{totalAdditions}
										</span>
									)}
									{totalDeletions > 0 && (
										<span
											style={{
												color: "var(--vscode-errorForeground)",
												fontFamily: "monospace",
												fontWeight: "bold",
											}}>
											-{totalDeletions}
										</span>
									)}
								</div>
							)}
							{/* Deployment status summary */}
							{Object.keys(statusCounts).length > 0 && (
								<div className="flex gap-2 mt-2 flex-wrap">
									{Object.entries(statusCounts).map(([status, count]) => {
										const config = getDeploymentStatusConfig(status as DeploymentStatus)
										if (!config) return null
										return (
											<span
												key={status}
												className="flex items-center gap-1 px-2 py-0.5 rounded text-xs"
												style={{
													color: config.color,
													backgroundColor: config.bgColor,
													fontSize: "10px",
													fontWeight: "600",
												}}>
												<span
													className={`codicon ${config.icon}`}
													style={{ fontSize: "10px" }}
												/>
												<span>
													{count} {config.label}
												</span>
											</span>
										)
									})}
								</div>
							)}
						</div>
					</div>

					{/* File list */}
					<div className="space-y-1">
						{validFiles.map((file) => (
							<FileChangeItem
								key={file.path}
								file={file}
								onFileClick={onFileClick}
								onViewDiff={onViewDiff}
								showStats={true}
								showDeploymentStatus={true}
							/>
						))}
					</div>
				</div>
			</div>
		)
	}

	// List variant: shows collapsible list (original behavior)
	return (
		<div className={`flex-initial ${className}`}>
			{/* Header: shows count and chevron */}
			<div className="flex items-center gap-2 text-sm cursor-pointer" onClick={() => setIsCollapsed((s) => !s)}>
				<span className="font-bold text-xs text-vscode-editor-foreground">{filesLabel}</span>
				{Object.keys(statusCounts).length > 0 && (
					<div className="flex gap-1 ml-2">
						{Object.entries(statusCounts).map(([status, count]) => {
							const config = getDeploymentStatusConfig(status as DeploymentStatus)
							if (!config) return null
							return (
								<span
									key={status}
									className="flex items-center gap-1 px-1.5 py-0.5 rounded"
									style={{
										color: config.color,
										backgroundColor: config.bgColor,
										fontSize: "9px",
										fontWeight: "600",
									}}
									title={`${count} ${config.label}`}>
									<span className={`codicon ${config.icon}`} style={{ fontSize: "9px" }} />
									<span>{count}</span>
								</span>
							)
						})}
					</div>
				)}
				<div className="ml-auto flex items-center gap-2">
					<span className={`codicon ${isCollapsed ? "codicon-chevron-right" : "codicon-chevron-down"}`} />
				</div>
			</div>

			{/* Expanded section (shows filenames) */}
			{!isCollapsed && (
				<div className="mt-1 max-h-60 overflow-auto text-sm bg-vscode-editorHoverWidget-background p-2 rounded">
					{validFiles.map((file) => (
						<FileChangeItem
							key={file.path}
							file={file}
							onFileClick={onFileClick}
							onViewDiff={onViewDiff}
							showStats={true}
							showDeploymentStatus={true}
						/>
					))}
				</div>
			)}
		</div>
	)
}
