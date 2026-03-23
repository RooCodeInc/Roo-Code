// src/core/multi-orchestrator/agent-coordinator.ts
import { EventEmitter } from "events"
import type { ClineProvider } from "../webview/ClineProvider"
import type { AgentState } from "./types"
import type { TokenUsage, ToolUsage } from "@roo-code/types"
import { RooCodeEventName } from "@roo-code/types"

/** Default timeout for waitForAll(): 10 minutes in milliseconds. */
const DEFAULT_WAIT_TIMEOUT_MS = 10 * 60 * 1000

export interface AgentCoordinatorEvents {
	agentCompleted: [taskId: string]
	agentFailed: [taskId: string]
	allCompleted: []
}

export class AgentCoordinator extends EventEmitter<AgentCoordinatorEvents> {
	private agents: Map<string, AgentState> = new Map()
	private providers: Map<string, ClineProvider> = new Map()
	private completedSet: Set<string> = new Set()

	/** Register an agent and attach event listeners to its provider */
	registerAgent(agent: AgentState, provider: ClineProvider): void {
		console.log(
			`[AgentCoordinator] registerAgent: taskId=${agent.taskId}, title="${agent.title}", ` +
				`getCurrentTask exists=${!!provider.getCurrentTask()}`,
		)
		this.agents.set(agent.taskId, agent)
		this.providers.set(agent.taskId, provider)

		// Listen for task completion on this provider.
		// ClineProvider emits TaskCompleted with (taskId, tokenUsage, toolUsage).
		provider.on(
			RooCodeEventName.TaskCompleted,
			(taskId: string, tokenUsage: TokenUsage, toolUsage: ToolUsage) => {
				console.log(
					`[AgentCoordinator] TaskCompleted received for agent ${agent.taskId} ` +
						`(event taskId=${taskId})`,
				)
				// Capture the completion report from the task's messages before aborting.
				// The last "completion_result" say message contains the agent's summary.
				const currentTask = provider.getCurrentTask()
				if (currentTask) {
					try {
						const messages = currentTask.clineMessages || []
						const completionMsg = [...messages].reverse().find(
							(m) => m.say === "completion_result" && m.text,
						)
						const agentState = this.agents.get(agent.taskId)
						if (agentState && completionMsg?.text) {
							agentState.completionReport = completionMsg.text
							console.log(`[AgentCoordinator] Captured completion report for agent ${agent.taskId} (${completionMsg.text.length} chars)`)
						}
					} catch (err) {
						console.warn(`[AgentCoordinator] Failed to capture completion report: ${err}`)
					}
				}

				this.handleAgentFinished(agent.taskId, "completed", tokenUsage)

				// CRITICAL: Abort the task to prevent the while(!abort) loop from
				// making another API request after attempt_completion succeeds.
				if (currentTask) {
					currentTask.abortTask(false).catch(() => {})
					console.log(`[AgentCoordinator] Aborted task for agent ${agent.taskId} to prevent completion loop`)
				}
			},
		)

		// ClineProvider emits TaskAborted with (taskId).
		provider.on(RooCodeEventName.TaskAborted, (_taskId: string) => {
			console.log(
				`[AgentCoordinator] TaskAborted received for agent ${agent.taskId} ` +
					`(event taskId=${_taskId})`,
			)
			this.handleAgentFinished(agent.taskId, "failed")
		})
	}

	/**
	 * Centralized handler for agent completion/failure.
	 * Guards against duplicate events for the same agent.
	 */
	private handleAgentFinished(
		agentTaskId: string,
		status: "completed" | "failed",
		tokenUsage?: TokenUsage,
	): void {
		console.log(
			`[AgentCoordinator] handleAgentFinished: agentTaskId=${agentTaskId}, ` +
				`status=${status}, already completed=${this.completedSet.has(agentTaskId)}, ` +
				`completedSet size=${this.completedSet.size}/${this.agents.size}`,
		)
		// Guard: ignore duplicate events for the same agent
		if (this.completedSet.has(agentTaskId)) {
			return
		}

		const agentState = this.agents.get(agentTaskId)
		if (!agentState) {
			return
		}

		this.completedSet.add(agentTaskId)
		agentState.status = status
		agentState.completedAt = Date.now()

		if (status === "completed" && tokenUsage) {
			agentState.tokenUsage = {
				input: tokenUsage.totalTokensIn,
				output: tokenUsage.totalTokensOut,
			}
		}

		this.emit(status === "completed" ? "agentCompleted" : "agentFailed", agentTaskId)

		if (this.allComplete()) {
			this.emit("allCompleted")
		}
	}

	/**
	 * Start all agents simultaneously.
	 * Each provider should already have a task created with startTask=false.
	 * Agents whose provider has no current task are marked as failed immediately
	 * so waitForAll() never hangs.
	 *
	 * BUG-002 fix: Instead of calling start() sequentially inside the loop,
	 * we collect all start thunks first, then fire them all at the same instant
	 * so no agent gets a head-start over another.
	 */
	async startAll(): Promise<void> {
		console.log(
			`[AgentCoordinator] startAll() — ${this.providers.size} providers registered`,
		)

		const starts: Array<() => void> = []

		for (const [taskId, provider] of this.providers) {
			const currentTask = provider.getCurrentTask()
			console.log(
				`[AgentCoordinator] startAll() — agent ${taskId}: ` +
					`getCurrentTask()=${currentTask ? `Task#${currentTask.taskId}` : "UNDEFINED"}, ` +
					`provider.clineStack size=${provider.getTaskStackSize?.() ?? "N/A"}`,
			)
			if (!currentTask) {
				// Task was never created or was already removed from the stack.
				console.error(
					`[AgentCoordinator] getCurrentTask() returned undefined for agent ${taskId}. ` +
						`The task may not have been created yet or was removed from the stack.`,
				)
				this.handleAgentFinished(taskId, "failed")
				continue
			}

			const agent = this.agents.get(taskId)
			if (agent) {
				agent.status = "running"
				agent.startedAt = Date.now()
			}

			starts.push(() => {
				try {
					currentTask.start()
				} catch (err) {
					console.error(
						`[AgentCoordinator] start() threw for agent ${taskId}: ${
							(err as Error)?.message ?? String(err)
						}`,
					)
					this.handleAgentFinished(taskId, "failed")
				}
			})
		}

		// Stagger starts with a 2-second gap between each agent.
		// Simultaneous API calls from N agents to the same provider cause rate
		// limiting ("Provider ended the request: terminated") which cascades
		// into retry loops. A 2s stagger lets each agent's first API request
		// complete before the next one fires, avoiding provider throttling.
		console.log(`[AgentCoordinator] Staggering ${starts.length} agent starts (2s apart)`)
		for (let i = 0; i < starts.length; i++) {
			if (i > 0) {
				await new Promise((resolve) => setTimeout(resolve, 2000))
			}
			console.log(`[AgentCoordinator] Starting agent ${i + 1}/${starts.length}`)
			starts[i]()
		}
	}

	/** Check if all agents have finished (completed or failed) */
	allComplete(): boolean {
		// If no agents registered, not "complete" — avoids vacuous-truth bugs
		if (this.agents.size === 0) {
			return false
		}
		return this.completedSet.size >= this.agents.size
	}

	/** Get current state of all agents */
	getStates(): AgentState[] {
		return Array.from(this.agents.values())
	}

	/** Get a specific agent's state */
	getState(taskId: string): AgentState | undefined {
		return this.agents.get(taskId)
	}

	/**
	 * Wait for all agents to complete (returns a promise).
	 * @param timeoutMs Maximum time to wait in ms. Defaults to 10 minutes.
	 *                  Pass 0 or Infinity to wait indefinitely.
	 * @throws Error if the timeout is reached before all agents complete.
	 */
	waitForAll(timeoutMs: number = DEFAULT_WAIT_TIMEOUT_MS): Promise<void> {
		if (this.allComplete()) return Promise.resolve()

		return new Promise<void>((resolve, reject) => {
			let timer: ReturnType<typeof setTimeout> | undefined

			const cleanup = () => {
				if (timer !== undefined) {
					clearTimeout(timer)
					timer = undefined
				}
			}

			const onComplete = () => {
				cleanup()
				resolve()
			}

			this.once("allCompleted", onComplete)

			// Set up timeout if a finite positive value is provided
			if (timeoutMs > 0 && timeoutMs < Infinity) {
				timer = setTimeout(() => {
					this.off("allCompleted", onComplete)
					const pending = Array.from(this.agents.entries())
						.filter(([id]) => !this.completedSet.has(id))
						.map(([id, agent]) => `${id} (${agent.title})`)
					reject(
						new Error(
							`AgentCoordinator.waitForAll() timed out after ${timeoutMs}ms. ` +
								`${this.completedSet.size}/${this.agents.size} agents completed. ` +
								`Pending: ${pending.join(", ")}`,
						),
					)
				}, timeoutMs)
			}
		})
	}

	/** Get total agent count */
	get totalAgents(): number {
		return this.agents.size
	}

	/** Get completed agent count */
	get completedAgents(): number {
		return this.completedSet.size
	}
}
