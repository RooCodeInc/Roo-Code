import { memo, useEffect, useRef, useState, useMemo, useCallback } from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { AlertTriangle, GripVertical, Edit, Trash2 } from "lucide-react"

import type { ProviderSettingsEntry, OrganizationAllowList } from "@roo-code/types"

import { useAppTranslation } from "@/i18n/TranslationContext"
import { Button, Input, Dialog, DialogContent, DialogTitle, StandardTooltip } from "@/components/ui"
import { cn } from "@/lib/utils"
import { vscode } from "@/utils/vscode"
import { useExtensionState } from "@/context/ExtensionStateContext"

interface DragState {
	isDragging: boolean
	draggedIndex: number | null
	dragOverIndex: number | null
}

interface ApiConfigManagerProps {
	currentApiConfigName?: string
	listApiConfigMeta?: ProviderSettingsEntry[]
	organizationAllowList?: OrganizationAllowList
	onSelectConfig: (configName: string) => void
	onDeleteConfig: (configName: string) => void
	onRenameConfig: (oldName: string, newName: string) => void
	onUpsertConfig: (configName: string) => void
	pinnedApiConfigs?: Record<string, boolean>
	togglePinnedApiConfig?: (id: string) => void
}

const ApiConfigManager = ({
	currentApiConfigName = "",
	listApiConfigMeta = [],
	organizationAllowList,
	onSelectConfig,
	onDeleteConfig,
	onRenameConfig,
	onUpsertConfig,
	pinnedApiConfigs = {},
	togglePinnedApiConfig,
}: ApiConfigManagerProps) => {
	const { t } = useAppTranslation()
	const { apiConfigCustomOrder: customOrder = [] } = useExtensionState()

	const [isCreating, setIsCreating] = useState(false)
	const [newProfileName, setNewProfileName] = useState("")
	const [error, setError] = useState<string | null>(null)
	const [dragState, setDragState] = useState<DragState>({
		isDragging: false,
		draggedIndex: null,
		dragOverIndex: null,
	})
	const [focusedIndex, setFocusedIndex] = useState<number | null>(null)
	const [editingConfigName, setEditingConfigName] = useState<string | null>(null)
	const [editingValue, setEditingValue] = useState("")
	const [editingError, setEditingError] = useState<string | null>(null)
	const newProfileInputRef = useRef<any>(null)
	const editInputRefs = useRef<Record<string, any>>({})

	// Sort configs based on custom order
	const sortedConfigs = useMemo(() => {
		const sorted = [...listApiConfigMeta]

		if (customOrder && customOrder.length > 0) {
			// Sort by custom order, with unordered items at the end
			const orderMap = new Map(customOrder.map((id: string, index: number) => [id, index]))
			sorted.sort((a, b) => {
				const aIndex = orderMap.get(a.name) ?? Number.MAX_SAFE_INTEGER
				const bIndex = orderMap.get(b.name) ?? Number.MAX_SAFE_INTEGER
				return (aIndex as number) - (bIndex as number)
			})
		}

		return sorted
	}, [listApiConfigMeta, customOrder])

	// Get the original order for drag and drop operations
	const originalOrder = useMemo(() => {
		return listApiConfigMeta.map((config) => config.name)
	}, [listApiConfigMeta])

	// Separate pinned and unpinned configs
	const { pinnedConfigs, unpinnedConfigs } = useMemo(() => {
		const pinned = sortedConfigs.filter((config) => pinnedApiConfigs?.[config.name])
		const unpinned = sortedConfigs.filter((config) => !pinnedApiConfigs?.[config.name])
		return { pinnedConfigs: pinned, unpinnedConfigs: unpinned }
	}, [sortedConfigs, pinnedApiConfigs])

	// Check if a profile is valid based on the organization allow list
	const isProfileValid = useCallback(
		(profile: ProviderSettingsEntry): boolean => {
			// If no organization allow list or allowAll is true, all profiles are valid
			if (!organizationAllowList || organizationAllowList.allowAll) {
				return true
			}

			// Check if the provider is allowed
			const provider = profile.apiProvider
			if (!provider) return true

			const providerConfig = organizationAllowList.providers[provider]
			if (!providerConfig) {
				return false
			}

			// If provider allows all models, profile is valid
			return !!providerConfig.allowAll || !!(providerConfig.models && providerConfig.models.length > 0)
		},
		[organizationAllowList],
	)

	const validateName = useCallback(
		(name: string, isNewProfile: boolean): string | null => {
			const trimmed = name.trim()
			if (!trimmed) return t("settings:providers.nameEmpty")

			const nameExists = listApiConfigMeta?.some((config) => config.name.toLowerCase() === trimmed.toLowerCase())

			// For new profiles, any existing name is invalid.
			if (isNewProfile && nameExists) {
				return t("settings:providers.nameExists")
			}

			// For rename, only block if trying to rename to a different existing profile.
			if (!isNewProfile && nameExists && trimmed.toLowerCase() !== currentApiConfigName?.toLowerCase()) {
				return t("settings:providers.nameExists")
			}

			return null
		},
		[listApiConfigMeta, currentApiConfigName, t],
	)

	const resetCreateState = () => {
		setIsCreating(false)
		setNewProfileName("")
		setError(null)
	}

	const resetEditState = () => {
		setEditingConfigName(null)
		setEditingValue("")
		setEditingError(null)
	}

	// Focus input when entering edit mode for a specific config
	useEffect(() => {
		if (editingConfigName && editInputRefs.current[editingConfigName]) {
			const timeoutId = setTimeout(() => editInputRefs.current[editingConfigName]?.focus(), 0)
			return () => clearTimeout(timeoutId)
		}
	}, [editingConfigName])

	// Focus input when opening new dialog.
	useEffect(() => {
		if (isCreating) {
			const timeoutId = setTimeout(() => newProfileInputRef.current?.focus(), 0)
			return () => clearTimeout(timeoutId)
		}
	}, [isCreating])

	// Effect to manage focus when in reorder mode
	useEffect(() => {
		if (focusedIndex !== null) {
			// Find the element at the focused index and focus it
			const element = document.querySelector(`[data-config-item-index="${focusedIndex}"]`) as HTMLElement
			if (element) {
				element.focus()
			}
		}
	}, [focusedIndex])

	// Reset state when current profile changes.
	useEffect(() => {
		resetCreateState()
		resetEditState()
	}, [currentApiConfigName])

	const handleSelectConfig = useCallback(
		(configName: string) => {
			if (!configName) return
			onSelectConfig(configName)
		},
		[onSelectConfig],
	)

	const moveItem = useCallback(
		(fromIndex: number, toIndex: number) => {
			if (fromIndex === toIndex) return

			// We need to work with the current customOrder, or the original order if no custom order exists
			// This ensures we always work with the order that the backend knows about
			const currentOrder = customOrder.length > 0 ? customOrder : originalOrder

			const newOrder = [...currentOrder]
			const [movedItemId] = newOrder.splice(fromIndex, 1)
			newOrder.splice(toIndex, 0, movedItemId)

			// Only update through VSCode message - this should update persistedCustomOrder
			vscode.postMessage({
				type: "setApiConfigCustomOrder",
				values: { customOrder: newOrder },
			})
		},
		[customOrder, originalOrder],
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

		setDragState((prev) => {
			// Only update if the dragOverIndex actually changed
			if (prev.dragOverIndex !== index) {
				return {
					...prev,
					dragOverIndex: index,
				}
			}
			return prev
		})
	}, [])

	// Convert display index to sortedConfigs index considering pinned/unpinned separation
	const getFilteredIndex = useCallback(
		(displayIndex: number) => {
			if (displayIndex < pinnedConfigs.length) {
				// Item is in pinned section - find its index in sortedConfigs
				const pinnedConfig = pinnedConfigs[displayIndex]
				return sortedConfigs.findIndex((config) => config.name === pinnedConfig.name)
			} else {
				// Item is in unpinned section - find its index in sortedConfigs
				const unpinnedIndex = displayIndex - pinnedConfigs.length
				const unpinnedConfig = unpinnedConfigs[unpinnedIndex]
				return sortedConfigs.findIndex((config) => config.name === unpinnedConfig.name)
			}
		},
		[pinnedConfigs, unpinnedConfigs, sortedConfigs],
	)

	const handleDragEnd = useCallback(() => {
		const { draggedIndex, dragOverIndex } = dragState

		if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
			// Get the current order (same logic as moveItem)
			const currentOrder = customOrder.length > 0 ? customOrder : originalOrder

			// Get the current sorted configs (we need to access this at drag end time)
			const currentSortedConfigs = [...listApiConfigMeta]
			if (customOrder && customOrder.length > 0) {
				const orderMap = new Map(customOrder.map((id: string, index: number) => [id, index]))
				currentSortedConfigs.sort((a, b) => {
					const aIndex = orderMap.get(a.name) ?? Number.MAX_SAFE_INTEGER
					const bIndex = orderMap.get(b.name) ?? Number.MAX_SAFE_INTEGER
					return (aIndex as number) - (bIndex as number)
				})
			}

			// Get the config IDs from display indices
			const draggedConfigId = currentSortedConfigs[getFilteredIndex(draggedIndex)].name
			const dragOverConfigId = currentSortedConfigs[getFilteredIndex(dragOverIndex)].name

			// Find their positions in the current order
			const draggedCurrentOrderIndex = currentOrder.indexOf(draggedConfigId)
			const dragOverCurrentOrderIndex = currentOrder.indexOf(dragOverConfigId)

			// Only proceed if both items are found in the current order
			if (draggedCurrentOrderIndex !== -1 && dragOverCurrentOrderIndex !== -1) {
				moveItem(draggedCurrentOrderIndex, dragOverCurrentOrderIndex)
			}
		}

		setDragState({
			isDragging: false,
			draggedIndex: null,
			dragOverIndex: null,
		})
	}, [dragState, moveItem, getFilteredIndex, customOrder, originalOrder, listApiConfigMeta])

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent, displayIndex: number) => {
			// Get the current sorted configs to find the config at this display index
			const currentSortedConfigs = [...listApiConfigMeta]
			if (customOrder && customOrder.length > 0) {
				const orderMap = new Map(customOrder.map((id: string, index: number) => [id, index]))
				currentSortedConfigs.sort((a, b) => {
					const aIndex = orderMap.get(a.name) ?? Number.MAX_SAFE_INTEGER
					const bIndex = orderMap.get(b.name) ?? Number.MAX_SAFE_INTEGER
					return (aIndex as number) - (bIndex as number)
				})
			}

			// Separate pinned and unpinned configs
			const currentPinnedConfigs = currentSortedConfigs.filter((config) => pinnedApiConfigs?.[config.name])
			const currentUnpinnedConfigs = currentSortedConfigs.filter((config) => !pinnedApiConfigs?.[config.name])
			const allConfigs = [...currentPinnedConfigs, ...currentUnpinnedConfigs]

			const currentConfig = allConfigs[displayIndex]
			if (!currentConfig) return

			const totalItems = allConfigs.length

			if (e.altKey || e.metaKey) {
				// Alt/Option + arrow keys for reordering
				const configId = currentConfig.name

				if (e.key === "ArrowUp") {
					e.preventDefault()
					// Optimistically update the UI first
					const currentOrder = customOrder.length > 0 ? customOrder : originalOrder
					const configOrderIndex = currentOrder.indexOf(configId)

					if (configOrderIndex > 0) {
						// Create new order by swapping with previous item
						const newOrder = [...currentOrder]
						;[newOrder[configOrderIndex - 1], newOrder[configOrderIndex]] = [
							newOrder[configOrderIndex],
							newOrder[configOrderIndex - 1],
						]

						// Sync with backend
						vscode.postMessage({
							type: "setApiConfigCustomOrder",
							values: { customOrder: newOrder },
						})
					}
				} else if (e.key === "ArrowDown") {
					e.preventDefault()
					// Optimistically update the UI first
					const currentOrder = customOrder.length > 0 ? customOrder : originalOrder
					const configOrderIndex = currentOrder.indexOf(configId)

					if (configOrderIndex < currentOrder.length - 1) {
						// Create new order by swapping with next item
						const newOrder = [...currentOrder]
						;[newOrder[configOrderIndex], newOrder[configOrderIndex + 1]] = [
							newOrder[configOrderIndex + 1],
							newOrder[configOrderIndex],
						]

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
				} else if (e.key === "ArrowDown" && displayIndex < totalItems - 1) {
					e.preventDefault()
					setFocusedIndex(displayIndex + 1)
				} else if (e.key === "Enter" || e.key === " ") {
					e.preventDefault()
					handleSelectConfig(currentConfig.name)
				} else if (e.key === "Tab") {
					e.preventDefault()
					// Handle tab navigation manually
					if (e.shiftKey && displayIndex > 0) {
						setFocusedIndex(displayIndex - 1)
					} else if (!e.shiftKey && displayIndex < totalItems - 1) {
						setFocusedIndex(displayIndex + 1)
					}
				}
			}
		},
		[listApiConfigMeta, customOrder, pinnedApiConfigs, originalOrder, handleSelectConfig],
	)

	const handleAdd = () => {
		resetCreateState()
		setIsCreating(true)
	}

	const handleStartEdit = useCallback((configName: string) => {
		setEditingConfigName(configName)
		setEditingValue(configName)
		setEditingError(null)
	}, [])

	const handleCancelEdit = useCallback(() => {
		resetEditState()
	}, [])

	const handleSaveEdit = useCallback(
		(configName: string) => {
			const trimmedValue = editingValue.trim()
			const error = validateName(trimmedValue, false)

			if (error) {
				setEditingError(error)
				return
			}

			if (configName === trimmedValue) {
				resetEditState()
				return
			}

			// Update custom order to preserve position when renaming
			if (customOrder.length > 0) {
				const currentOrder = [...customOrder]
				const oldNameIndex = currentOrder.indexOf(configName)
				if (oldNameIndex !== -1) {
					currentOrder[oldNameIndex] = trimmedValue
					vscode.postMessage({
						type: "setApiConfigCustomOrder",
						values: { customOrder: currentOrder },
					})
				}
			}

			onRenameConfig(configName, trimmedValue)
			resetEditState()
		},
		[editingValue, validateName, customOrder, onRenameConfig],
	)

	const handleDelete = useCallback(
		(configName: string) => {
			if (!configName || !listApiConfigMeta || listApiConfigMeta.length <= 1) return
			onDeleteConfig(configName)
		},
		[listApiConfigMeta, onDeleteConfig],
	)

	const renderConfigItem = useCallback(
		(config: ProviderSettingsEntry, isPinned: boolean, index: number) => {
			const isCurrentConfig = config.name === currentApiConfigName
			const isDraggedOver = dragState.dragOverIndex === index
			const isDragged = dragState.draggedIndex === index
			const isFocused = focusedIndex === index
			const isValid = isProfileValid(config)
			const isEditing = editingConfigName === config.name
			const isOnlyProfile = listApiConfigMeta?.length === 1

			if (isEditing) {
				return (
					<div
						key={config.name}
						data-testid="rename-form"
						className="pl-3 pr-2 py-0.5 text-sm flex items-center border rounded-md border-vscode-focusBorder">
						{/* Always show drag handle */}
						<div
							className="mr-2 flex items-center justify-center size-4 text-vscode-descriptionForeground cursor-grab hover:cursor-grabbing"
							draggable
							onDragStart={(e) => {
								e.stopPropagation()
								handleDragStart(e, index)
							}}
							onDragEnd={handleDragEnd}
							onClick={(e) => e.stopPropagation()}>
							<GripVertical className="size-3" />
						</div>

						<VSCodeTextField
							ref={(el) => {
								if (el) editInputRefs.current[config.name] = el
							}}
							value={editingValue}
							onInput={(e: unknown) => {
								const target = e as { target: { value: string } }
								setEditingValue(target.target.value)
								setEditingError(null)
							}}
							placeholder={t("settings:providers.enterNewName")}
							onKeyDown={({ key }) => {
								if (key === "Enter" && editingValue.trim()) {
									handleSaveEdit(config.name)
								} else if (key === "Escape") {
									handleCancelEdit()
								}
							}}
							className="flex-1 mr-2"
						/>

						<StandardTooltip content={t("settings:common.save")}>
							<Button
								variant="ghost"
								size="icon"
								disabled={!editingValue.trim()}
								data-testid="save-rename-button"
								onClick={() => handleSaveEdit(config.name)}>
								<span className="codicon codicon-check" />
							</Button>
						</StandardTooltip>

						<StandardTooltip content={t("settings:common.cancel")}>
							<Button
								variant="ghost"
								size="icon"
								data-testid="cancel-rename-button"
								onClick={handleCancelEdit}>
								<span className="codicon codicon-close" />
							</Button>
						</StandardTooltip>

						{editingError && (
							<div className="text-vscode-errorForeground text-sm" data-testid="error-message">
								{editingError}
							</div>
						)}
					</div>
				)
			}

			return (
				<div
					key={config.name}
					data-config-item
					data-config-item-index={index}
					role="option"
					aria-selected={isCurrentConfig}
					aria-label={`${config.name}${config.modelId ? ` - ${config.modelId}` : ""}`}
					onDragOver={(e) => handleDragOver(e, index)}
					onClick={() => handleSelectConfig(config.name)}
					onKeyDown={(e) => {
						handleKeyDown(e, index)
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault()
							handleSelectConfig(config.name)
						}
					}}
					tabIndex={isFocused ? 0 : -1}
					className={cn(
						"px-3 py-2 text-sm flex items-center group relative border rounded-md",
						"cursor-pointer hover:bg-vscode-list-hoverBackground",
						isCurrentConfig &&
							"bg-vscode-list-activeSelectionBackground text-vscode-list-activeSelectionForeground border-vscode-focusBorder",
						!isCurrentConfig && "border-vscode-dropdown-border",
						isDragged && "opacity-50",
						isDraggedOver && "border-t-2 border-vscode-focusBorder",
						isFocused && "ring-1 ring-vscode-focusBorder",
						!isValid && "opacity-60",
					)}>
					<div
						className="mr-2 flex items-center justify-center size-4 text-vscode-descriptionForeground cursor-grab hover:cursor-grabbing"
						draggable
						onDragStart={(e) => {
							e.stopPropagation()
							handleDragStart(e, index)
						}}
						onDragEnd={handleDragEnd}
						onClick={(e) => e.stopPropagation()}>
						<GripVertical className="size-3" />
					</div>

					<div className="flex-1 min-w-0 flex items-center gap-2 overflow-hidden">
						{!isValid && (
							<StandardTooltip content={t("settings:validation.profileInvalid")}>
								<AlertTriangle size={16} className="text-vscode-errorForeground flex-shrink-0" />
							</StandardTooltip>
						)}
						<span className="flex-shrink-0 font-medium">{config.name}</span>
						{config.modelId && (
							<span
								className="text-vscode-descriptionForeground opacity-70 min-w-0 ml-auto overflow-hidden"
								style={{ direction: "rtl", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
								{config.modelId}
							</span>
						)}
					</div>

					<div
						className={cn(
							"absolute right-0 top-0 bottom-0 rounded-r-md flex items-center gap-1 bg-gradient-to-r from-transparent from-5% to-35% to-vscode-sideBar-background pr-2 pl-8",
							"opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150",
						)}>
						{/* Edit button - visible on hover */}
						<StandardTooltip content={t("settings:providers.renameProfile")}>
							<Button
								variant="ghost"
								size="icon"
								tabIndex={-1}
								aria-label={t("settings:providers.renameProfile")}
								data-testid={
									isCurrentConfig ? "rename-profile-button" : `rename-profile-button-${config.name}`
								}
								onClick={(e) => {
									e.stopPropagation()
									handleStartEdit(config.name)
								}}
								className="size-5 flex items-center justify-center">
								<Edit className="size-3" />
							</Button>
						</StandardTooltip>

						{/* Delete button - visible on hover */}
						<StandardTooltip
							content={
								isOnlyProfile
									? t("settings:providers.cannotDeleteOnlyProfile")
									: t("settings:providers.deleteProfile")
							}>
							<Button
								variant="ghost"
								size="icon"
								tabIndex={-1}
								aria-label={t("settings:providers.deleteProfile")}
								disabled={isOnlyProfile}
								data-testid={
									isCurrentConfig ? "delete-profile-button" : `delete-profile-button-${config.name}`
								}
								onClick={(e) => {
									e.stopPropagation()
									handleDelete(config.name)
								}}
								className="size-5 flex items-center justify-center">
								<Trash2 className="size-3 text-destructive" />
							</Button>
						</StandardTooltip>

						{togglePinnedApiConfig && (
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
										togglePinnedApiConfig(config.name)
										vscode.postMessage({ type: "toggleApiConfigPin", text: config.name })
									}}
									className={cn("size-5 flex items-center justify-center", {
										"opacity-0": !isPinned && !isCurrentConfig,
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
			currentApiConfigName,
			handleSelectConfig,
			togglePinnedApiConfig,
			dragState,
			handleDragStart,
			handleDragOver,
			handleDragEnd,
			t,
			focusedIndex,
			handleKeyDown,
			isProfileValid,
			editingConfigName,
			editingValue,
			editingError,
			handleStartEdit,
			handleSaveEdit,
			handleCancelEdit,
			handleDelete,
			listApiConfigMeta,
		],
	)

	const handleNewProfileSave = useCallback(() => {
		const trimmedValue = newProfileName.trim()
		const error = validateName(trimmedValue, true)

		if (error) {
			setError(error)
			return
		}

		onUpsertConfig(trimmedValue)
		resetCreateState()
	}, [newProfileName, validateName, onUpsertConfig])

	return (
		<div className="flex flex-col gap-1">
			<div className="flex justify-between items-center">
				<label className="block font-medium mb-1">{t("settings:providers.configProfile")}</label>
				{/* Action buttons - only add button */}
				<div className="flex items-center gap-1 mb-3">
					<StandardTooltip content={t("settings:providers.addProfile")}>
						<Button variant="ghost" size="icon" onClick={handleAdd} data-testid="add-profile-button">
							<span className="codicon codicon-add" />
						</Button>
					</StandardTooltip>
				</div>
			</div>
			{/* Config list */}
			<div
				className="flex flex-col gap-2 max-h-[240px] overflow-y-auto overflow-x-hidden"
				role="listbox"
				aria-label={t("settings:providers.configProfile")}>
				{sortedConfigs.length === 0 ? (
					<div className="py-4 px-3 text-sm text-vscode-foreground/70 text-center border border-vscode-dropdown-border rounded-md">
						{t("settings:providers.noConfigs")}
					</div>
				) : (
					<>
						{/* Pinned configs */}
						{pinnedConfigs.map((config, index) => renderConfigItem(config, true, index))}

						{/* Separator between pinned and unpinned */}
						{pinnedConfigs.length > 0 && unpinnedConfigs.length > 0 && (
							<div className="mx-1 my-1 h-px bg-vscode-dropdown-foreground/10" />
						)}

						{/* Unpinned configs */}
						{unpinnedConfigs.map((config, index) =>
							renderConfigItem(config, false, pinnedConfigs.length + index),
						)}
					</>
				)}
			</div>

			{/* Help text */}
			<div className="text-vscode-descriptionForeground text-sm mt-2">
				{t("chat:apiConfigSelector.dragToReorder")}
			</div>

			{/* Error display for inline editing */}
			{editingError && <div className="text-vscode-errorForeground text-sm mt-1">{editingError}</div>}

			<Dialog
				open={isCreating}
				onOpenChange={(open: boolean) => {
					if (open) {
						setIsCreating(true)
						setNewProfileName("")
						setError(null)
					} else {
						resetCreateState()
					}
				}}
				aria-labelledby="new-profile-title">
				<DialogContent className="p-4 max-w-sm bg-card">
					<DialogTitle>{t("settings:providers.newProfile")}</DialogTitle>
					<Input
						ref={newProfileInputRef}
						value={newProfileName}
						onInput={(e: unknown) => {
							const target = e as { target: { value: string } }
							setNewProfileName(target.target.value)
							setError(null)
						}}
						placeholder={t("settings:providers.enterProfileName")}
						data-testid="new-profile-input"
						style={{ width: "100%" }}
						onKeyDown={(e: unknown) => {
							const event = e as { key: string }
							if (event.key === "Enter" && newProfileName.trim()) {
								handleNewProfileSave()
							} else if (event.key === "Escape") {
								resetCreateState()
							}
						}}
					/>
					{error && (
						<p className="text-vscode-errorForeground text-sm mt-2" data-testid="error-message">
							{error}
						</p>
					)}
					<div className="flex justify-end gap-2 mt-4">
						<Button variant="secondary" onClick={resetCreateState} data-testid="cancel-new-profile-button">
							{t("settings:common.cancel")}
						</Button>
						<Button
							variant="default"
							disabled={!newProfileName.trim()}
							onClick={handleNewProfileSave}
							data-testid="create-profile-button">
							{t("settings:providers.createProfile")}
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	)
}

export default memo(ApiConfigManager)
