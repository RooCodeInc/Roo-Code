// src/core/multi-orchestrator/orchestrator.ts
import * as vscode from "vscode"
import type { ProviderSettings, ModeConfig, RooCodeSettings } from "@roo-code/types"
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
		const notify = () => {
			console.log("[MultiOrch:Handler] notify() → phase:", this.state.phase, "agents:", this.state.agents.length)
			onStateChange({ ...this.state })
		}

		try {
			// PHASE 1: PLAN
			this.state.phase = "planning"
			notify()

			console.log("[MultiOrch:Handler] execute() entry ──────────────────────")
			console.log("[MultiOrch:Handler]   userRequest:", JSON.stringify(userRequest).slice(0, 200))
			console.log("[MultiOrch:Handler]   maxAgents:", maxAgents, "typeof:", typeof maxAgents)
			console.log("[MultiOrch:Handler]   providerSettings.apiProvider:", providerSettings.apiProvider)
			console.log("[MultiOrch:Handler]   providerSettings.apiModelId:", providerSettings.apiModelId)
			console.log("[MultiOrch:Handler]   providerSettings has apiKey:", !!providerSettings.apiKey)
			console.log("[MultiOrch:Handler]   availableModes:", availableModes.length, "modes")
			console.log("[MultiOrch:Handler]   planReviewEnabled:", planReviewEnabled)
			console.log("[MultiOrch:Handler]   mergeMode:", mergeMode)
			console.log("[MultiOrch:Handler]   workspacePath:", this.workspacePath)

			const clampedMaxAgents = Math.min(
				Math.max(1, maxAgents),
				MULTI_ORCHESTRATOR_CONSTANTS.MAX_AGENTS,
			)
			console.log("[MultiOrch:Handler]   clampedMaxAgents:", clampedMaxAgents, "(MAX_AGENTS constant:", MULTI_ORCHESTRATOR_CONSTANTS.MAX_AGENTS, ")")

			console.log("[MultiOrch:Handler] calling generatePlan() ...")
			const plan = await generatePlan(userRequest, availableModes, clampedMaxAgents, providerSettings)
			console.log("[MultiOrch:Handler] generatePlan() returned:", plan ? `${plan.tasks.length} tasks` : "null/undefined")
			if (plan && plan.tasks.length > 0) {
				for (const t of plan.tasks) {
					console.log("[MultiOrch:Handler]   task:", t.id, "mode:", t.mode, "title:", t.title)
				}
			}
			if (!plan || plan.tasks.length === 0) {
				console.log("[MultiOrch:Handler] ⚠ empty plan — setting phase=complete")
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
				console.log("[MultiOrch:Handler] planReview ON → returning early for user approval")
				// The onStateChange callback will trigger UI to show the plan
				// The execute() caller should handle the approval flow
				return
			}

			console.log("[MultiOrch:Handler] planReview OFF → continuing to executeFromPlan()")
			await this.executeFromPlan(plan, providerSettings, mergeMode, onStateChange)
		} catch (error) {
			console.error("[MultiOrch:Handler] execute() CAUGHT error:", error)
			console.error("[MultiOrch:Handler] error stack:", (error as Error)?.stack ?? "no stack")
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

			if (panels.size === 0) {
				throw new Error("No panels were spawned — cannot proceed with orchestration.")
			}

			// Build a lookup so we can match tasks to successfully-spawned panels.
			// If some panels failed to spawn, the corresponding tasks are marked failed.
			const panelEntries = Array.from(panels.entries())
			this.coordinator = new AgentCoordinator()

			// Auto-approval settings so spawned agents don't block on tool approval prompts.
			// The user interacts with the orchestrator sidebar — nobody is clicking approve
			// in the spawned panels, so every tool operation must be pre-approved.
			//
			// CRITICAL FIX: These are set as per-provider overrides (NOT via
			// setValues/ContextProxy). ContextProxy is a singleton shared by ALL
			// providers — any concurrent activity (main sidebar, other panels, mode
			// switches) can overwrite values that were set via setValues(), causing
			// auto-approval to silently disappear by the time the Task's
			// checkAutoApproval() reads provider.getState().
			//
			// Per-provider overrides are held in instance memory and merged LAST
			// in getState(), so they always win regardless of ContextProxy mutations.
			const autoApprovalOverrides: Partial<RooCodeSettings> & { multiOrchForceApproveAll: boolean } = {
				autoApprovalEnabled: true,
				multiOrchForceApproveAll: true,              // bypass ALL approval checks unconditionally
				alwaysAllowReadOnly: true,
				alwaysAllowReadOnlyOutsideWorkspace: true,
				alwaysAllowWrite: true,
				alwaysAllowWriteOutsideWorkspace: true,
				alwaysAllowWriteProtected: true,
				alwaysAllowExecute: true,
				alwaysAllowMcp: true,
				alwaysAllowModeSwitch: true,
				alwaysAllowSubtasks: true,
				alwaysAllowFollowupQuestions: true,
				followupAutoApproveTimeoutMs: 1,
				writeDelayMs: 0,
				requestDelaySeconds: 0,
			}

			// All panels are already spawned. Now create tasks in parallel —
			// each task targets a different ClineProvider so there are no
			// shared-state conflicts between the concurrent createTask() calls.
			const taskPromises = plan.tasks.map(async (task, i) => {
				if (this.aborted) return

				const agent = this.state.agents[i]

				// Panel index may not exist if that panel failed to spawn
				if (i >= panelEntries.length) {
					console.warn(`[MultiOrch] No panel available for task ${task.id} ("${task.title}") — skipping`)
					agent.status = "failed"
					agent.completionReport = "Panel failed to spawn"
					return
				}

				const [panelId, spawned] = panelEntries[i]

				agent.providerId = panelId
				agent.panelId = panelId

				// Set per-provider auto-approval overrides BEFORE creating the task.
				// These persist in provider instance memory and are immune to
				// ContextProxy mutations from other providers.
				spawned.provider.setAutoApprovalOverrides(autoApprovalOverrides)

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

				// Create the task WITHOUT passing configuration — auto-approval is
				// guaranteed by the per-provider overrides set above.
				await spawned.provider.createTask(task.description, undefined, undefined, {
					startTask: false,
				})

				// Verify auto-approval is active after task creation.
				// This catches regressions where createTask() might reset state.
				try {
					const postCreateState = await spawned.provider.getState()
					console.log(
						`[MultiOrch] Agent ${task.id} post-createTask auto-approval check: ` +
							`autoApprovalEnabled=${postCreateState?.autoApprovalEnabled}, ` +
							`alwaysAllowWrite=${postCreateState?.alwaysAllowWrite}, ` +
							`alwaysAllowExecute=${postCreateState?.alwaysAllowExecute}, ` +
							`alwaysAllowReadOnly=${postCreateState?.alwaysAllowReadOnly}, ` +
							`alwaysAllowMcp=${postCreateState?.alwaysAllowMcp}`,
					)
				} catch (stateErr) {
					console.warn(`[MultiOrch] Could not read back state after createTask: ${stateErr}`)
				}

				// Register with coordinator
				this.coordinator!.registerAgent(agent, spawned.provider)
			})
			await Promise.all(taskPromises)

			notify()

			// PHASE 3: RUN
			this.state.phase = "running"
			notify()

			// Attach event listeners BEFORE starting so we never miss
			// early completions or failures that fire during startAll().
			this.coordinator.on("agentCompleted", () => notify())
			this.coordinator.on("agentFailed", () => notify())

			// Verify at least one agent was successfully registered
			if (this.coordinator.totalAgents === 0) {
				throw new Error(
					"No agents were registered with the coordinator — " +
						"all panels may have failed to spawn or all tasks failed to create.",
				)
			}

			// Start all agents simultaneously (synchronous — each task.start()
			// is fire-and-forget; failures are handled inside startAll()).
			this.coordinator.startAll()

			// Wait for all to complete (with timeout)
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
