import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Fzf } from "fzf"
import { GripVertical } from "lucide-react"

import { cn } from "@/lib/utils"
import { useRooPortal } from "@/components/ui/hooks/useRooPortal"
import { Popover, PopoverContent, PopoverTrigger, StandardTooltip } from "@/components/ui"
import { vscode } from "@/utils/vscode"
import { Button } from "@/components/ui"
import { useExtensionState } from "@/context/ExtensionStateContext"

import { IconButton } from "./IconButton"

type SortMode = "alphabetical" | "custom"

interface DragState {
	isDragging: boolean
	draggedIndex: number | null
	dragOverIndex: number | null
}

interface ApiConfigSelectorProps {
	value: string
	displayName: string
	disabled?: boolean
	title: string
	onChange: (value: string) => void
	triggerClassName?: string
	listApiConfigMeta: Array<{ id: string; name: string; modelId?: string }>
	pinnedApiConfigs?: Record<string, boolean>
	togglePinnedApiConfig: (id: string) => void
}

export const ApiConfigSelector = ({
	value,
	displayName,
	disabled = false,
	title,
	onChange,
	triggerClassName = "",
	listApiConfigMeta,
	pinnedApiConfigs,
	togglePinnedApiConfig,
}: ApiConfigSelectorProps) => {
	const { t } = useTranslation()
	const { apiConfigCustomOrder: persistedCustomOrder } = useExtensionState()
	const [open, setOpen] = useState(false)
	const [searchValue, setSearchValue] = useState("")
	const [isReorderMode, setIsReorderMode] = useState(false)
	const [dragState, setDragState] = useState<DragState>({
		isDragging: false,
		draggedIndex: null,
		dragOverIndex: null,
	})
	const [focusedIndex, setFocusedIndex] = useState<number | null>(null)
	// Track the ID of the item that should maintain focus during reordering
	const [focusedItemId, setFocusedItemId] = useState<string | null>(null)

	// Internal state for sort mode and custom order when parent doesn't provide them
	const [sortMode, setSortMode] = useState<SortMode>("alphabetical")
	const [internalCustomOrder, setInternalCustomOrder] = useState<string[]>([])

	// Use persisted state then internal state as fallback
	const customOrder =
		persistedCustomOrder && persistedCustomOrder.length > 0 ? persistedCustomOrder : internalCustomOrder

	const portalContainer = useRooPortal("roo-portal")
	const scrollContainerRef = useRef<HTMLDivElement | null>(null)

	// Sort configs based on sort mode
	const sortedConfigs = useMemo(() => {
		const sorted = [...listApiConfigMeta]

		switch (sortMode) {
			case "alphabetical":
				sorted.sort((a, b) => a.name.localeCompare(b.name))
				break
			case "custom":
				if (customOrder && customOrder.length > 0) {
					// Sort by custom order, with unordered items at the end
					const orderMap = new Map(customOrder.map((id: string, index: number) => [id, index]))
					sorted.sort((a, b) => {
						const aIndex = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER
						const bIndex = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER
						return (aIndex as number) - (bIndex as number)
					})
				}
				break
		}

		return sorted
	}, [listApiConfigMeta, sortMode, customOrder])

	// Filter configs based on search.
	const filteredConfigs = useMemo(() => {
		if (!searchValue) {
			return sortedConfigs
		}

		const searchableItems = sortedConfigs.map((config) => ({
			original: config,
			searchStr: config.name,
		}))

		const fzf = new Fzf(searchableItems, { selector: (item) => item.searchStr })
		const matchingItems = fzf.find(searchValue).map((result) => result.item.original)
		return matchingItems
	}, [sortedConfigs, searchValue])

	// Separate pinned and unpinned configs.
	const { pinnedConfigs, unpinnedConfigs } = useMemo(() => {
		const pinned = filteredConfigs.filter((config) => pinnedApiConfigs?.[config.id])
		const unpinned = filteredConfigs.filter((config) => !pinnedApiConfigs?.[config.id])
		return { pinnedConfigs: pinned, unpinnedConfigs: unpinned }
	}, [filteredConfigs, pinnedApiConfigs])

	// Effect to manage focus when in reorder mode
	useEffect(() => {
		if (isReorderMode && focusedIndex !== null) {
			// Find the element at the focused index and focus it
			const element = document.querySelector(`[data-config-item-index="${focusedIndex}"]`) as HTMLElement
			if (element) {
				element.focus()
			}
		}
	}, [focusedIndex, isReorderMode])

	// Effect to set initial focus when entering reorder mode
	useEffect(() => {
		if (isReorderMode && focusedIndex === null) {
			const allConfigs = [...pinnedConfigs, ...unpinnedConfigs]
			// Try to focus on the currently selected item, otherwise focus the first item
			const selectedIndex = allConfigs.findIndex((config) => config.id === value)
			const initialIndex = selectedIndex !== -1 ? selectedIndex : 0
			setFocusedIndex(initialIndex)
			if (allConfigs[initialIndex]) {
				setFocusedItemId(allConfigs[initialIndex].id)
			}
		} else if (!isReorderMode) {
			setFocusedIndex(null)
			setFocusedItemId(null)
		}
	}, [isReorderMode, focusedIndex, pinnedConfigs, unpinnedConfigs, value])

	// Update focus index when the focused item's position changes
	useEffect(() => {
		if (isReorderMode && focusedItemId) {
			const allConfigs = [...pinnedConfigs, ...unpinnedConfigs]
			const newIndex = allConfigs.findIndex((config) => config.id === focusedItemId)
			if (newIndex !== -1 && newIndex !== focusedIndex) {
				setFocusedIndex(newIndex)
			}
		}
	}, [pinnedConfigs, unpinnedConfigs, focusedItemId, isReorderMode, focusedIndex])

	const handleSelect = useCallback(
		(configId: string) => {
			onChange(configId)
			setOpen(false)
			setSearchValue("")
		},
		[onChange],
	)

	const handleEditClick = useCallback(() => {
		vscode.postMessage({ type: "switchTab", tab: "settings" })
		setOpen(false)
	}, [])

	const handleSortModeChange = useCallback((mode: SortMode) => {
		// Always update internal state as fallback
		setSortMode(mode)

		if (mode !== "custom") {
			setIsReorderMode(false)
		}
	}, [])

	const handleReorderClick = useCallback(() => {
		if (sortMode !== "custom") {
			handleSortModeChange("custom")
		}
		setIsReorderMode(true)
		// Reset focused item ID when entering reorder mode
		setFocusedItemId(null)
	}, [sortMode, handleSortModeChange])

	const handleReorderDone = useCallback(() => {
		// Find the index of the currently selected item to maintain focus
		const allConfigs = [...pinnedConfigs, ...unpinnedConfigs]
		const selectedIndex = allConfigs.findIndex((config) => config.id === value)

		setIsReorderMode(false)
		setDragState({
			isDragging: false,
			draggedIndex: null,
			dragOverIndex: null,
		})
		// Keep focus on the selected item if found, otherwise clear focus
		setFocusedIndex(selectedIndex !== -1 ? selectedIndex : null)
	}, [pinnedConfigs, unpinnedConfigs, value])

	const handleReorderCancel = useCallback(() => {
		setIsReorderMode(false)
		setDragState({
			isDragging: false,
			draggedIndex: null,
			dragOverIndex: null,
		})
		setFocusedIndex(null)
		setFocusedItemId(null)
		// Reset to original order by not saving changes
	}, [])

	const moveItem = useCallback(
		(fromIndex: number, toIndex: number) => {
			if (fromIndex === toIndex) return

			// We need to work with the current customOrder, not filteredConfigs
			// because filteredConfigs might be sorted differently
			const currentOrder = customOrder.length > 0 ? customOrder : filteredConfigs.map((c) => c.id)

			const newOrder = [...currentOrder]
			const [movedItemId] = newOrder.splice(fromIndex, 1)
			newOrder.splice(toIndex, 0, movedItemId)

			// Only update through VSCode message - this should update persistedCustomOrder
			vscode.postMessage({
				type: "setApiConfigCustomOrder",
				values: { customOrder: newOrder },
			})
		},
		[customOrder, filteredConfigs],
	)

	const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
		setDragState({
			isDragging: true,
			draggedIndex: index,
			dragOverIndex: null,
		})
		e.dataTransfer.effectAllowed = "move"
		e.dataTransfer.setData("text/html", "")
	}, [])

	const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
		e.preventDefault()
		e.dataTransfer.dropEffect = "move"
		setDragState((prev) => ({
			...prev,
			dragOverIndex: index,
		}))
	}, [])

	// Convert display index to filteredConfigs index considering pinned/unpinned separation
	const getFilteredIndex = useCallback(
		(displayIndex: number) => {
			if (displayIndex < pinnedConfigs.length) {
				// Item is in pinned section - find its index in filteredConfigs
				const pinnedConfig = pinnedConfigs[displayIndex]
				return filteredConfigs.findIndex((config) => config.id === pinnedConfig.id)
			} else {
				// Item is in unpinned section - find its index in filteredConfigs
				const unpinnedIndex = displayIndex - pinnedConfigs.length
				const unpinnedConfig = unpinnedConfigs[unpinnedIndex]
				return filteredConfigs.findIndex((config) => config.id === unpinnedConfig.id)
			}
		},
		[pinnedConfigs, unpinnedConfigs, filteredConfigs],
	)

	const handleDragEnd = useCallback(() => {
		const { draggedIndex, dragOverIndex } = dragState

		if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
			// Convert display indices to customOrder indices for moveItem
			const draggedConfigId = filteredConfigs[getFilteredIndex(draggedIndex)].id
			const dragOverConfigId = filteredConfigs[getFilteredIndex(dragOverIndex)].id

			const draggedCustomOrderIndex = customOrder.indexOf(draggedConfigId)
			const dragOverCustomOrderIndex = customOrder.indexOf(dragOverConfigId)

			moveItem(draggedCustomOrderIndex, dragOverCustomOrderIndex)
		}

		setDragState({
			isDragging: false,
			draggedIndex: null,
			dragOverIndex: null,
		})
	}, [dragState, moveItem, getFilteredIndex, customOrder, filteredConfigs])

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent, displayIndex: number) => {
			if (!isReorderMode) return

			const allConfigs = [...pinnedConfigs, ...unpinnedConfigs]
			const currentConfig = allConfigs[displayIndex]
			if (!currentConfig) return

			const totalItems = allConfigs.length

			if (e.altKey || e.metaKey) {
				// Alt/Option + arrow keys for reordering
				const configId = currentConfig.id

				if (e.key === "ArrowUp") {
					e.preventDefault()
					// Optimistically update the UI first
					const currentOrder = customOrder.length > 0 ? customOrder : filteredConfigs.map((c) => c.id)
					const configOrderIndex = currentOrder.indexOf(configId)

					if (configOrderIndex > 0) {
						// Create new order by swapping with previous item
						const newOrder = [...currentOrder]
						;[newOrder[configOrderIndex - 1], newOrder[configOrderIndex]] = [
							newOrder[configOrderIndex],
							newOrder[configOrderIndex - 1],
						]

						// Update internal state immediately for responsive UI
						setInternalCustomOrder(newOrder)

						// Track the item being moved to maintain focus on it
						setFocusedItemId(configId)

						// Sync with backend
						vscode.postMessage({
							type: "setApiConfigCustomOrder",
							values: { customOrder: newOrder },
						})
					}
				} else if (e.key === "ArrowDown") {
					e.preventDefault()
					// Optimistically update the UI first
					const currentOrder = customOrder.length > 0 ? customOrder : filteredConfigs.map((c) => c.id)
					const configOrderIndex = currentOrder.indexOf(configId)

					if (configOrderIndex < currentOrder.length - 1) {
						// Create new order by swapping with next item
						const newOrder = [...currentOrder]
						;[newOrder[configOrderIndex], newOrder[configOrderIndex + 1]] = [
							newOrder[configOrderIndex + 1],
							newOrder[configOrderIndex],
						]

						// Update internal state immediately for responsive UI
						setInternalCustomOrder(newOrder)

						// Track the item being moved to maintain focus on it
						setFocusedItemId(configId)

						// Sync with backend
						vscode.postMessage({
							type: "setApiConfigCustomOrder",
							values: { customOrder: newOrder },
						})
					}
				}
			} else {
				// Plain arrow keys for navigation
				if (e.key === "ArrowUp" && displayIndex > 0) {
					e.preventDefault()
					setFocusedIndex(displayIndex - 1)
					setFocusedItemId(allConfigs[displayIndex - 1].id)
				} else if (e.key === "ArrowDown" && displayIndex < totalItems - 1) {
					e.preventDefault()
					setFocusedIndex(displayIndex + 1)
					setFocusedItemId(allConfigs[displayIndex + 1].id)
				} else if (e.key === "Enter" || e.key === " ") {
					e.preventDefault()
					handleSelect(currentConfig.id)
				} else if (e.key === "Tab") {
					e.preventDefault()
					// Handle tab navigation manually
					if (e.shiftKey && displayIndex > 0) {
						setFocusedIndex(displayIndex - 1)
						setFocusedItemId(allConfigs[displayIndex - 1].id)
					} else if (!e.shiftKey && displayIndex < totalItems - 1) {
						setFocusedIndex(displayIndex + 1)
						setFocusedItemId(allConfigs[displayIndex + 1].id)
					}
				}
			}
		},
		[isReorderMode, filteredConfigs, pinnedConfigs, unpinnedConfigs, customOrder, handleSelect],
	)

	const renderConfigItem = useCallback(
		(config: { id: string; name: string; modelId?: string }, isPinned: boolean, index: number) => {
			const isCurrentConfig = config.id === value
			const isDraggedOver = dragState.dragOverIndex === index
			const isDragged = dragState.draggedIndex === index
			const isFocused = focusedIndex === index

			return (
				<div
					key={config.id}
					data-config-item
					data-config-item-index={index}
					role="option"
					aria-selected={isCurrentConfig}
					aria-label={`${config.name}${config.modelId ? ` - ${config.modelId}` : ""}`}
					draggable={isReorderMode && sortMode === "custom"}
					onDragStart={(e) => isReorderMode && handleDragStart(e, index)}
					onDragOver={(e) => isReorderMode && handleDragOver(e, index)}
					onDragEnd={handleDragEnd}
					onClick={() => !isReorderMode && handleSelect(config.id)}
					onKeyDown={(e) => {
						if (isReorderMode) {
							handleKeyDown(e, index)
						} else if (e.key === "Enter" || e.key === " ") {
							e.preventDefault()
							handleSelect(config.id)
						}
					}}
					tabIndex={isReorderMode ? (isFocused ? 0 : -1) : 0}
					className={cn(
						"px-3 py-1.5 text-sm flex items-center group relative",
						!isReorderMode && "cursor-pointer hover:bg-vscode-list-hoverBackground",
						isCurrentConfig &&
							"bg-vscode-list-activeSelectionBackground text-vscode-list-activeSelectionForeground",
						isReorderMode && "cursor-move",
						isDragged && "opacity-50",
						isDraggedOver && "border-t-2 border-vscode-focusBorder",
						isFocused && "ring-1 ring-vscode-focusBorder",
					)}>
					{/* Drag handle - only visible in reorder mode */}
					{isReorderMode && sortMode === "custom" && (
						<div className="mr-2 flex items-center justify-center size-4 text-vscode-descriptionForeground">
							<GripVertical className="size-3" />
						</div>
					)}

					<div className="flex-1 min-w-0 flex items-center gap-1 overflow-hidden">
						<span className="flex-shrink-0">{config.name}</span>
						{config.modelId && (
							<>
								<span
									className="text-vscode-descriptionForeground opacity-70 min-w-0 overflow-hidden"
									style={{ direction: "rtl", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
									{config.modelId}
								</span>
							</>
						)}
					</div>

					<div className="flex items-center gap-1">
						{isCurrentConfig && (
							<div className="size-5 p-1 flex items-center justify-center">
								<span className="codicon codicon-check text-xs" />
							</div>
						)}
						{!isReorderMode && (
							<StandardTooltip
								content={
									isPinned ? t("chat:apiConfigSelector.unpin") : t("chat:apiConfigSelector.pin")
								}>
								<Button
									variant="ghost"
									size="icon"
									tabIndex={-1}
									aria-label={
										isPinned ? t("chat:apiConfigSelector.unpin") : t("chat:apiConfigSelector.pin")
									}
									onClick={(e) => {
										e.stopPropagation()
										togglePinnedApiConfig(config.id)
										vscode.postMessage({ type: "toggleApiConfigPin", text: config.id })
									}}
									className={cn("size-5 flex items-center justify-center", {
										"opacity-0 group-hover:opacity-100": !isPinned && !isCurrentConfig,
										"bg-accent opacity-100": isPinned,
									})}>
									<span className="codicon codicon-pin text-xs opacity-50" />
								</Button>
							</StandardTooltip>
						)}
					</div>
				</div>
			)
		},
		[
			value,
			handleSelect,
			togglePinnedApiConfig,
			isReorderMode,
			sortMode,
			dragState,
			handleDragStart,
			handleDragOver,
			handleDragEnd,
			t,
			focusedIndex,
			handleKeyDown,
		],
	)

	return (
		<Popover open={open} onOpenChange={setOpen} data-testid="api-config-selector-root">
			<StandardTooltip content={title}>
				<PopoverTrigger
					disabled={disabled}
					data-testid="dropdown-trigger"
					aria-label={title}
					aria-expanded={open}
					aria-haspopup="listbox"
					className={cn(
						"min-w-0 inline-flex items-center relative whitespace-nowrap px-1.5 py-1 text-xs",
						"bg-transparent border border-[rgba(255,255,255,0.08)] rounded-md text-vscode-foreground",
						"transition-all duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder focus-visible:ring-inset",
						disabled
							? "opacity-50 cursor-not-allowed"
							: "opacity-90 hover:opacity-100 hover:bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.15)] cursor-pointer",
						triggerClassName,
					)}>
					<span className="truncate">{displayName}</span>
				</PopoverTrigger>
			</StandardTooltip>
			<PopoverContent
				align="start"
				sideOffset={4}
				container={portalContainer}
				className="p-0 overflow-hidden w-[300px]">
				<div className="flex flex-col w-full">
					{/* Search input or info blurb */}
					{listApiConfigMeta.length > 6 ? (
						<div className="relative p-2 border-b border-vscode-dropdown-border">
							<input
								aria-label={t("common:ui.search_placeholder")}
								value={searchValue}
								onChange={(e) => setSearchValue(e.target.value)}
								placeholder={t("common:ui.search_placeholder")}
								className="w-full h-8 px-2 py-1 text-xs bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded focus:outline-0"
								autoFocus
							/>
							{searchValue.length > 0 && (
								<div className="absolute right-4 top-0 bottom-0 flex items-center justify-center">
									<span
										className="codicon codicon-close text-vscode-input-foreground opacity-50 hover:opacity-100 text-xs cursor-pointer"
										onClick={() => setSearchValue("")}
										aria-label="Clear search"
										role="button"
										tabIndex={0}
										onKeyDown={(e) => {
											if (e.key === "Enter" || e.key === " ") {
												e.preventDefault()
												setSearchValue("")
											}
										}}
									/>
								</div>
							)}
						</div>
					) : (
						<div className="p-3 border-b border-vscode-dropdown-border">
							<p className="text-xs text-vscode-descriptionForeground m-0">
								{t("prompts:apiConfiguration.select")}
							</p>
						</div>
					)}

					{/* Config list - single scroll container with a11y attributes and ref for drag-and-drop */}
					{filteredConfigs.length === 0 && searchValue ? (
						<div className="py-2 px-3 text-sm text-vscode-foreground/70">{t("common:ui.no_results")}</div>
					) : (
						<div
							ref={scrollContainerRef}
							className="max-h-[300px] overflow-y-auto"
							role="listbox"
							aria-label={t("prompts:apiConfiguration.select")}>
							{/* Pinned configs - sticky header */}
							{pinnedConfigs.length > 0 && (
								<div
									className={cn(
										"sticky top-0 z-10 bg-vscode-dropdown-background py-1",
										unpinnedConfigs.length > 0 && "border-b border-vscode-dropdown-foreground/10",
									)}
									aria-label="Pinned configurations">
									{pinnedConfigs.map((config, index) => renderConfigItem(config, true, index))}
								</div>
							)}

							{/* Unpinned configs */}
							{unpinnedConfigs.length > 0 && (
								<div className="py-1" aria-label="All configurations">
									{unpinnedConfigs.map((config, index) =>
										renderConfigItem(config, false, pinnedConfigs.length + index)
									)}
								</div>
							)}
						</div>
					)}

					{/* Bottom bar with controls */}
					<div className="flex flex-col border-t border-vscode-dropdown-border">
						{/* Sort controls */}
						{!isReorderMode && (
							<div className="flex items-center justify-between px-2 py-1.5 border-b border-vscode-dropdown-border">
								<div className="flex items-center gap-2">
									<span className="text-xs text-vscode-descriptionForeground">
										{t("chat:apiConfigSelector.sort")}
									</span>
									<div className="flex items-center gap-1">
										{(["alphabetical", "custom"] as const).map((mode) => (
											<Button
												key={mode}
												variant="ghost"
												size="sm"
												aria-label={`${t("chat:apiConfigSelector.sort")} ${mode === "alphabetical" ? t("chat:apiConfigSelector.alphabetical") : t("chat:apiConfigSelector.custom")}`}
												aria-pressed={sortMode === mode}
												onClick={() => handleSortModeChange(mode)}
												className={cn(
													"h-6 px-2 text-xs",
													sortMode === mode &&
														"bg-vscode-button-background text-vscode-button-foreground",
												)}>
												{mode === "alphabetical"
													? t("chat:apiConfigSelector.alphabetical")
													: t("chat:apiConfigSelector.custom")}
											</Button>
										))}
									</div>
								</div>
								{sortMode === "custom" && (
									<Button
										variant="ghost"
										size="sm"
										aria-label={t("chat:apiConfigSelector.reorder")}
										onClick={handleReorderClick}
										className="h-6 px-2 text-xs">
										{t("chat:apiConfigSelector.reorder")}
									</Button>
								)}
							</div>
						)}

						{/* Reorder mode controls */}
						{isReorderMode && (
							<div className="flex flex-col border-b border-vscode-dropdown-border bg-vscode-inputOption-activeBackground">
								<div className="flex items-center justify-between px-2 py-1.5">
									<span className="text-xs text-vscode-descriptionForeground">
										{t("chat:apiConfigSelector.dragToReorder")}
									</span>
									<div className="flex items-center gap-1">
										<Button
											variant="ghost"
											size="sm"
											aria-label={t("chat:apiConfigSelector.cancel")}
											onClick={handleReorderCancel}
											className="h-6 px-2 text-xs">
											{t("chat:apiConfigSelector.cancel")}
										</Button>
										<Button
											variant="ghost"
											size="sm"
											aria-label={t("chat:apiConfigSelector.done")}
											onClick={handleReorderDone}
											className="h-6 px-2 text-xs bg-vscode-button-background text-vscode-button-foreground">
											{t("chat:apiConfigSelector.done")}
										</Button>
									</div>
								</div>
								<div className="px-2 pb-1.5">
									<span className="text-xs text-vscode-descriptionForeground opacity-80">
										{t("chat:apiConfigSelector.keyboardNavigation")}
									</span>
								</div>
							</div>
						)}

						{/* Bottom bar with settings and title */}
						<div className="flex flex-row items-center justify-between px-2 py-2">
							<div className="flex flex-row gap-1">
								<IconButton
									iconClass="codicon-settings-gear"
									title={t("chat:apiConfigSelector.editConfigurations")}
									onClick={handleEditClick}
									tooltip={false}
									aria-label="chat:edit"
								/>
							</div>

							{/* Info icon and title on the right with matching spacing */}
							<div className="flex items-center gap-1 pr-1">
								{listApiConfigMeta.length > 6 && (
									<StandardTooltip content={t("prompts:apiConfiguration.select")}>
										<span
											className="codicon codicon-info text-xs text-vscode-descriptionForeground opacity-70 hover:opacity-100 cursor-help"
											aria-label={t("prompts:apiConfiguration.select")}
											role="img"
										/>
									</StandardTooltip>
								)}
								<h4 className="m-0 font-medium text-sm text-vscode-descriptionForeground">
									{t("prompts:apiConfiguration.title")}
								</h4>
							</div>
						</div>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	)
}
