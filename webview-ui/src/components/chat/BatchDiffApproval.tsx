import React, { memo, useState } from "react"
import CodeAccordian from "../common/CodeAccordian"
import { extractUnifiedDiff } from "../../utils/diffUtils"

interface FileDiff {
	path: string
	changeCount: number
	key: string
	content: string
	diffs?: Array<{
		content: string
		startLine?: number
	}>
}

interface BatchDiffApprovalProps {
	files: FileDiff[]
	ts: number
}

/** Compute +/− from a unified diff (ignores headers/hunk lines) */
function computeUnifiedStats(diff?: string): { added: number; removed: number } | null {
	if (!diff) return null
	let added = 0
	let removed = 0
	let saw = false
	for (const line of diff.split("\n")) {
		if (line.startsWith("+++ ") || line.startsWith("--- ") || line.startsWith("@@")) continue
		if (line.startsWith("+")) {
			added++
			saw = true
		} else if (line.startsWith("-")) {
			removed++
			saw = true
		}
	}
	return saw && (added > 0 || removed > 0) ? { added, removed } : null
}

/* keep placeholder (legacy) – replaced by computeUnifiedStats after normalization */

export const BatchDiffApproval = memo(({ files = [], ts }: BatchDiffApprovalProps) => {
	const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({})

	if (!files?.length) {
		return null
	}

	const handleToggleExpand = (filePath: string) => {
		setExpandedFiles((prev) => ({
			...prev,
			[filePath]: !prev[filePath],
		}))
	}

	return (
		<div className="pt-[5px]">
			<div className="flex flex-col gap-0 border border-border rounded-md p-1">
				{files.map((file) => {
					// Normalize to unified diff and compute stats
					const rawCombined = file.diffs?.map((d) => d.content).join("\n\n") || file.content
					const unified = extractUnifiedDiff({
						toolName: "appliedDiff",
						path: file.path,
						diff: rawCombined,
						content: undefined,
					})
					const stats = computeUnifiedStats(unified)

					return (
						<div key={`${file.path}-${ts}`}>
							<CodeAccordian
								path={file.path}
								code={unified}
								language="diff"
								isExpanded={expandedFiles[file.path] || false}
								onToggleExpand={() => handleToggleExpand(file.path)}
								diffStats={stats ?? undefined}
							/>
						</div>
					)
				})}
			</div>
		</div>
	)
})

BatchDiffApproval.displayName = "BatchDiffApproval"
