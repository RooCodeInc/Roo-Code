import { memo, useEffect, useRef, useState, useMemo, useCallback } from "react"

import type { ProviderSettingsEntry, OrganizationAllowList } from "@roo-code/types"

import { useAppTranslation } from "@/i18n/TranslationContext"
import { Button, Input, Dialog, DialogContent, DialogTitle, StandardTooltip } from "@/components/ui"
import { vscode } from "@/utils/vscode"
import { useExtensionState } from "@/context/ExtensionStateContext"
import ConfigListItem from "./ConfigListItem"

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
}

const ApiConfigManager = ({
	currentApiConfigName = "",
	listApiConfigMeta = [],
	organizationAllowList,
	onSelectConfig,
	onDeleteConfig,
	onRenameConfig,
	onUpsertConfig,
}: ApiConfigManagerProps) => {
	const { t } = useAppTranslation()
	const { apiConfigsCustomOrder: customOrder = [] } = useExtensionState()

	const [isCreating, setIsCreating] = useState(false)
	const [newProfileName, setNewProfileName] = useState("")
	const [error, setError] = useState<string | null>(null)
	const [dragState, setDragState] = useState<DragState>({
		isDragging: false,
		draggedIndex: null,
		dragOverIndex: null,
	})
	const [focusedIndex, setFocusedIndex] = useState<number | null>(null)
	// Always allow reordering in Settings per design feedback
	const isReorderingMode = true
	const newProfileInputRef = useRef<any>(null)

	const isOnlyProfile = listApiConfigMeta?.length === 1

	// Sort configs based on custom order
	const sortedConfigs = useMemo(() => {
		if (!customOrder || customOrder.length === 0) {
			return listApiConfigMeta
		}

		const orderMap = new Map(customOrder.map((item) => [item.id, item.index]))

		const sorted = [...listApiConfigMeta]
		sorted.sort((a, b) => {
			const aIndex = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER
			const bIndex = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER
			return (aIndex as number) - (bIndex as number)
		})

		return sorted
	}, [listApiConfigMeta, customOrder])

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

			if (fromIndex < 0 || fromIndex >= sortedConfigs.length || toIndex < 0 || toIndex >= sortedConfigs.length)
				return

			// Create a reordered array of configs
			const reorderedConfigs = [...sortedConfigs]
			const [movedItem] = reorderedConfigs.splice(fromIndex, 1)
			reorderedConfigs.splice(toIndex, 0, movedItem)

			// Create new order array with updated indices, preserving pinned status
			const newOrder = reorderedConfigs.map((config, index) => {
				const existingOrderItem = customOrder.find((item) => item.id === config.id)
				return {
					id: config.id,
					index,
					pinned: existingOrderItem?.pinned ?? false,
				}
			})

			vscode.postMessage({
				type: "setApiConfigsCustomOrder",
				values: { customOrder: newOrder },
			})
		},
		[sortedConfigs, customOrder],
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

	// Use sorted configs as display configs
	const displayConfigs = sortedConfigs

	const handleDragEnd = useCallback(() => {
		const { draggedIndex, dragOverIndex } = dragState

		if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
			moveItem(draggedIndex, dragOverIndex)
		}

		setDragState({
			isDragging: false,
			draggedIndex: null,
			dragOverIndex: null,
		})
	}, [dragState, moveItem])

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent, displayIndex: number) => {
			const currentConfig = displayConfigs[displayIndex]
			if (!currentConfig) return

			const totalItems = displayConfigs.length

			if (e.altKey || e.metaKey) {
				// Alt/Option + arrow keys for reordering
				if (e.key === "ArrowUp" && displayIndex > 0) {
					e.preventDefault()
					moveItem(displayIndex, displayIndex - 1)
				} else if (e.key === "ArrowDown" && displayIndex < totalItems - 1) {
					e.preventDefault()
					moveItem(displayIndex, displayIndex + 1)
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
		[displayConfigs, moveItem, handleSelectConfig],
	)

	const handleAdd = () => {
		resetCreateState()
		setIsCreating(true)
	}

	// Removed explicit toggle; reordering is always enabled

	const handleRename = useCallback(
		(oldName: string, newName: string) => {
			// No need to update custom order since ID doesn't change when renaming
			onRenameConfig(oldName, newName)
		},
		[onRenameConfig],
	)

	const handleDelete = useCallback(
		(configName: string) => {
			if (!configName || !listApiConfigMeta || listApiConfigMeta.length <= 1) return
			onDeleteConfig(configName)
		},
		[listApiConfigMeta, onDeleteConfig],
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
				{/* Action buttons */}
				<div className="flex items-center gap-1 mb-3">
					<StandardTooltip content="Reset to Alphabetical">
						<Button
							variant="ghost"
							size="icon"
							onClick={() =>
								vscode.postMessage({
									type: "setApiConfigsCustomOrder",
									values: { customOrder: [] },
								})
							}
							data-testid="reset-to-alphabetical-button">
							<span className="codicon codicon-discard" />
						</Button>
					</StandardTooltip>
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
				{displayConfigs.length === 0 ? (
					<div className="py-4 px-3 text-sm text-vscode-foreground/70 text-center border border-vscode-dropdown-border rounded-md">
						{t("settings:providers.noConfigs")}
					</div>
				) : (
					displayConfigs.map((config, index) => (
						<ConfigListItem
							key={config.id}
							config={config}
							index={index}
							isCurrentConfig={config.name === currentApiConfigName}
							dragState={dragState}
							isFocused={focusedIndex === index}
							isValid={isProfileValid(config)}
							isOnlyProfile={isOnlyProfile}
							isReorderingMode={isReorderingMode}
							validateName={validateName}
							onDragStart={handleDragStart}
							onDragEnd={handleDragEnd}
							onDragOver={handleDragOver}
							onSelectConfig={handleSelectConfig}
							onKeyDown={handleKeyDown}
							onRename={handleRename}
							onDelete={handleDelete}
						/>
					))
				)}
			</div>

			{/* Help text */}
			<div className="text-vscode-descriptionForeground text-sm mt-2">
				{t("settings:providers.reorderModeHelpText")}
			</div>

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
