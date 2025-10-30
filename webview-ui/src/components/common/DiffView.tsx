import { memo, useMemo } from "react"
import { parsePatch } from "diff"

interface DiffViewProps {
	source: string
	filePath?: string
}

interface DiffLine {
	oldLineNum: number | null
	newLineNum: number | null
	type: "context" | "addition" | "deletion"
	content: string
}

/**
 * DiffView component renders unified diffs with side-by-side line numbers
 * matching VSCode's diff editor style
 */
const DiffView = memo(({ source }: DiffViewProps) => {
	// Parse diff and extract line information
	const diffLines = useMemo(() => {
		if (!source) return []

		try {
			const patches = parsePatch(source)
			if (!patches || patches.length === 0) return []

			const lines: DiffLine[] = []
			const patch = patches[0]

			for (const hunk of patch.hunks) {
				let oldLine = hunk.oldStart
				let newLine = hunk.newStart

				for (const line of hunk.lines) {
					const firstChar = line[0]
					const content = line.slice(1)

					if (firstChar === "-") {
						lines.push({
							oldLineNum: oldLine,
							newLineNum: null,
							type: "deletion",
							content,
						})
						oldLine++
					} else if (firstChar === "+") {
						lines.push({
							oldLineNum: null,
							newLineNum: newLine,
							type: "addition",
							content,
						})
						newLine++
					} else {
						// Context line
						lines.push({
							oldLineNum: oldLine,
							newLineNum: newLine,
							type: "context",
							content,
						})
						oldLine++
						newLine++
					}
				}
			}

			return lines
		} catch (error) {
			console.error("[DiffView] Failed to parse diff:", error)
			return []
		}
	}, [source])

	return (
		<div
			style={{
				backgroundColor: "var(--vscode-editor-background)",
				borderRadius: "6px",
				overflow: "hidden",
				fontFamily: "var(--vscode-editor-font-family)",
				fontSize: "0.95em",
			}}>
			<div style={{ overflowX: "hidden" }}>
				<table
					style={{
						width: "100%",
						borderCollapse: "collapse",
						tableLayout: "auto",
					}}>
					<tbody>
						{diffLines.map((line, idx) => {
							// Backgrounds: tint only the content and +/- gutter, not the line-number columns
							const contentBg =
								line.type === "addition"
									? "var(--vscode-diffEditor-insertedTextBackground)"
									: line.type === "deletion"
										? "var(--vscode-diffEditor-removedTextBackground)"
										: "transparent"
							// Use same tint for the +/- gutter for a cohesive band effect
							const gutterBg = contentBg

							const lineColor =
								line.type === "addition"
									? "var(--vscode-gitDecoration-addedResourceForeground)"
									: line.type === "deletion"
										? "var(--vscode-gitDecoration-deletedResourceForeground)"
										: "var(--vscode-editorLineNumber-foreground)"

							return (
								<tr key={idx}>
									{/* Old line number */}
									<td
										style={{
											width: "45px",
											textAlign: "right",
											paddingRight: "12px",
											paddingLeft: "8px",
											color: lineColor,
											opacity: 0.5,
											userSelect: "none",
											verticalAlign: "top",
											whiteSpace: "nowrap",
										}}>
										{line.oldLineNum || ""}
									</td>
									{/* New line number */}
									<td
										style={{
											width: "45px",
											textAlign: "right",
											paddingRight: "12px",
											color: lineColor,
											opacity: 0.5,
											userSelect: "none",
											verticalAlign: "top",
											whiteSpace: "nowrap",
										}}>
										{line.newLineNum || ""}
									</td>
									{/* +/- indicator */}
									<td
										style={{
											width: "20px",
											textAlign: "center",
											backgroundColor: gutterBg,
											color:
												line.type === "addition"
													? "var(--vscode-gitDecoration-addedResourceForeground)"
													: line.type === "deletion"
														? "var(--vscode-gitDecoration-deletedResourceForeground)"
														: "transparent",
											userSelect: "none",
											verticalAlign: "top",
											paddingRight: "8px",
										}}>
										{line.type === "addition" ? "+" : line.type === "deletion" ? "−" : ""}
									</td>
									{/* Code content */}
									<td
										style={{
											paddingLeft: "4px",
											paddingRight: "12px",
											whiteSpace: "pre-wrap",
											overflowWrap: "anywhere",
											wordBreak: "break-word",
											fontFamily: "var(--vscode-editor-font-family)",
											color: "var(--vscode-editor-foreground)",
											width: "100%",
											backgroundColor: contentBg,
										}}>
										{line.content}
									</td>
								</tr>
							)
						})}
					</tbody>
				</table>
			</div>
		</div>
	)
})

export default DiffView
