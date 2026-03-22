// src/core/multi-orchestrator/merge-pipeline.ts
import { execSync } from "child_process"
import type { AgentState, MergeResult } from "./types"

export class MergePipeline {
	constructor(private workspacePath: string) {}

	/**
	 * Merge all agent branches sequentially into the current branch.
	 * Order: by priority (lower = first).
	 */
	async mergeAll(
		agents: AgentState[],
		onProgress: (agentId: string, result: MergeResult) => void,
	): Promise<MergeResult[]> {
		const results: MergeResult[] = []

		// Sort by priority for deterministic merge order
		const sorted = [...agents]
			.filter((a) => a.worktreeBranch && a.status === "completed")
			.sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0))

		for (const agent of sorted) {
			if (!agent.worktreeBranch) continue

			const result = this.mergeBranch(agent.taskId, agent.worktreeBranch)
			results.push(result)
			onProgress(agent.taskId, result)
		}

		return results
	}

	/** Merge a single agent's branch into the current branch */
	private mergeBranch(agentTaskId: string, branch: string): MergeResult {
		try {
			// Get list of files changed on this branch
			const filesChanged = this.getFilesChanged(branch)

			// Attempt merge
			try {
				execSync(`git merge --no-ff "${branch}" -m "Merge multi-orch agent: ${agentTaskId}"`, {
					cwd: this.workspacePath,
					encoding: "utf-8",
					timeout: 30000,
				})

				return {
					agentTaskId,
					branch,
					success: true,
					conflictsFound: 0,
					conflictsResolved: 0,
					filesChanged,
				}
			} catch (mergeError) {
				// Merge conflict — count them
				const conflictFiles = this.getConflictFiles()
				const conflictsFound = conflictFiles.length

				if (conflictsFound > 0) {
					// Abort the merge for now — let the report indicate conflicts
					try {
						execSync("git merge --abort", { cwd: this.workspacePath, encoding: "utf-8" })
					} catch {
						// If abort fails, reset
						execSync("git reset --hard HEAD", { cwd: this.workspacePath, encoding: "utf-8" })
					}
				}

				return {
					agentTaskId,
					branch,
					success: false,
					conflictsFound,
					conflictsResolved: 0,
					filesChanged,
				}
			}
		} catch (error) {
			return {
				agentTaskId,
				branch,
				success: false,
				conflictsFound: 0,
				conflictsResolved: 0,
				filesChanged: [],
			}
		}
	}

	/** Get files changed on a branch compared to current HEAD */
	private getFilesChanged(branch: string): string[] {
		try {
			const output = execSync(`git diff --name-only HEAD..."${branch}"`, {
				cwd: this.workspacePath,
				encoding: "utf-8",
				timeout: 10000,
			})
			return output.trim().split("\n").filter(Boolean)
		} catch {
			return []
		}
	}

	/** Get files with merge conflicts */
	private getConflictFiles(): string[] {
		try {
			const output = execSync("git diff --name-only --diff-filter=U", {
				cwd: this.workspacePath,
				encoding: "utf-8",
				timeout: 10000,
			})
			return output.trim().split("\n").filter(Boolean)
		} catch {
			return []
		}
	}
}
