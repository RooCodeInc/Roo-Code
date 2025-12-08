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
	 * Register an existing running process as a background service
	 * 将一个已运行的进程注册为后台服务（用于通用超时）
	 */
	static async registerExistingProcess(
		command: string,
		cwd: string,
		terminal: RooTerminal,
		process: RooTerminalProcess,
		pid?: number,
	): Promise<ServiceHandle> {
		const serviceId = `service-${this.nextServiceId++}`

		const serviceHandle: ServiceHandle = {
			serviceId,
			command,
			cwd,
			status: "running", // Assume running initially
			terminal,
			process,
			startedAt: Date.now(),
			readyAt: Date.now(), // Assume ready since it's already running
			logs: [],
			maxLogLines: 1000,
			pid,
		}

		// Check if process is still running
		// 检查进程是否仍在运行
		if (pid) {
			const isRunning = await this.isProcessRunning(pid)
			if (!isRunning) {
				// Process has already terminated, mark as stopped
				// 进程已经结束，标记为已停止
				serviceHandle.status = "stopped"
				serviceHandle.logs.push(
					`[ServiceManager] Process already terminated when registered. Command: ${command}`,
				)
				// Still add to services list so user can see it, but it will be cleaned up
				// 仍然添加到服务列表，以便用户可以看到，但会被清理
				this.services.set(serviceId, serviceHandle)
				this.notifyStatusChange(serviceHandle)
				// Schedule cleanup for terminated process
				// 为已终止的进程安排清理
				this.scheduleCleanup(serviceHandle)
				return serviceHandle
			}
		}

		// Try to get any existing output immediately
		// 立即尝试获取任何已有的输出
		try {
			const existingOutput = process.getUnretrievedOutput()
			if (existingOutput) {
				const lines = existingOutput.split("\n").filter((line) => line.length > 0)
				for (const line of lines) {
					serviceHandle.logs.push(line)
					if (serviceHandle.logs.length > (serviceHandle.maxLogLines || 1000)) {
						serviceHandle.logs.shift()
					}
				}
			}
		} catch (error) {
			// Ignore errors when getting existing output
			// 忽略获取已有输出时的错误
			console.warn(`[ServiceManager] Failed to get existing output for ${serviceId}:`, error)
		}

		// Set up callbacks to collect logs (for future output)
		// 设置回调以收集日志（用于后续输出）
		process.on("line", (line: string) => {
			serviceHandle.logs.push(line)
			if (serviceHandle.logs.length > (serviceHandle.maxLogLines || 1000)) {
				serviceHandle.logs.shift()
			}
		})

		// Listen for process completion to update status
		// 监听进程完成以更新状态
		process.on("completed", () => {
			// Update status regardless of current state (handles stopping, running, ready)
			// 无论当前状态如何都更新状态（处理 stopping、running、ready 状态）
			if (
				serviceHandle.status === "running" ||
				serviceHandle.status === "ready" ||
				serviceHandle.status === "stopping"
			) {
				serviceHandle.status = "stopped"
				this.notifyStatusChange(serviceHandle)
				this.scheduleCleanup(serviceHandle)
			}
		})

		// Store service
		this.services.set(serviceId, serviceHandle)

		// Notify status change
		this.notifyStatusChange(serviceHandle)

		return serviceHandle
	}

	/**
	 * Stop service with improved Windows support
	 * 停止服务，改进了 Windows 支持
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

		// Check if process is already terminated before attempting to abort
		// 在尝试终止之前检查进程是否已经结束
		if (service.pid) {
			const isRunning = await this.isProcessRunning(service.pid)
			if (!isRunning) {
				service.status = "stopped"
				this.notifyStatusChange(service)
				this.services.delete(serviceId)
				return
			}
		}

		// Terminate process and wait for it to complete
		// 终止进程并等待其完成
		try {
			await service.process.abort()
		} catch (error) {
			// If abort fails, check if process is still running
			// 如果 abort 失败，检查进程是否仍在运行
			console.warn(`[ServiceManager] Failed to abort process for service ${serviceId}:`, error)
			if (service.pid) {
				const isRunning = await this.isProcessRunning(service.pid)
				if (!isRunning) {
					// Process already terminated
					// 进程已经结束
					service.status = "stopped"
					this.notifyStatusChange(service)
					this.services.delete(serviceId)
					return
				}
			}
			// If process is still running, continue with force kill logic
			// 如果进程仍在运行，继续执行强制终止逻辑
		}

		// Wait for process to actually stop, maximum wait 10 seconds
		// 等待进程实际停止，最多等待 10 秒
		const maxWaitTime = 10000 // 10 seconds
		const checkInterval = 100 // Check every 100ms
		let waitedTime = 0
		let forceKillAttempted = false

		await new Promise<void>((resolve) => {
			const interval = setInterval(async () => {
				waitedTime += checkInterval

				// If process has stopped or failed, complete waiting
				if (service.status === "stopped" || service.status === "failed") {
					clearInterval(interval)
					resolve(undefined)
					return
				}

				// After 5 seconds, try force kill on Windows
				// 5秒后，在 Windows 上尝试强制终止
				if (waitedTime >= 5000 && !forceKillAttempted && service.pid) {
					forceKillAttempted = true
					await this.forceKillProcess(service.pid, service)
				}

				// If timeout, mark as failed and schedule cleanup
				if (waitedTime >= maxWaitTime) {
					clearInterval(interval)
					// Check if process is really still running
					if (service.pid) {
						const isRunning = await this.isProcessRunning(service.pid)
						if (isRunning) {
							// Process still exists, try one more force kill
							await this.forceKillProcess(service.pid, service)
							// Wait a bit and check again
							await new Promise((r) => setTimeout(r, 500))
							const stillRunning = await this.isProcessRunning(service.pid)

							if (stillRunning) {
								service.status = "failed"
								service.logs.push(
									`[ServiceManager] Warning: Service did not terminate within ${maxWaitTime}ms. Process may still be running. Try manually killing PID ${service.pid}.`,
								)
								this.notifyStatusChange(service)
								this.scheduleCleanup(service)
								console.warn(
									`[ServiceManager] Service ${serviceId} (PID: ${service.pid}) did not terminate within timeout. Marked as failed.`,
								)
							} else {
								service.status = "stopped"
								this.notifyStatusChange(service)
							}
						} else {
							// Process doesn't exist, it has terminated
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
		const updatedService = this.services.get(serviceId)
		if (updatedService && updatedService.status === "stopped") {
			this.services.delete(serviceId)
		}
	}

	/**
	 * Check if a process is running
	 * 检查进程是否正在运行
	 */
	private static async isProcessRunning(pid: number): Promise<boolean> {
		try {
			// On both Windows and Unix, sending signal 0 checks if process exists
			process.kill(pid, 0)
			return true
		} catch (error: unknown) {
			// Process doesn't exist
			return false
		}
	}

	/**
	 * Force kill a process, with Windows-specific handling
	 * 强制终止进程，包含 Windows 特定处理
	 */
	private static async forceKillProcess(pid: number, service: ServiceHandle): Promise<void> {
		const isWindows = process.platform === "win32"

		if (isWindows) {
			// On Windows, use taskkill with /F (force) and /T (kill child processes)
			// 在 Windows 上，使用 taskkill 的 /F（强制）和 /T（终止子进程）选项
			try {
				const { exec } = await import("child_process")
				const { promisify } = await import("util")
				const execAsync = promisify(exec)

				// Kill process tree on Windows
				// 在 Windows 上终止进程树
				await execAsync(`taskkill /PID ${pid} /T /F`)
				service.logs.push(`[ServiceManager] Force killed process ${pid} using taskkill`)
				console.log(`[ServiceManager] Force killed process ${pid} using taskkill`)
			} catch (error) {
				// taskkill may fail if process already exited
				console.log(`[ServiceManager] taskkill failed for PID ${pid}:`, error)
			}
		} else {
			// On Unix, send SIGKILL
			// 在 Unix 上，发送 SIGKILL 信号
			try {
				process.kill(pid, "SIGKILL")
				service.logs.push(`[ServiceManager] Sent SIGKILL to process ${pid}`)
				console.log(`[ServiceManager] Sent SIGKILL to process ${pid}`)
			} catch (error) {
				// Process may already be dead
				console.log(`[ServiceManager] SIGKILL failed for PID ${pid}:`, error)
			}
		}
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
	 * Get all running services (alias for listServices)
	 * 获取所有运行中的服务（listServices 的别名）
	 */
	static getRunningServices(): ServiceHandle[] {
		return this.listServices()
	}

	/**
	 * Get service logs
	 * 获取服务日志
	 */
	static getServiceLogs(serviceId: string, maxLines?: number): string[] {
		const service = this.services.get(serviceId)
		if (!service) {
			return []
		}

		// Try to get any unretrieved output from the process using peek method
		// This ensures we get the latest output including incomplete lines
		// 使用 peek 方法获取进程中尚未检索的输出，确保获取到最新的输出（包括不完整的行）
		if (service.process) {
			try {
				// Use peekAllUnretrievedOutput to get ALL unretrieved output including incomplete lines
				// This method does NOT update lastRetrievedIndex, so it can be called multiple times
				// 使用 peekAllUnretrievedOutput 获取所有未检索的输出（包括不完整的行）
				// 此方法不会更新 lastRetrievedIndex，所以可以多次调用
				const unretrievedOutput = service.process.peekAllUnretrievedOutput()
				if (unretrievedOutput && unretrievedOutput.length > 0) {
					// Split by newlines, but keep the last line even if it doesn't end with \n
					// 按换行符分割，但保留最后一行即使它没有以 \n 结尾
					const lines = unretrievedOutput.split("\n")

					// Create a combined logs array: existing logs + new peeked output
					// We need to be careful about duplicate lines at the boundary
					// 创建合并的日志数组：现有日志 + 新的 peek 输出
					// 我们需要小心边界处的重复行

					// To avoid duplicates, we check if the first peeked line matches the last logged line
					// 为避免重复，检查第一个 peek 行是否与最后一个日志行匹配
					const existingLogs = [...service.logs]
					const newLines: string[] = []

					for (const line of lines) {
						// Only add non-empty lines that are truly new
						// 只添加非空且确实是新的行
						if (line.length > 0) {
							newLines.push(line)
						}
					}

					// Combine existing logs with the peeked new content
					// Note: We don't modify service.logs here since peek doesn't consume the output
					// 将现有日志与 peek 到的新内容组合
					// 注意：这里不修改 service.logs，因为 peek 不会消费输出
					const combinedLogs = [...existingLogs]

					// Only add new lines if they don't duplicate the end of existing logs
					// 只有当新行不与现有日志末尾重复时才添加
					if (newLines.length > 0 && existingLogs.length > 0) {
						// Find where the peeked output starts in relation to existing logs
						// This handles the case where some output was already processed
						// 找到 peek 输出相对于现有日志的起始位置
						// 这处理了一些输出已经被处理过的情况
						const lastExistingLine = existingLogs[existingLogs.length - 1]
						const firstNewLineIndex = newLines.findIndex((line) => line !== lastExistingLine)

						if (firstNewLineIndex >= 0) {
							// Add only the truly new lines
							// 只添加真正新的行
							for (let i = firstNewLineIndex; i < newLines.length; i++) {
								combinedLogs.push(newLines[i])
							}
						} else if (newLines.length > existingLogs.length) {
							// All new lines are unique, add them all
							// 所有新行都是唯一的，全部添加
							for (const line of newLines) {
								combinedLogs.push(line)
							}
						}
					} else if (existingLogs.length === 0) {
						// No existing logs, add all new lines
						// 没有现有日志，添加所有新行
						combinedLogs.push(...newLines)
					}

					// Apply max lines limit and return
					// 应用最大行数限制并返回
					if (maxLines && combinedLogs.length > maxLines) {
						return combinedLogs.slice(-maxLines)
					}
					return combinedLogs
				}
			} catch (error) {
				// Ignore errors when getting unretrieved output
				// 忽略获取未检索输出时的错误
				console.warn(`[ServiceManager] Error peeking unretrieved output for ${serviceId}:`, error)
			}
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
