import { memo, useMemo, useEffect, useState } from "react"
import { parseUnifiedDiff } from "@src/utils/parseUnifiedDiff"
import { toJsxRuntime } from "hast-util-to-jsx-runtime"
import { Fragment, jsx, jsxs } from "react/jsx-runtime"
import { getHighlighter, normalizeLanguage } from "@src/utils/highlighter"
import { getLanguageFromPath } from "@src/utils/getLanguageFromPath"

interface DiffViewProps {
	source: string
	filePath?: string
}

/**
 * DiffView component renders unified diffs with side-by-side line numbers
 * matching VSCode's diff editor style
 */
const DiffView = memo(({ source, filePath }: DiffViewProps) => {
	// Determine language from file path and prepare highlighter
	const normalizedLang = useMemo(() => normalizeLanguage(getLanguageFromPath(filePath || "") || "txt"), [filePath])
	const [highlighter, setHighlighter] = useState<any>(null)
	const isLightTheme = useMemo(() => {
		if (typeof document === "undefined") return false
		const cls = document.body.className
		return /\bvscode-light\b|\bvscode-high-contrast-light\b/i.test(cls)
	}, [])

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

	// Disable syntax highlighting for large diffs (performance optimization)
	const shouldHighlight = useMemo(() => {
		const lineCount = source.split("\n").length
		return lineCount <= 1000 // Only highlight diffs with <= 1000 lines
	}, [source])

	const renderHighlighted = (code: string): React.ReactNode => {
		if (!highlighter || !shouldHighlight) return code
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

	// Parse diff server-provided unified patch into renderable lines
	const diffLines = useMemo(() => parseUnifiedDiff(source, filePath), [source, filePath])

	return (
		<div className="diff-view bg-[var(--vscode-editor-background)] rounded-md overflow-hidden text-[0.95em]">
			<div className="overflow-x-hidden">
				<table className="w-full border-collapse table-auto">
					<tbody>
						{diffLines.map((line, idx) => {
							// Render compact separator between hunks
							if (line.type === "gap") {
								// Compact separator between hunks
								return (
									<tr key={idx}>
										<td className="w-[45px] text-right pr-3 pl-2 select-none align-top whitespace-nowrap bg-[var(--vscode-editor-background)]" />
										<td className="w-[45px] text-right pr-3 select-none align-top whitespace-nowrap bg-[var(--vscode-editor-background)]" />
										<td className="w-[12px] align-top bg-[var(--vscode-editor-background)]" />
										{/* +/- column (empty for gap) */}
										<td className="w-[16px] text-center select-none bg-[var(--vscode-editor-background)]" />
										<td className="pr-3 whitespace-pre-wrap break-words w-full italic bg-[var(--vscode-editor-background)]">
											{`${line.hiddenCount ?? 0} hidden lines`}
										</td>
									</tr>
								)
							}

							// Use VSCode's built-in diff editor color variables as classes for gutters
							const gutterBgClass =
								line.type === "addition"
									? "bg-[var(--vscode-diffEditor-insertedTextBackground)]"
									: line.type === "deletion"
										? "bg-[var(--vscode-diffEditor-removedTextBackground)]"
										: "bg-[var(--vscode-editorGroup-border)]"

							const contentBgClass =
								line.type === "addition"
									? "diff-content-inserted"
									: line.type === "deletion"
										? "diff-content-removed"
										: "diff-content-context"

							const sign = line.type === "addition" ? "+" : line.type === "deletion" ? "-" : ""

							return (
								<tr key={idx}>
									{/* Old line number */}
									<td
										className={`w-[45px] text-right pr-1 pl-1 select-none align-top whitespace-nowrap ${gutterBgClass}`}>
										{line.oldLineNum || ""}
									</td>
									{/* New line number */}
									<td
										className={`w-[45px] text-right pr-1 select-none align-top whitespace-nowrap ${gutterBgClass}`}>
										{line.newLineNum || ""}
									</td>
									{/* Narrow colored gutter */}
									<td className={`w-[12px] ${gutterBgClass} align-top`} />
									{/* +/- fixed column to prevent wrapping into it */}
									<td
										className={`w-[16px] text-center select-none whitespace-nowrap px-1 ${gutterBgClass}`}>
										{sign}
									</td>
									{/* Code content (no +/- prefix here) */}
									<td
										className={`pl-1 pr-3 whitespace-pre-wrap break-words w-full ${contentBgClass}`}>
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
