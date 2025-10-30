import React, { memo, useState } from "react"
import { structuredPatch } from "diff"
import CodeAccordian from "../common/CodeAccordian"

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

/**
 * Converts Roo's SEARCH/REPLACE format to unified diff format for better readability
 */
function convertSearchReplaceToUnifiedDiff(content: string, filePath?: string): string {
	const blockRegex =
		/<<<<<<?\s*SEARCH[\s\S]*?(?:^:start_line:.*\n)?(?:^:end_line:.*\n)?(?:^-------\s*\n)?([\s\S]*?)^(?:=======\s*\n)([\s\S]*?)^(?:>>>>>>> REPLACE)/gim

	let hasBlocks = false
	let combinedDiff = ""
	const fileName = filePath || "file"

	let match: RegExpExecArray | null
	while ((match = blockRegex.exec(content)) !== null) {
		hasBlocks = true
		const searchContent = (match[1] ?? "").replace(/\n$/, "") // Remove trailing newline
		const replaceContent = (match[2] ?? "").replace(/\n$/, "")

		// Use the diff library to create a proper unified diff
		const patch = structuredPatch(fileName, fileName, searchContent, replaceContent, "", "", { context: 3 })

		// Convert to unified diff format
		if (patch.hunks.length > 0) {
			for (const hunk of patch.hunks) {
				combinedDiff += `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@\n`
				combinedDiff += hunk.lines.join("\n") + "\n"
			}
		}
	}

	return hasBlocks ? combinedDiff : content
}

function computeDiffStats(diff?: string): { added: number; removed: number } | null {
	if (!diff) return null

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

	if (sawPlusMinus && (added > 0 || removed > 0)) {
		return { added, removed }
	}

	return null
}

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
					// Combine all diffs into a single diff string for this file
					const rawCombinedDiff = file.diffs?.map((diff) => diff.content).join("\n\n") || file.content

					// Remove CDATA markers
					const withoutCData = rawCombinedDiff.replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "")

					// Convert SEARCH/REPLACE to unified diff if needed
					const cleanDiff = /<<<<<<<?\s*SEARCH/i.test(withoutCData)
						? convertSearchReplaceToUnifiedDiff(withoutCData, file.path)
						: withoutCData

					// Compute stats for display
					const stats = computeDiffStats(cleanDiff)

					return (
						<div key={`${file.path}-${ts}`}>
							<CodeAccordian
								path={file.path}
								code={cleanDiff}
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
