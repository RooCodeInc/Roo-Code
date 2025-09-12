import { useState, useRef, useMemo, useEffect } from "react"

export function TodoListDisplay({ todos }: { todos: any[] }) {
	const [isCollapsed, setIsCollapsed] = useState(true)
	const ulRef = useRef<HTMLUListElement>(null)
	const itemRefs = useRef<(HTMLLIElement | null)[]>([])
	const scrollIndex = useMemo(() => {
		const inProgressIdx = todos.findIndex((todo: any) => todo.status === "in_progress")
		if (inProgressIdx !== -1) return inProgressIdx
		return todos.findIndex((todo: any) => todo.status !== "completed")
	}, [todos])

	// Find the most important todo to display when collapsed
	const mostImportantTodo = useMemo(() => {
		const inProgress = todos.find((todo: any) => todo.status === "in_progress")
		if (inProgress) return inProgress
		return todos.find((todo: any) => todo.status !== "completed")
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
	const completedCount = todos.filter((todo: any) => todo.status === "completed").length

	const allCompleted = completedCount === totalCount && totalCount > 0

	// Create the status icon for the most important todo
	const getMostImportantTodoIcon = () => {
		if (allCompleted) {
			return (
				<span className="flex items-center justify-center w-5 h-5 rounded-full bg-white mr-2.5 shrink-0">
					<span className="codicon codicon-check" style={{ color: "black", fontSize: 12 }} />
				</span>
			)
		}

		if (!mostImportantTodo) {
			return (
				<span className="codicon codicon-checklist text-[var(--vscode-foreground)] mr-2.5 shrink-0 text-[16px]" />
			)
		}

		if (mostImportantTodo.status === "completed") {
			return (
				<span className="flex items-center justify-center w-5 h-5 rounded-full bg-white mr-2.5 shrink-0">
					<span className="codicon codicon-check" style={{ color: "#fff", fontSize: 14 }} />
				</span>
			)
		}

		if (mostImportantTodo.status === "in_progress") {
			return (
				<span className="flex items-center justify-center w-5 h-5 rounded-full bg-white mr-2.5 shrink-0">
					<span className="codicon codicon-loading animate-spin" style={{ color: "black", fontSize: 16 }} />
				</span>
			)
		}

		// Default not-started todo
		return <span className="inline-block w-5 h-5 rounded-full border border-[var(--vscode-descriptionForeground)] bg-transparent mr-2.5 shrink-0" />
	}

	return (
		<div
			className="border border-t-0 rounded-2xl mt-2 relative shadow-[0_1px_10px_rgba(0,0,0,0.65)] bg-[rgba(255,255,255,0.15)] [--tw-backdrop-blur:blur(10px)] border-[rgba(255,255,255,0.1)] px-2 py-1.5">
			<div className="flex items-center gap-0 mb-0 cursor-pointer select-none py-1" onClick={() => setIsCollapsed((v) => !v)}>
				{getMostImportantTodoIcon()}
				<span
					style={{
						fontWeight: 500,
						fontSize: "14px",
						color: allCompleted
							? "white"
							: mostImportantTodo?.status === "in_progress"
								? "var(--vscode-foreground)"
								: "var(--vscode-foreground)",
						flex: 1,
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
					}}>
					{allCompleted ? "All tasks completed!" : mostImportantTodo?.content || "No pending tasks"}
				</span>
				<div className="flex items-center gap-1.5 shrink-0 bg-[rgba(255,255,255,0.08)] [--tw-backdrop-blur:blur(10px)] px-[9px] py-1 rounded-full border border-[rgba(255,255,255,0.1)]">
					<span className="codicon codicon-checklist text-[var(--vscode-descriptionForeground)] text-[14px]" />
					<span className="text-[var(--vscode-descriptionForeground)] text-[13px] font-medium">
						{completedCount}/{totalCount}
					</span>
				</div>
			</div>
			{/* Floating panel for expanded state */}
			{!isCollapsed && (
				<>
					{/* Backdrop */}
					<div className="fixed inset-0 bg-[rgba(0,0,0,0.1)] z-[1000]" onClick={() => setIsCollapsed(true)} />
					{/* Floating panel */}
					<div className="absolute top-full left-0 right-0 mt-1 bg-[rgba(255,255,255,0.07)] border border-[rgba(255,255,255,0.1)] rounded-[12px] shadow-[0_8px_20px_rgba(0,0,0,0.2)] z-[1001] [--tw-backdrop-blur:blur(10px)] max-h-[400px] min-h-[200px] overflow-hidden">
						{/* Panel header */}
						<div className="flex items-center justify-between px-4 py-3 border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)]">
							<div className="flex items-center gap-2.5">
								<div className="flex items-center justify-center w-6 h-6 rounded-[6px] bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.1)] [--tw-backdrop-blur:blur(10px)]">
									<span className="codicon codicon-checklist text-[var(--vscode-foreground)] text-[16px]" />
								</div>
								<span className="font-semibold text-[15px]">Todo List</span>
								<div className="flex items-center bg-[rgba(255,255,255,0.08)] px-2 py-[2px] rounded-[10px] border border-[rgba(255,255,255,0.1)] [--tw-backdrop-blur:blur(10px)]">
									<span className="text-[var(--vscode-descriptionForeground)] text-[13px] font-medium">
										{completedCount}/{totalCount}
									</span>
								</div>
							</div>
							<div className="flex items-center justify-center w-6 h-6 rounded-[4px] cursor-pointer" onClick={(e) => {
								e.stopPropagation()
								setIsCollapsed(true)
							}}
								onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "var(--vscode-toolbar-hoverBackground)" }}
								onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent" }}>
								<span className="codicon codicon-chevron-up text-[14px]" />
							</div>
						</div>
						{/* Todo list */}
						<ul ref={ulRef} className="m-0 pl-0 list-none max-h-[330px] overflow-y-auto px-2.5">
							{todos.map((todo: any, idx: number) => {
								let icon
								if (todo.status === "completed") {
									icon = (
										<span className="flex items-center justify-center w-4 h-4 rounded-full bg-white mr-2.5 shrink-0">
											<span className="codicon codicon-check" style={{ color: "black", fontSize: 12 }} />
										</span>
									)
								} else if (todo.status === "in_progress") {
									icon = (
										<span className="flex items-center justify-center w-5 h-5 rounded-full bg-[var(--vscode-foreground)] mr-2.5 shrink-0">
											<span className="codicon codicon-loading animate-spin" style={{ color: "black", fontSize: 16 }} />
										</span>
									)
								} else {
									icon = <span className="inline-block w-5 h-5 rounded-full border border-[var(--vscode-descriptionForeground)] bg-transparent mr-2.5 shrink-0" />
								}
								return (
									<li key={todo.id || todo.content} ref={(el) => (itemRefs.current[idx] = el)} className="mb-3 flex items-start min-h-6 leading-[1.5] py-1">
										{icon}
										<span className="font-medium text-[14px] text-[var(--vscode-foreground)] break-words">{todo.content}</span>
									</li>
								)
							})}
						</ul>
					</div>
				</>
			)}
		</div>
	)
}
