import React, { useState } from "react"

interface TodoDiffItem {
	type: "added" | "removed" | "modified"
	content: string
	oldContent?: string
	status?: string
	oldStatus?: string
}

interface TodoListDiffProps {
	diffText: string
	isCollapsed?: boolean
}

/**
 * Parse diff text into structured diff items
 */
function parseDiffText(diffText: string): TodoDiffItem[] {
	const items: TodoDiffItem[] = []
	const lines = diffText.split("\n")
	let currentSection: "added" | "removed" | "modified" | null = null

	for (const line of lines) {
		if (line === "Added:") {
			currentSection = "added"
		} else if (line === "Removed:") {
			currentSection = "removed"
		} else if (line === "Modified:") {
			currentSection = "modified"
		} else if (line.startsWith("  + ") && currentSection === "added") {
			// Parse added item: + [status] content
			const match = line.match(/^\s+\+\s+(\[.\])\s+(.+)$/)
			if (match) {
				items.push({
					type: "added",
					content: match[2],
					status: match[1],
				})
			}
		} else if (line.startsWith("  - ") && currentSection === "removed") {
			// Parse removed item: - [status] content
			const match = line.match(/^\s+-\s+(\[.\])\s+(.+)$/)
			if (match) {
				items.push({
					type: "removed",
					content: match[2],
					status: match[1],
				})
			}
		} else if (line.startsWith("  ~ ") && currentSection === "modified") {
			// Parse modified item
			if (line.includes("→")) {
				if (line.includes("Status:")) {
					// Status change: ~ Status: old → new
					const match = line.match(/^\s+~\s+Status:\s+(\w+)\s+→\s+(\w+)$/)
					if (match) {
						items.push({
							type: "modified",
							content: "",
							oldStatus: match[1],
							status: match[2],
						})
					}
				} else {
					// Content change: ~ "old" → "new"
					const match = line.match(/^\s+~\s+"(.+)"\s+→\s+"(.+)"$/)
					if (match) {
						items.push({
							type: "modified",
							oldContent: match[1],
							content: match[2],
						})
					}
				}
			}
		}
	}

	return items
}

export const TodoListDiff: React.FC<TodoListDiffProps> = ({ diffText, isCollapsed: initialCollapsed = true }) => {
	const [isCollapsed, setIsCollapsed] = useState(initialCollapsed)
	const diffItems = parseDiffText(diffText)

	// Count changes by type
	const addedCount = diffItems.filter((item) => item.type === "added").length
	const removedCount = diffItems.filter((item) => item.type === "removed").length
	const modifiedCount = diffItems.filter((item) => item.type === "modified").length

	// Generate summary text
	const summaryParts: string[] = []
	if (addedCount > 0) summaryParts.push(`+${addedCount} added`)
	if (removedCount > 0) summaryParts.push(`-${removedCount} removed`)
	if (modifiedCount > 0) summaryParts.push(`~${modifiedCount} modified`)
	const summary = summaryParts.length > 0 ? summaryParts.join(", ") : "No changes"

	return (
		<div className="todo-list-diff" style={{ marginTop: 8 }}>
			<div
				className="diff-header"
				style={{
					display: "flex",
					alignItems: "center",
					padding: "4px 8px",
					background: "var(--vscode-editor-background)",
					border: "1px solid var(--vscode-panel-border)",
					borderRadius: 4,
					cursor: "pointer",
					userSelect: "none",
				}}
				onClick={() => setIsCollapsed(!isCollapsed)}>
				<span
					className={`codicon codicon-chevron-${isCollapsed ? "right" : "down"}`}
					style={{ marginRight: 6, fontSize: 12 }}
				/>
				<span style={{ fontSize: 13, fontWeight: 500 }}>Todo list updated</span>
				<span
					style={{
						marginLeft: 8,
						fontSize: 12,
						color: "var(--vscode-descriptionForeground)",
					}}>
					({summary})
				</span>
			</div>

			{!isCollapsed && (
				<div
					className="diff-content"
					style={{
						marginTop: 4,
						padding: "8px 12px",
						background: "var(--vscode-editor-background)",
						border: "1px solid var(--vscode-panel-border)",
						borderRadius: 4,
						fontSize: 13,
						fontFamily: "var(--vscode-editor-font-family)",
					}}>
					{diffItems.length === 0 ? (
						<div style={{ color: "var(--vscode-descriptionForeground)" }}>No changes detected</div>
					) : (
						<div className="diff-items">
							{diffItems.map((item, index) => (
								<div
									key={index}
									className={`diff-item diff-${item.type}`}
									style={{
										marginBottom: 4,
										display: "flex",
										alignItems: "flex-start",
									}}>
									{item.type === "added" && (
										<>
											<span
												style={{
													color: "var(--vscode-gitDecoration-addedResourceForeground)",
													marginRight: 8,
													fontWeight: "bold",
												}}>
												+
											</span>
											<span
												style={{
													color: "var(--vscode-gitDecoration-addedResourceForeground)",
												}}>
												{item.status} {item.content}
											</span>
										</>
									)}
									{item.type === "removed" && (
										<>
											<span
												style={{
													color: "var(--vscode-gitDecoration-deletedResourceForeground)",
													marginRight: 8,
													fontWeight: "bold",
												}}>
												-
											</span>
											<span
												style={{
													color: "var(--vscode-gitDecoration-deletedResourceForeground)",
													textDecoration: "line-through",
												}}>
												{item.status} {item.content}
											</span>
										</>
									)}
									{item.type === "modified" && (
										<>
											<span
												style={{
													color: "var(--vscode-gitDecoration-modifiedResourceForeground)",
													marginRight: 8,
													fontWeight: "bold",
												}}>
												~
											</span>
											<span
												style={{
													color: "var(--vscode-gitDecoration-modifiedResourceForeground)",
												}}>
												{item.oldContent && item.content && (
													<>
														<span style={{ textDecoration: "line-through", opacity: 0.7 }}>
															{item.oldContent}
														</span>
														{" → "}
														<span>{item.content}</span>
													</>
												)}
												{item.oldStatus && item.status && (
													<>
														Status: {item.oldStatus} → {item.status}
													</>
												)}
											</span>
										</>
									)}
								</div>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	)
}
