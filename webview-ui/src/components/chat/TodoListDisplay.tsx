import { cn } from "@/lib/utils"
import { vscode } from "@/utils/vscode"
import { t } from "i18next"
import { ArrowRight, Check, Circle, ListChecks, SquareDashed } from "lucide-react"
import { useState, useRef, useMemo, useEffect, useCallback } from "react"

type TodoStatus = "completed" | "in_progress" | "pending"

interface TodoItem {
	id: string
	content: string
	status: TodoStatus
	breakpoint?: boolean
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

export function TodoListDisplay({ todos }: { todos: TodoItem[] }) {
	const [isCollapsed, setIsCollapsed] = useState(true)
	// Session-only breakpoint state (doesn't persist across sessions)
	const [breakpoints, setBreakpoints] = useState<Record<string, boolean>>({})
	const ulRef = useRef<HTMLUListElement>(null)
	const itemRefs = useRef<(HTMLLIElement | null)[]>([])
	const scrollIndex = useMemo(() => {
		const inProgressIdx = todos.findIndex((todo: TodoItem) => todo.status === "in_progress")
		if (inProgressIdx !== -1) return inProgressIdx
		return todos.findIndex((todo: TodoItem) => todo.status !== "completed")
	}, [todos])

	// Find the most important todo to display when collapsed
	const mostImportantTodo = useMemo(() => {
		const inProgress = todos.find((todo: TodoItem) => todo.status === "in_progress")
		if (inProgress) return inProgress
		return todos.find((todo: TodoItem) => todo.status !== "completed")
	}, [todos])

	// Toggle breakpoint on a todo item
	const toggleBreakpoint = useCallback(
		(todoId: string, e: React.MouseEvent) => {
			e.stopPropagation() // Prevent collapsing the list
			const newBreakpointState = !breakpoints[todoId]
			setBreakpoints((prev) => ({
				...prev,
				[todoId]: newBreakpointState,
			}))
			// Notify extension about the breakpoint change
			vscode.postMessage({
				type: "toggleTodoBreakpoint",
				values: { todoId, breakpoint: newBreakpointState },
			})
		},
		[breakpoints],
	)
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
	const completedCount = todos.filter((todo: any) => todo.status === "completed").length

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
				onClick={() => setIsCollapsed((v) => !v)}>
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
						{todos.map((todo: TodoItem, idx: number) => {
							const icon = getTodoIcon(todo.status as TodoStatus)
							const hasBreakpoint = breakpoints[todo.id] || false
							const canHaveBreakpoint = todo.status === "pending" // Only pending items can have breakpoints
							return (
								<li
									key={todo.id || todo.content}
									ref={(el) => (itemRefs.current[idx] = el)}
									className={cn(
										"font-light flex flex-row gap-2 items-start min-h-[20px] leading-normal mb-2 group",
										todo.status === "in_progress" && "text-vscode-charts-yellow",
										todo.status !== "in_progress" && todo.status !== "completed" && "opacity-60",
									)}>
									{icon}
									<span className="flex-1">{todo.content}</span>
									{/* Breakpoint toggle button - only show for pending items */}
									{canHaveBreakpoint && (
										<button
											onClick={(e) => toggleBreakpoint(todo.id, e)}
											className={cn(
												"shrink-0 p-0.5 rounded hover:bg-vscode-toolbar-hoverBackground transition-colors",
												hasBreakpoint
													? "text-vscode-charts-red opacity-100"
													: "text-vscode-descriptionForeground opacity-0 group-hover:opacity-60",
											)}
											title={
												hasBreakpoint ? t("chat:todo.removeBreakpoint") : t("chat:todo.addBreakpoint")
											}>
											<Circle
												className={cn("size-2.5", hasBreakpoint && "fill-current")}
												strokeWidth={hasBreakpoint ? 0 : 2}
											/>
										</button>
									)}
								</li>
							)
						})}
					</ul>
				)}
		</div>
	)
}
