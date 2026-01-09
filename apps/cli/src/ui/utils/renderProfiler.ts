/**
 * Render Performance Profiler
 *
 * A singleton class that collects and aggregates render performance data
 * for the CLI TUI application. Writes to ~/.roo/cli-render.log to avoid
 * corrupting TUI output.
 *
 * Usage:
 *   import { RenderProfiler } from './utils/renderProfiler.js'
 *
 *   // Get singleton instance
 *   const profiler = RenderProfiler.getInstance()
 *
 *   // Record a component render
 *   profiler.recordRender('ChatHistoryItem', 2.5, 'props.message.content changed')
 *
 *   // Record a store update
 *   profiler.recordStoreUpdate('CLIStore', 'addMessage', 0.8)
 */

import * as fs from "fs"
import * as path from "path"
import * as os from "os"

const RENDER_LOG_PATH = path.join(os.homedir(), ".roo", "cli-render.log")

export interface RenderProfilerConfig {
	/** Enable/disable profiling globally */
	enabled: boolean
	/** Log individual component render events */
	logComponents: boolean
	/** Log Zustand store updates */
	logStoreUpdates: boolean
	/** Log frame/tick timing */
	logFrameTiming: boolean
	/** Milliseconds between aggregate summary logs (default: 5000) */
	aggregateInterval: number
	/** Threshold in ms for slow render warnings (default: 16 - one frame at 60fps) */
	slowRenderThreshold: number
}

export interface RenderEvent {
	component: string
	renderCount: number
	totalTime: number
	avgTime: number
	maxTime: number
	lastReason?: string
}

export interface StoreUpdateEvent {
	store: string
	action: string
	count: number
	totalTime: number
	avgTime: number
	maxTime: number
}

export interface FrameTimingStats {
	avgMs: number
	maxMs: number
	p95Ms: number
	measurements: number
	droppedFrames: number
}

export interface ProfilerSummary {
	periodMs: number
	totalRenders: number
	componentBreakdown: Record<string, { count: number; avgMs: number; maxMs: number }>
	storeUpdates: Record<string, { count: number; avgMs: number; maxMs: number }>
	frameTiming: FrameTimingStats | null
}

interface LogEntry {
	timestamp: string
	type: "render" | "store_update" | "frame" | "summary" | "config"
	[key: string]: unknown
}

const defaultConfig: RenderProfilerConfig = {
	enabled: false,
	logComponents: true,
	logStoreUpdates: true,
	logFrameTiming: true,
	aggregateInterval: 5000,
	slowRenderThreshold: 16,
}

export class RenderProfiler {
	private static instance: RenderProfiler | null = null
	private config: RenderProfilerConfig
	private renderEvents: Map<string, RenderEvent> = new Map()
	private storeUpdates: Map<string, StoreUpdateEvent> = new Map()
	private frameTimings: number[] = []
	private lastSummaryTime: number = 0
	private summaryTimer: NodeJS.Timeout | null = null
	private logBuffer: LogEntry[] = []
	private flushTimer: NodeJS.Timeout | null = null
	private startTime: number = Date.now()

	private constructor() {
		this.config = { ...defaultConfig }
	}

	/**
	 * Get the singleton instance of RenderProfiler
	 */
	static getInstance(): RenderProfiler {
		if (!RenderProfiler.instance) {
			RenderProfiler.instance = new RenderProfiler()
		}
		return RenderProfiler.instance
	}

	/**
	 * Reset the singleton instance (useful for testing)
	 */
	static resetInstance(): void {
		if (RenderProfiler.instance) {
			RenderProfiler.instance.stop()
			RenderProfiler.instance = null
		}
	}

	/**
	 * Configure the profiler
	 */
	configure(config: Partial<RenderProfilerConfig>): void {
		const wasEnabled = this.config.enabled
		this.config = { ...this.config, ...config }

		// Log configuration change
		if (this.config.enabled) {
			this.writeLog({
				timestamp: new Date().toISOString(),
				type: "config",
				config: this.config,
			})
		}

		// Start/stop summary timer based on enabled state
		if (this.config.enabled && !wasEnabled) {
			this.startSummaryTimer()
			this.lastSummaryTime = Date.now()
			this.startTime = Date.now()
		} else if (!this.config.enabled && wasEnabled) {
			this.stop()
		}
	}

	/**
	 * Check if profiling is enabled
	 */
	isEnabled(): boolean {
		return this.config.enabled
	}

	/**
	 * Get current configuration
	 */
	getConfig(): RenderProfilerConfig {
		return { ...this.config }
	}

	/**
	 * Record a component render event
	 */
	recordRender(component: string, durationMs: number, reason?: string): void {
		if (!this.config.enabled) return

		// Update aggregated stats
		const existing = this.renderEvents.get(component)
		if (existing) {
			existing.renderCount++
			existing.totalTime += durationMs
			existing.avgTime = existing.totalTime / existing.renderCount
			existing.maxTime = Math.max(existing.maxTime, durationMs)
			if (reason) existing.lastReason = reason
		} else {
			this.renderEvents.set(component, {
				component,
				renderCount: 1,
				totalTime: durationMs,
				avgTime: durationMs,
				maxTime: durationMs,
				lastReason: reason,
			})
		}

		// Log individual event if configured
		if (this.config.logComponents) {
			const entry: LogEntry = {
				timestamp: new Date().toISOString(),
				type: "render",
				component,
				duration: durationMs,
			}
			if (reason) entry.reason = reason

			// Warn on slow renders
			if (durationMs > this.config.slowRenderThreshold) {
				entry.slow = true
			}

			this.bufferLog(entry)
		}
	}

	/**
	 * Record props that changed for a component
	 */
	recordPropsChange(component: string, changedProps: string[]): void {
		if (!this.config.enabled || !this.config.logComponents) return

		this.bufferLog({
			timestamp: new Date().toISOString(),
			type: "render",
			component,
			propsChanged: changedProps,
		})
	}

	/**
	 * Record a store update event
	 */
	recordStoreUpdate(store: string, action: string, durationMs: number): void {
		if (!this.config.enabled) return

		const key = `${store}:${action}`
		const existing = this.storeUpdates.get(key)
		if (existing) {
			existing.count++
			existing.totalTime += durationMs
			existing.avgTime = existing.totalTime / existing.count
			existing.maxTime = Math.max(existing.maxTime, durationMs)
		} else {
			this.storeUpdates.set(key, {
				store,
				action,
				count: 1,
				totalTime: durationMs,
				avgTime: durationMs,
				maxTime: durationMs,
			})
		}

		// Log individual event if configured
		if (this.config.logStoreUpdates) {
			this.bufferLog({
				timestamp: new Date().toISOString(),
				type: "store_update",
				store,
				action,
				duration: durationMs,
			})
		}
	}

	/**
	 * Record a frame timing measurement
	 */
	recordFrameTime(durationMs: number): void {
		if (!this.config.enabled) return

		this.frameTimings.push(durationMs)

		// Keep only last 1000 measurements to bound memory
		if (this.frameTimings.length > 1000) {
			this.frameTimings = this.frameTimings.slice(-1000)
		}

		// Log individual slow frames
		if (this.config.logFrameTiming && durationMs > this.config.slowRenderThreshold) {
			this.bufferLog({
				timestamp: new Date().toISOString(),
				type: "frame",
				duration: durationMs,
				slow: true,
			})
		}
	}

	/**
	 * Get frame timing statistics
	 */
	getFrameStats(): FrameTimingStats | null {
		if (this.frameTimings.length === 0) return null

		const sorted = [...this.frameTimings].sort((a, b) => a - b)
		const sum = sorted.reduce((a, b) => a + b, 0)
		const p95Index = Math.floor(sorted.length * 0.95)

		return {
			avgMs: sum / sorted.length,
			maxMs: sorted[sorted.length - 1] ?? 0,
			p95Ms: sorted[p95Index] ?? 0,
			measurements: sorted.length,
			droppedFrames: this.frameTimings.filter((t) => t > this.config.slowRenderThreshold).length,
		}
	}

	/**
	 * Get current summary of profiling data
	 */
	getSummary(): ProfilerSummary {
		const now = Date.now()
		const periodMs = now - this.lastSummaryTime

		const componentBreakdown: Record<string, { count: number; avgMs: number; maxMs: number }> = {}
		let totalRenders = 0

		for (const [name, event] of this.renderEvents) {
			componentBreakdown[name] = {
				count: event.renderCount,
				avgMs: Math.round(event.avgTime * 100) / 100,
				maxMs: Math.round(event.maxTime * 100) / 100,
			}
			totalRenders += event.renderCount
		}

		const storeUpdates: Record<string, { count: number; avgMs: number; maxMs: number }> = {}
		for (const [key, event] of this.storeUpdates) {
			storeUpdates[key] = {
				count: event.count,
				avgMs: Math.round(event.avgTime * 100) / 100,
				maxMs: Math.round(event.maxTime * 100) / 100,
			}
		}

		return {
			periodMs,
			totalRenders,
			componentBreakdown,
			storeUpdates,
			frameTiming: this.getFrameStats(),
		}
	}

	/**
	 * Flush buffered logs to file and write summary
	 */
	flush(): void {
		if (!this.config.enabled) return

		// Write buffered logs
		this.flushBuffer()

		// Write summary
		const summary = this.getSummary()
		this.writeLog({
			timestamp: new Date().toISOString(),
			type: "summary",
			period: `${Math.round(summary.periodMs / 1000)}s`,
			totalRenders: summary.totalRenders,
			componentBreakdown: summary.componentBreakdown,
			storeUpdates: summary.storeUpdates,
			frameTiming: summary.frameTiming,
		})

		// Reset for next period
		this.reset()
		this.lastSummaryTime = Date.now()
	}

	/**
	 * Reset accumulated statistics (but keep profiler enabled)
	 */
	reset(): void {
		this.renderEvents.clear()
		this.storeUpdates.clear()
		this.frameTimings = []
	}

	/**
	 * Stop profiling and clean up
	 */
	stop(): void {
		if (this.summaryTimer) {
			clearInterval(this.summaryTimer)
			this.summaryTimer = null
		}
		if (this.flushTimer) {
			clearTimeout(this.flushTimer)
			this.flushTimer = null
		}

		// Final flush if we have data
		if (this.logBuffer.length > 0 || this.renderEvents.size > 0) {
			this.flush()
		}

		this.reset()
	}

	/**
	 * Buffer a log entry for batch writing
	 */
	private bufferLog(entry: LogEntry): void {
		this.logBuffer.push(entry)

		// Schedule flush if not already scheduled
		if (!this.flushTimer) {
			this.flushTimer = setTimeout(() => {
				this.flushBuffer()
				this.flushTimer = null
			}, 100) // Flush every 100ms max
		}
	}

	/**
	 * Write buffered logs to file
	 */
	private flushBuffer(): void {
		if (this.logBuffer.length === 0) return

		try {
			const logDir = path.dirname(RENDER_LOG_PATH)
			if (!fs.existsSync(logDir)) {
				fs.mkdirSync(logDir, { recursive: true })
			}

			const lines = this.logBuffer.map((entry) => JSON.stringify(entry)).join("\n") + "\n"
			fs.appendFileSync(RENDER_LOG_PATH, lines)
			this.logBuffer = []
		} catch {
			// NO-OP - don't let logging errors break functionality
		}
	}

	/**
	 * Write a single log entry immediately
	 */
	private writeLog(entry: LogEntry): void {
		try {
			const logDir = path.dirname(RENDER_LOG_PATH)
			if (!fs.existsSync(logDir)) {
				fs.mkdirSync(logDir, { recursive: true })
			}

			fs.appendFileSync(RENDER_LOG_PATH, JSON.stringify(entry) + "\n")
		} catch {
			// NO-OP - don't let logging errors break functionality
		}
	}

	/**
	 * Start the periodic summary timer
	 */
	private startSummaryTimer(): void {
		if (this.summaryTimer) {
			clearInterval(this.summaryTimer)
		}

		this.summaryTimer = setInterval(() => {
			this.flush()
		}, this.config.aggregateInterval)

		// Don't prevent process exit
		this.summaryTimer.unref()
	}
}

/**
 * Convenience function to check if profiling is enabled
 */
export function isProfilingEnabled(): boolean {
	return RenderProfiler.getInstance().isEnabled()
}

/**
 * Get the render log file path
 */
export function getRenderLogPath(): string {
	return RENDER_LOG_PATH
}
