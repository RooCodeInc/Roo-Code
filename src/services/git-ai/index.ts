import { spawn, exec } from "child_process"
import { promisify } from "util"

import type { ApiMessage } from "../../core/task-persistence/apiMessages"

import { buildTranscript } from "./transcript"

const execAsync = promisify(exec)

/**
 * Narrow interface for the Task data needed by gitAiAfterEdit.
 * Avoids coupling the git-ai service to the full Task class.
 */
export interface GitAiTaskContext {
	taskId: string
	cwd: string
	apiConversationHistory: ApiMessage[]
	api: { getModel(): { id: string } }
}

// Cached result of checking if git-ai CLI is installed.
let gitAiAvailableCache: boolean | null = null

/**
 * Check if the git-ai CLI is available on the system.
 * Result is cached for the lifetime of the process.
 */
export async function isGitAiAvailable(): Promise<boolean> {
	if (gitAiAvailableCache !== null) {
		return gitAiAvailableCache
	}
	try {
		const cmd = process.platform === "win32" ? "where" : "which"
		await execAsync(`${cmd} git-ai`)
		gitAiAvailableCache = true
	} catch {
		gitAiAvailableCache = false
	}
	return gitAiAvailableCache
}

// Cached git repo roots keyed by working directory. Null values indicate non-git directories.
const repoRootCache = new Map<string, string | null>()

/**
 * Get the git repository root for a given working directory.
 * Result is cached per cwd (including negative results for non-git directories).
 */
async function getGitRepoRoot(cwd: string): Promise<string | null> {
	if (repoRootCache.has(cwd)) {
		return repoRootCache.get(cwd)!
	}
	try {
		const { stdout } = await execAsync("git rev-parse --show-toplevel", { cwd })
		const root = stdout.trim()
		repoRootCache.set(cwd, root)
		return root
	} catch {
		repoRootCache.set(cwd, null)
		return null
	}
}

/**
 * Spawn a process and pipe input to its stdin.
 */
function execWithStdin(command: string, args: string[], input: string, cwd: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const proc = spawn(command, args, { cwd, stdio: ["pipe", "ignore", "ignore"] })
		proc.stdin.write(input)
		proc.stdin.end()
		proc.on("close", (code) => {
			if (code === 0) {
				resolve()
			} else {
				reject(new Error(`git-ai exited with code ${code}`))
			}
		})
		proc.on("error", reject)
	})
}

/**
 * Call git-ai checkpoint before a file edit.
 * Marks any uncommitted changes as human-generated.
 *
 * Must be awaited before the file save to correctly attribute prior changes.
 * Never throws — failures are logged and silently ignored.
 */
export async function gitAiBeforeEdit(cwd: string, filepaths: string[]): Promise<void> {
	try {
		if (!(await isGitAiAvailable())) {
			return
		}
		const repoRoot = await getGitRepoRoot(cwd)
		if (!repoRoot) {
			return
		}

		const payload = JSON.stringify({
			type: "human",
			repo_working_dir: repoRoot,
			will_edit_filepaths: filepaths,
		})

		await execWithStdin("git-ai", ["checkpoint", "agent-v1", "--hook-input", "stdin"], payload, repoRoot)
	} catch (error) {
		console.error("[git-ai] gitAiBeforeEdit failed:", error)
	}
}

/**
 * Call git-ai checkpoint after a file edit.
 * Marks the new changes as AI-generated with full session context.
 *
 * Never throws — failures are logged and silently ignored.
 */
export async function gitAiAfterEdit(cwd: string, task: GitAiTaskContext, filepaths: string[]): Promise<void> {
	try {
		if (!(await isGitAiAvailable())) {
			return
		}
		const repoRoot = await getGitRepoRoot(cwd)
		if (!repoRoot) {
			return
		}

		const payload = JSON.stringify({
			type: "ai_agent",
			repo_working_dir: repoRoot,
			transcript: {
				messages: buildTranscript(task.apiConversationHistory),
			},
			agent_name: "roo-code",
			model: task.api.getModel().id.split("/").pop() ?? task.api.getModel().id,
			conversation_id: task.taskId,
			edited_filepaths: filepaths,
		})

		await execWithStdin("git-ai", ["checkpoint", "agent-v1", "--hook-input", "stdin"], payload, repoRoot)
	} catch (error) {
		console.error("[git-ai] gitAiAfterEdit failed:", error)
	}
}

/**
 * Reset cached state. Exported for testing.
 */
export function resetGitAiCache(): void {
	gitAiAvailableCache = null
	repoRootCache.clear()
}
