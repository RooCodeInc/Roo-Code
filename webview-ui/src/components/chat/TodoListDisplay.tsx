import { cn } from "@/lib/utils"
import { t } from "i18next"
import { ArrowRight, Check, ListChecks, SquareDashed } from "lucide-react"
import { useState, useRef, useMemo, useEffect } from "react"

import { formatLargeNumber } from "@src/utils/format"

import type { SubtaskDetail } from "@src/types/subtasks"

type TodoStatus = "completed" | "in_progress" | "pending"

interface TodoItem {
	// Legacy fields
	id?: string
	content: string
	status?: TodoStatus | string | null

	// Direct-linking/cost fields (optional for backward compatibility)
	subtaskId?: string
	tokens?: number
	cost?: number
	added?: number
	removed?: number
}

function getTodoIcon(status: TodoStatus | null) {
	switch (status) {
		case "completed":
			return <Check className={`size-3 mt-1 shrink-0`} />
		case "in_progress":
			return <ArrowRight className="size-3 mt-1 shrink-0" />
		default:
			return <SquareDashed className="size-3 mt-1 shrink-0" />
	}
}

export interface TodoListDisplayProps {
	todos: TodoItem[]
	subtaskDetails?: SubtaskDetail[]
	onSubtaskClick?: (subtaskId: string) => void
}

export function TodoListDisplay({ todos, subtaskDetails, onSubtaskClick }: TodoListDisplayProps) {
	useEffect(() => {
		console.log("[TODO-DEBUG]", "TodoListDisplay props received", {
			todosCount: Array.isArray(todos) ? todos.length : 0,
			todoSubtaskIds: Array.isArray(todos) ? todos.map((t) => t?.subtaskId).filter(Boolean) : [],
			subtaskDetailsCount: Array.isArray(subtaskDetails) ? subtaskDetails.length : 0,
			subtaskDetailsIds: Array.isArray(subtaskDetails) ? subtaskDetails.map((s) => s?.id).filter(Boolean) : [],
			hasOnSubtaskClick: Boolean(onSubtaskClick),
		})
	}, [todos, subtaskDetails, onSubtaskClick])

	const [isCollapsed, setIsCollapsed] = useState(true)
	const ulRef = useRef<HTMLUListElement>(null)
	const itemRefs = useRef<(HTMLLIElement | null)[]>([])
	const scrollIndex = useMemo(() => {
		const inProgressIdx = todos.findIndex((todo) => todo.status === "in_progress")
		if (inProgressIdx !== -1) return inProgressIdx
		return todos.findIndex((todo) => todo.status !== "completed")
	}, [todos])

	// Find the most important todo to display when collapsed
	const mostImportantTodo = useMemo(() => {
		const inProgress = todos.find((todo) => todo.status === "in_progress")
		if (inProgress) return inProgress
		return todos.find((todo) => todo.status !== "completed")
	}, [todos])
	useEffect(() => {
		if (isCollapsed) return
		if (!ulRef.current) return
		if (scrollIndex === -1) return
		const target = itemRefs.current[scrollIndex]
		if (target && ulRef.current) {
			const ul = ulRef.current
			const targetTop = target.offsetTop - ul.offsetTop
			const targetHeight = target.offsetHeight
			const ulHeight = ul.clientHeight
			const scrollTo = targetTop - (ulHeight / 2 - targetHeight / 2)
			ul.scrollTop = scrollTo
		}
	}, [todos, isCollapsed, scrollIndex])
	if (!Array.isArray(todos) || todos.length === 0) return null

	const totalCount = todos.length
	const completedCount = todos.filter((todo) => todo.status === "completed").length

	const allCompleted = completedCount === totalCount && totalCount > 0

	return (
		<div data-todo-list className="mt-1 -mx-2.5 border-t border-vscode-sideBar-background overflow-hidden">
			<div
				className={cn(
					"flex items-center gap-2 pt-2 px-2.5 cursor-pointer select-none",
					mostImportantTodo?.status === "in_progress" && isCollapsed
						? "text-vscode-charts-yellow"
						: "text-vscode-foreground",
				)}
				onClick={() => setIsCollapsed((v: boolean) => !v)}>
				<ListChecks className="size-3 shrink-0" />
				<span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
					{isCollapsed
						? allCompleted
							? t("chat:todo.complete", { total: completedCount })
							: mostImportantTodo?.content // show current todo while not done
						: t("chat:todo.partial", { completed: completedCount, total: totalCount })}
				</span>
				{isCollapsed && completedCount < totalCount && (
					<div className="shrink-0 text-vscode-descriptionForeground text-xs">
						{completedCount}/{totalCount}
					</div>
				)}
			</div>
			{/* Inline expanded list */}
			{!isCollapsed && (
				<ul ref={ulRef} className="list-none max-h-[300px] overflow-y-auto mt-2 -mb-1 pb-0 px-2 cursor-default">
					{todos.map((todo, idx: number) => {
						const todoStatus = (todo.status as TodoStatus) ?? "pending"
						const icon = getTodoIcon(todoStatus)
						const isClickable = Boolean(todo.subtaskId && onSubtaskClick)
						console.log("[TODO-DEBUG]", "TodoListDisplay subtask match start", {
							todoIndex: idx,
							todoId: todo.id,
							todoContent: todo.content,
							todoSubtaskId: todo.subtaskId,
							availableSubtaskDetailIds: Array.isArray(subtaskDetails)
								? subtaskDetails.map((s) => s?.id).filter(Boolean)
								: [],
						})
						const subtaskById =
							subtaskDetails && todo.subtaskId
								? subtaskDetails.find((s) => s.id === todo.subtaskId)
								: undefined
						console.log("[TODO-DEBUG]", "TodoListDisplay subtask match result", {
							todoIndex: idx,
							todoSubtaskId: todo.subtaskId,
							matched: Boolean(subtaskById),
							matchedSubtaskId: subtaskById?.id,
						})
						const displayTokens = todo.tokens ?? subtaskById?.tokens
						const displayCost = todo.cost ?? subtaskById?.cost
						const shouldShowCost = typeof displayTokens === "number" && typeof displayCost === "number"

						const todoAddedIsFinite = typeof todo.added === "number" && Number.isFinite(todo.added)
						const todoRemovedIsFinite = typeof todo.removed === "number" && Number.isFinite(todo.removed)

						const displayAdded = todoAddedIsFinite ? todo.added : subtaskById?.added
						const displayRemoved = todoRemovedIsFinite ? todo.removed : subtaskById?.removed

						const displayAddedIsFinite = typeof displayAdded === "number" && Number.isFinite(displayAdded)
						const displayRemovedIsFinite =
							typeof displayRemoved === "number" && Number.isFinite(displayRemoved)
						const hasValidSubtaskLink = typeof todo.subtaskId === "string" && todo.subtaskId.length > 0

						// Upstream aggregation may coerce missing stats to 0.
						// To avoid showing misleading `+0/−0` for in-progress/pending rows,
						// only render 0 while running if it was explicitly provided on the todo itself.
						const canRenderAdded =
							displayAddedIsFinite &&
							(todoStatus === "completed" || displayAdded !== 0 || todoAddedIsFinite)
						const canRenderRemoved =
							displayRemovedIsFinite &&
							(todoStatus === "completed" || displayRemoved !== 0 || todoRemovedIsFinite)

						const shouldShowLineChanges = hasValidSubtaskLink && (canRenderAdded || canRenderRemoved)

						console.log("[TODO-DEBUG]", "TodoListDisplay metadata computed", {
							todoIndex: idx,
							todoSubtaskId: todo.subtaskId,
							fromTodo: {
								tokens: todo.tokens,
								cost: todo.cost,
								added: todo.added,
								removed: todo.removed,
							},
							fromSubtaskDetails: subtaskById
								? {
										tokens: subtaskById.tokens,
										cost: subtaskById.cost,
										added: subtaskById.added,
										removed: subtaskById.removed,
									}
								: undefined,
							display: {
								displayTokens,
								displayCost,
								displayAdded,
								displayRemoved,
							},
							shouldShowCost,
							shouldShowLineChanges,
						})

						const isAddedPositive = canRenderAdded && (displayAdded as number) > 0
						const isRemovedPositive = canRenderRemoved && (displayRemoved as number) > 0
						const isAddedZero = canRenderAdded && displayAdded === 0
						const isRemovedZero = canRenderRemoved && displayRemoved === 0

						return (
							<li
								key={todo.id || todo.content}
								ref={(el) => (itemRefs.current[idx] = el)}
								className={cn(
									"font-light flex flex-row gap-2 items-start min-h-[20px] leading-normal mb-2",
									todoStatus === "in_progress" && "text-vscode-charts-yellow",
									todoStatus !== "in_progress" && todoStatus !== "completed" && "opacity-60",
								)}>
								{icon}
								<span
									className={cn("flex-1", isClickable && "cursor-pointer hover:underline")}
									onClick={
										isClickable ? () => onSubtaskClick?.(todo.subtaskId as string) : undefined
									}>
									{todo.content}
								</span>
								{/* Token count and cost display */}
								{(shouldShowCost || shouldShowLineChanges) && (
									<span className="flex items-center gap-2 text-xs text-vscode-descriptionForeground shrink-0">
										{shouldShowCost && (
											<>
												<span className="tabular-nums opacity-70">
													{formatLargeNumber(displayTokens)}
												</span>
												<span className="tabular-nums min-w-[45px] text-right">
													${displayCost.toFixed(2)}
												</span>
											</>
										)}
										{shouldShowLineChanges && (
											<span className="tabular-nums ml-2 min-w-[60px] grid grid-cols-2 items-center justify-end">
												<span
													className={cn(
														" text-right",
														isAddedPositive ? "font-medium text-vscode-charts-green" : "",
														isAddedZero ? "opacity-50" : "",
													)}>
													{canRenderAdded ? `+${displayAdded}` : "\u00A0"}
												</span>
												<span
													className={cn(
														" text-right",
														isRemovedPositive ? "font-medium text-vscode-charts-red" : "",
														isRemovedZero ? "opacity-50" : "",
													)}>
													{canRenderRemoved ? `−${displayRemoved}` : "\u00A0"}
												</span>
											</span>
										)}
									</span>
								)}
							</li>
						)
					})}
				</ul>
			)}
		</div>
	)
}
