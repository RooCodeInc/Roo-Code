/**
 * Frame Timing Tracker
 *
 * Monitors event loop delay to detect blocking renders and long tasks.
 * Uses setImmediate to measure how long the event loop takes between ticks.
 *
 * Usage:
 *   import { FrameTimingTracker } from "./frameTiming.js"
 *
 *   const tracker = new FrameTimingTracker()
 *   tracker.start()
 *   // ... later
 *   tracker.stop()
 *   console.log(tracker.getStats())
 */

import { RenderProfiler } from "./renderProfiler.js"

export interface FrameStats {
	/** Average frame time in ms */
	avgMs: number
	/** Maximum frame time in ms */
	maxMs: number
	/** 95th percentile frame time in ms */
	p95Ms: number
	/** Total number of measurements */
	measurements: number
	/** Number of frames exceeding threshold */
	droppedFrames: number
	/** Target frame time threshold in ms */
	threshold: number
}

export class FrameTimingTracker {
	private lastTick: number = 0
	private measurements: number[] = []
	private running: boolean = false
	private immediateId: NodeJS.Immediate | null = null
	private threshold: number

	/**
	 * Create a new frame timing tracker
	 * @param thresholdMs - Frame time threshold for "dropped frame" detection (default: 16ms = 60fps)
	 */
	constructor(thresholdMs: number = 16) {
		this.threshold = thresholdMs
	}

	/**
	 * Start tracking frame timing
	 */
	start(): void {
		if (this.running) return

		this.running = true
		this.lastTick = performance.now()
		this.measurements = []
		this.scheduleNextMeasurement()
	}

	/**
	 * Stop tracking frame timing
	 */
	stop(): void {
		this.running = false
		if (this.immediateId) {
			clearImmediate(this.immediateId)
			this.immediateId = null
		}
	}

	/**
	 * Check if tracker is currently running
	 */
	isRunning(): boolean {
		return this.running
	}

	/**
	 * Get current frame timing statistics
	 */
	getStats(): FrameStats {
		if (this.measurements.length === 0) {
			return {
				avgMs: 0,
				maxMs: 0,
				p95Ms: 0,
				measurements: 0,
				droppedFrames: 0,
				threshold: this.threshold,
			}
		}

		const sorted = [...this.measurements].sort((a, b) => a - b)
		const sum = sorted.reduce((a, b) => a + b, 0)
		const p95Index = Math.floor(sorted.length * 0.95)

		return {
			avgMs: Math.round((sum / sorted.length) * 100) / 100,
			maxMs: Math.round((sorted[sorted.length - 1] ?? 0) * 100) / 100,
			p95Ms: Math.round((sorted[p95Index] ?? 0) * 100) / 100,
			measurements: sorted.length,
			droppedFrames: this.measurements.filter((t) => t > this.threshold).length,
			threshold: this.threshold,
		}
	}

	/**
	 * Reset collected measurements
	 */
	reset(): void {
		this.measurements = []
		this.lastTick = performance.now()
	}

	/**
	 * Schedule the next measurement using setImmediate
	 */
	private scheduleNextMeasurement(): void {
		if (!this.running) return

		this.immediateId = setImmediate(() => {
			this.measure()
			this.scheduleNextMeasurement()
		})
	}

	/**
	 * Perform a single measurement
	 */
	private measure(): void {
		const now = performance.now()
		const delta = now - this.lastTick
		this.lastTick = now

		// Record measurement
		this.measurements.push(delta)

		// Keep only last 1000 measurements to bound memory
		if (this.measurements.length > 1000) {
			this.measurements = this.measurements.slice(-1000)
		}

		// Record to profiler
		const profiler = RenderProfiler.getInstance()
		if (profiler.isEnabled()) {
			profiler.recordFrameTime(delta)
		}
	}
}

// Singleton instance for global frame timing
let globalTracker: FrameTimingTracker | null = null

/**
 * Get or create the global frame timing tracker
 */
export function getFrameTimingTracker(): FrameTimingTracker {
	if (!globalTracker) {
		globalTracker = new FrameTimingTracker()
	}
	return globalTracker
}

/**
 * Start global frame timing tracking
 * Automatically starts when profiling is enabled
 */
export function startFrameTracking(): void {
	const tracker = getFrameTimingTracker()
	if (!tracker.isRunning()) {
		tracker.start()
	}
}

/**
 * Stop global frame timing tracking
 */
export function stopFrameTracking(): void {
	if (globalTracker) {
		globalTracker.stop()
	}
}

/**
 * Get global frame timing stats
 */
export function getFrameStats(): FrameStats | null {
	if (!globalTracker) return null
	return globalTracker.getStats()
}
