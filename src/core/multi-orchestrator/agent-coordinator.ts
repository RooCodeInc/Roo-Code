// src/core/multi-orchestrator/agent-coordinator.ts
import { EventEmitter } from "events"
import type { ClineProvider } from "../webview/ClineProvider"
import type { AgentState } from "./types"
import type { TokenUsage, ToolUsage } from "@roo-code/types"
import { RooCodeEventName } from "@roo-code/types"

export interface AgentCoordinatorEvents {
	agentCompleted: [taskId: string]
	agentFailed: [taskId: string]
	allCompleted: []
}

export class AgentCoordinator extends EventEmitter<AgentCoordinatorEvents> {
	private agents: Map<string, AgentState> = new Map()
	private providers: Map<string, ClineProvider> = new Map()
	private completionCount = 0

	/** Register an agent and attach event listeners to its provider */
	registerAgent(agent: AgentState, provider: ClineProvider): void {
		this.agents.set(agent.taskId, agent)
		this.providers.set(agent.taskId, provider)

		// Listen for task completion on this provider.
		// ClineProvider emits TaskCompleted with (taskId, tokenUsage, toolUsage).
		provider.on(
			RooCodeEventName.TaskCompleted,
			(taskId: string, tokenUsage: TokenUsage, toolUsage: ToolUsage) => {
				const agentState = this.agents.get(agent.taskId)
				if (agentState) {
					agentState.status = "completed"
					agentState.completedAt = Date.now()
					agentState.tokenUsage = {
						input: tokenUsage.totalTokensIn,
						output: tokenUsage.totalTokensOut,
					}
					this.completionCount++
					this.emit("agentCompleted", agent.taskId)

					if (this.allComplete()) {
						this.emit("allCompleted")
					}
				}
			},
		)

		// ClineProvider emits TaskAborted with (taskId).
		provider.on(RooCodeEventName.TaskAborted, (_taskId: string) => {
			const agentState = this.agents.get(agent.taskId)
			if (agentState) {
				agentState.status = "failed"
				agentState.completedAt = Date.now()
				this.completionCount++
				this.emit("agentFailed", agent.taskId)

				if (this.allComplete()) {
					this.emit("allCompleted")
				}
			}
		})
	}

	/**
	 * Start all agents simultaneously.
	 * Each provider should already have a task created with startTask=false.
	 */
	async startAll(): Promise<void> {
		const startPromises: Promise<void>[] = []

		for (const [taskId, provider] of this.providers) {
			const agent = this.agents.get(taskId)
			if (agent) {
				agent.status = "running"
				agent.startedAt = Date.now()
			}

			const currentTask = provider.getCurrentTask()
			if (currentTask) {
				startPromises.push(
					new Promise<void>((resolve) => {
						currentTask.start()
						resolve()
					}),
				)
			}
		}

		// Start all simultaneously
		await Promise.all(startPromises)
	}

	/** Check if all agents have finished (completed or failed) */
	allComplete(): boolean {
		return this.completionCount >= this.agents.size
	}

	/** Get current state of all agents */
	getStates(): AgentState[] {
		return Array.from(this.agents.values())
	}

	/** Get a specific agent's state */
	getState(taskId: string): AgentState | undefined {
		return this.agents.get(taskId)
	}

	/** Wait for all agents to complete (returns a promise) */
	waitForAll(): Promise<void> {
		if (this.allComplete()) return Promise.resolve()
		return new Promise((resolve) => {
			this.once("allCompleted", resolve)
		})
	}

	/** Get total agent count */
	get totalAgents(): number {
		return this.agents.size
	}

	/** Get completed agent count */
	get completedAgents(): number {
		return this.completionCount
	}
}
