import type { ClineMessage, ClineSayTool } from "@roo-code/types"
import { safeJsonParse } from "@roo/core"

/** File-edit tool names from ClineSayTool["tool"] (packages/types). */
const FILE_EDIT_TOOLS = new Set<string>(["editedExistingFile", "appliedDiff", "newFileCreated"])

export interface FileChangeEntry {
	path: string
	diff: string
	diffStats?: { added: number; removed: number }
	/** Original file content before first edit (for merged diff display) */
	originalContent?: string
}

/**
 * Derives a list of file changes from clineMessages for the current conversation.
 * Includes:
 * - type "say" + say "tool" (applied tool results, if any are ever pushed that way)
 * - type "ask" + ask "tool" (tool approval messages; after approval the message stays as ask, so this is where file edits appear in the UI)
 */
export function fileChangesFromMessages(messages: ClineMessage[] | undefined): FileChangeEntry[] {
	if (!messages?.length) return []

	const entries: FileChangeEntry[] = []

	for (const msg of messages) {
		// Tool payload can be in say "tool" (rare) or ask "tool" (how file edits are stored after approval)
		const isSayTool = msg.type === "say" && msg.say === "tool"
		const isAskTool = msg.type === "ask" && msg.ask === "tool"
		if ((!isSayTool && !isAskTool) || !msg.text || msg.partial) continue
		// Only include ask "tool" file edits that the user (or auto-approval) has approved
		if (isAskTool && !msg.isAnswered) continue

		const tool = safeJsonParse<ClineSayTool>(msg.text)
		if (!tool || !FILE_EDIT_TOOLS.has(tool.tool as string)) continue

		// Batch diffs
		if (tool.batchDiffs && Array.isArray(tool.batchDiffs)) {
			for (const file of tool.batchDiffs) {
				if (!file.path) continue
				const content = file.content ?? file.diffs?.map((d) => d.content).join("\n") ?? ""
				if (content) {
					entries.push({
						path: file.path,
						diff: content,
						diffStats: file.diffStats,
					})
				}
			}
			continue
		}

		// Single file
		if (!tool.path) continue
		const diff = tool.diff ?? tool.content ?? ""
		if (diff) {
			entries.push({
				path: tool.path,
				diff,
				diffStats: tool.diffStats,
				originalContent: tool.originalContent,
			})
		}
	}

	return entries
}
