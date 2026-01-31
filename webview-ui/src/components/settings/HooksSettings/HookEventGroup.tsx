import React from "react"
import { ChevronDown, ChevronRight, Plus } from "lucide-react"
import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"

import { hookEventDescriptions, type HookEventType, type HookWithMetadata } from "@roo-code/types"

import { cn } from "@/lib/utils"
import { Button, Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui"

import { HookItem } from "./HookItem"

interface HookEventGroupProps {
	eventType: HookEventType
	hooks: HookWithMetadata[]
	onUpdateHook: (hookId: string, updates: Partial<HookWithMetadata>) => void
	onToggleHookEnabled: (hookId: string) => void
	onDeleteHook: (hookId: string) => void
	onCopyHook: (hookId: string) => void
	onOpenHookFolder: (hookId: string) => void
	onAddHook: () => void
	disabled?: boolean
	/** Whether any hook is currently being dragged (for visual feedback) */
	isDragging?: boolean
	/** Controlled open state - whether the group is expanded */
	isOpen: boolean
	/** Callback when open state changes */
	onOpenChange: (open: boolean) => void
}

/**
 * Collapsible group for each event type.
 * Shows event type name and description.
 * "[+ Add]" button in header.
 * List of HookItem components for hooks in this group.
 * Header acts as drop zone for drag-and-drop (works even when collapsed).
 */
export const HookEventGroup: React.FC<HookEventGroupProps> = ({
	eventType,
	hooks,
	onUpdateHook,
	onToggleHookEnabled,
	onDeleteHook,
	onCopyHook,
	onOpenHookFolder,
	onAddHook,
	disabled = false,
	isDragging = false,
	isOpen,
	onOpenChange,
}) => {
	// Make this group a drop zone for cross-container dragging
	const { setNodeRef, isOver } = useDroppable({
		id: eventType,
	})

	// Get hook IDs for SortableContext
	const hookIds = hooks.map((hook) => hook.id)

	const description = hookEventDescriptions[eventType]

	return (
		<Collapsible open={isOpen} onOpenChange={onOpenChange} className="mb-3">
			{/* Header - acts as drop zone for cross-container dragging */}
			<div
				ref={setNodeRef}
				className={cn(
					"flex items-center gap-2 border rounded-md p-3 bg-vscode-editor-background transition-all",
					// Default state (not dragging)
					!isDragging && "border-vscode-panel-border hover:bg-vscode-list-hoverBackground",
					// When any drag is active: show subtle indicator that this is a valid drop target
					isDragging && !isOver && "border-dashed border-vscode-focusBorder/50 bg-vscode-editor-background",
					// When hovering over this header: show strong highlight
					isOver &&
						"border-solid border-vscode-focusBorder bg-vscode-list-hoverBackground ring-2 ring-vscode-focusBorder/30",
				)}>
				<CollapsibleTrigger className="flex items-center gap-2 flex-1 cursor-pointer">
					{isOpen ? (
						<ChevronDown className="w-4 h-4 text-vscode-foreground" />
					) : (
						<ChevronRight className="w-4 h-4 text-vscode-foreground" />
					)}
					<div className="flex flex-col items-start">
						<span className="font-medium text-vscode-foreground">{eventType}</span>
						<span className="text-xs text-vscode-descriptionForeground">{description}</span>
					</div>
				</CollapsibleTrigger>

				{/* Hook count badge */}
				{hooks.length > 0 && (
					<span className="text-xs bg-vscode-badge-background text-vscode-badge-foreground px-2 py-0.5 rounded-full">
						{hooks.length}
					</span>
				)}

				{/* Add button */}
				<Button
					variant="secondary"
					className="py-1 hover:brightness-75"
					onClick={(e) => {
						e.stopPropagation()
						onAddHook()
					}}
					disabled={disabled}>
					<Plus className="w-4 h-4 mr-1" />
					Add
				</Button>
			</div>

			{/* Content */}
			<CollapsibleContent>
				<div className="pl-6 pt-2">
					{/* Sortable hook items */}
					<SortableContext items={hookIds} strategy={verticalListSortingStrategy}>
						{hooks.map((hook) => (
							<HookItem
								key={hook.id}
								hook={hook}
								onChange={(updates) => onUpdateHook(hook.id, updates)}
								onToggleEnabled={() => onToggleHookEnabled(hook.id)}
								onDelete={() => onDeleteHook(hook.id)}
								onCopy={() => onCopyHook(hook.id)}
								onOpenFolder={() => onOpenHookFolder(hook.id)}
								disabled={disabled}
							/>
						))}
					</SortableContext>
				</div>
			</CollapsibleContent>
		</Collapsible>
	)
}
