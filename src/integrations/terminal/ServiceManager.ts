import process from "process"

import type { RooTerminal, RooTerminalProcess, RooTerminalCallbacks, ExitCodeDetails } from "./types"
import { TerminalRegistry } from "./TerminalRegistry"

/**
 * Service status type
 */
export type ServiceStatus = "pending" | "starting" | "ready" | "running" | "stopping" | "stopped" | "failed"

/**
 * Service handle interface
 */
export interface ServiceHandle {
	serviceId: string
	command: string
	cwd: string
	status: ServiceStatus
	pid?: number
	terminal: RooTerminal
	process: RooTerminalProcess
	startedAt: number
	readyAt?: number
	logs: string[]
	maxLogLines?: number
	readyPattern?: string | RegExp
	healthCheckUrl?: string
	healthCheckIntervalMs?: number
	healthCheckIntervalId?: NodeJS.Timeout
	cleanupTimeoutId?: NodeJS.Timeout
}

/**
 * Service status change callback function type
 */
export type ServiceStatusChangeCallback = (serviceHandle: ServiceHandle) => void

/**
 * ServiceManager class: manages long-running services
 */
export class ServiceManager {
	private static services = new Map<string, ServiceHandle>()
	private static nextServiceId = 1
	private static statusChangeCallbacks: Set<ServiceStatusChangeCallback> = new Set()

	/**
	 * Start service
	 */
	static async startService(
		command: string,
		cwd: string,
		options: {
			readyPattern?: string | RegExp
			readyTimeoutMs?: number
			healthCheckUrl?: string
			healthCheckIntervalMs?: number
		},
	): Promise<ServiceHandle> {
		const serviceId = `service-${this.nextServiceId++}`

		// Get or create terminal (use execa provider to ensure long-running)
		const terminal = await TerminalRegistry.getOrCreateTerminal(cwd, undefined, "execa")

		// Create service handle
		const serviceHandle: ServiceHandle = {
			serviceId,
			command,
			cwd,
			status: "pending",
			terminal,
			process: null as any, // Will be set after runCommand
			startedAt: Date.now(),
			logs: [],
			maxLogLines: 1000,
			readyPattern: options.readyPattern,
			healthCheckUrl: options.healthCheckUrl,
			healthCheckIntervalMs: options.healthCheckIntervalMs || 1000,
		}

		// Set up callbacks to collect logs
		const callbacks: RooTerminalCallbacks = {
			onLine: (line: string, process: RooTerminalProcess) => {
				// Add to logs
				serviceHandle.logs.push(line)
				if (serviceHandle.logs.length > (serviceHandle.maxLogLines || 1000)) {
					serviceHandle.logs.shift() // Remove oldest log
				}
			},
			onCompleted: () => {
				// Service should not "complete", if it completes it means the process exited
				serviceHandle.status = "stopped"
				this.notifyStatusChange(serviceHandle)
			},
			onShellExecutionStarted: (pid) => {
				serviceHandle.pid = pid
				serviceHandle.status = "starting"
				this.notifyStatusChange(serviceHandle)
			},
			onShellExecutionComplete: (details: ExitCodeDetails) => {
				// Regardless of service status, update status when process completes
				// If stopping, status changes from stopping to stopped/failed
				// If unexpected exit, status changes from starting/ready/running to stopped/failed
				serviceHandle.status = details.exitCode === 0 ? "stopped" : "failed"

				// Clean up health check interval to prevent memory leak
				if (serviceHandle.healthCheckIntervalId) {
					clearInterval(serviceHandle.healthCheckIntervalId)
					serviceHandle.healthCheckIntervalId = undefined
				}

				this.notifyStatusChange(serviceHandle)

				// Schedule cleanup for failed services to prevent memory leak
				if (serviceHandle.status === "failed") {
					this.scheduleCleanup(serviceHandle)
				}
			},
		}

		// Start command
		const process = terminal.runCommand(command, callbacks)
		serviceHandle.process = process

		// Store service
		this.services.set(serviceId, serviceHandle)

		// If health check URL is provided, start health check
		if (options.healthCheckUrl) {
			this.startHealthCheck(serviceHandle, options.healthCheckUrl, options.healthCheckIntervalMs || 1000)
		}

		return serviceHandle
	}

	/**
	 * Get service by serviceId
	 */
	static getService(serviceId: string): ServiceHandle | undefined {
		return this.services.get(serviceId)
	}

	/**
	 * Stop service
	 */
	static async stopService(serviceId: string): Promise<void> {
		const service = this.services.get(serviceId)
		if (!service) {
			throw new Error(`Service ${serviceId} not found`)
		}

		service.status = "stopping"
		this.notifyStatusChange(service)

		// Clear any scheduled cleanup since we're manually stopping
		if (service.cleanupTimeoutId) {
			clearTimeout(service.cleanupTimeoutId)
			service.cleanupTimeoutId = undefined
		}

		// Stop health check
		if (service.healthCheckIntervalId) {
			clearInterval(service.healthCheckIntervalId)
			service.healthCheckIntervalId = undefined
		}

		// Terminate process and wait for it to complete
		await service.process.abort()

		// Wait for process to actually stop, maximum wait 10 seconds
		const maxWaitTime = 10000 // 10 seconds
		const checkInterval = 100 // Check every 100ms
		let waitedTime = 0

		await new Promise<void>((resolve) => {
			const interval = setInterval(() => {
				waitedTime += checkInterval

				// If process has stopped or failed, complete waiting
				if (service.status === "stopped" || service.status === "failed") {
					clearInterval(interval)
					resolve(undefined)
					return
				}

				// If timeout, mark as failed and schedule cleanup
				if (waitedTime >= maxWaitTime) {
					clearInterval(interval)
					// Check if process is really still running
					if (service.pid) {
						try {
							// Try sending signal 0 to check if process exists (won't terminate process)
							process.kill(service.pid, 0)
							// If process still exists, mark as failed status and schedule cleanup
							service.status = "failed"
							service.logs.push(
								`[ServiceManager] Warning: Service did not terminate within ${maxWaitTime}ms. Process may still be running.`,
							)
							this.notifyStatusChange(service)
							this.scheduleCleanup(service)
							console.warn(
								`[ServiceManager] Service ${serviceId} (PID: ${service.pid}) did not terminate within timeout. Marked as failed and scheduled for cleanup.`,
							)
						} catch (error) {
							// Process doesn't exist (errno === ESRCH), means it has terminated
							service.status = "stopped"
							this.notifyStatusChange(service)
						}
					} else {
						// No PID, mark as failed and schedule cleanup
						service.status = "failed"
						service.logs.push(
							`[ServiceManager] Warning: Service did not terminate within ${maxWaitTime}ms. No PID available.`,
						)
						this.notifyStatusChange(service)
						this.scheduleCleanup(service)
					}
					resolve(undefined)
				}
			}, checkInterval)
		})

		// Only remove from list when service successfully stops
		// If status is failed, keep in list so user knows service shutdown failed
		// Re-fetch service to get latest status (status may be updated in Promise callback)
		const updatedService = this.services.get(serviceId)
		if (updatedService && updatedService.status === "stopped") {
			this.services.delete(serviceId)
		}
		// Services with failed status remain in list, user can see and handle manually
	}

	/**
	 * List all running services (including services being stopped and services that failed to stop)
	 * Only exclude fully stopped (stopped) services
	 * Services with failed status are also shown so user knows service shutdown failed
	 */
	static listServices(): ServiceHandle[] {
		return Array.from(this.services.values()).filter(
			(service) =>
				service.status === "starting" ||
				service.status === "ready" ||
				service.status === "running" ||
				service.status === "stopping" ||
				service.status === "failed",
		)
	}

	/**
	 * Get service logs
	 */
	static getServiceLogs(serviceId: string, maxLines?: number): string[] {
		const service = this.services.get(serviceId)
		if (!service) {
			return []
		}

		const logs = service.logs
		if (maxLines && logs.length > maxLines) {
			return logs.slice(-maxLines)
		}

		return logs
	}

	/**
	 * Register status change callback
	 */
	static onServiceStatusChange(callback: ServiceStatusChangeCallback): () => void {
		this.statusChangeCallbacks.add(callback)
		return () => {
			this.statusChangeCallbacks.delete(callback)
		}
	}

	/**
	 * Schedule cleanup of a failed service after a delay
	 * This prevents memory leaks from failed services accumulating indefinitely
	 */
	private static scheduleCleanup(serviceHandle: ServiceHandle, delayMs: number = 300000): void {
		// Clear any existing cleanup timeout
		if (serviceHandle.cleanupTimeoutId) {
			clearTimeout(serviceHandle.cleanupTimeoutId)
		}

		// Schedule cleanup after delay (default 5 minutes)
		serviceHandle.cleanupTimeoutId = setTimeout(() => {
			this.services.delete(serviceHandle.serviceId)
			console.log(`[ServiceManager] Cleaned up failed service ${serviceHandle.serviceId} after ${delayMs}ms`)
		}, delayMs) as unknown as NodeJS.Timeout
	}

	/**
	 * Start health check
	 */
	private static startHealthCheck(serviceHandle: ServiceHandle, url: string, intervalMs: number): void {
		const checkHealth = async () => {
			if (serviceHandle.status === "stopped" || serviceHandle.status === "failed") {
				if (serviceHandle.healthCheckIntervalId) {
					clearInterval(serviceHandle.healthCheckIntervalId)
					serviceHandle.healthCheckIntervalId = undefined
				}
				// If failed, schedule cleanup
				if (serviceHandle.status === "failed") {
					this.scheduleCleanup(serviceHandle)
				}
				return
			}

			try {
				const controller = new AbortController()
				const timeoutId = setTimeout(() => controller.abort(), 2000)

				const response = await fetch(url, {
					method: "GET",
					signal: controller.signal,
				})

				clearTimeout(timeoutId)

				if (response.ok && serviceHandle.status === "starting") {
					serviceHandle.status = "ready"
					serviceHandle.readyAt = Date.now()
					this.notifyStatusChange(serviceHandle)

					// Stop checking after health check succeeds
					if (serviceHandle.healthCheckIntervalId) {
						clearInterval(serviceHandle.healthCheckIntervalId)
						serviceHandle.healthCheckIntervalId = undefined
					}
				}
			} catch (error) {
				// Health check failed, continue waiting
				// Don't update status, continue checking
			}
		}

		// Execute check immediately once
		checkHealth()

		// Set up periodic check
		serviceHandle.healthCheckIntervalId = setInterval(checkHealth, intervalMs) as unknown as NodeJS.Timeout
	}

	/**
	 * Notify status change
	 */
	static notifyStatusChange(serviceHandle: ServiceHandle): void {
		for (const callback of this.statusChangeCallbacks) {
			try {
				callback(serviceHandle)
			} catch (error) {
				console.error("[ServiceManager] Error in status change callback:", error)
			}
		}
	}
}
