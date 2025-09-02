import { EventEmitter } from "events"
import type { ExtensionContext } from "vscode"
import type { QueuedRequest, QueueStats, RetryQueueConfig, RetryQueueEvents } from "./types.js"

type AuthHeaderProvider = () => Record<string, string> | undefined

export class RetryQueue extends EventEmitter<RetryQueueEvents> {
	private queue: Map<string, QueuedRequest> = new Map()
	private context: ExtensionContext
	private config: RetryQueueConfig
	private log: (...args: unknown[]) => void
	private isProcessing = false
	private retryTimer?: NodeJS.Timeout
	private readonly STORAGE_KEY = "roo.retryQueue"
	private authHeaderProvider?: AuthHeaderProvider

	constructor(
		context: ExtensionContext,
		config?: Partial<RetryQueueConfig>,
		log?: (...args: unknown[]) => void,
		authHeaderProvider?: AuthHeaderProvider,
	) {
		super()
		this.context = context
		this.log = log || console.log
		this.authHeaderProvider = authHeaderProvider

		this.config = {
			maxRetries: 0,
			retryDelay: 60000,
			maxQueueSize: 100,
			persistQueue: true,
			networkCheckInterval: 60000,
			...config,
		}

		this.loadPersistedQueue()
		this.startRetryTimer()
	}

	private loadPersistedQueue(): void {
		if (!this.config.persistQueue) return

		try {
			const stored = this.context.workspaceState.get<QueuedRequest[]>(this.STORAGE_KEY)
			if (stored && Array.isArray(stored)) {
				stored.forEach((request) => {
					this.queue.set(request.id, request)
				})
				this.log(`[RetryQueue] Loaded ${stored.length} persisted requests from workspace storage`)
			}
		} catch (error) {
			this.log("[RetryQueue] Failed to load persisted queue:", error)
		}
	}

	private async persistQueue(): Promise<void> {
		if (!this.config.persistQueue) return

		try {
			const requests = Array.from(this.queue.values())
			await this.context.workspaceState.update(this.STORAGE_KEY, requests)
		} catch (error) {
			this.log("[RetryQueue] Failed to persist queue:", error)
		}
	}

	public async enqueue(
		url: string,
		options: RequestInit,
		type: QueuedRequest["type"] = "other",
		operation?: string,
	): Promise<void> {
		if (this.queue.size >= this.config.maxQueueSize) {
			const oldestId = Array.from(this.queue.keys())[0]
			if (oldestId) {
				this.queue.delete(oldestId)
			}
		}

		const request: QueuedRequest = {
			id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			url,
			options,
			timestamp: Date.now(),
			retryCount: 0,
			type,
			operation,
		}

		this.queue.set(request.id, request)
		await this.persistQueue()

		this.emit("request-queued", request)
		this.log(`[RetryQueue] Queued request: ${operation || url}`)
	}

	public async retryAll(): Promise<void> {
		if (this.isProcessing) {
			return
		}

		const requests = Array.from(this.queue.values())
		if (requests.length === 0) {
			return
		}

		this.isProcessing = true

		requests.sort((a, b) => a.timestamp - b.timestamp)

		const lastRequest = requests[requests.length - 1]
		if (!lastRequest) {
			this.isProcessing = false
			return
		}

		try {
			await this.retryRequest(lastRequest)
			this.queue.delete(lastRequest.id)
			this.emit("request-retry-success", lastRequest)

			const remainingRequests = Array.from(this.queue.values()).sort((a, b) => a.timestamp - b.timestamp)

			for (const request of remainingRequests) {
				try {
					await this.retryRequest(request)
					this.queue.delete(request.id)
					this.emit("request-retry-success", request)
				} catch (error) {
					request.retryCount++
					request.lastError = error instanceof Error ? error.message : String(error)

					this.queue.set(request.id, request)
					this.emit("request-retry-failed", request, error as Error)
				}

				await this.delay(100)
			}
		} catch (error) {
			lastRequest.retryCount++
			lastRequest.lastError = error instanceof Error ? error.message : String(error)

			this.queue.set(lastRequest.id, lastRequest)
			this.emit("request-retry-failed", lastRequest, error as Error)
		}

		await this.persistQueue()
		this.isProcessing = false
	}

	private async retryRequest(request: QueuedRequest): Promise<Response> {
		this.log(`[RetryQueue] Retrying request: ${request.operation || request.url}`)

		let headers = { ...request.options.headers }
		if (this.authHeaderProvider) {
			const freshAuthHeaders = this.authHeaderProvider()
			if (freshAuthHeaders) {
				headers = {
					...headers,
					...freshAuthHeaders,
				}
			}
		}

		const controller = new AbortController()
		const timeoutId = setTimeout(() => controller.abort(), 30000)

		try {
			const response = await fetch(request.url, {
				...request.options,
				signal: controller.signal,
				headers: {
					...headers,
					"X-Retry-Queue": "true",
				},
			})

			clearTimeout(timeoutId)

			if (!response.ok) {
				throw new Error(`Request failed with status ${response.status}`)
			}

			return response
		} catch (error) {
			clearTimeout(timeoutId)
			throw error
		}
	}

	private startRetryTimer(): void {
		if (this.retryTimer) {
			clearInterval(this.retryTimer)
		}

		this.retryTimer = setInterval(() => {
			this.retryAll().catch((error) => {
				this.log("[RetryQueue] Error during retry cycle:", error)
			})
		}, this.config.networkCheckInterval)
	}

	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms))
	}

	public getStats(): QueueStats {
		const requests = Array.from(this.queue.values())
		const byType: Record<string, number> = {}
		let totalRetries = 0
		let failedRetries = 0

		requests.forEach((request) => {
			byType[request.type] = (byType[request.type] || 0) + 1
			totalRetries += request.retryCount
			if (request.lastError) {
				failedRetries++
			}
		})

		const timestamps = requests.map((r) => r.timestamp)
		const oldestRequest = timestamps.length > 0 ? new Date(Math.min(...timestamps)) : undefined
		const newestRequest = timestamps.length > 0 ? new Date(Math.max(...timestamps)) : undefined

		return {
			totalQueued: requests.length,
			byType,
			oldestRequest,
			newestRequest,
			totalRetries,
			failedRetries,
		}
	}

	public clear(): void {
		this.queue.clear()
		this.persistQueue().catch((error) => {
			this.log("[RetryQueue] Failed to persist after clear:", error)
		})
		this.emit("queue-cleared")
	}

	public dispose(): void {
		if (this.retryTimer) {
			clearInterval(this.retryTimer)
		}
		this.removeAllListeners()
	}
}
