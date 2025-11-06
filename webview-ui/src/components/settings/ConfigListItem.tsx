import { memo, useEffect, useRef, useState, useCallback } from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { AlertTriangle, GripVertical, Edit, Trash2 } from "lucide-react"

import type { ProviderSettingsEntry } from "@roo-code/types"

import { useAppTranslation } from "@/i18n/TranslationContext"
import { Button, StandardTooltip } from "@/components/ui"
import { cn } from "@/lib/utils"

interface DragState {
	isDragging: boolean
	draggedIndex: number | null
	dragOverIndex: number | null
}

interface ConfigListItemProps {
	config: ProviderSettingsEntry
	index: number
	isCurrentConfig: boolean
	dragState: DragState
	isFocused: boolean
	isValid: boolean
	isOnlyProfile: boolean
	isReorderingMode: boolean
	validateName: (name: string, isNewProfile: boolean) => string | null
	onDragStart: (event: React.DragEvent, index: number) => void
	onDragEnd: () => void
	onDragOver: (event: React.DragEvent, index: number) => void
	onSelectConfig: (configName: string) => void
	onKeyDown: (event: React.KeyboardEvent, displayIndex: number) => void
	onRename: (oldName: string, newName: string) => void
	onDelete: (configName: string) => void
}

const ConfigListItem = memo(function ConfigListItemComponent({
	config,
	index,
	isCurrentConfig,
	dragState,
	isFocused,
	isValid,
	isOnlyProfile,
	isReorderingMode,
	validateName,
	onDragStart,
	onDragEnd,
	onDragOver,
	onSelectConfig,
	onKeyDown,
	onRename,
	onDelete,
}: ConfigListItemProps) {
	const { t } = useAppTranslation()
	const [isEditing, setIsEditing] = useState(false)
	const [editingValue, setEditingValue] = useState("")
	const [editingError, setEditingError] = useState<string | null>(null)
	const editInputRef = useRef<any>(null)

	const isDraggedOver = dragState.dragOverIndex === index
	const isDragged = dragState.draggedIndex === index

	// Focus input when entering edit mode
	useEffect(() => {
		if (isEditing && editInputRef.current) {
			const timeoutId = setTimeout(() => editInputRef.current?.focus(), 0)
			return () => clearTimeout(timeoutId)
		}
	}, [isEditing])

	const handleStartEdit = useCallback(() => {
		setIsEditing(true)
		setEditingValue(config.name)
		setEditingError(null)
	}, [config.name])

	const handleCancelEdit = useCallback(() => {
		setIsEditing(false)
		setEditingValue("")
		setEditingError(null)
	}, [])

	const handleSaveEdit = useCallback(() => {
		const trimmedValue = editingValue.trim()
		// Pass false for isNewProfile since this is a rename operation
		const error = validateName(trimmedValue, false)

		if (error) {
			setEditingError(error)
			return
		}

		if (config.name === trimmedValue) {
			handleCancelEdit()
			return
		}

		onRename(config.name, trimmedValue)
		handleCancelEdit()
	}, [editingValue, validateName, config.name, onRename, handleCancelEdit])

	const handleInputChange = useCallback((e: unknown) => {
		const target = e as { target: { value: string } }
		setEditingValue(target.target.value)
		setEditingError(null)
	}, [])

	const handleInputKeyDown = useCallback(
		({ key }: { key: string }) => {
			if (key === "Enter" && editingValue.trim()) {
				handleSaveEdit()
			} else if (key === "Escape") {
				handleCancelEdit()
			}
		},
		[editingValue, handleSaveEdit, handleCancelEdit],
	)

	if (isEditing) {
		return (
			<div
				data-testid="rename-form"
				className="pl-3 pr-2 py-0.5 text-sm border rounded-md border-vscode-focusBorder bg-vscode-sidebar-background">
				<div className="flex items-center">
					<div className="mr-2 flex items-center justify-center size-4">
						{isReorderingMode ? (
							<div
								className="text-vscode-descriptionForeground cursor-grab hover:cursor-grabbing"
								draggable
								onDragStart={(e) => {
									e.stopPropagation()
									onDragStart(e, index)
								}}
								onDragEnd={onDragEnd}
								onClick={(e) => e.stopPropagation()}>
								<GripVertical className="size-3" />
							</div>
						) : (
							<div className="flex items-center justify-center size-4">
								{isCurrentConfig && (
									<span className="codicon codicon-check text-xs text-vscode-charts-green" />
								)}
							</div>
						)}
					</div>

					<VSCodeTextField
						ref={editInputRef}
						value={editingValue}
						onInput={handleInputChange}
						placeholder={t("settings:providers.enterNewName")}
						onKeyDown={handleInputKeyDown}
						className="flex-1 mr-2"
					/>

					<StandardTooltip content={t("settings:common.save")}>
						<Button
							variant="ghost"
							size="icon"
							disabled={!editingValue.trim()}
							data-testid="save-rename-button"
							onClick={handleSaveEdit}>
							<span className="codicon codicon-save" />
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
				</div>

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
			data-config-item
			data-config-item-index={index}
			role="option"
			aria-selected={isCurrentConfig}
			aria-label={`${config.name}${config.modelId ? ` - ${config.modelId}` : ""}`}
			onDragOver={isReorderingMode ? (e) => onDragOver(e, index) : undefined}
			onDrop={
				isReorderingMode
					? (e) => {
							e.preventDefault()
							onDragEnd()
						}
					: undefined
			}
			onClick={() => onSelectConfig(config.name)}
			onKeyDown={(e) => {
				onKeyDown(e, index)
				if (!isReorderingMode && (e.key === "Enter" || e.key === " ")) {
					e.preventDefault()
					e.stopPropagation()
					onSelectConfig(config.name)
				}
			}}
			tabIndex={isFocused ? 0 : -1}
			className={cn(
				"px-3 py-2 text-sm flex items-center group relative border rounded-md bg-vscode-sideBar-background",
				!isReorderingMode && "cursor-pointer hover:bg-vscode-list-hoverBackground",
				isReorderingMode && "cursor-move",
				isCurrentConfig &&
					"bg-vscode-list-activeSelectionBackground text-vscode-list-activeSelectionForeground border-vscode-focusBorder",
				!isCurrentConfig && "border-vscode-dropdown-border",
				isDragged && "opacity-50",
				isDraggedOver && "border-t-2 border-vscode-focusBorder",
				isFocused && "ring-1 ring-vscode-focusBorder",
				!isValid && "opacity-60",
			)}
			draggable={isReorderingMode}
			onDragStart={
				isReorderingMode
					? (e) => {
							e.stopPropagation()
							onDragStart(e, index)
						}
					: undefined
			}
			onDragEnd={isReorderingMode ? onDragEnd : undefined}>
			<div className="mr-2 flex items-center justify-center size-4">
				{isReorderingMode ? (
					<div className="text-vscode-descriptionForeground cursor-grab hover:cursor-grabbing">
						<GripVertical className="size-3" />
					</div>
				) : (
					<div className="flex items-center justify-center size-4">
						{isCurrentConfig && <span className="codicon codicon-check text-xs text-vscode-charts-green" />}
					</div>
				)}
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
					"absolute z-20 right-0 top-0 bottom-0 rounded-r-md flex items-center gap-1 bg-gradient-to-r from-transparent from-5% to-35% to-vscode-sideBar-background pr-2 pl-8",
					"opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150",
				)}>
				<StandardTooltip content={t("settings:providers.renameProfile")}>
					<Button
						variant="ghost"
						size="icon"
						tabIndex={-1}
						aria-label={t("settings:providers.renameProfile")}
						data-testid={isCurrentConfig ? "rename-profile-button" : `rename-profile-button-${config.name}`}
						onClick={(e) => {
							e.stopPropagation()
							handleStartEdit()
						}}
						className="size-5 flex items-center justify-center">
						<Edit className="size-3" />
					</Button>
				</StandardTooltip>

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
						data-testid={isCurrentConfig ? "delete-profile-button" : `delete-profile-button-${config.name}`}
						onClick={(e) => {
							e.stopPropagation()
							onDelete(config.name)
						}}
						className="size-5 flex items-center justify-center">
						<Trash2 className="size-3 text-destructive" />
					</Button>
				</StandardTooltip>
			</div>
		</div>
	)
})

export default ConfigListItem
