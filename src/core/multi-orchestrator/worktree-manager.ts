import { WorktreeService } from "@roo-code/core"
import { MULTI_ORCHESTRATOR_CONSTANTS } from "./types"
import * as path from "path"

export interface WorktreeInfo {
	agentId: string
	path: string
	branch: string
}

export class MultiWorktreeManager {
	private worktreeService: WorktreeService
	private worktrees: Map<string, WorktreeInfo> = new Map()

	constructor(private workspacePath: string) {
		this.worktreeService = new WorktreeService()
	}

	/**
	 * Create a git worktree for each agent.
	 * Each gets its own branch from current HEAD and its own directory.
	 */
	async createWorktrees(agentIds: string[]): Promise<Map<string, WorktreeInfo>> {
		for (const agentId of agentIds) {
			const branch = `${MULTI_ORCHESTRATOR_CONSTANTS.BRANCH_PREFIX}${agentId}`
			const worktreePath = path.join(
				path.dirname(this.workspacePath),
				`${MULTI_ORCHESTRATOR_CONSTANTS.WORKTREE_PREFIX}${agentId}`,
			)

			const result = await this.worktreeService.createWorktree(this.workspacePath, {
				path: worktreePath,
				branch,
				createNewBranch: true,
			})

			if (!result.success) {
				throw new Error(`Failed to create worktree for agent ${agentId}: ${result.message}`)
			}

			this.worktrees.set(agentId, { agentId, path: worktreePath, branch })
		}

		return new Map(this.worktrees)
	}

	/** Get worktree info for a specific agent */
	getWorktree(agentId: string): WorktreeInfo | undefined {
		return this.worktrees.get(agentId)
	}

	/** Get all worktrees */
	getAllWorktrees(): WorktreeInfo[] {
		return Array.from(this.worktrees.values())
	}

	/** Clean up all worktrees created by this orchestration */
	async cleanupWorktrees(): Promise<void> {
		for (const [agentId, info] of this.worktrees) {
			try {
				await this.worktreeService.deleteWorktree(this.workspacePath, info.path, true)
			} catch (error) {
				console.error(`[MultiOrch] Failed to cleanup worktree for ${agentId}:`, error)
			}
		}
		this.worktrees.clear()
	}

	/** Get the branch name for an agent */
	getBranchName(agentId: string): string {
		return `${MULTI_ORCHESTRATOR_CONSTANTS.BRANCH_PREFIX}${agentId}`
	}
}
