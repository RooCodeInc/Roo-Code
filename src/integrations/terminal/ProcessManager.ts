import { RooTerminal, RooTerminalProcess } from "./types"

/**
 * ProcessEntry represents a running process that can receive stdin input.
 */
export interface ProcessEntry {
	/** The terminal containing the process */
	terminal: RooTerminal
	/** The running process handle */
	process: RooTerminalProcess
	/** Task ID that owns this process */
	taskId: string
	/** Original command that started the process */
	command: string
	/** Timestamp of last interaction */
	lastUsed: number
	/** Whether the process is still running */
	running: boolean
}

/**
 * ProcessManager tracks running terminal processes by session ID.
 *
 * This enables the write_stdin tool to send input to processes that were
 * started by execute_command and are still running.
 *
 * Session IDs are assigned when a command is started and returns a process
 * that hasn't exited. The LLM can then use write_stdin with the session_id
 * to interact with that process.
 *
 * ## Lifecycle
 *
 * 1. execute_command starts a process
 * 2. If process is still running after yield_time, ProcessManager registers it
 * 3. LLM calls write_stdin with session_id to send input
 * 4. When process exits, entry is cleaned up
 *
 * ## Limits
 *
 * - Maximum 64 concurrent tracked processes
 * - Warning issued at 60 processes
 * - Oldest unused processes evicted when limit reached
 */
export class ProcessManager {
	private static instance: ProcessManager | null = null
	private processes: Map<number, ProcessEntry> = new Map()
	private nextSessionId = 1

	static readonly MAX_PROCESSES = 64
	static readonly WARNING_THRESHOLD = 60

	/**
	 * Get the singleton ProcessManager instance.
	 */
	static getInstance(): ProcessManager {
		if (!ProcessManager.instance) {
			ProcessManager.instance = new ProcessManager()
		}
		return ProcessManager.instance
	}

	/**
	 * Reset the singleton instance (for testing).
	 */
	static resetInstance(): void {
		ProcessManager.instance = null
	}

	/**
	 * Register a running process and return its session ID.
	 *
	 * @param terminal - The terminal containing the process
	 * @param process - The running process
	 * @param taskId - The task that owns this process
	 * @param command - The original command
	 * @returns The session ID for this process
	 * @throws Error if maximum process limit is reached
	 */
	registerProcess(terminal: RooTerminal, process: RooTerminalProcess, taskId: string, command: string): number {
		// Clean up completed processes first
		this.cleanup()

		// Check limits
		if (this.processes.size >= ProcessManager.MAX_PROCESSES) {
			// Try to evict oldest unused process
			const evicted = this.evictOldest()
			if (!evicted) {
				throw new Error(
					`Maximum concurrent processes (${ProcessManager.MAX_PROCESSES}) reached. ` +
						`Please wait for existing processes to complete or terminate them.`,
				)
			}
		}

		if (this.processes.size >= ProcessManager.WARNING_THRESHOLD) {
			console.warn(
				`[ProcessManager] ${this.processes.size} concurrent processes tracked. ` +
					`Consider cleaning up long-running processes.`,
			)
		}

		const sessionId = this.nextSessionId++
		const entry: ProcessEntry = {
			terminal,
			process,
			taskId,
			command,
			lastUsed: Date.now(),
			running: true,
		}

		this.processes.set(sessionId, entry)
		console.log(`[ProcessManager] Registered session ${sessionId} for command: ${command.slice(0, 50)}...`)

		return sessionId
	}

	/**
	 * Get a process entry by session ID.
	 *
	 * @param sessionId - The session ID
	 * @returns The process entry, or undefined if not found
	 */
	getProcess(sessionId: number): ProcessEntry | undefined {
		const entry = this.processes.get(sessionId)
		if (entry) {
			entry.lastUsed = Date.now()
		}
		return entry
	}

	/**
	 * Check if a session exists and is still running.
	 *
	 * @param sessionId - The session ID
	 * @returns True if session exists and process is running
	 */
	isRunning(sessionId: number): boolean {
		const entry = this.processes.get(sessionId)
		return entry !== undefined && entry.running
	}

	/**
	 * Mark a process as no longer running.
	 *
	 * @param sessionId - The session ID
	 */
	markCompleted(sessionId: number): void {
		const entry = this.processes.get(sessionId)
		if (entry) {
			entry.running = false
			console.log(`[ProcessManager] Session ${sessionId} marked as completed`)
		}
	}

	/**
	 * Unregister a process by session ID.
	 *
	 * @param sessionId - The session ID to unregister
	 * @returns True if the session was found and removed
	 */
	unregisterProcess(sessionId: number): boolean {
		const removed = this.processes.delete(sessionId)
		if (removed) {
			console.log(`[ProcessManager] Unregistered session ${sessionId}`)
		}
		return removed
	}

	/**
	 * Unregister all processes for a specific task.
	 *
	 * @param taskId - The task ID
	 * @returns Number of processes unregistered
	 */
	unregisterTaskProcesses(taskId: string): number {
		let count = 0
		for (const [sessionId, entry] of this.processes.entries()) {
			if (entry.taskId === taskId) {
				this.processes.delete(sessionId)
				count++
			}
		}
		if (count > 0) {
			console.log(`[ProcessManager] Unregistered ${count} processes for task ${taskId}`)
		}
		return count
	}

	/**
	 * Get all session IDs for a task.
	 *
	 * @param taskId - The task ID
	 * @returns Array of session IDs
	 */
	getTaskSessions(taskId: string): number[] {
		const sessions: number[] = []
		for (const [sessionId, entry] of this.processes.entries()) {
			if (entry.taskId === taskId) {
				sessions.push(sessionId)
			}
		}
		return sessions
	}

	/**
	 * Get the number of tracked processes.
	 */
	get size(): number {
		return this.processes.size
	}

	/**
	 * List all active sessions with their info.
	 *
	 * @param taskId - Optional task ID to filter by
	 * @returns Array of session info objects
	 */
	listSessions(taskId?: string): Array<{
		sessionId: number
		taskId: string
		command: string
		running: boolean
		lastUsed: number
	}> {
		// Clean up first to get accurate state
		this.cleanup()

		const sessions: Array<{
			sessionId: number
			taskId: string
			command: string
			running: boolean
			lastUsed: number
		}> = []

		for (const [sessionId, entry] of this.processes.entries()) {
			if (!taskId || entry.taskId === taskId) {
				sessions.push({
					sessionId,
					taskId: entry.taskId,
					command: entry.command,
					running: entry.running,
					lastUsed: entry.lastUsed,
				})
			}
		}

		// Sort by session ID for consistent ordering
		return sessions.sort((a, b) => a.sessionId - b.sessionId)
	}

	/**
	 * Terminate a session by sending abort signal to the process.
	 *
	 * @param sessionId - The session ID to terminate
	 * @returns Object with success status and optional message
	 */
	terminateSession(sessionId: number): { success: boolean; message: string } {
		const entry = this.processes.get(sessionId)

		if (!entry) {
			return {
				success: false,
				message: `Session ${sessionId} not found. Use list_sessions to see active sessions.`,
			}
		}

		if (!entry.running) {
			// Session exists but already completed
			this.processes.delete(sessionId)
			return {
				success: true,
				message: `Session ${sessionId} was already completed. Entry removed.`,
			}
		}

		try {
			// Abort the process
			entry.process.abort()
			entry.running = false

			// Remove from tracking
			this.processes.delete(sessionId)

			console.log(`[ProcessManager] Terminated session ${sessionId}`)
			return {
				success: true,
				message: `Session ${sessionId} terminated successfully.`,
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			console.error(`[ProcessManager] Error terminating session ${sessionId}:`, errorMessage)
			return {
				success: false,
				message: `Failed to terminate session ${sessionId}: ${errorMessage}`,
			}
		}
	}

	/**
	 * Clean up completed processes.
	 */
	private cleanup(): void {
		const toRemove: number[] = []
		for (const [sessionId, entry] of this.processes.entries()) {
			// Check if terminal is closed or process is no longer running
			if (entry.terminal.isClosed() || !entry.running) {
				toRemove.push(sessionId)
			}
		}
		for (const sessionId of toRemove) {
			this.processes.delete(sessionId)
		}
		if (toRemove.length > 0) {
			console.log(`[ProcessManager] Cleaned up ${toRemove.length} completed processes`)
		}
	}

	/**
	 * Evict the oldest unused process to make room.
	 *
	 * @returns True if a process was evicted
	 */
	private evictOldest(): boolean {
		let oldestId: number | null = null
		let oldestTime = Infinity

		for (const [sessionId, entry] of this.processes.entries()) {
			// Only evict non-running processes first
			if (!entry.running && entry.lastUsed < oldestTime) {
				oldestId = sessionId
				oldestTime = entry.lastUsed
			}
		}

		// If no completed processes, evict oldest running one
		if (oldestId === null) {
			for (const [sessionId, entry] of this.processes.entries()) {
				if (entry.lastUsed < oldestTime) {
					oldestId = sessionId
					oldestTime = entry.lastUsed
				}
			}
		}

		if (oldestId !== null) {
			console.warn(`[ProcessManager] Evicting session ${oldestId} to make room`)
			this.processes.delete(oldestId)
			return true
		}

		return false
	}
}
