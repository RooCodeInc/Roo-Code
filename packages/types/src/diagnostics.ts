/**
 * Diagnostic level for log messages
 */
export type DiagnosticLevel = "info" | "warn" | "error" | "debug"

/**
 * A single diagnostic log entry
 */
export interface DiagnosticLog {
	timestamp: number
	message: string
	level: DiagnosticLevel
}

/**
 * Performance metric for a specific operation
 */
export interface PerformanceMetric {
	id: string
	name: string
	durationMs: number
	status: "success" | "failure" | "pending"
	timestamp: number
}

/**
 * Snapshot of system resources
 */
export interface ResourceSnapshot {
	timestamp: number
	memoryUsage: {
		rss: number
		heapTotal: number
		heapUsed: number
	}
	cpuUsage: number // Percentage (0-100)
}

/**
 * Full state snapshot for the diagnostics dashboard
 */
export interface DiagnosticSnapshot {
	logs: DiagnosticLog[]
	metrics: PerformanceMetric[]
	resources: ResourceSnapshot[]
	currentAction?: string
}
