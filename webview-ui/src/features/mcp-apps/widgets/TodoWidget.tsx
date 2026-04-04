import React, { useState, useEffect } from "react"
import { ClineAskUseMcpServer, ModeConfig } from "@jabberwock/types"
import { useExtensionState } from "../../../context/ExtensionStateContext"
import {
	VSCodeButton,
	VSCodeCheckbox,
	VSCodeDropdown,
	VSCodeOption,
	VSCodeTextField,
	VSCodeTextArea,
} from "@vscode/webview-ui-toolkit/react"
import {
	DndContext,
	closestCenter,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
	DragEndEvent,
} from "@dnd-kit/core"
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	verticalListSortingStrategy,
	useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

interface TaskItem {
	id: string
	title: string
	description?: string
	assignedTo?: string
	isAsync?: boolean
	status?: "pending" | "in_progress" | "completed"
}

interface TodoItemProps {
	task: TaskItem
	modes: ModeConfig[]
	onUpdate: (id: string, updates: Partial<TaskItem>) => void
}

const SortableTodoItem = ({ task, modes, onUpdate }: TodoItemProps) => {
	const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id })
	const [expanded, setExpanded] = useState(false)
	const [editing, setEditing] = useState(false)

	const style = { transform: CSS.Transform.toString(transform), transition }

	return (
		<div
			ref={setNodeRef}
			style={style}
			className="bg-vscode-editor-background border border-vscode-border rounded mb-2">
			<div className="flex items-center p-2">
				<div {...attributes} {...listeners} className="cursor-grab mr-2 codicon codicon-gripper" />
				<div
					className="cursor-pointer mr-2 codicon codicon-chevron-right"
					onClick={() => setExpanded(!expanded)}
					style={{ transform: expanded ? "rotate(90deg)" : "none" }}
				/>

				<div className="flex-1 flex items-center">
					{editing ? (
						<VSCodeTextField
							value={task.title}
							onInput={(e: any) => onUpdate(task.id, { title: e.target.value })}
							className="flex-1"
						/>
					) : (
						<span className="flex-1 font-semibold">{task.title}</span>
					)}
					<div className="cursor-pointer ml-2 codicon codicon-edit" onClick={() => setEditing(!editing)} />
				</div>
			</div>

			{expanded && (
				<div className="p-2 border-t border-vscode-border bg-vscode-editor-inactiveSelectionBackground">
					<VSCodeTextArea
						value={task.description || ""}
						onInput={(e: any) => onUpdate(task.id, { description: e.target.value })}
						className="w-full mb-2"
						rows={3}
						placeholder="Task description/instructions..."
					/>
					<div className="flex items-center gap-4">
						<div className="flex items-center gap-2">
							<label>Agent:</label>
							<VSCodeDropdown
								value={task.assignedTo || ""}
								onChange={(e: any) => onUpdate(task.id, { assignedTo: e.target.value })}>
								<VSCodeOption value="">Auto-select</VSCodeOption>
								{modes.map((mode) => (
									<VSCodeOption key={mode.slug} value={mode.slug}>
										{mode.name}
									</VSCodeOption>
								))}
							</VSCodeDropdown>
						</div>
						<VSCodeCheckbox
							checked={task.isAsync || false}
							onChange={(e: any) => onUpdate(task.id, { isAsync: e.target.checked })}>
							Run in background (Parallel)
						</VSCodeCheckbox>
					</div>
				</div>
			)}
		</div>
	)
}

interface TodoWidgetProps {
	useMcpServer: ClineAskUseMcpServer
	allowedContext: string[]
	onAccept: (content: Record<string, unknown>) => void
}

export const TodoWidget = ({ useMcpServer, onAccept }: TodoWidgetProps) => {
	const { customModes } = useExtensionState()
	const [tasks, setTasks] = useState<TaskItem[]>([])

	useEffect(() => {
		try {
			const args = JSON.parse(useMcpServer.arguments || "{}") as { tasks?: TaskItem[] }
			if (args.tasks && Array.isArray(args.tasks)) {
				setTasks(args.tasks)
			}
		} catch {
			// ignore
		}
	}, [useMcpServer])

	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	)

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event
		if (over && active.id !== over.id) {
			setTasks((items) => {
				const oldIndex = items.findIndex((i) => i.id === active.id)
				const newIndex = items.findIndex((i) => i.id === over.id)
				return arrayMove(items, oldIndex, newIndex)
			})
		}
	}

	const handleUpdate = (id: string, updates: Partial<TaskItem>) => {
		setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)))
	}

	const handleSubmit = () => {
		const resultArgs = JSON.parse(useMcpServer.arguments || "{}") as Record<string, unknown>
		resultArgs.tasks = tasks
		onAccept({ action: "accept", arguments: resultArgs })
	}

	const availableModes = customModes && customModes.length > 0 ? customModes : []

	return (
		<div className="todo-widget flex flex-col gap-2">
			<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
				<SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
					{tasks.map((task) => (
						<SortableTodoItem key={task.id} task={task} modes={availableModes} onUpdate={handleUpdate} />
					))}
				</SortableContext>
			</DndContext>
			<VSCodeButton appearance="primary" onClick={handleSubmit} className="mt-2">
				Approve & Execute Plan
			</VSCodeButton>
		</div>
	)
}
