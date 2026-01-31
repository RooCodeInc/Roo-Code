import React, { useState } from "react"
import { ChevronDown, ChevronRight, GripVertical, Copy, Trash2, FileText } from "lucide-react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

import type { HookWithMetadata } from "@roo-code/types"

import { cn } from "@/lib/utils"
import { Button, ToggleSwitch } from "@/components/ui"

import { HookConfigTab } from "./HookConfigTab"
import { HookCommandTab } from "./HookCommandTab"
import { HookLogsTab } from "./HookLogsTab"

interface HookItemProps {
	hook: HookWithMetadata
	onChange: (updates: Partial<HookWithMetadata>) => void
	onToggleEnabled: () => void
	onDelete: () => void
	onCopy: () => void
	onOpenFolder: () => void
	disabled?: boolean
}

type TabId = "config" | "command" | "logs"

/**
 * Individual hook accordion item.
 * Shows header with drag handle, hook info, and action icons.
 * Expandable content with Config, Command, and Logs tabs.
 */
export const HookItem: React.FC<HookItemProps> = ({
	hook,
	onChange,
	onToggleEnabled,
	onDelete,
	onCopy,
	onOpenFolder,
	disabled = false,
}) => {
	const [isExpanded, setIsExpanded] = useState(false)
	const [activeTab, setActiveTab] = useState<TabId>("config")

	// Setup sortable functionality
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: hook.id,
	})

	// Apply transform and transition styles for drag animation
	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	}

	// Get matcher badges for display
	const getMatcherBadges = (): string[] => {
		if (!hook.matchers) return []

		if ("tools" in hook.matchers && hook.matchers.tools) {
			return hook.matchers.tools
		}

		if ("sessionType" in hook.matchers && hook.matchers.sessionType) {
			return hook.matchers.sessionType
		}

		return []
	}

	const matcherBadges = getMatcherBadges()

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={cn(
				"border border-vscode-panel-border rounded-md mb-2 overflow-hidden",
				!hook.enabled && "opacity-60",
				isDragging && "opacity-50 shadow-lg ring-2 ring-vscode-focusBorder",
			)}>
			{/* Header */}
			<div
				className={cn(
					"flex items-center gap-2 px-3 py-2 bg-vscode-editor-background cursor-pointer hover:bg-vscode-list-hoverBackground",
					isExpanded && "border-b border-vscode-panel-border",
				)}
				onClick={() => setIsExpanded(!isExpanded)}>
				{/* Drag handle - connected to sortable listeners */}
				<div
					className={cn(
						"text-vscode-descriptionForeground cursor-grab active:cursor-grabbing",
						isDragging && "cursor-grabbing",
					)}
					title="Drag to reorder"
					{...attributes}
					{...listeners}
					onClick={(e) => e.stopPropagation()}>
					<GripVertical className="w-4 h-4" />
				</div>
				{/* Expand/collapse indicator */}
				{isExpanded ? (
					<ChevronDown className="w-4 h-4 text-vscode-foreground" />
				) : (
					<ChevronRight className="w-4 h-4 text-vscode-foreground" />
				)}
				{/* Hook name */}
				<span className="font-mono text-sm text-vscode-foreground">{hook.name}</span>
				{/* Matcher badges */}
				{matcherBadges.length > 0 && (
					<div className="flex gap-1">
						<span className="text-xs bg-vscode-badge-background text-vscode-badge-foreground px-1.5 py-0.5 rounded">
							{matcherBadges.join("|")}
						</span>
					</div>
				)}
				{/* Source badge */}
				<span className="text-xs bg-vscode-badge-background text-vscode-badge-foreground px-1.5 py-0.5 rounded ml-auto">
					{hook.source}
				</span>
				<div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
					<Button
						variant="ghost"
						size="icon"
						className="w-6 h-6 opacity-60 hover:opacity-100"
						onClick={onDelete}
						title="Delete hook">
						<Trash2 className="w-3.5 h-3.5" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						className="w-6 h-6 opacity-60 hover:opacity-100"
						onClick={onCopy}
						title="Copy hook">
						<Copy className="w-3.5 h-3.5" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						className="w-6 h-6 opacity-60 hover:opacity-100"
						onClick={onOpenFolder}
						title="Open in editor">
						<FileText className="w-3.5 h-3.5" />
					</Button>

					{/* Status indicator */}
					<div
						style={{
							width: "8px",
							height: "8px",
							borderRadius: "50%",
							background: hook.enabled
								? "var(--vscode-testing-iconPassed)"
								: "var(--vscode-descriptionForeground)",
							marginLeft: "4px",
						}}
						title={hook.enabled ? "Enabled" : "Disabled"}
					/>

					{/* Enable toggle */}
					<ToggleSwitch
						checked={hook.enabled}
						onChange={onToggleEnabled}
						disabled={disabled}
						size="medium"
						aria-label={`Toggle ${hook.id} hook`}
					/>
				</div>
			</div>

			{/* Expandable content */}
			{isExpanded && (
				<div className="bg-vscode-editor-background">
					{/* Tabs */}
					<div className="flex border-b border-vscode-panel-border">
						{(["config", "command", "logs"] as TabId[]).map((tab) => (
							<button
								key={tab}
								onClick={() => setActiveTab(tab)}
								className={cn(
									"px-4 py-2 text-sm capitalize",
									activeTab === tab
										? "text-vscode-foreground border-b-2 border-vscode-focusBorder"
										: "text-vscode-descriptionForeground hover:text-vscode-foreground",
								)}>
								{tab}
							</button>
						))}
					</div>

					{/* Tab content */}
					<div className="p-4">
						{activeTab === "config" && (
							<HookConfigTab hook={hook} onChange={onChange} disabled={disabled} />
						)}
						{activeTab === "command" && (
							<HookCommandTab hook={hook} onChange={onChange} disabled={disabled} />
						)}
						{activeTab === "logs" && <HookLogsTab hookId={hook.id} />}
					</div>
				</div>
			)}
		</div>
	)
}
