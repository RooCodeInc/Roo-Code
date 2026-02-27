import os from "os"
import path from "path"

import { readTaskSessionsFromStoragePath, type TaskSessionEntry } from "@roo-code/core/cli"

import { arePathsEqual } from "@/lib/utils/path.js"

const DEFAULT_CLI_TASK_STORAGE_PATH = path.join(os.homedir(), ".vscode-mock", "global-storage")

export function getDefaultCliTaskStoragePath(): string {
	return DEFAULT_CLI_TASK_STORAGE_PATH
}

export function filterSessionsForWorkspace(sessions: TaskSessionEntry[], workspacePath: string): TaskSessionEntry[] {
	return sessions
		.filter((session) => typeof session.workspace === "string" && arePathsEqual(session.workspace, workspacePath))
		.sort((a, b) => b.ts - a.ts)
}

export async function readWorkspaceTaskSessions(
	workspacePath: string,
	storagePath = DEFAULT_CLI_TASK_STORAGE_PATH,
): Promise<TaskSessionEntry[]> {
	const sessions = await readTaskSessionsFromStoragePath(storagePath)
	return filterSessionsForWorkspace(sessions, workspacePath)
}

export function resolveWorkspaceResumeSessionId(sessions: TaskSessionEntry[], requestedSessionId?: string): string {
	if (requestedSessionId) {
		const hasRequestedSession = sessions.some((session) => session.id === requestedSessionId)
		if (!hasRequestedSession) {
			throw new Error(`Session not found in current workspace: ${requestedSessionId}`)
		}

		return requestedSessionId
	}

	const mostRecentSessionId = sessions[0]?.id
	if (!mostRecentSessionId) {
		throw new Error("No previous tasks found to continue in this workspace.")
	}

	return mostRecentSessionId
}
