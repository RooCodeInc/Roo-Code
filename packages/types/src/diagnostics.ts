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
 * A single MST (MobX-State-Tree) incremental patch
 */
export interface MstPatch {
	timestamp: number
	op: "add" | "remove" | "replace"
	path: string
	value?: unknown
}

/**
 * Full state snapshot for the diagnostics dashboard
 */
export interface DiagnosticSnapshot {
	logs: DiagnosticLog[]
	metrics: PerformanceMetric[]
	resources: ResourceSnapshot[]
	mstPatches: MstPatch[]
	currentAction?: string
}
