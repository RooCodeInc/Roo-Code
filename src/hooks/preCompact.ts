import fs from "fs/promises"
import path from "path"

interface CompactEntry {
	tool: string
	status: string
	summary: string
	timestamp: string
}

const historyByTask = new Map<string, CompactEntry[]>()
const LAST_COMPACT_THRESHOLD = 20

function claudePath(cwd: string): string {
	return path.join(cwd, ".orchestration", "CLAUDE.md")
}

export function recordCompactEntry(taskId: string, entry: CompactEntry): void {
	const current = historyByTask.get(taskId) ?? []
	current.push(entry)
	if (current.length > 200) {
		current.splice(0, current.length - 200)
	}
	historyByTask.set(taskId, current)
}

export async function preCompact(taskId: string, cwd: string): Promise<void> {
	const entries = historyByTask.get(taskId) ?? []
	if (entries.length < LAST_COMPACT_THRESHOLD) {
		return
	}
	const recent = entries.slice(-LAST_COMPACT_THRESHOLD)
	const compactSummary = recent
		.map((entry, idx) => `${idx + 1}. [${entry.status}] ${entry.tool} - ${entry.summary}`)
		.join("\n")
	const content = `# Governance Notes

## Compact State
Task: ${taskId}
Updated: ${new Date().toISOString()}

### Recent Tool Summary
${compactSummary}
`
	const target = claudePath(cwd)
	await fs.mkdir(path.dirname(target), { recursive: true })
	await fs.writeFile(target, content, "utf-8")
}
