import { memo, useMemo, useEffect, useState } from "react"
import { parsePatch } from "diff"
import { toJsxRuntime } from "hast-util-to-jsx-runtime"
import { Fragment, jsx, jsxs } from "react/jsx-runtime"
import { getHighlighter, normalizeLanguage } from "@src/utils/highlighter"
import { getLanguageFromPath } from "@src/utils/getLanguageFromPath"

interface DiffViewProps {
	source: string
	filePath?: string
}

interface DiffLine {
	oldLineNum: number | null
	newLineNum: number | null
	type: "context" | "addition" | "deletion" | "gap"
	content: string
	hiddenCount?: number
}

/**
 * DiffView component renders unified diffs with side-by-side line numbers
 * matching VSCode's diff editor style
 */
const DiffView = memo(({ source, filePath }: DiffViewProps) => {
	// Determine language from file path and prepare highlighter
	const normalizedLang = useMemo(() => normalizeLanguage(getLanguageFromPath(filePath || "") || "txt"), [filePath])
	const [highlighter, setHighlighter] = useState<any>(null)
	const isLightTheme = useMemo(
		() => typeof document !== "undefined" && document.body.className.toLowerCase().includes("light"),
		[],
	)

	useEffect(() => {
		let mounted = true
		getHighlighter(normalizedLang)
			.then((h) => {
				if (mounted) setHighlighter(h)
			})
			.catch(() => {
				// fall back to plain text if highlighting fails
			})
		return () => {
			mounted = false
		}
	}, [normalizedLang])

	const renderHighlighted = (code: string): React.ReactNode => {
		if (!highlighter) return code
		try {
			const hast: any = highlighter.codeToHast(code, {
				lang: normalizedLang,
				theme: isLightTheme ? "github-light" : "github-dark",
				transformers: [
					{
						pre(node: any) {
							node.properties.style = "padding:0;margin:0;background:none;"
							return node
						},
						code(node: any) {
							node.properties.class = `hljs language-${normalizedLang}`
							return node
						},
					},
				],
			})

			// Extract just the <code> children to render inline inside our table cell
			const codeEl = hast?.children?.[0]?.children?.[0]
			const inlineRoot =
				codeEl && codeEl.children
					? { type: "element", tagName: "span", properties: {}, children: codeEl.children }
					: { type: "element", tagName: "span", properties: {}, children: hast.children || [] }

			return toJsxRuntime(inlineRoot as any, { Fragment, jsx, jsxs })
		} catch {
			return code
		}
	}

	// Parse diff and extract line information
	const diffLines = useMemo(() => {
		if (!source) return []

		try {
			const patches = parsePatch(source)
			if (!patches || patches.length === 0) return []

			const lines: DiffLine[] = []
			const patch = patches[0]

			let prevHunk: any = null
			for (const hunk of patch.hunks) {
				// Insert a compact "hidden lines" separator between hunks
				if (prevHunk) {
					const gapNew = hunk.newStart - (prevHunk.newStart + prevHunk.newLines)
					const gapOld = hunk.oldStart - (prevHunk.oldStart + prevHunk.oldLines)
					const hidden = Math.max(gapNew, gapOld)
					if (hidden > 0) {
						lines.push({
							oldLineNum: null,
							newLineNum: null,
							type: "gap",
							content: "",
							hiddenCount: hidden,
						})
					}
				}

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

				prevHunk = hunk
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
							// Render compact separator between hunks
							if (line.type === "gap") {
								const gapBg = "color-mix(in srgb, var(--vscode-editorGroup-border) 100%, transparent)"
								return (
									<tr key={idx}>
										<td
											style={{
												width: "45px",
												textAlign: "right",
												paddingRight: "12px",
												paddingLeft: "8px",
												userSelect: "none",
												verticalAlign: "top",
												whiteSpace: "nowrap",
												backgroundColor: gapBg,
											}}
										/>
										<td
											style={{
												width: "45px",
												textAlign: "right",
												paddingRight: "12px",
												userSelect: "none",
												verticalAlign: "top",
												whiteSpace: "nowrap",
												backgroundColor: gapBg,
											}}
										/>
										<td
											style={{
												width: "12px",
												backgroundColor: gapBg,
												verticalAlign: "top",
											}}
										/>
										{/* +/- column (empty for gap) */}
										<td
											style={{
												width: "16px",
												textAlign: "center",
												userSelect: "none",
												backgroundColor: gapBg,
											}}
										/>
										<td
											style={{
												paddingLeft: "4px",
												paddingRight: "12px",
												whiteSpace: "pre-wrap",
												overflowWrap: "anywhere",
												wordBreak: "break-word",
												fontFamily: "var(--vscode-editor-font-family)",
												color: "var(--vscode-descriptionForeground)",
												width: "100%",
												textAlign: "center",
												fontStyle: "italic",
												backgroundColor: gapBg,
											}}>
											{`${line.hiddenCount ?? 0} hidden lines`}
										</td>
									</tr>
								)
							}

							// Use VSCode's built-in diff editor color variables with 50% opacity
							const gutterBg =
								line.type === "addition"
									? "var(--vscode-diffEditor-insertedTextBackground)"
									: line.type === "deletion"
										? "var(--vscode-diffEditor-removedTextBackground)"
										: "var(--vscode-editorGroup-border)"

							const contentBgStyles =
								line.type === "addition"
									? {
											backgroundColor:
												"color-mix(in srgb, var(--vscode-diffEditor-insertedTextBackground) 70%, transparent)",
										}
									: line.type === "deletion"
										? {
												backgroundColor:
													"color-mix(in srgb, var(--vscode-diffEditor-removedTextBackground) 70%, transparent)",
											}
										: {
												backgroundColor:
													"color-mix(in srgb, var(--vscode-editorGroup-border) 100%, transparent)",
											}

							const sign = line.type === "addition" ? "+" : line.type === "deletion" ? "-" : ""

							return (
								<tr key={idx}>
									{/* Old line number */}
									<td
										style={{
											width: "45px",
											textAlign: "right",
											paddingRight: "4px",
											paddingLeft: "4px",
											userSelect: "none",
											verticalAlign: "top",
											whiteSpace: "nowrap",
											backgroundColor: gutterBg,
										}}>
										{line.oldLineNum || ""}
									</td>
									{/* New line number */}
									<td
										style={{
											width: "45px",
											textAlign: "right",
											paddingRight: "4px",
											userSelect: "none",
											verticalAlign: "top",
											whiteSpace: "nowrap",
											backgroundColor: gutterBg,
										}}>
										{line.newLineNum || ""}
									</td>
									{/* Narrow colored gutter */}
									<td
										style={{
											width: "12px",
											backgroundColor: gutterBg,
											verticalAlign: "top",
										}}
									/>
									{/* +/- fixed column to prevent wrapping into it */}
									<td
										style={{
											width: "16px",
											textAlign: "center",
											userSelect: "none",
											whiteSpace: "nowrap",
											paddingLeft: "4px",
											paddingRight: "4px",
											backgroundColor: gutterBg,
											color: "var(--vscode-editor-foreground)",
											fontFamily: "var(--vscode-editor-font-family)",
										}}>
										{sign}
									</td>
									{/* Code content (no +/- prefix here) */}
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
											...contentBgStyles,
										}}>
										{renderHighlighted(line.content)}
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
