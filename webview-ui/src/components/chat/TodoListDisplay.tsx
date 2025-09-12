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
				<span
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						width: 20,
						height: 20,
						borderRadius: "50%",
						background: "white",
						marginRight: 10,
						flexShrink: 0,
					}}>
					<span className="codicon codicon-check" style={{ color: "black", fontSize: 12 }} />
				</span>
			)
		}

		if (!mostImportantTodo) {
			return (
				<span
					className="codicon codicon-checklist"
					style={{
						color: "var(--vscode-foreground)",
						marginRight: 10,
						flexShrink: 0,
						fontSize: 16,
					}}
				/>
			)
		}

		if (mostImportantTodo.status === "completed") {
			return (
				<span
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						width: 20,
						height: 20,
						borderRadius: "50%",
						background: "white",
						marginRight: 10,
						flexShrink: 0,
					}}>
					<span className="codicon codicon-check" style={{ color: "#fff", fontSize: 14 }} />
				</span>
			)
		}

		if (mostImportantTodo.status === "in_progress") {
			return (
				<span
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						width: 20,
						height: 20,
						borderRadius: "50%",
						background: "white",
						marginRight: 10,
						flexShrink: 0,
					}}>
					{/* Icon for in-progress tasks */}
					<span className="codicon codicon-loading animate-spin" style={{ color: "black", fontSize: 16 }} />
				</span>
			)
		}

		// Default not-started todo
		return (
			<span
				style={{
					display: "inline-block",
					width: 20,
					height: 20,
					borderRadius: "50%",
					border: "1px solid var(--vscode-descriptionForeground)",
					background: "transparent",
					marginRight: 10,
					flexShrink: 0,
				}}
			/>
		)
	}

	return (
		<div
			className="border border-t-0 rounded-2xl mt-2 relative"
			style={{
				boxShadow: "0 1px 10px rgba(0,0,0,0.65)",
				padding: "3px 8px",
				background: "rgba(255,255,255,0.15)",

				WebkitBackdropFilter: "blur(10px)",
				borderColor: "rgba(255,255,255,0.1)",
				borderWidth: "1px",
			}}>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 2,
					marginBottom: 0,
					cursor: "pointer",
					userSelect: "none",
					padding: "4px 0px",
				}}
				onClick={() => setIsCollapsed((v) => !v)}>
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
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 6,
						flexShrink: 0,
						backgroundColor: "rgba(255,255,255,0.08)",
						backdropFilter: "blur(10px)",
						WebkitBackdropFilter: "blur(10px)",
						padding: "4px 9px",
						borderRadius: "40px",
						border: "1px solid rgba(255,255,255,0.1)",
					}}>
					<span
						className="codicon codicon-checklist"
						style={{
							color: "var(--vscode-descriptionForeground)",
							fontSize: 14,
						}}
					/>
					<span
						style={{
							color: "var(--vscode-descriptionForeground)",
							fontSize: 13,
							fontWeight: 500,
						}}>
						{completedCount}/{totalCount}
					</span>
				</div>
			</div>
			{/* Floating panel for expanded state */}
			{!isCollapsed && (
				<>
					{/* Backdrop */}
					<div
						style={{
							position: "fixed",
							top: 0,
							left: 0,
							right: 0,
							bottom: 0,
							background: "rgba(0, 0, 0, 0.1)",
							zIndex: 1000,
						}}
						onClick={() => setIsCollapsed(true)}
					/>
					{/* Floating panel */}
					<div
						style={{
							position: "absolute",
							top: "100%",
							left: 0,
							right: 0,
							marginTop: 4,
							background: "rgba(255,255,255,0.07)",
							border: "1px solid rgba(255,255,255,0.1)",
							borderRadius: 12,
							boxShadow: "0 8px 20px rgba(0, 0, 0, 0.2)",
							zIndex: 1001,
							backdropFilter: "blur(10px)",
							WebkitBackdropFilter: "blur(10px)",
							maxHeight: "400px",
							minHeight: "200px",
							overflow: "hidden",
						}}>
						{/* Panel header */}
						<div
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between",
								padding: "12px 16px",
								borderBottom: "1px solid var(--vscode-panel-border)",
								background: "var(--vscode-editor-background)",
							}}>
							<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
								<div
									style={{
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										width: 24,
										height: 24,
										borderRadius: "6px",
										backgroundColor: "rgba(255,255,255,0.08)",
										border: "1px solid rgba(255,255,255,0.1)",
										backdropFilter: "blur(10px)",
										WebkitBackdropFilter: "blur(10px)",
									}}>
									<span
										className="codicon codicon-checklist"
										style={{ color: "var(--vscode-foreground)", fontSize: 16 }}
									/>
								</div>
								<span style={{ fontWeight: 600, fontSize: 15 }}>Todo List</span>
								<div
									style={{
										display: "flex",
										alignItems: "center",
										backgroundColor: "rgba(255,255,255,0.08)",
										padding: "2px 8px",
										borderRadius: "10px",
										border: "1px solid rgba(255,255,255,0.1)",
										backdropFilter: "blur(10px)",
										WebkitBackdropFilter: "blur(10px)",
									}}>
									<span
										style={{
											color: "var(--vscode-descriptionForeground)",
											fontSize: 13,
											fontWeight: 500,
										}}>
										{completedCount}/{totalCount}
									</span>
								</div>
							</div>
							<div
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									width: 24,
									height: 24,
									borderRadius: "4px",
									cursor: "pointer",
								}}
								onClick={(e) => {
									e.stopPropagation()
									setIsCollapsed(true)
								}}
								onMouseEnter={(e) => {
									e.currentTarget.style.background = "var(--vscode-toolbar-hoverBackground)"
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.background = "transparent"
								}}>
								<span
									className="codicon codicon-chevron-up"
									style={{
										fontSize: 14,
									}}
								/>
							</div>
						</div>
						{/* Todo list */}
						<ul
							ref={ulRef}
							style={{
								margin: 0,
								paddingLeft: 0,
								listStyle: "none",
								maxHeight: "330px",
								overflowY: "auto",
								padding: "3px 10px",
							}}>
							{todos.map((todo: any, idx: number) => {
								let icon
								if (todo.status === "completed") {
									icon = (
										<span
											style={{
												display: "flex",
												alignItems: "center",
												justifyContent: "center",
												width: 16,
												height: 16,
												borderRadius: "50%",
												background: "white",
												marginRight: 9,
												flexShrink: 0,
											}}>
											<span
												className="codicon codicon-check"
												style={{ color: "black", fontSize: 12 }}
											/>
										</span>
									)
								} else if (todo.status === "in_progress") {
									icon = (
										<span
											style={{
												display: "flex",
												alignItems: "center",
												justifyContent: "center",
												width: 20,
												height: 20,
												borderRadius: "50%",
												background: "var(--vscode-foreground)",
												marginRight: 10,
												flexShrink: 0,
											}}>
											<span
												className="codicon codicon-loading animate-spin"
												style={{ color: "black", fontSize: 16 }}
											/>
										</span>
									)
								} else {
									icon = (
										<span
											style={{
												display: "inline-block",
												width: 20,
												height: 20,
												borderRadius: "50%",
												border: "1px solid var(--vscode-descriptionForeground)",
												background: "transparent",
												marginRight: 10,
												flexShrink: 0,
											}}
										/>
									)
								}
								return (
									<li
										key={todo.id || todo.content}
										ref={(el) => (itemRefs.current[idx] = el)}
										style={{
											marginBottom: 12,
											display: "flex",
											alignItems: "flex-start",
											minHeight: 24,
											lineHeight: "1.5",
											padding: "4px 0",
										}}>
										{icon}
										<span
											style={{
												fontWeight: 500,
												fontSize: "14px",
												color:
													todo.status === "completed"
														? "white"
														: todo.status === "in_progress"
															? "var(--vscode-foreground)"
															: "var(--vscode-foreground)",
												wordBreak: "break-word",
											}}>
											{todo.content}
										</span>
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
