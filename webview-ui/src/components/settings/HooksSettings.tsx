import React, { useState, useCallback } from "react"
import { Plus, FolderOpen, RefreshCw, GripVertical, Link2, AlertCircle, Loader2 } from "lucide-react"
import { DndContext, DragOverlay, closestCenter } from "@dnd-kit/core"

import { hookEventTypes, type HookEventType, type HookWithMetadata } from "@roo-code/types"

import { vscode } from "@/utils/vscode"
import { Button, Checkbox } from "@/components/ui"

import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { SearchableSetting } from "./SearchableSetting"
import { HookEventGroup } from "./HooksSettings/HookEventGroup"
import { CreateHookDialog } from "./HooksSettings/CreateHookDialog"
import { DeleteHookDialog } from "./HooksSettings/DeleteHookDialog"
import { useHooks } from "./HooksSettings/hooks/useHooks"
import { useHookDragDrop } from "./HooksSettings/hooks/useHookDragDrop"

/**
 * Compute initial expanded groups based on which event types have hooks.
 */
function getInitialExpandedGroups(hooks: HookWithMetadata[]): Set<HookEventType> {
	const expanded = new Set<HookEventType>()
	for (const hook of hooks) {
		expanded.add(hook.eventType)
	}
	return expanded
}

/**
 * Main Hooks Settings component.
 *
 * Features:
 * - Header section with title "Hooks" and description
 * - Global "Enable Hooks" toggle checkbox
 * - All 11 event type groups using HookEventGroup
 * - Footer with action buttons
 * - Create and Delete dialogs
 */
export const HooksSettings: React.FC = () => {
	const {
		hooks,
		isLoading,
		error,
		hooksEnabled,
		setHooksEnabled,
		getHooksByEventType,
		updateHook,
		toggleHookEnabled,
		deleteHook,
		createHook,
		getAllHookIds,
		reloadHooks,
		openGlobalFolder,
		openProjectFolder,
		moveHook,
		reorderHooks,
	} = useHooks()

	// Track which event type groups are expanded
	// Initialize based on which event types have hooks
	const [expandedGroups, setExpandedGroups] = useState<Set<HookEventType>>(() => getInitialExpandedGroups(hooks))

	// Expand a specific event group (used after drag-drop moves)
	const expandGroup = useCallback((eventType: HookEventType) => {
		setExpandedGroups((prev) => new Set([...prev, eventType]))
	}, [])

	// Handle open/close changes for a specific event group
	const handleGroupOpenChange = useCallback((eventType: HookEventType, open: boolean) => {
		setExpandedGroups((prev) => {
			const next = new Set(prev)
			if (open) {
				next.add(eventType)
			} else {
				next.delete(eventType)
			}
			return next
		})
	}, [])

	const { sensors, dragState, handleDragStart, handleDragOver, handleDragEnd, handleDragCancel } = useHookDragDrop({
		hooks,
		moveHook,
		reorderHooks,
		getHooksByEventType,
		onMoveComplete: expandGroup,
	})

	// Dialog state
	const [showCreateDialog, setShowCreateDialog] = useState(false)
	const [showDeleteDialog, setShowDeleteDialog] = useState(false)
	const [createForEventType, setCreateForEventType] = useState<HookEventType | undefined>(undefined)
	const [hookToDelete, setHookToDelete] = useState<HookWithMetadata | null>(null)

	// Handler for adding hook from event group "+ Add" button
	const handleAddHook = useCallback((eventType: HookEventType) => {
		setCreateForEventType(eventType)
		setShowCreateDialog(true)
	}, [])

	// Handler for creating a new hook from footer button
	const handleCreateNewHook = useCallback(() => {
		setCreateForEventType(undefined)
		setShowCreateDialog(true)
	}, [])

	// Handler for hook creation
	const handleHookCreate = useCallback(
		(hook: HookWithMetadata) => {
			createHook(hook.eventType, hook, hook.source)
		},
		[createHook],
	)

	// Handler for delete button click
	const handleDeleteClick = useCallback(
		(hookId: string, _eventType: HookEventType) => {
			const hook = hooks.find((h) => h.id === hookId)
			if (hook) {
				setHookToDelete(hook)
				setShowDeleteDialog(true)
			}
		},
		[hooks],
	)

	// Handler for confirming delete
	const handleDeleteConfirm = useCallback(() => {
		if (hookToDelete) {
			deleteHook(hookToDelete.id, hookToDelete.eventType)
			setShowDeleteDialog(false)
			setHookToDelete(null)
		}
	}, [hookToDelete, deleteHook])

	// Handler for duplicating a hook
	const handleCopyHook = useCallback(
		(hookId: string) => {
			const hook = hooks.find((h) => h.id === hookId)
			if (hook) {
				// Generate a 10-character random hash
				const randomHash = Math.random().toString(36).substring(2, 12)
				const newId = `${hook.id}-${randomHash}`

				// Create duplicated hook (starts disabled for safety)
				const duplicatedHook: HookWithMetadata = {
					id: newId,
					name: hook.name,
					enabled: false, // Duplicated hooks start disabled
					action: hook.action,
					matchers: hook.matchers,
					eventType: hook.eventType,
					source: hook.source,
				}

				// Add the duplicated hook under the same event type
				createHook(hook.eventType, duplicatedHook, hook.source)
				console.log(`[HooksSettings] Duplicated hook ${hookId} as ${newId}`)
			}
		},
		[hooks, createHook],
	)

	// Handler for opening hook file and scrolling to the hook definition
	const handleOpenHookFolder = useCallback((hookId: string) => {
		vscode.postMessage({ type: "hooks/openFile", hookId })
	}, [])

	return (
		<DndContext
			sensors={sensors}
			collisionDetection={closestCenter}
			onDragStart={handleDragStart}
			onDragOver={handleDragOver}
			onDragEnd={handleDragEnd}
			onDragCancel={handleDragCancel}>
			<div>
				<SectionHeader description="Hooks execute custom shell commands automatically when Roo uses specific tools. Use them to integrate with external systems, enforce workflows, or automate repetitive tasks.">
					Hooks
				</SectionHeader>

				<Section>
					{/* Global Enable Toggle */}
					<SearchableSetting settingId="hooks-enable" section="hooks" label="Enable Hooks" className="mb-4">
						<div className="flex items-center gap-2">
							<Checkbox
								id="hooks-enable-checkbox"
								checked={hooksEnabled}
								onCheckedChange={(checked) => setHooksEnabled(checked === true)}
							/>
							<label
								htmlFor="hooks-enable-checkbox"
								className="text-sm font-medium text-vscode-foreground cursor-pointer">
								Enable Hooks
							</label>
						</div>
						<p className="text-xs text-vscode-descriptionForeground mt-1 ml-6">
							Toggle all hooks on or off at once
						</p>
					</SearchableSetting>

					{/* Loading State */}
					{isLoading && (
						<div className="flex items-center justify-center py-8">
							<Loader2 className="w-6 h-6 animate-spin text-vscode-textLink-foreground" />
							<span className="ml-2 text-sm text-vscode-descriptionForeground">Loading hooks...</span>
						</div>
					)}

					{/* Error State */}
					{error && !isLoading && (
						<div className="bg-vscode-inputValidation-errorBackground border border-vscode-inputValidation-errorBorder rounded-md p-4 mb-4">
							<div className="flex items-start gap-2">
								<AlertCircle className="w-4 h-4 text-vscode-errorForeground mt-0.5 flex-shrink-0" />
								<div className="text-sm">
									<p className="font-medium text-vscode-errorForeground mb-1">Failed to load hooks</p>
									<p className="text-vscode-descriptionForeground">{error}</p>
									<Button variant="ghost" size="sm" onClick={reloadHooks} className="mt-2">
										<RefreshCw className="w-3 h-3 mr-1" />
										Try Again
									</Button>
								</div>
							</div>
						</div>
					)}

					{/* Event Type Groups */}
					{!isLoading && !error && (
						<SearchableSetting settingId="hooks-groups" section="hooks" label="Hook Event Groups">
							<div className="space-y-2">
								{hookEventTypes.map((eventType) => (
									<HookEventGroup
										key={eventType}
										eventType={eventType}
										hooks={getHooksByEventType(eventType)}
										onUpdateHook={updateHook}
										onToggleHookEnabled={toggleHookEnabled}
										onDeleteHook={(hookId) => handleDeleteClick(hookId, eventType)}
										onCopyHook={handleCopyHook}
										onOpenHookFolder={handleOpenHookFolder}
										onAddHook={() => handleAddHook(eventType)}
										disabled={!hooksEnabled}
										isDragging={dragState.activeId !== null}
										isOpen={expandedGroups.has(eventType)}
										onOpenChange={(open) => handleGroupOpenChange(eventType, open)}
									/>
								))}
							</div>
						</SearchableSetting>
					)}

					{/* Footer Buttons */}
					<SearchableSetting settingId="hooks-actions" section="hooks" label="Hook Actions" className="mt-6">
						<div className="flex flex-wrap gap-2">
							<Button
								variant="secondary"
								onClick={handleCreateNewHook}
								disabled={!hooksEnabled || isLoading}>
								<Plus className="w-4 h-4 mr-1" />
								Create New Hook
							</Button>
							<Button variant="ghost" onClick={openGlobalFolder}>
								<FolderOpen className="w-4 h-4 mr-1" />
								Open Global Folder
							</Button>
							<Button variant="ghost" onClick={openProjectFolder}>
								<FolderOpen className="w-4 h-4 mr-1" />
								Open Project Folder
							</Button>
							<Button variant="ghost" onClick={reloadHooks} disabled={isLoading}>
								{isLoading ? (
									<Loader2 className="w-4 h-4 mr-1 animate-spin" />
								) : (
									<RefreshCw className="w-4 h-4 mr-1" />
								)}
								{isLoading ? "Loading..." : "Reload"}
							</Button>
						</div>
					</SearchableSetting>
				</Section>

				{/* Drag Overlay - Shows preview of dragged hook */}
				<DragOverlay>
					{dragState.activeHook && (
						<div className="bg-vscode-editor-background border border-vscode-focusBorder rounded-md p-3 shadow-lg opacity-90">
							<div className="flex items-center gap-2">
								<GripVertical className="w-4 h-4 text-vscode-descriptionForeground" />
								<Link2 className="w-4 h-4 text-vscode-descriptionForeground" />
								<span className="font-mono text-sm text-vscode-foreground">
									{dragState.activeHook.id}
								</span>
								<span className="text-xs text-vscode-descriptionForeground ml-auto">
									{dragState.activeHook.source}
								</span>
							</div>
						</div>
					)}
				</DragOverlay>

				{/* Create Hook Dialog */}
				<CreateHookDialog
					open={showCreateDialog}
					onOpenChange={setShowCreateDialog}
					preSelectedEventType={createForEventType}
					existingHookIds={getAllHookIds()}
					onCreate={handleHookCreate}
				/>

				{/* Delete Hook Dialog */}
				<DeleteHookDialog
					open={showDeleteDialog}
					onOpenChange={setShowDeleteDialog}
					hookToDelete={hookToDelete}
					onConfirm={handleDeleteConfirm}
				/>
			</div>
		</DndContext>
	)
}
