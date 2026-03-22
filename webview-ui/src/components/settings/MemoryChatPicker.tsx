import React, { useState, useCallback, useMemo } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { formatTimeAgo } from "@/utils/format"

interface MemoryChatPickerProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	taskHistory: Array<{ id: string; task: string; ts: number }>
	onStartSync: (taskIds: string[]) => void
	isSyncing: boolean
}

const MemoryChatPicker: React.FC<MemoryChatPickerProps> = ({
	open,
	onOpenChange,
	taskHistory,
	onStartSync,
	isSyncing,
}) => {
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

	const allSelected = taskHistory.length > 0 && selectedIds.size === taskHistory.length

	const toggleItem = useCallback((id: string, checked: boolean) => {
		setSelectedIds((prev) => {
			const next = new Set(prev)
			checked ? next.add(id) : next.delete(id)
			return next
		})
	}, [])

	const toggleAll = useCallback(
		(checked: boolean) => {
			setSelectedIds(checked ? new Set(taskHistory.map((t) => t.id)) : new Set())
		},
		[taskHistory],
	)

	const handleLearn = useCallback(() => {
		if (selectedIds.size === 0) return
		onStartSync(Array.from(selectedIds))
	}, [selectedIds, onStartSync])

	const handleOpenChange = useCallback(
		(nextOpen: boolean) => {
			if (!nextOpen) {
				setSelectedIds(new Set())
			}
			onOpenChange(nextOpen)
		},
		[onOpenChange],
	)

	const sortedHistory = useMemo(
		() => [...taskHistory].sort((a, b) => b.ts - a.ts),
		[taskHistory],
	)

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-[500px] flex flex-col gap-0 p-0">
				<DialogHeader className="px-6 pt-6 pb-0">
					<DialogTitle>Select Chats to Analyze</DialogTitle>
				</DialogHeader>

				{/* Select All bar */}
				<div
					className="flex items-center gap-3 px-6 py-3 border-b"
					style={{ borderColor: "var(--vscode-panel-border)" }}>
					<Checkbox
						checked={allSelected}
						onCheckedChange={(checked) => toggleAll(checked === true)}
						variant="description"
					/>
					<span className="text-sm text-vscode-foreground">
						{allSelected ? "Deselect All" : "Select All"}
					</span>
					<span className="ml-auto text-xs text-vscode-descriptionForeground">
						{selectedIds.size} of {taskHistory.length} selected
					</span>
				</div>

				{/* Scrollable chat list */}
				<div
					className="overflow-y-auto px-2"
					style={{
						maxHeight: "400px",
						backgroundColor: "var(--vscode-input-background)",
					}}>
					{sortedHistory.length === 0 ? (
						<div className="flex items-center justify-center py-8 text-sm text-vscode-descriptionForeground">
							No chat history available
						</div>
					) : (
						sortedHistory.map((chat) => {
							const isChecked = selectedIds.has(chat.id)
							return (
								<label
									key={chat.id}
									className="flex items-start gap-3 px-4 py-2.5 cursor-pointer rounded-md hover:bg-vscode-list-hoverBackground transition-colors"
									style={{ opacity: isSyncing ? 0.6 : 1 }}>
									<Checkbox
										checked={isChecked}
										onCheckedChange={(checked) => toggleItem(chat.id, checked === true)}
										disabled={isSyncing}
										className="mt-0.5"
									/>
									<div className="flex flex-col gap-0.5 min-w-0">
										<span className="text-sm text-vscode-foreground truncate">
											{chat.task || "Untitled chat"}
										</span>
										<span className="text-xs text-vscode-descriptionForeground">
											{formatTimeAgo(chat.ts)}
										</span>
									</div>
								</label>
							)
						})
					)}
				</div>

				{/* Footer */}
				<DialogFooter className="px-6 py-4 border-t" style={{ borderColor: "var(--vscode-panel-border)" }}>
					<Button variant="secondary" onClick={() => handleOpenChange(false)} disabled={isSyncing}>
						Cancel
					</Button>
					<Button
						variant="primary"
						onClick={handleLearn}
						disabled={isSyncing || selectedIds.size === 0}>
						{isSyncing ? "Learning…" : "Learn"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

export default MemoryChatPicker
