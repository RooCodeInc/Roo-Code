import { useState, useCallback, useRef, useEffect, memo } from "react"
import { useTranslation } from "react-i18next"

import { QueuedMessage } from "@roo-code/types"

import { Button } from "@src/components/ui"

import Thumbnails from "../common/Thumbnails"

import { Mention } from "./Mention"

interface QueuedMessagesProps {
	queue: QueuedMessage[]
	onRemove: (index: number) => void
	onUpdate: (index: number, newText: string) => void
}

// Memoize individual message component to prevent re-renders
const QueuedMessageItem = memo(
	({
		message,
		index,
		editState,
		onEdit,
		onSave,
		onRemove,
	}: {
		message: QueuedMessage
		index: number
		editState: { isEditing: boolean; value: string }
		onEdit: (messageId: string, isEditing: boolean, value?: string) => void
		onSave: (index: number, messageId: string, newValue: string) => void
		onRemove: (index: number) => void
	}) => {
		const { t } = useTranslation("chat")

		return (
			<div
				key={message.id}
				className="bg-vscode-editor-background border rounded-xs p-1 overflow-hidden whitespace-pre-wrap flex-shrink-0">
				<div className="flex justify-between">
					<div className="flex-grow px-2 py-1 wrap-anywhere">
						{editState.isEditing ? (
							<textarea
								ref={(textarea) => {
									if (textarea) {
										// Set cursor at the end
										textarea.setSelectionRange(textarea.value.length, textarea.value.length)
									}
								}}
								value={editState.value}
								onChange={(e) => onEdit(message.id, true, e.target.value)}
								onBlur={() => onSave(index, message.id, editState.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter" && !e.shiftKey) {
										e.preventDefault()
										onSave(index, message.id, editState.value)
									}
									if (e.key === "Escape") {
										onEdit(message.id, false, message.text)
									}
								}}
								className="w-full bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded px-2 py-1 resize-none focus:outline-0 focus:ring-1 focus:ring-vscode-focusBorder"
								placeholder={t("chat:editMessage.placeholder")}
								autoFocus
								rows={Math.min(editState.value.split("\n").length, 10)}
							/>
						) : (
							<div
								onClick={() => onEdit(message.id, true, message.text)}
								className="cursor-pointer hover:bg-vscode-list-hoverBackground px-1 py-0.5 -mx-1 -my-0.5 rounded transition-colors"
								title={t("chat:queuedMessages.clickToEdit")}>
								<Mention text={message.text} withShadow />
							</div>
						)}
					</div>
					<div className="flex">
						<Button
							variant="ghost"
							size="icon"
							className="shrink-0"
							onClick={(e) => {
								e.stopPropagation()
								onRemove(index)
							}}>
							<span className="codicon codicon-trash" />
						</Button>
					</div>
				</div>
				{message.images && message.images.length > 0 && (
					<Thumbnails images={message.images} style={{ marginTop: "8px" }} />
				)}
			</div>
		)
	},
)

QueuedMessageItem.displayName = "QueuedMessageItem"

export const QueuedMessages = memo(({ queue, onRemove, onUpdate }: QueuedMessagesProps) => {
	const { t } = useTranslation("chat")
	const [editingStates, setEditingStates] = useState<Record<string, { isEditing: boolean; value: string }>>({})

	// Use refs to debounce updates
	const updateTimerRef = useRef<NodeJS.Timeout | null>(null)
	const pendingUpdatesRef = useRef<Map<string, string>>(new Map())

	// Define all hooks before any conditional returns
	const getEditState = useCallback(
		(messageId: string, currentText: string) => {
			return editingStates[messageId] || { isEditing: false, value: currentText }
		},
		[editingStates],
	)

	const setEditState = useCallback((messageId: string, isEditing: boolean, value?: string) => {
		setEditingStates((prev) => ({
			...prev,
			[messageId]: { isEditing, value: value ?? prev[messageId]?.value ?? "" },
		}))
	}, [])

	// Debounced save function
	const handleSaveEdit = useCallback(
		(_index: number, messageId: string, newValue: string) => {
			// Add to pending updates
			pendingUpdatesRef.current.set(messageId, newValue)

			// Clear existing timer
			if (updateTimerRef.current) {
				clearTimeout(updateTimerRef.current)
			}

			// Set new timer to batch updates
			updateTimerRef.current = setTimeout(() => {
				// Process all pending updates
				pendingUpdatesRef.current.forEach((value, id) => {
					const messageIndex = queue.findIndex((m) => m.id === id)
					if (messageIndex !== -1) {
						onUpdate(messageIndex, value)
					}
				})
				pendingUpdatesRef.current.clear()
				updateTimerRef.current = null
			}, 300) // 300ms debounce delay

			setEditState(messageId, false)
		},
		[queue, onUpdate, setEditState],
	)

	// Cleanup timers on unmount
	useEffect(() => {
		return () => {
			if (updateTimerRef.current) {
				clearTimeout(updateTimerRef.current)
			}
		}
	}, [])

	// Early return after all hooks are defined
	if (queue.length === 0) {
		return null
	}

	return (
		<div className="px-[15px] py-[10px] pr-[6px]" data-testid="queued-messages">
			<div className="text-vscode-descriptionForeground text-md mb-2">{t("queuedMessages.title")}</div>
			<div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-2">
				{queue.map((message, index) => {
					const editState = getEditState(message.id, message.text)

					return (
						<QueuedMessageItem
							key={message.id}
							message={message}
							index={index}
							editState={editState}
							onEdit={setEditState}
							onSave={handleSaveEdit}
							onRemove={onRemove}
						/>
					)
				})}
			</div>
		</div>
	)
})

QueuedMessages.displayName = "QueuedMessages"
