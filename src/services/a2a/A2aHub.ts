import * as fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"
import chokidar, { FSWatcher } from "chokidar"
import deepEqual from "fast-deep-equal"

import type {
	A2aAgent,
	A2aAgentCard,
	A2aAgentConfig,
	A2aJsonRpcRequest,
	A2aJsonRpcResponse,
	A2aMessage,
	A2aTask,
	A2aTaskState,
} from "@roo-code/types"

import { ClineProvider } from "../../core/webview/ClineProvider"
import { GlobalFileNames } from "../../shared/globalFileNames"
import { fileExistsAtPath } from "../../utils/fs"
import { getWorkspacePath } from "../../utils/path"
import { safeWriteJson } from "../../utils/safeWriteJson"

// ============================================================================
// A2A Settings Types
// ============================================================================

interface A2aSettingsFile {
	a2aAgents?: Record<string, A2aAgentConfig>
}

// ============================================================================
// A2aHub - Manages A2A agent connections
// ============================================================================

export class A2aHub {
	private providerRef: WeakRef<ClineProvider>
	private agents: A2aAgent[] = []
	private fileWatchers: FSWatcher[] = []
	private settingsFilePath: string = ""
	private projectSettingsFilePath: string = ""
	private isDisposed = false
	private clientCount = 0

	constructor(provider: ClineProvider) {
		this.providerRef = new WeakRef(provider)
	}

	// ========================================================================
	// Lifecycle
	// ========================================================================

	async initialize(): Promise<void> {
		const provider = this.providerRef.deref()
		if (!provider) {
			return
		}

		// Set up settings file paths
		const globalStoragePath = provider.context.globalStorageUri.fsPath
		this.settingsFilePath = path.join(globalStoragePath, GlobalFileNames.a2aSettings)
		this.projectSettingsFilePath = path.join(getWorkspacePath() ?? "", ".roo", "a2a.json")

		// Ensure default settings file exists
		if (!(await fileExistsAtPath(this.settingsFilePath))) {
			await safeWriteJson(this.settingsFilePath, { a2aAgents: {} })
		}

		// Load agents from settings
		await this.loadAgents()

		// Watch settings files for changes
		this.watchSettingsFiles()
	}

	async dispose(): Promise<void> {
		this.isDisposed = true
		for (const watcher of this.fileWatchers) {
			await watcher.close()
		}
		this.fileWatchers = []
		this.agents = []
	}

	registerClient(): void {
		this.clientCount++
	}

	async unregisterClient(): Promise<void> {
		this.clientCount--
		if (this.clientCount <= 0) {
			await this.dispose()
		}
	}

	// ========================================================================
	// Agent Management
	// ========================================================================

	getAgents(): A2aAgent[] {
		return this.agents.filter((a) => !a.disabled)
	}

	getAllAgents(): A2aAgent[] {
		return [...this.agents]
	}

	getAgent(name: string): A2aAgent | undefined {
		return this.agents.find((a) => a.name === name && !a.disabled)
	}

	// ========================================================================
	// A2A Protocol Operations
	// ========================================================================

	/**
	 * Send a task to an A2A agent using the tasks/send method.
	 * Returns the task result with status and any artifacts.
	 */
	async sendTask(agentName: string, message: string, taskId?: string): Promise<A2aTask> {
		const agent = this.getAgent(agentName)
		if (!agent) {
			throw new Error(`A2A agent "${agentName}" not found or is disabled`)
		}

		const config = JSON.parse(agent.config) as A2aAgentConfig

		const id = taskId ?? `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

		const request: A2aJsonRpcRequest = {
			jsonrpc: "2.0",
			id,
			method: "tasks/send",
			params: {
				id,
				message: {
					role: "user",
					parts: [{ type: "text", text: message }],
				},
			},
		}

		const response = await this.makeRequest(config, request)

		if (response.error) {
			throw new Error(`A2A agent error (${response.error.code}): ${response.error.message}`)
		}

		if (!response.result) {
			throw new Error("A2A agent returned empty result")
		}

		// Update agent's active tasks
		const agentIndex = this.agents.findIndex((a) => a.name === agentName)
		if (agentIndex >= 0) {
			const currentAgent = this.agents[agentIndex]
			const activeTasks = currentAgent.activeTasks ?? []
			const existingIdx = activeTasks.findIndex((t) => t.id === response.result!.id)
			if (existingIdx >= 0) {
				activeTasks[existingIdx] = response.result
			} else {
				activeTasks.push(response.result)
			}
			this.agents[agentIndex] = { ...currentAgent, activeTasks }
		}

		this.notifyWebview()
		return response.result
	}

	/**
	 * Get the current status of a task from an A2A agent.
	 */
	async getTask(agentName: string, taskId: string): Promise<A2aTask> {
		const agent = this.getAgent(agentName)
		if (!agent) {
			throw new Error(`A2A agent "${agentName}" not found or is disabled`)
		}

		const config = JSON.parse(agent.config) as A2aAgentConfig

		const request: A2aJsonRpcRequest = {
			jsonrpc: "2.0",
			id: `get-${taskId}`,
			method: "tasks/get",
			params: { id: taskId },
		}

		const response = await this.makeRequest(config, request)

		if (response.error) {
			throw new Error(`A2A agent error (${response.error.code}): ${response.error.message}`)
		}

		if (!response.result) {
			throw new Error("A2A agent returned empty result")
		}

		return response.result
	}

	/**
	 * Cancel a task on an A2A agent.
	 */
	async cancelTask(agentName: string, taskId: string): Promise<A2aTask> {
		const agent = this.getAgent(agentName)
		if (!agent) {
			throw new Error(`A2A agent "${agentName}" not found or is disabled`)
		}

		const config = JSON.parse(agent.config) as A2aAgentConfig

		const request: A2aJsonRpcRequest = {
			jsonrpc: "2.0",
			id: `cancel-${taskId}`,
			method: "tasks/cancel",
			params: { id: taskId },
		}

		const response = await this.makeRequest(config, request)

		if (response.error) {
			throw new Error(`A2A agent error (${response.error.code}): ${response.error.message}`)
		}

		return response.result ?? { id: taskId, status: { state: "canceled" } }
	}

	/**
	 * Fetch the agent card from the agent's well-known endpoint.
	 */
	async fetchAgentCard(config: A2aAgentConfig): Promise<A2aAgentCard | undefined> {
		try {
			const url = new URL(config.url)
			const cardUrl = `${url.origin}/.well-known/agent.json`

			const headers: Record<string, string> = {
				"Content-Type": "application/json",
				...(config.headers ?? {}),
			}

			const response = await fetch(cardUrl, {
				method: "GET",
				headers,
				signal: AbortSignal.timeout(10000),
			})

			if (response.ok) {
				return (await response.json()) as A2aAgentCard
			}
		} catch {
			// Agent card is optional; ignore errors
		}
		return undefined
	}

	// ========================================================================
	// Settings Path Access
	// ========================================================================

	async getA2aSettingsFilePath(): Promise<string> {
		return this.settingsFilePath
	}

	// ========================================================================
	// Private Methods
	// ========================================================================

	/**
	 * Make an HTTP request to an A2A agent.
	 */
	private async makeRequest(config: A2aAgentConfig, request: A2aJsonRpcRequest): Promise<A2aJsonRpcResponse> {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			...(config.headers ?? {}),
		}

		const timeoutMs = (config.timeout ?? 300) * 1000

		const response = await fetch(config.url, {
			method: "POST",
			headers,
			body: JSON.stringify(request),
			signal: AbortSignal.timeout(timeoutMs),
		})

		if (!response.ok) {
			throw new Error(`A2A HTTP error ${response.status}: ${response.statusText}`)
		}

		return (await response.json()) as A2aJsonRpcResponse
	}

	/**
	 * Load agents from settings files.
	 */
	private async loadAgents(): Promise<void> {
		const globalAgents = await this.loadSettingsFile(this.settingsFilePath, "global")
		const projectAgents = await this.loadSettingsFile(this.projectSettingsFilePath, "project")

		// Project settings override global settings for agents with the same name
		const agentMap = new Map<string, A2aAgent>()

		for (const agent of globalAgents) {
			agentMap.set(agent.name, agent)
		}

		for (const agent of projectAgents) {
			agentMap.set(agent.name, agent)
		}

		const newAgents = Array.from(agentMap.values())

		if (!deepEqual(this.agents, newAgents)) {
			this.agents = newAgents

			// Try to fetch agent cards for newly connected agents
			for (const agent of this.agents) {
				if (!agent.agentCard && !agent.disabled) {
					const config = JSON.parse(agent.config) as A2aAgentConfig
					this.fetchAgentCard(config).then((card) => {
						if (card) {
							agent.agentCard = card
							agent.status = "connected"
							this.notifyWebview()
						}
					})
				}
			}

			this.notifyWebview()
		}
	}

	/**
	 * Load agents from a single settings file.
	 */
	private async loadSettingsFile(filePath: string, source: "global" | "project"): Promise<A2aAgent[]> {
		try {
			if (!(await fileExistsAtPath(filePath))) {
				return []
			}

			const content = await fs.readFile(filePath, "utf-8")
			const settings: A2aSettingsFile = JSON.parse(content)

			if (!settings.a2aAgents) {
				return []
			}

			return Object.entries(settings.a2aAgents).map(([name, config]) => ({
				name,
				config: JSON.stringify(config),
				status: "connecting" as const,
				disabled: config.disabled,
				description: config.description,
				source,
				projectPath: source === "project" ? getWorkspacePath() : undefined,
			}))
		} catch {
			return []
		}
	}

	/**
	 * Watch settings files for changes and reload.
	 */
	private watchSettingsFiles(): void {
		const watchPaths = [this.settingsFilePath]

		if (getWorkspacePath()) {
			watchPaths.push(this.projectSettingsFilePath)
		}

		for (const watchPath of watchPaths) {
			try {
				const watcher = chokidar.watch(watchPath, {
					persistent: true,
					ignoreInitial: true,
				})

				watcher.on("change", () => {
					if (!this.isDisposed) {
						this.loadAgents()
					}
				})

				watcher.on("add", () => {
					if (!this.isDisposed) {
						this.loadAgents()
					}
				})

				this.fileWatchers.push(watcher)
			} catch {
				// Ignore watcher errors for non-existent paths
			}
		}
	}

	/**
	 * Notify the webview of agent state changes.
	 */
	private notifyWebview(): void {
		const provider = this.providerRef.deref()
		if (provider) {
			provider.postMessageToWebview({
				type: "a2aAgents",
				a2aAgents: this.getAllAgents(),
			} as any)
		}
	}

	/**
	 * Toggle an agent's disabled state.
	 */
	async toggleAgentDisabled(agentName: string, source: "global" | "project", disabled: boolean): Promise<void> {
		const filePath = source === "global" ? this.settingsFilePath : this.projectSettingsFilePath

		try {
			const content = await fs.readFile(filePath, "utf-8")
			const settings: A2aSettingsFile = JSON.parse(content)

			if (settings.a2aAgents?.[agentName]) {
				settings.a2aAgents[agentName].disabled = disabled
				await safeWriteJson(filePath, settings)
			}
		} catch (error) {
			throw new Error(`Failed to toggle agent: ${error}`)
		}
	}

	/**
	 * Delete an agent from settings.
	 */
	async deleteAgent(agentName: string, source: "global" | "project"): Promise<void> {
		const filePath = source === "global" ? this.settingsFilePath : this.projectSettingsFilePath

		try {
			const content = await fs.readFile(filePath, "utf-8")
			const settings: A2aSettingsFile = JSON.parse(content)

			if (settings.a2aAgents?.[agentName]) {
				delete settings.a2aAgents[agentName]
				await safeWriteJson(filePath, settings)
			}
		} catch (error) {
			throw new Error(`Failed to delete agent: ${error}`)
		}
	}
}
