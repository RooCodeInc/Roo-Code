import React, { useState, useMemo } from "react"
import type { HistoryItem } from "@roo-code/types"
import { formatTimeAgo } from "@src/utils/format"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
	Button,
	Checkbox,
} from "@src/components/ui"

interface MemoryChatPickerProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	taskHistory: HistoryItem[]
	onStartSync: (taskIds: string[]) => void
}

export const MemoryChatPicker: React.FC<MemoryChatPickerProps> = ({
	open,
	onOpenChange,
	taskHistory,
	onStartSync,
}) => {
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

	const allSelected = useMemo(
		() => taskHistory.length > 0 && selectedIds.size === taskHistory.length,
		[taskHistory.length, selectedIds.size],
	)

	const toggleAll = () => {
		if (allSelected) {
			setSelectedIds(new Set())
		} else {
			setSelectedIds(new Set(taskHistory.map((t) => t.id)))
		}
	}

	const toggleOne = (id: string) => {
		setSelectedIds((prev) => {
			const next = new Set(prev)
			if (next.has(id)) {
				next.delete(id)
			} else {
				next.add(id)
			}
			return next
		})
	}

	const handleLearn = () => {
		onStartSync(Array.from(selectedIds))
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent style={{ maxWidth: "520px", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
				<DialogHeader>
					<DialogTitle>Browse Chats</DialogTitle>
					<DialogDescription>Select conversations to analyze for building your profile.</DialogDescription>
				</DialogHeader>

				<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
					<button
						onClick={toggleAll}
						style={{
							background: "none",
							border: "none",
							color: "var(--vscode-textLink-foreground)",
							cursor: "pointer",
							fontSize: "12px",
							padding: 0,
						}}>
						{allSelected ? "Deselect All" : "Select All"}
					</button>
					<span style={{ fontSize: "12px", opacity: 0.7 }}>
						{selectedIds.size} of {taskHistory.length} selected
					</span>
				</div>

				<div style={{ flex: 1, overflowY: "auto", minHeight: 0, maxHeight: "400px" }}>
					{taskHistory.map((item) => (
						<div
							key={item.id}
							style={{
								display: "flex",
								alignItems: "flex-start",
								gap: "8px",
								padding: "8px 4px",
								borderBottom: "1px solid var(--vscode-input-border)",
								cursor: "pointer",
							}}
							onClick={() => toggleOne(item.id)}>
							<Checkbox
								checked={selectedIds.has(item.id)}
								onCheckedChange={() => toggleOne(item.id)}
								style={{ marginTop: "2px" }}
							/>
							<div style={{ flex: 1, minWidth: 0 }}>
								<div
									style={{
										fontSize: "12px",
										overflow: "hidden",
										textOverflow: "ellipsis",
										whiteSpace: "nowrap",
									}}>
									{item.task || "(no message)"}
								</div>
								<div style={{ fontSize: "11px", opacity: 0.5 }}>{formatTimeAgo(item.ts)}</div>
							</div>
						</div>
					))}
					{taskHistory.length === 0 && (
						<p style={{ fontSize: "12px", opacity: 0.5, textAlign: "center", padding: "24px 0" }}>
							No conversations found.
						</p>
					)}
				</div>

				<DialogFooter>
					<Button variant="secondary" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={handleLearn} disabled={selectedIds.size === 0}>
						Learn
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
