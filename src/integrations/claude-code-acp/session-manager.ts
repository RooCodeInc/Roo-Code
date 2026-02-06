import type { ClaudeCodeAcpSession } from "@roo-code/types"
import { AcpClient, getSharedAcpClient } from "./acp-client"
import type {
	AcpSession,
	AcpPromptParams,
	AcpPromptResult,
	AcpSessionUpdate,
	AcpSessionUpdateParams,
	AcpPermissionRequestParams,
	AcpPermissionResult,
	AcpContentBlock,
	AcpTextContent,
} from "./types"

/**
 * Session Manager for Claude Code ACP
 *
 * Manages multiple sessions, handles session lifecycle, and provides
 * intelligent session reuse to avoid constant restarts.
 */
export class ClaudeCodeAcpSessionManager {
	private client: AcpClient
	private sessions = new Map<string, ClaudeCodeAcpSession>()
	private sessionUpdateCallbacks = new Map<string, (update: AcpSessionUpdate) => void>()
	private permissionHandler?: (request: AcpPermissionRequestParams) => Promise<AcpPermissionResult>
	private maxIdleTime = 5 * 60 * 1000 // 5 minutes
	private cleanupInterval: NodeJS.Timeout | null = null

	constructor(executablePath?: string) {
		this.client = getSharedAcpClient(executablePath)
		this.setupEventHandlers()
		this.startCleanupInterval()
	}

	/**
	 * Set up event handlers for the ACP client
	 */
	private setupEventHandlers(): void {
		this.client.on("sessionUpdate", (params: AcpSessionUpdateParams) => {
			const callback = this.sessionUpdateCallbacks.get(params.sessionId)
			if (callback) {
				callback(params.update)
			}

			// Update session activity timestamp
			const session = this.sessions.get(params.sessionId)
			if (session) {
				session.lastActivityAt = Date.now()
			}
		})

		this.client.on("permissionRequest", async (request: AcpPermissionRequestParams) => {
			if (this.permissionHandler) {
				return this.permissionHandler(request)
			}
			// Default: grant permission
			return { outcome: "approved" as const }
		})

		this.client.on("disconnected", () => {
			for (const session of this.sessions.values()) {
				session.isActive = false
			}
		})

		this.client.on("error", (error: Error) => {
			console.error("[ClaudeCodeAcpSessionManager] Client error:", error)
		})
	}

	/**
	 * Start the cleanup interval for idle sessions
	 */
	private startCleanupInterval(): void {
		this.cleanupInterval = setInterval(() => {
			this.cleanupIdleSessions()
		}, 60 * 1000)
	}

	/**
	 * Clean up idle sessions
	 */
	private cleanupIdleSessions(): void {
		const now = Date.now()
		for (const [sessionId, session] of this.sessions) {
			if (!session.isActive && now - session.lastActivityAt > this.maxIdleTime) {
				this.sessions.delete(sessionId)
				this.sessionUpdateCallbacks.delete(sessionId)
			}
		}
	}

	/**
	 * Ensure the client is connected
	 */
	async ensureConnected(): Promise<void> {
		if (this.client.getState() !== "connected") {
			await this.client.connect()
		}
	}

	/**
	 * Get or create a session for a working directory
	 */
	async getOrCreateSession(workingDirectory: string, modelId: string): Promise<ClaudeCodeAcpSession> {
		await this.ensureConnected()

		// Look for an existing session with the same working directory
		for (const session of this.sessions.values()) {
			if (session.workingDirectory === workingDirectory && session.modelId === modelId && session.isActive) {
				session.lastActivityAt = Date.now()
				return session
			}
		}

		// Create a new session (per ACP spec: cwd + mcpServers)
		const acpSession = await this.client.createSession({
			cwd: workingDirectory,
			mcpServers: [],
		})
		const session: ClaudeCodeAcpSession = {
			sessionId: acpSession.sessionId,
			workingDirectory,
			isActive: true,
			createdAt: Date.now(),
			lastActivityAt: Date.now(),
			modelId,
		}

		this.sessions.set(session.sessionId, session)
		return session
	}

	/**
	 * Send a prompt to a session
	 */
	async sendPrompt(
		sessionId: string,
		prompt: string,
		onUpdate?: (update: AcpSessionUpdate) => void,
	): Promise<AcpPromptResult> {
		await this.ensureConnected()

		const session = this.sessions.get(sessionId)
		if (!session) {
			throw new Error(`Session not found: ${sessionId}`)
		}

		if (!session.isActive) {
			throw new Error(`Session is not active: ${sessionId}`)
		}

		// Set up update callback if provided
		if (onUpdate) {
			this.sessionUpdateCallbacks.set(sessionId, onUpdate)
		}

		try {
			const params: AcpPromptParams = {
				sessionId,
				prompt: [
					{
						type: "text",
						text: prompt,
					} as AcpTextContent,
				],
			}

			const result = await this.client.sendPrompt(params)

			// Update session activity
			session.lastActivityAt = Date.now()

			return result
		} finally {
			// Keep callback for streaming updates
		}
	}

	/**
	 * Send a prompt with content blocks
	 */
	async sendPromptWithContent(
		sessionId: string,
		content: AcpContentBlock[],
		onUpdate?: (update: AcpSessionUpdate) => void,
	): Promise<AcpPromptResult> {
		await this.ensureConnected()

		const session = this.sessions.get(sessionId)
		if (!session) {
			throw new Error(`Session not found: ${sessionId}`)
		}

		if (!session.isActive) {
			throw new Error(`Session is not active: ${sessionId}`)
		}

		if (onUpdate) {
			this.sessionUpdateCallbacks.set(sessionId, onUpdate)
		}

		try {
			const params: AcpPromptParams = {
				sessionId,
				prompt: content,
			}

			const result = await this.client.sendPrompt(params)
			session.lastActivityAt = Date.now()
			return result
		} finally {
			// Callback remains for streaming
		}
	}

	/**
	 * Cancel an ongoing prompt
	 */
	cancelPrompt(sessionId: string): void {
		this.client.cancelPrompt({ sessionId })
	}

	/**
	 * Set the permission handler
	 */
	setPermissionHandler(handler: (request: AcpPermissionRequestParams) => Promise<AcpPermissionResult>): void {
		this.permissionHandler = handler
	}

	/**
	 * Get session by ID
	 */
	getSession(sessionId: string): ClaudeCodeAcpSession | undefined {
		return this.sessions.get(sessionId)
	}

	/**
	 * Get all active sessions
	 */
	getActiveSessions(): ClaudeCodeAcpSession[] {
		return Array.from(this.sessions.values()).filter((s) => s.isActive)
	}

	/**
	 * Close a specific session
	 */
	closeSession(sessionId: string): void {
		const session = this.sessions.get(sessionId)
		if (session) {
			session.isActive = false
			this.sessionUpdateCallbacks.delete(sessionId)
		}
	}

	/**
	 * Dispose of the session manager
	 */
	async dispose(): Promise<void> {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval)
			this.cleanupInterval = null
		}

		for (const session of this.sessions.values()) {
			session.isActive = false
		}

		this.sessions.clear()
		this.sessionUpdateCallbacks.clear()
	}
}

// Singleton instance
let sharedManager: ClaudeCodeAcpSessionManager | null = null

/**
 * Get or create the shared session manager
 */
export function getSharedSessionManager(executablePath?: string): ClaudeCodeAcpSessionManager {
	if (!sharedManager) {
		sharedManager = new ClaudeCodeAcpSessionManager(executablePath)
	}
	return sharedManager
}

/**
 * Dispose of the shared session manager
 */
export async function disposeSharedSessionManager(): Promise<void> {
	if (sharedManager) {
		await sharedManager.dispose()
		sharedManager = null
	}
}
