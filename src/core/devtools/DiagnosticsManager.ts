import {
	DiagnosticLog,
	DiagnosticSnapshot,
	DiagnosticLevel,
	PerformanceMetric,
	ResourceSnapshot,
} from "@jabberwock/types"
import os from "os"
import fs from "fs"
import path from "path"

/**
 * Manages diagnostic collection for task execution.
 * Provides real-time visibility into performance and resources.
 */
export class DiagnosticsManager {
	private logs: DiagnosticLog[] = []
	private metrics: PerformanceMetric[] = []
	private resources: ResourceSnapshot[] = []
	private currentAction?: string

	private readonly MAX_LOGS = 100
	private readonly MAX_METRICS = 50
	private readonly MAX_RESOURCES = 100

	private resourceInterval?: NodeJS.Timeout
	private lastCpuUsage?: { user: number; system: number; time: number }

	private logFilePath?: string
	private logBuffer: string[] = []
	private flushTimeout?: NodeJS.Timeout
	private readonly FLUSH_INTERVAL_MS = 500

	constructor() {
		this.startResourceMonitoring()
	}

	public setLogFilePath(filePath: string) {
		this.logFilePath = filePath
		// Ensure directory exists
		const dir = path.dirname(filePath)
		fs.mkdirSync(dir, { recursive: true })
	}

	/**
	 * Log a diagnostic message
	 */
	public log(message: string, level: DiagnosticLevel = "info") {
		this.logs.push({
			timestamp: Date.now(),
			message,
			level,
		})

		if (this.logs.length > this.MAX_LOGS) {
			this.logs.shift()
		}

		if (level === "info" || level === "warn" || level === "error") {
			this.currentAction = message
		}

		this.appendToFile(message, level)
	}

	private appendToFile(message: string, level: DiagnosticLevel) {
		if (!this.logFilePath) return

		const timestamp = new Date().toISOString()
		this.logBuffer.push(`[${timestamp}][${level.toUpperCase()}] ${message}`)

		// Debounced flush to avoid excessive disk I/O
		if (!this.flushTimeout) {
			this.flushTimeout = setTimeout(() => this.flushBuffer(), this.FLUSH_INTERVAL_MS)
		}
	}

	private flushBuffer() {
		this.flushTimeout = undefined
		if (!this.logFilePath || this.logBuffer.length === 0) return

		const content = this.logBuffer.join("\n") + "\n"
		this.logBuffer = []

		fs.appendFile(this.logFilePath, content, (err) => {
			if (err) {
				console.error("[DiagnosticsManager] Failed to write log file:", err.message)
			}
		})
	}

	/**
	 * Track a performance metric
	 */
	public recordMetric(name: string, durationMs: number, status: "success" | "failure") {
		this.metrics.push({
			id: Math.random().toString(36).substring(7),
			name,
			durationMs,
			status,
			timestamp: Date.now(),
		})

		if (this.metrics.length > this.MAX_METRICS) {
			this.metrics.shift()
		}
	}

	/**
	 * Set the currently active action description
	 */
	public setCurrentAction(action: string) {
		this.currentAction = action
		this.log(action, "debug")
	}

	/**
	 * Get a snapshot of current diagnostics
	 */
	public getSnapshot(): DiagnosticSnapshot {
		return {
			logs: [...this.logs].reverse(),
			metrics: [...this.metrics].reverse(),
			resources: [...this.resources],
			currentAction: this.currentAction,
		}
	}

	private startResourceMonitoring() {
		this.resourceInterval = setInterval(() => {
			this.captureResources()
		}, 3000) // Every 3 seconds
	}

	private captureResources() {
		const mem = process.memoryUsage()
		const now = Date.now()

		// CPU Usage calculation
		const cpu = process.cpuUsage()
		let cpuPercent = 0

		if (this.lastCpuUsage) {
			const userDiff = cpu.user - this.lastCpuUsage.user
			const systemDiff = cpu.system - this.lastCpuUsage.system
			const timeDiff = (now - this.lastCpuUsage.time) * 1000 // to microseconds

			if (timeDiff > 0) {
				// Normalize by number of cores and time diff
				cpuPercent = ((userDiff + systemDiff) / timeDiff) * 100
			}
		}

		this.lastCpuUsage = { ...cpu, time: now }

		this.resources.push({
			timestamp: now,
			memoryUsage: {
				rss: mem.rss,
				heapTotal: mem.heapTotal,
				heapUsed: mem.heapUsed,
			},
			cpuUsage: Math.min(100, cpuPercent),
		})

		if (this.resources.length > this.MAX_RESOURCES) {
			this.resources.shift()
		}
	}

	public clear() {
		this.logs = []
		this.metrics = []
		this.resources = []
		this.currentAction = undefined
		this.log("Diagnostics cleared", "info")
	}

	public dispose() {
		if (this.resourceInterval) {
			clearInterval(this.resourceInterval)
		}
		if (this.flushTimeout) {
			clearTimeout(this.flushTimeout)
		}
		this.flushBuffer()
	}
}

// Global instance
export const diagnosticsManager = new DiagnosticsManager()
