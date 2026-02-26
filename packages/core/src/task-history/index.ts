import * as fs from "fs/promises"
import * as path from "path"

import type { HistoryItem } from "@roo-code/types"

const HISTORY_ITEM_FILENAME = "history_item.json"
const HISTORY_INDEX_FILENAME = "_index.json"

export interface TaskSessionEntry {
	id: string
	task: string
	ts: number
	workspace?: string
	mode?: string
	status?: HistoryItem["status"]
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null
}

function extractSessionEntry(value: unknown): TaskSessionEntry | undefined {
	if (!isRecord(value)) {
		return undefined
	}

	const id = value.id
	const task = value.task
	const ts = value.ts
	const workspace = value.workspace
	const mode = value.mode
	const status = value.status

	if (typeof id !== "string" || typeof task !== "string" || typeof ts !== "number") {
		return undefined
	}

	return {
		id,
		task,
		ts,
		workspace: typeof workspace === "string" ? workspace : undefined,
		mode: typeof mode === "string" ? mode : undefined,
		status: status === "active" || status === "completed" || status === "delegated" ? status : undefined,
	}
}

async function readJsonFile(filePath: string): Promise<unknown | undefined> {
	try {
		const raw = await fs.readFile(filePath, "utf8")
		return JSON.parse(raw)
	} catch {
		return undefined
	}
}

export async function readTaskSessionsFromStoragePath(storageBasePath: string): Promise<TaskSessionEntry[]> {
	const tasksDir = path.join(storageBasePath, "tasks")
	const sessionsById = new Map<string, TaskSessionEntry>()

	const historyIndex = await readJsonFile(path.join(tasksDir, HISTORY_INDEX_FILENAME))
	const indexEntries = isRecord(historyIndex) && Array.isArray(historyIndex.entries) ? historyIndex.entries : []

	for (const entry of indexEntries) {
		const session = extractSessionEntry(entry)
		if (session) {
			sessionsById.set(session.id, session)
		}
	}

	let taskDirs: string[] = []

	try {
		const entries = await fs.readdir(tasksDir, { withFileTypes: true })
		taskDirs = entries
			.filter((entry) => entry.isDirectory() && !entry.name.startsWith("_") && !entry.name.startsWith("."))
			.map((entry) => entry.name)
	} catch {
		// No tasks directory; return index-derived entries only.
	}

	for (const taskId of taskDirs) {
		if (sessionsById.has(taskId)) {
			continue
		}

		const historyItem = await readJsonFile(path.join(tasksDir, taskId, HISTORY_ITEM_FILENAME))
		const session = extractSessionEntry(historyItem)

		if (session) {
			sessionsById.set(session.id, session)
		}
	}

	if (taskDirs.length > 0) {
		const onDiskIds = new Set(taskDirs)
		for (const sessionId of sessionsById.keys()) {
			if (!onDiskIds.has(sessionId)) {
				sessionsById.delete(sessionId)
			}
		}
	}

	return Array.from(sessionsById.values()).sort((a, b) => b.ts - a.ts)
}
