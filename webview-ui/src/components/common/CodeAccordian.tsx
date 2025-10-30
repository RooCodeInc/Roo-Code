import { memo, useMemo } from "react"
import { VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react"
import { type ToolProgressStatus } from "@roo-code/types"
import { getLanguageFromPath } from "@src/utils/getLanguageFromPath"
import { formatPathTooltip } from "@src/utils/formatPathTooltip"

import { ToolUseBlock, ToolUseBlockHeader } from "./ToolUseBlock"
import CodeBlock from "./CodeBlock"
import { PathTooltip } from "../ui/PathTooltip"
import DiffView from "./DiffView"

interface CodeAccordianProps {
	path?: string
	code?: string
	language: string
	progressStatus?: ToolProgressStatus
	isLoading?: boolean
	isExpanded: boolean
	isFeedback?: boolean
	onToggleExpand: () => void
	header?: string
	onJumpToFile?: () => void
	// New props for diff stats
	diffStats?: { added: number; removed: number }
}

// Fallback computation of + / - counts from code (supports both unified diff and Roo's multi-search-replace blocks)
function computeDiffStatsFromCode(diff?: string): { added: number; removed: number } | null {
	if (!diff) return null

	// Strategy 1: unified diff markers
	let added = 0
	let removed = 0
	let sawPlusMinus = false
	for (const line of diff.split("\n")) {
		if (line.startsWith("+++ ") || line.startsWith("--- ") || line.startsWith("@@")) continue
		if (line.startsWith("+")) {
			added++
			sawPlusMinus = true
		} else if (line.startsWith("-")) {
			removed++
			sawPlusMinus = true
		}
	}
	if (sawPlusMinus) {
		if (added === 0 && removed === 0) return null
		return { added, removed }
	}

	// Strategy 2: Roo multi-search-replace blocks
	const blockRegex =
		/<<<<<<?\s*SEARCH[\s\S]*?(?:^:start_line:.*\n)?(?:^:end_line:.*\n)?(?:^-------\s*\n)?([\s\S]*?)^(?:=======\s*\n)([\s\S]*?)^(?:>>>>>>> REPLACE)/gim

	const asLines = (s: string) => {
		const norm = (s || "").replace(/\r\n/g, "\n")
		if (!norm) return 0
		const parts = norm.split("\n")
		return parts[parts.length - 1] === "" ? parts.length - 1 : parts.length
	}

	let hasBlocks = false
	added = 0
	removed = 0

	let match: RegExpExecArray | null
	while ((match = blockRegex.exec(diff)) !== null) {
		hasBlocks = true
		const searchCount = asLines(match[1] ?? "")
		const replaceCount = asLines(match[2] ?? "")
		if (replaceCount > searchCount) added += replaceCount - searchCount
		else if (searchCount > replaceCount) removed += searchCount - replaceCount
	}

	if (hasBlocks) {
		if (added === 0 && removed === 0) return null
		return { added, removed }
	}

	return null
}

const CodeAccordian = ({
	path,
	code = "",
	language,
	progressStatus,
	isLoading,
	isExpanded,
	isFeedback,
	onToggleExpand,
	header,
	onJumpToFile,
	diffStats,
}: CodeAccordianProps) => {
	const inferredLanguage = useMemo(() => language ?? (path ? getLanguageFromPath(path) : "txt"), [path, language])
	const source = useMemo(() => code.trim(), [code])
	const hasHeader = Boolean(path || isFeedback || header)

	// Derive diff stats from code when not provided
	const derivedStats = useMemo(() => {
		if (diffStats && (diffStats.added > 0 || diffStats.removed > 0)) return diffStats
		if ((language || inferredLanguage) && (language || inferredLanguage) === "diff") {
			return computeDiffStatsFromCode(source || code || "")
		}
		return null
	}, [diffStats, language, inferredLanguage, source, code])

	const hasValidStats = Boolean(derivedStats && (derivedStats.added > 0 || derivedStats.removed > 0))

	return (
		<ToolUseBlock>
			{hasHeader && (
				<ToolUseBlockHeader onClick={onToggleExpand} className="group">
					{isLoading && <VSCodeProgressRing className="size-3 mr-2" />}
					{header ? (
						<div className="flex items-center">
							<span className="codicon codicon-server mr-1.5"></span>
							<PathTooltip content={header}>
								<span className="whitespace-nowrap overflow-hidden text-ellipsis mr-2">{header}</span>
							</PathTooltip>
						</div>
					) : isFeedback ? (
						<div className="flex items-center">
							<span className={`codicon codicon-${isFeedback ? "feedback" : "codicon-output"} mr-1.5`} />
							<span className="whitespace-nowrap overflow-hidden text-ellipsis mr-2 rtl">
								{isFeedback ? "User Edits" : "Console Logs"}
							</span>
						</div>
					) : (
						<>
							{path?.startsWith(".") && <span>.</span>}
							<PathTooltip content={formatPathTooltip(path)}>
								<span className="whitespace-nowrap overflow-hidden text-ellipsis text-left mr-2 rtl">
									{formatPathTooltip(path)}
								</span>
							</PathTooltip>
						</>
					)}
					<div className="flex-grow-1" />
					{/* Prefer diff stats over generic progress indicator if available */}
					{hasValidStats ? (
						<div className="flex items-center gap-2 mr-1">
							<span className="text-xs font-medium" style={{ color: "var(--vscode-charts-green)" }}>
								+{derivedStats!.added}
							</span>
							<span className="text-xs font-medium" style={{ color: "var(--vscode-charts-red)" }}>
								-{derivedStats!.removed}
							</span>
						</div>
					) : (
						progressStatus &&
						progressStatus.text && (
							<>
								{progressStatus.icon && (
									<span className={`codicon codicon-${progressStatus.icon} mr-1`} />
								)}
								<span className="mr-1 ml-auto text-vscode-descriptionForeground">
									{progressStatus.text}
								</span>
							</>
						)
					)}
					{onJumpToFile && path && (
						<span
							className="codicon codicon-link-external mr-1"
							style={{ fontSize: 13.5 }}
							onClick={(e) => {
								e.stopPropagation()
								onJumpToFile()
							}}
							aria-label={`Open file: ${path}`}
						/>
					)}
					{!onJumpToFile && (
						<span
							className={`opacity-0 group-hover:opacity-100 codicon codicon-chevron-${isExpanded ? "up" : "down"}`}></span>
					)}
				</ToolUseBlockHeader>
			)}
			{(!hasHeader || isExpanded) && (
				<div className="overflow-x-auto overflow-y-hidden max-w-full">
					{inferredLanguage === "diff" ? (
						<DiffView source={source} filePath={path} />
					) : (
						<CodeBlock source={source} language={inferredLanguage} />
					)}
				</div>
			)}
		</ToolUseBlock>
	)
}

export default memo(CodeAccordian)
