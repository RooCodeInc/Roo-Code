import React from "react"
import { FileChangeset, FileChange } from "@roo-code/types"
import { useTranslation } from "react-i18next"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { vscode } from "@/utils/vscode"
import { useDebouncedAction } from "@/hooks/useDebouncedAction"
import { EXPERIMENT_IDS } from "../../../../src/shared/experiments"
import styles from "./FilesChangedOverview.module.css"

// Helper functions for file path display
const getFileName = (uri: string): string => {
	return uri.split(/[/\\]/).pop() || uri
}

const getFilePath = (uri: string): string => {
	const parts = uri.split(/[/\\]/)
	parts.pop() // Remove filename
	return parts.length > 0 ? parts.join("/") : "/"
}

const VIRTUALIZATION_THRESHOLD = 20
const VIRTUALIZATION_ITEM_HEIGHT = 60 // Approximate height of each file item
const VIRTUALIZATION_MAX_VISIBLE_ITEMS = 10

/**
 * FilesChangedOverview is a self-managing component that listens for checkpoint events
 * and displays file changes. It manages its own state and communicates with the backend
 * through VS Code message passing.
 */
const FilesChangedOverview: React.FC = () => {
	const { t } = useTranslation()
	const { experiments } = useExtensionState()
	const filesChangedEnabled = !!experiments?.[EXPERIMENT_IDS.FILES_CHANGED_OVERVIEW]

	// Self-managed state
	const [changeset, setChangeset] = React.useState<FileChangeset | null>(null)
	const [isInitialized, setIsInitialized] = React.useState(false)

	// Refs for dynamic CSS custom properties
	const headerRef = React.useRef<HTMLDivElement>(null)
	const contentRef = React.useRef<HTMLDivElement>(null)
	const virtualizationContainerRef = React.useRef<HTMLDivElement>(null)
	const virtualizationOffsetRef = React.useRef<HTMLDivElement>(null)

	const files = React.useMemo<FileChange[]>(() => changeset?.files ?? [], [changeset?.files])
	const [isCollapsed, setIsCollapsed] = React.useState(true)

	// Performance optimization: Use virtualization for large file lists
	const [scrollTop, setScrollTop] = React.useState(0)

	const shouldVirtualize = files.length > VIRTUALIZATION_THRESHOLD

	const virtualizationState = React.useMemo(() => {
		if (!shouldVirtualize) {
			return {
				items: files,
				totalHeight: "auto" as const,
				offsetY: 0,
			}
		}

		const startIndex = Math.floor(scrollTop / VIRTUALIZATION_ITEM_HEIGHT)
		const endIndex = Math.min(startIndex + VIRTUALIZATION_MAX_VISIBLE_ITEMS, files.length)
		return {
			items: files.slice(startIndex, endIndex),
			totalHeight: files.length * VIRTUALIZATION_ITEM_HEIGHT,
			offsetY: startIndex * VIRTUALIZATION_ITEM_HEIGHT,
		}
	}, [files, scrollTop, shouldVirtualize])

	const { items: visibleItems, totalHeight, offsetY } = virtualizationState

	// Update CSS custom properties for dynamic styling
	React.useEffect(() => {
		if (headerRef.current) {
			const borderValue = isCollapsed ? "none" : "1px solid var(--vscode-panel-border)"
			headerRef.current.style.setProperty("--header-border-bottom", borderValue)
		}
	}, [isCollapsed])

	React.useEffect(() => {
		if (contentRef.current) {
			contentRef.current.style.setProperty("--content-opacity", isCollapsed ? "0" : "1")
		}
	}, [isCollapsed])

	React.useEffect(() => {
		if (virtualizationContainerRef.current && shouldVirtualize) {
			virtualizationContainerRef.current.style.setProperty("--virtualization-height", `${totalHeight}px`)
		}
	}, [totalHeight, shouldVirtualize])

	React.useEffect(() => {
		if (virtualizationOffsetRef.current && shouldVirtualize) {
			virtualizationOffsetRef.current.style.setProperty("--virtualization-transform", `translateY(${offsetY}px)`)
		}
	}, [offsetY, shouldVirtualize])

	// Debounced click handling for double-click prevention
	const { isProcessing, handleWithDebounce } = useDebouncedAction(300)

	// FilesChanged initialization logic
	const checkInit = React.useCallback(
		(_baseCheckpoint: string) => {
			if (!isInitialized) {
				setIsInitialized(true)
			}
		},
		[isInitialized],
	)

	// Update changeset - backend handles filtering, no local filtering needed
	const updateChangeset = React.useCallback((newChangeset: FileChangeset) => {
		setChangeset(newChangeset)
	}, [])

	// Handle checkpoint creation
	const handleCheckpointCreated = React.useCallback(
		(checkpoint: string, previousCheckpoint?: string) => {
			if (!isInitialized) {
				checkInit(previousCheckpoint || checkpoint)
			}
			// Note: Backend automatically sends file changes during checkpoint creation
			// No need to request them here - just wait for the filesChanged message
		},
		[isInitialized, checkInit],
	)

	// Handle checkpoint restoration (backend will push updated filesChanged state)
	const handleCheckpointRestored = React.useCallback((_restoredCheckpoint: string) => {
		// No-op: rely on backend to post updated filesChanged after restore
	}, [])

	// Action handlers
	const handleViewDiff = React.useCallback((uri: string) => {
		try {
			vscode.postMessage({ type: "viewDiff", uri })
		} catch (error) {
			console.error("Failed to view diff for file:", uri, error)
		}
	}, [])

	const handleAcceptFile = React.useCallback((uri: string) => {
		try {
			vscode.postMessage({ type: "acceptFileChange", uri })
			// Backend will send updated filesChanged message with filtered results
		} catch (error) {
			console.error("Failed to accept file change:", uri, error)
		}
	}, [])

	const handleRejectFile = React.useCallback((uri: string) => {
		try {
			vscode.postMessage({ type: "rejectFileChange", uri })
			// Backend will send updated filesChanged message with filtered results
		} catch (error) {
			console.error("Failed to reject file change:", uri, error)
		}
	}, [])

	const handleAcceptAll = React.useCallback(() => {
		try {
			vscode.postMessage({ type: "acceptAllFileChanges" })
			// Backend will send updated filesChanged message with filtered results
		} catch (error) {
			console.error("Failed to accept all file changes:", error)
		}
	}, [])

	const handleRejectAll = React.useCallback(() => {
		try {
			const visibleUris = files.map((file) => file.uri)
			vscode.postMessage({ type: "rejectAllFileChanges", uris: visibleUris })
			// Backend will send updated filesChanged message with filtered results
		} catch (error) {
			console.error("Failed to reject all file changes:", error)
		}
	}, [files])

	/**
	 * Handles scroll events for virtualization
	 * Updates scrollTop state to calculate visible items
	 */
	const handleScroll = React.useCallback(
		(e: React.UIEvent<HTMLDivElement>) => {
			if (shouldVirtualize) {
				setScrollTop(e.currentTarget.scrollTop)
			}
		},
		[shouldVirtualize],
	)

	// Listen for filesChanged messages from the backend
	React.useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data

			// Guard against null/undefined/malformed messages
			if (!message || typeof message !== "object" || !message.type) {
				return
			}

			// Only process known message types to avoid noisy updates
			switch (message.type) {
				case "filesChanged":
					// Additional validation for filesChanged message shape
					if ("filesChanged" in message) {
						if (
							message.filesChanged &&
							typeof message.filesChanged === "object" &&
							typeof message.filesChanged.baseCheckpoint === "string" &&
							Array.isArray(message.filesChanged.files)
						) {
							checkInit(message.filesChanged.baseCheckpoint)
							updateChangeset(message.filesChanged)
						} else if (message.filesChanged === null || message.filesChanged === undefined) {
							// Clear the changeset
							setChangeset(null)
						}
					}
					break
				case "checkpoint":
					// Additional validation for checkpoint message shape
					if (
						typeof message.checkpoint === "string" &&
						(message.previousCheckpoint === undefined || typeof message.previousCheckpoint === "string")
					) {
						handleCheckpointCreated(message.checkpoint, message.previousCheckpoint)
					}
					break
				case "checkpointRestored":
					// Additional validation for checkpointRestored message shape
					if (typeof message.checkpoint === "string") {
						handleCheckpointRestored(message.checkpoint)
					}
					break
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [checkInit, updateChangeset, handleCheckpointCreated, handleCheckpointRestored])

	// Enable/disable handled by backend; avoid duplicate filesChanged requests

	/**
	 * Formats line change counts for display - shows only plus/minus numbers
	 * @param file - The file change to format
	 * @returns Formatted string with just the line change counts
	 */
	const formatLineChanges = (file: FileChange): string => {
		const added = file.linesAdded || 0
		const removed = file.linesRemoved || 0

		const parts = []
		if (added > 0) parts.push(`+${added}`)
		if (removed > 0) parts.push(`-${removed}`)

		return parts.length > 0 ? parts.join(", ") : ""
	}

	// Memoize expensive total calculations
	const totalChanges = React.useMemo(() => {
		const totalAdded = files.reduce((sum, file) => sum + (file.linesAdded || 0), 0)
		const totalRemoved = files.reduce((sum, file) => sum + (file.linesRemoved || 0), 0)

		const parts = []
		if (totalAdded > 0) parts.push(`+${totalAdded}`)
		if (totalRemoved > 0) parts.push(`-${totalRemoved}`)
		return parts.length > 0 ? ` (${parts.join(", ")})` : ""
	}, [files])

	// Don't render if the feature is disabled or no changes to show
	if (!filesChangedEnabled || !changeset || files.length === 0) {
		return null
	}

	return (
		<div
			className="files-changed-overview border border-[var(--vscode-panel-border)] border-t-0 rounded-none px-2.5 py-1.5 m-0 bg-[var(--vscode-editor-background)]"
			data-testid="files-changed-overview">
			{/* Collapsible header */}
			<div
				ref={headerRef}
				className={`flex justify-between items-center mt-0 cursor-pointer select-none ${styles.header}`}
				onClick={() => setIsCollapsed(!isCollapsed)}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault()
						setIsCollapsed(!isCollapsed)
					}
				}}
				tabIndex={0}
				role="button"
				aria-expanded={!isCollapsed}
				aria-label={t("file-changes:accessibility.files_list", {
					count: files.length,
					state: isCollapsed
						? t("file-changes:accessibility.collapsed")
						: t("file-changes:accessibility.expanded"),
				})}
				title={isCollapsed ? t("file-changes:header.expand") : t("file-changes:header.collapse")}>
				<div className="flex items-center gap-2">
					<span
						className={`codicon text-xs transition-transform duration-200 ease-out ${isCollapsed ? "codicon-chevron-right" : "codicon-chevron-down"}`}
					/>
					<h3 className="m-0 text-sm font-bold" data-testid="files-changed-header">
						<span aria-live="polite" aria-atomic="true">
							{t("file-changes:summary.count_with_changes", {
								count: files.length,
								changes: totalChanges,
							})}
						</span>
					</h3>
				</div>

				{/* Action buttons always visible for quick access */}
				<div
					className="flex gap-2"
					onClick={(e) => e.stopPropagation()} // Prevent collapse toggle when clicking buttons
				>
					<button
						onClick={() => handleWithDebounce(handleRejectAll)}
						disabled={isProcessing}
						tabIndex={0}
						data-testid="reject-all-button"
						className="bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] border-none rounded px-2 py-1 text-xs disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--vscode-focusBorder)]"
						title={t("file-changes:actions.reject_all")}
						type="button"
						aria-disabled={isProcessing}
						aria-label={t("file-changes:actions.reject_all")}>
						{t("file-changes:actions.reject_all")}
					</button>
					<button
						onClick={() => handleWithDebounce(handleAcceptAll)}
						disabled={isProcessing}
						tabIndex={0}
						data-testid="accept-all-button"
						className="bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] border-none rounded px-2 py-1 text-xs disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--vscode-focusBorder)]"
						title={t("file-changes:actions.accept_all")}
						type="button"
						aria-disabled={isProcessing}
						aria-label={t("file-changes:actions.accept_all")}>
						{t("file-changes:actions.accept_all")}
					</button>
				</div>
			</div>

			{/* Collapsible content area */}
			{!isCollapsed && (
				<div
					ref={contentRef}
					className={styles.content}
					onScroll={handleScroll}
					role="region"
					aria-label={t("file-changes:header.files_changed", { defaultValue: "Files changed" })}>
					{shouldVirtualize && (
						<div ref={virtualizationContainerRef} className={styles.virtualizationContainer}>
							<div ref={virtualizationOffsetRef} className={styles.virtualizationOffset}>
								{visibleItems.map((file) => (
									<FileItem
										key={file.uri}
										file={file}
										formatLineChanges={formatLineChanges}
										onViewDiff={handleViewDiff}
										onAcceptFile={handleAcceptFile}
										onRejectFile={handleRejectFile}
										handleWithDebounce={handleWithDebounce}
										isProcessing={isProcessing}
										t={t}
									/>
								))}
							</div>
						</div>
					)}
					{!shouldVirtualize &&
						files.map((file) => (
							<FileItem
								key={file.uri}
								file={file}
								formatLineChanges={formatLineChanges}
								onViewDiff={handleViewDiff}
								onAcceptFile={handleAcceptFile}
								onRejectFile={handleRejectFile}
								handleWithDebounce={handleWithDebounce}
								isProcessing={isProcessing}
								t={t}
							/>
						))}
				</div>
			)}
		</div>
	)
}

/**
 * Props for the FileItem component
 */
interface FileItemProps {
	/** File change data */
	file: FileChange
	/** Function to format line change counts for display */
	formatLineChanges: (file: FileChange) => string
	/** Callback to view diff for the file */
	onViewDiff: (uri: string) => void
	/** Callback to accept changes for the file */
	onAcceptFile: (uri: string) => void
	/** Callback to reject changes for the file */
	onRejectFile: (uri: string) => void
	/** Debounced handler to prevent double-clicks */
	handleWithDebounce: (operation: () => void) => void
	/** Whether operations are currently being processed */
	isProcessing: boolean
	/** Translation function */
	t: (key: string, options?: Record<string, any>) => string
}

/**
 * FileItem renders a single file change with action buttons.
 * Used for both virtualized and non-virtualized rendering.
 * Memoized for performance optimization.
 */
const FileItem: React.FC<FileItemProps> = React.memo(
	({ file, formatLineChanges, onViewDiff, onAcceptFile, onRejectFile, handleWithDebounce, isProcessing, t }) => (
		<div
			data-testid={`file-item-${file.uri}`}
			className="flex justify-between items-center px-2 py-1.5 mb-1 bg-[var(--vscode-list-hoverBackground)] rounded text-xs min-h-[32px] leading-tight">
			<div className="flex-1 min-w-0">
				<div className="font-mono text-xs text-[var(--vscode-editor-foreground)] overflow-hidden text-ellipsis whitespace-nowrap font-medium">
					<span>{getFileName(file.uri)}</span>
					<span className="mx-1 opacity-60">•</span>
					<span className="opacity-60 text-[11px]">{t(`file-changes:file_types.${file.type}`)}</span>
				</div>
				<div className="text-[10px] text-[var(--vscode-descriptionForeground)] opacity-60 mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap">
					{getFilePath(file.uri)}
				</div>
			</div>

			<div className="flex items-center gap-2 ml-2">
				<div className="text-xs text-[var(--vscode-descriptionForeground)] whitespace-nowrap flex-shrink-0">
					{formatLineChanges(file)}
				</div>
				<div className="flex gap-1">
					<button
						onClick={() => handleWithDebounce(() => onViewDiff(file.uri))}
						disabled={isProcessing}
						title={t("file-changes:actions.view_diff")}
						data-testid={`diff-${file.uri}`}
						className="bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] border border-[var(--vscode-button-border)] rounded px-1.5 py-0.5 text-[11px] min-w-[35px] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--vscode-focusBorder)]"
						type="button"
						aria-disabled={isProcessing}>
						Diff
					</button>
					<button
						onClick={() => handleWithDebounce(() => onRejectFile(file.uri))}
						disabled={isProcessing}
						title={t("file-changes:actions.reject_file")}
						aria-label={t("file-changes:actions.reject_file")}
						data-testid={`reject-${file.uri}`}
						className="bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] border border-[var(--vscode-button-border)] rounded px-1.5 py-0.5 text-[11px] min-w-[20px] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--vscode-focusBorder)]"
						type="button"
						aria-disabled={isProcessing}>
						✗
					</button>
					<button
						onClick={() => handleWithDebounce(() => onAcceptFile(file.uri))}
						disabled={isProcessing}
						title={t("file-changes:actions.accept_file")}
						aria-label={t("file-changes:actions.accept_file")}
						data-testid={`accept-${file.uri}`}
						className="bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] border border-[var(--vscode-button-border)] rounded px-1.5 py-0.5 text-[11px] min-w-[20px] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--vscode-focusBorder)]"
						type="button"
						aria-disabled={isProcessing}>
						✓
					</button>
				</div>
			</div>
		</div>
	),
)

FileItem.displayName = "FileItem"

export default FilesChangedOverview
