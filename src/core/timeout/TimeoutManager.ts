import { EventEmitter } from "events"
import type { ToolName } from "@roo-code/types"

export interface TimeoutConfig {
	toolName: ToolName
	timeoutMs: number
	enableFallback: boolean
	taskId?: string
}

export interface TimeoutResult<T> {
	success: boolean
	result?: T
	timedOut: boolean
	fallbackTriggered: boolean
	error?: Error
	executionTimeMs: number
}

export interface TimeoutEvent {
	toolName: ToolName
	timeoutMs: number
	executionTimeMs: number
	taskId?: string
	timestamp: number
}

/**
 * Manages timeouts for all tool executions with configurable fallback mechanisms
 */
export class TimeoutManager extends EventEmitter {
	private static instance: TimeoutManager | undefined
	private activeOperations = new Map<string, AbortController>()
	/**
	 * Assumes there is only one active tool-- does not timeout edge cases
	 * like "Proceed While Running"
	 */
	private lastTimeoutEvent: TimeoutEvent | null = null

	private constructor() {
		super()
	}

	public static getInstance(): TimeoutManager {
		if (!TimeoutManager.instance) {
			TimeoutManager.instance = new TimeoutManager()
		}
		return TimeoutManager.instance
	}

	/**
	 * Execute a function with timeout protection
	 */
	public async executeWithTimeout<T>(
		operation: (signal: AbortSignal) => Promise<T>,
		config: TimeoutConfig,
	): Promise<TimeoutResult<T>> {
		const operationId = this.generateOperationId(config.toolName, config.taskId)
		const controller = new AbortController()
		const startTime = Date.now()

		// Store the controller for potential cancellation
		this.activeOperations.set(operationId, controller)

		try {
			// Create timeout promise
			const timeoutPromise = new Promise<never>((_, reject) => {
				const timeoutId = setTimeout(() => {
					controller.abort()
					reject(new Error(`Operation timed out after ${config.timeoutMs}ms`))
				}, config.timeoutMs)

				// Clean up timeout if operation completes
				controller.signal.addEventListener("abort", () => {
					clearTimeout(timeoutId)
				})
			})

			// Race between operation and timeout
			const result = await Promise.race([operation(controller.signal), timeoutPromise])

			const executionTimeMs = Date.now() - startTime

			return {
				success: true,
				result,
				timedOut: false,
				fallbackTriggered: false,
				executionTimeMs,
			}
		} catch (error) {
			const executionTimeMs = Date.now() - startTime
			const timedOut = controller.signal.aborted

			if (timedOut) {
				// Store the last timeout event
				const timeoutEvent: TimeoutEvent = {
					toolName: config.toolName,
					timeoutMs: config.timeoutMs,
					executionTimeMs,
					taskId: config.taskId,
					timestamp: Date.now(),
				}

				this.lastTimeoutEvent = timeoutEvent
				this.emit("timeout", timeoutEvent)

				return {
					success: false,
					timedOut: true,
					fallbackTriggered: config.enableFallback,
					error: error as Error,
					executionTimeMs,
				}
			}

			return {
				success: false,
				timedOut: false,
				fallbackTriggered: false,
				error: error as Error,
				executionTimeMs,
			}
		} finally {
			// Clean up
			this.activeOperations.delete(operationId)
		}
	}

	/**
	 * Cancel a specific operation by tool name and task ID
	 */
	public cancelOperation(toolName: ToolName, taskId?: string): boolean {
		const operationId = this.generateOperationId(toolName, taskId)
		const controller = this.activeOperations.get(operationId)

		if (controller) {
			controller.abort()
			this.activeOperations.delete(operationId)
			return true
		}

		return false
	}

	/**
	 * Cancel all active operations
	 */
	public cancelAllOperations(): void {
		for (const controller of this.activeOperations.values()) {
			controller.abort()
		}
		this.activeOperations.clear()
	}

	/**
	 * Get the last timeout event
	 */
	public getLastTimeoutEvent(): TimeoutEvent | null {
		return this.lastTimeoutEvent
	}

	/**
	 * Clear the last timeout event
	 */
	public clearLastTimeoutEvent(): void {
		this.lastTimeoutEvent = null
	}

	/**
	 * Get active operation count
	 */
	public getActiveOperationCount(): number {
		return this.activeOperations.size
	}

	/**
	 * Check if a specific operation is active
	 */
	public isOperationActive(toolName: ToolName, taskId?: string): boolean {
		const operationId = this.generateOperationId(toolName, taskId)
		return this.activeOperations.has(operationId)
	}

	private generateOperationId(toolName: ToolName, taskId?: string): string {
		return `${toolName}:${taskId || "default"}`
	}

	/**
	 * Cleanup method for graceful shutdown
	 */
	public dispose(): void {
		this.cancelAllOperations()
		this.removeAllListeners()
		this.lastTimeoutEvent = null
	}
}

export const timeoutManager = TimeoutManager.getInstance()
