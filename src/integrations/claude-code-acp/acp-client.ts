import { ChildProcess, spawn } from "child_process"
import { EventEmitter } from "events"
import * as readline from "readline"

import type {
	JsonRpcRequest,
	JsonRpcResponse,
	JsonRpcNotification,
	AcpInitializeParams,
	AcpInitializeResult,
	AcpSessionNewParams,
	AcpSession,
	AcpPromptParams,
	AcpPromptResult,
	AcpCancelParams,
	AcpConnectionState,
	AcpSessionUpdateParams,
	AcpPermissionRequestParams,
	AcpPermissionResult,
	AcpSessionLoadParams,
	AcpSessionLoadResult,
	AcpSessionResumeParams,
	AcpSessionResumeResult,
	AcpSessionForkParams,
	AcpSessionForkResult,
	AcpSessionListParams,
	AcpSessionListResult,
	AcpSetSessionModeParams,
	AcpPermissionMode,
	AcpAvailableCommandsUpdate,
	AcpAvailableModelsUpdate,
	AcpCurrentModeUpdate,
} from "./types"

const ACP_PROTOCOL_VERSION = 1

/**
 * ACP Client for communicating with claude-code-acp process
 *
 * This client manages the lifecycle of the claude-code-acp subprocess
 * and handles JSON-RPC communication over stdio.
 */
export class AcpClient extends EventEmitter {
	private process: ChildProcess | null = null
	private state: AcpConnectionState = "disconnected"
	private requestId = 0
	private pendingRequests = new Map<
		string | number,
		{
			resolve: (value: unknown) => void
			reject: (error: Error) => void
		}
	>()
	private readline: readline.Interface | null = null
	private executablePath: string
	private agentCapabilities: AcpInitializeResult | null = null

	constructor(executablePath?: string) {
		super()
		// Default to npx for running the package
		this.executablePath = executablePath || "npx"
	}

	/**
	 * Get current connection state
	 */
	getState(): AcpConnectionState {
		return this.state
	}

	/**
	 * Get agent capabilities (available after initialization)
	 */
	getAgentCapabilities(): AcpInitializeResult | null {
		return this.agentCapabilities
	}

	/**
	 * Connect to the claude-code-acp process
	 */
	async connect(): Promise<void> {
		if (this.state === "connected" || this.state === "connecting") {
			return
		}

		this.state = "connecting"

		return new Promise((resolve, reject) => {
			try {
				// Spawn the claude-code-acp process
				const args = this.executablePath === "npx" ? ["--yes", "@zed-industries/claude-code-acp"] : []

				this.process = spawn(this.executablePath, args, {
					stdio: ["pipe", "pipe", "pipe"],
					shell: process.platform === "win32",
					env: {
						...process.env,
						// Pass config dir if set (upstream v0.14+)
						...(process.env.CLAUDE_CONFIG_DIR ? { CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR } : {}),
						// IS_SANDBOX bypasses permission prompts in root mode (upstream v0.14+)
						...(process.env.IS_SANDBOX ? { IS_SANDBOX: process.env.IS_SANDBOX } : {}),
					},
				})

				if (!this.process.stdout || !this.process.stdin) {
					throw new Error("Failed to create stdio pipes")
				}

				// Set up readline for parsing JSON-RPC messages
				this.readline = readline.createInterface({
					input: this.process.stdout,
					crlfDelay: Infinity,
				})

				this.readline.on("line", (line) => {
					this.handleLine(line)
				})

				this.process.stderr?.on("data", (data) => {
					const message = data.toString()
					console.debug("[claude-code-acp stderr]", message)
				})

				this.process.on("error", (error) => {
					this.handleProcessError(error)
					reject(error)
				})

				this.process.on("close", (code) => {
					this.handleProcessClose(code)
				})

				// Initialize the connection
				this.initialize()
					.then(() => {
						this.state = "connected"
						this.emit("connected")
						resolve()
					})
					.catch((error) => {
						this.state = "error"
						reject(error)
					})
			} catch (error) {
				this.state = "error"
				reject(error)
			}
		})
	}

	/**
	 * Disconnect from the claude-code-acp process
	 */
	async disconnect(): Promise<void> {
		if (this.state === "disconnected") {
			return
		}

		// Reject all pending requests
		for (const [, { reject }] of this.pendingRequests) {
			reject(new Error("Connection closed"))
		}
		this.pendingRequests.clear()

		if (this.readline) {
			this.readline.close()
			this.readline = null
		}

		if (this.process) {
			this.process.kill()
			this.process = null
		}

		this.state = "disconnected"
		this.emit("disconnected")
	}

	/**
	 * Initialize the ACP connection (per ACP spec)
	 */
	private async initialize(): Promise<AcpInitializeResult> {
		const params: AcpInitializeParams = {
			protocolVersion: ACP_PROTOCOL_VERSION,
			clientCapabilities: {
				fs: {
					readTextFile: true,
					writeTextFile: true,
				},
				terminal: true,
			},
			clientInfo: {
				name: "roo-code",
				title: "Roo Code",
				version: "1.0.0",
			},
		}

		const result = await this.sendRequest<AcpInitializeResult>("initialize", params)
		this.agentCapabilities = result
		return result
	}

	/**
	 * Create a new session (per ACP spec)
	 */
	async createSession(params: AcpSessionNewParams): Promise<AcpSession> {
		return this.sendRequest<AcpSession>("session/new", params)
	}

	/**
	 * Send a prompt to the agent
	 */
	async sendPrompt(params: AcpPromptParams): Promise<AcpPromptResult> {
		return this.sendRequest<AcpPromptResult>("session/prompt", params)
	}

	/**
	 * Cancel an ongoing prompt (notification - no response expected)
	 */
	cancelPrompt(params: AcpCancelParams): void {
		this.sendNotification("session/cancel", params)
	}

	/**
	 * Load a previous session (per upstream v0.14+)
	 * Replays the session history from stored JSONL files.
	 */
	async loadSession(params: AcpSessionLoadParams): Promise<AcpSessionLoadResult> {
		return this.sendRequest<AcpSessionLoadResult>("session/load", params)
	}

	/**
	 * Resume a previous session (unstable, per upstream v0.12.5+)
	 */
	async resumeSession(params: AcpSessionResumeParams): Promise<AcpSessionResumeResult> {
		return this.sendRequest<AcpSessionResumeResult>("unstable/session/resume", params)
	}

	/**
	 * Fork an existing session (unstable, per upstream v0.12.4+)
	 */
	async forkSession(params: AcpSessionForkParams): Promise<AcpSessionForkResult> {
		return this.sendRequest<AcpSessionForkResult>("unstable/session/fork", params)
	}

	/**
	 * List available sessions (unstable, per upstream v0.14+)
	 */
	async listSessions(params?: AcpSessionListParams): Promise<AcpSessionListResult> {
		return this.sendRequest<AcpSessionListResult>("unstable/session/list", params)
	}

	/**
	 * Set session permission mode (per upstream v0.14+)
	 */
	async setSessionMode(sessionId: string, mode: AcpPermissionMode): Promise<void> {
		const params: AcpSetSessionModeParams = { sessionId, mode }
		await this.sendRequest<void>("session/set_mode", params)
	}

	/**
	 * Send a JSON-RPC request and wait for response
	 */
	private sendRequest<T>(method: string, params?: unknown): Promise<T> {
		return new Promise((resolve, reject) => {
			if (!this.process?.stdin) {
				reject(new Error("Not connected"))
				return
			}

			const id = ++this.requestId
			const request: JsonRpcRequest = {
				jsonrpc: "2.0",
				id,
				method,
				params,
			}

			this.pendingRequests.set(id, {
				resolve: resolve as (value: unknown) => void,
				reject,
			})

			const message = JSON.stringify(request) + "\n"
			this.process.stdin.write(message)
		})
	}

	/**
	 * Send a JSON-RPC notification (no response expected)
	 */
	private sendNotification(method: string, params?: unknown): void {
		if (!this.process?.stdin) {
			return
		}

		const notification: JsonRpcNotification = {
			jsonrpc: "2.0",
			method,
			params,
		}

		const message = JSON.stringify(notification) + "\n"
		this.process.stdin.write(message)
	}

	/**
	 * Send a JSON-RPC response (for agent-initiated requests like permissions)
	 */
	private sendResponse(id: string | number, result: unknown): void {
		if (!this.process?.stdin) {
			return
		}

		const response: JsonRpcResponse = {
			jsonrpc: "2.0",
			id,
			result,
		}

		const message = JSON.stringify(response) + "\n"
		this.process.stdin.write(message)
	}

	/**
	 * Handle incoming line from stdout
	 */
	private handleLine(line: string): void {
		if (!line.trim()) {
			return
		}

		try {
			const message = JSON.parse(line)

			if ("id" in message && message.id !== null && "method" in message) {
				// It's a request from agent to client (e.g. session/request_permission, fs/read_text_file)
				this.handleAgentRequest(message as JsonRpcRequest)
			} else if ("id" in message && message.id !== null) {
				// It's a response to one of our requests
				this.handleResponse(message as JsonRpcResponse)
			} else if ("method" in message) {
				// It's a notification from agent
				this.handleNotification(message as JsonRpcNotification)
			}
		} catch (error) {
			console.error("[AcpClient] Failed to parse message:", line, error)
		}
	}

	/**
	 * Handle JSON-RPC response
	 */
	private handleResponse(response: JsonRpcResponse): void {
		const pending = this.pendingRequests.get(response.id as string | number)
		if (!pending) {
			console.warn("[AcpClient] Received response for unknown request:", response.id)
			return
		}

		this.pendingRequests.delete(response.id as string | number)

		if (response.error) {
			pending.reject(new Error(`${response.error.code}: ${response.error.message}`))
		} else {
			pending.resolve(response.result)
		}
	}

	/**
	 * Handle JSON-RPC notification from agent
	 */
	private handleNotification(notification: JsonRpcNotification): void {
		switch (notification.method) {
			case "session/update": {
				const params = notification.params as AcpSessionUpdateParams
				this.emit("sessionUpdate", params)

				// Also emit typed events for specific update types
				const update = params.update as unknown as Record<string, unknown>
				const updateType = update?.sessionUpdate as string | undefined

				if (updateType === "available_commands_update") {
					const typedUpdate = update as unknown as AcpAvailableCommandsUpdate
					this.emit("availableCommandsUpdate", params.sessionId, typedUpdate.commands)
				} else if (updateType === "available_models_update") {
					const typedUpdate = update as unknown as AcpAvailableModelsUpdate
					this.emit("availableModelsUpdate", params.sessionId, typedUpdate.models)
				} else if (updateType === "current_mode_update") {
					const typedUpdate = update as unknown as AcpCurrentModeUpdate
					this.emit("currentModeUpdate", params.sessionId, typedUpdate.currentModeId)
				}
				break
			}
			default:
				// Gracefully ignore known informational notifications
				console.debug("[AcpClient] Unhandled notification:", notification.method)
		}
	}

	/**
	 * Handle JSON-RPC requests from agent to client
	 * (e.g. session/request_permission, fs/read_text_file, terminal/*)
	 */
	private async handleAgentRequest(request: JsonRpcRequest): Promise<void> {
		switch (request.method) {
			case "session/request_permission":
				await this.handlePermissionRequest(request)
				break
			default:
				// For unsupported methods, respond with method not found
				console.debug("[AcpClient] Unhandled agent request:", request.method)
				this.sendResponse(request.id, null)
		}
	}

	/**
	 * Handle permission request from agent (per ACP spec)
	 *
	 * The agent sends a JSON-RPC request, and we respond with a JSON-RPC response.
	 */
	private async handlePermissionRequest(request: JsonRpcRequest): Promise<void> {
		const params = request.params as AcpPermissionRequestParams
		const listeners = this.listeners("permissionRequest")

		if (listeners.length === 0) {
			// No listeners, auto-approve
			this.sendResponse(request.id, { outcome: "approved" })
			return
		}

		try {
			const result = (await (
				listeners[0] as (request: AcpPermissionRequestParams) => Promise<AcpPermissionResult>
			)(params)) as AcpPermissionResult
			this.sendResponse(request.id, result)
		} catch (error) {
			// On error, deny
			this.sendResponse(request.id, { outcome: "denied" })
		}
	}

	/**
	 * Handle process error
	 */
	private handleProcessError(error: Error): void {
		console.error("[AcpClient] Process error:", error)
		this.state = "error"
		this.emit("error", error)
	}

	/**
	 * Handle process close
	 */
	private handleProcessClose(code: number | null): void {
		console.debug("[AcpClient] Process closed with code:", code)
		this.state = "disconnected"
		this.emit("disconnected", code !== 0 ? new Error(`Process exited with code ${code}`) : undefined)
	}
}

// Singleton instance for reuse across handlers
let sharedClient: AcpClient | null = null

/**
 * Get or create a shared ACP client instance
 */
export function getSharedAcpClient(executablePath?: string): AcpClient {
	if (!sharedClient) {
		sharedClient = new AcpClient(executablePath)
	}
	return sharedClient
}

/**
 * Reset the shared client (for testing or reconnection)
 */
export async function resetSharedAcpClient(): Promise<void> {
	if (sharedClient) {
		await sharedClient.disconnect()
		sharedClient = null
	}
}
