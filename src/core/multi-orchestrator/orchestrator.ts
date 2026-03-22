// src/core/multi-orchestrator/orchestrator.ts
import * as vscode from "vscode"
import type { ProviderSettings, ModeConfig } from "@roo-code/types"
import { PanelSpawner } from "./panel-spawner"
import { MultiWorktreeManager } from "./worktree-manager"
import { generatePlan } from "./plan-generator"
import { AgentCoordinator } from "./agent-coordinator"
import { MergePipeline } from "./merge-pipeline"
import { aggregateReports } from "./report-aggregator"
import {
	type OrchestratorState,
	type OrchestratorPlan,
	createInitialOrchestratorState,
	createInitialAgentState,
	MULTI_ORCHESTRATOR_CONSTANTS,
} from "./types"

export class MultiOrchestrator {
	private state: OrchestratorState = createInitialOrchestratorState()
	private panelSpawner: PanelSpawner
	private worktreeManager: MultiWorktreeManager | null = null
	private coordinator: AgentCoordinator | null = null
	private mergePipeline: MergePipeline | null = null
	private aborted = false

	constructor(
		private context: vscode.ExtensionContext,
		private outputChannel: vscode.OutputChannel,
		private workspacePath: string,
	) {
		this.panelSpawner = new PanelSpawner(context, outputChannel)
	}

	/**
	 * Execute the full multi-orchestration lifecycle.
	 */
	async execute(
		userRequest: string,
		maxAgents: number,
		providerSettings: ProviderSettings,
		availableModes: ModeConfig[],
		planReviewEnabled: boolean,
		mergeMode: "auto" | "always" | "never",
		onStateChange: (state: OrchestratorState) => void,
	): Promise<void> {
		this.aborted = false
		const notify = () => onStateChange({ ...this.state })

		try {
			// PHASE 1: PLAN
			this.state.phase = "planning"
			notify()

			const clampedMaxAgents = Math.min(
				Math.max(1, maxAgents),
				MULTI_ORCHESTRATOR_CONSTANTS.MAX_AGENTS,
			)

			const plan = await generatePlan(userRequest, availableModes, clampedMaxAgents, providerSettings)
			if (!plan || plan.tasks.length === 0) {
				this.state.phase = "complete"
				this.state.finalReport = "Could not decompose the request into parallel tasks."
				notify()
				return
			}

			this.state.plan = plan
			this.state.agents = plan.tasks.map(createInitialAgentState)
			notify()

			// If plan review enabled, stop here and wait for approval
			if (planReviewEnabled) {
				// The onStateChange callback will trigger UI to show the plan
				// The execute() caller should handle the approval flow
				return
			}

			await this.executeFromPlan(plan, providerSettings, mergeMode, onStateChange)
		} catch (error) {
			this.state.phase = "complete"
			this.state.finalReport = `Orchestration failed: ${error}`
			notify()
		}
	}

	/**
	 * Resume execution after plan approval (called when user approves in plan-review mode).
	 */
	async executeFromPlan(
		plan: OrchestratorPlan,
		providerSettings: ProviderSettings,
		mergeMode: "auto" | "always" | "never",
		onStateChange: (state: OrchestratorState) => void,
	): Promise<void> {
		const notify = () => onStateChange({ ...this.state })

		try {
			// PHASE 2: SPAWN
			this.state.phase = "spawning"
			notify()

			const needsMerge =
				mergeMode === "always" ||
				(mergeMode === "auto" && plan.requiresMerge) ||
				false

			// Check if we CAN use worktrees (requires git repo)
			let canUseWorktrees = false
			if (needsMerge) {
				this.worktreeManager = new MultiWorktreeManager(this.workspacePath)
				canUseWorktrees = await this.worktreeManager.isGitRepo()

				if (!canUseWorktrees) {
					console.log("[MultiOrch] No git repo found, skipping worktree isolation")
					// Agents will work on the same directory — this is fine if files don't overlap
				}
			}

			// Only create worktrees if git is available
			if (canUseWorktrees && needsMerge) {
				const agentIds = plan.tasks.map((t) => t.id)
				const worktrees = await this.worktreeManager!.createWorktrees(agentIds)

				// Update agent states with worktree info
				for (const agent of this.state.agents) {
					const wt = worktrees.get(agent.taskId)
					if (wt) {
						agent.worktreePath = wt.path
						agent.worktreeBranch = wt.branch
					}
				}
			}

			// Open panels
			const titles = plan.tasks.map((t) => t.title)
			const panels = await this.panelSpawner.spawnPanels(plan.tasks.length, titles)

			// Create tasks in each provider (startTask=false)
			const panelEntries = Array.from(panels.entries())
			this.coordinator = new AgentCoordinator()

			for (let i = 0; i < plan.tasks.length; i++) {
				if (this.aborted) return

				const task = plan.tasks[i]
				const [panelId, spawned] = panelEntries[i]
				const agent = this.state.agents[i]

				agent.providerId = panelId
				agent.panelId = panelId

				// Switch provider to the correct mode BEFORE creating the task.
				// The Task constructor initializes its mode from provider.getState()
				// during initializeTaskMode(), so the mode must already be set.
				// (Mirrors the pattern in ClineProvider.delegateParentAndOpenChild)
				try {
					await spawned.provider.handleModeSwitch(task.mode)
				} catch (e) {
					console.warn(
						`[MultiOrch] handleModeSwitch failed for agent ${task.id} mode '${task.mode}': ${
							(e as Error)?.message ?? String(e)
						}`,
					)
				}

				// Create the task in this provider but don't start it yet
				await spawned.provider.createTask(task.description, undefined, undefined, {
					startTask: false,
				})

				// Register with coordinator
				this.coordinator.registerAgent(agent, spawned.provider)
			}

			notify()

			// PHASE 3: RUN
			this.state.phase = "running"
			notify()

			// Start all simultaneously
			await this.coordinator.startAll()

			// Monitor: update state on each agent completion
			this.coordinator.on("agentCompleted", () => notify())
			this.coordinator.on("agentFailed", () => notify())

			// Wait for all to complete
			await this.coordinator.waitForAll()

			// PHASE 4: MERGE (if needed and worktrees were actually created)
			if (canUseWorktrees && needsMerge && mergeMode !== "never") {
				this.state.phase = "merging"
				notify()

				this.mergePipeline = new MergePipeline(this.workspacePath)
				this.state.mergeResults = await this.mergePipeline.mergeAll(
					this.state.agents,
					(_agentId, _result) => notify(),
				)
			}

			// PHASE 5: REPORT
			this.state.phase = "reporting"
			notify()

			this.state.finalReport = aggregateReports(this.state.agents, this.state.mergeResults)

			// Cleanup worktrees
			if (this.worktreeManager) {
				await this.worktreeManager.cleanupWorktrees()
			}

			this.state.phase = "complete"
			notify()
		} catch (error) {
			this.state.phase = "complete"
			this.state.finalReport = `Orchestration failed: ${error}`
			onStateChange({ ...this.state })
		}
	}

	/** Abort the current orchestration */
	async abort(): Promise<void> {
		this.aborted = true
		await this.panelSpawner.closeAllPanels()
		if (this.worktreeManager) {
			await this.worktreeManager.cleanupWorktrees()
		}
		this.state.phase = "complete"
		this.state.finalReport = "Orchestration aborted by user."
	}

	/** Get current state */
	getState(): OrchestratorState {
		return { ...this.state }
	}
}
