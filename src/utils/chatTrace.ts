import * as fs from "fs/promises"
import * as path from "path"

/**
 * Append a compact trace line to <cwd>/logs/chat-trace.log. Swallows errors so it
 * never interferes with runtime behavior.
 */
export async function appendChatTrace(cwd: string | undefined, line: string): Promise<void> {
	try {
		const base = cwd && cwd.length ? cwd : process.cwd()
		const dir = path.join(base, "logs")
		await fs.mkdir(dir, { recursive: true })
		const file = path.join(dir, "chat-trace.log")
		const ts = new Date().toISOString()
		const entry = `${ts} ${line}\n`
		await fs.appendFile(file, entry, "utf8")
	} catch (err) {
		// never throw from tracing
		console.warn("[chatTrace] failed to write trace:", err)
	}
}

/**
 * Compact a string for single-line logging (truncate and escape newlines).
 */
export function compact(input?: string | null, max = 180): string {
	if (!input) return ""
	const s = String(input).replace(/\s+/g, " ").trim()
	if (s.length <= max) return s
	return s.slice(0, max - 1) + "…"
}
