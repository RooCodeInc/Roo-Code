/**
 * Knowledge Graph Trace Collector
 * Detailed tracing for debugging and performance analysis
 */

/**
 * Trace event types
 */
export enum TraceEvent {
	// Lifecycle events
	GRAPH_INIT = "graph.init",
	GRAPH_LOAD = "graph.load",
	GRAPH_SAVE = "graph.save",
	GRAPH_CLEAR = "graph.clear",

	// Node events
	NODE_ADD = "node.add",
	NODE_UPDATE = "node.update",
	NODE_REMOVE = "node.remove",
	NODE_BATCH_UPDATE = "node.batch_update",

	// Query events
	QUERY_DEPENDENCIES = "query.dependencies",
	QUERY_DEPENDENTS = "query.dependents",
	QUERY_TRANSITIVE_DEPS = "query.transitive_deps",
	QUERY_TRANSITIVE_DEPENDENTS = "query.transitive_dependents",
	QUERY_COMMON_DEPS = "query.common_deps",

	// Parse events
	PARSE_START = "parse.start",
	PARSE_SUCCESS = "parse.success",
	PARSE_FAILURE = "parse.failure",

	// Analysis events
	CYCLE_DETECTION = "analysis.cycle_detection",
	IMPACT_ANALYSIS = "analysis.impact",

	// Error events
	ERROR = "error",
	WARNING = "warning",
}

/**
 * Trace severity levels
 */
export enum TraceSeverity {
	DEBUG = "debug",
	INFO = "info",
	WARN = "warn",
	ERROR = "error",
}

/**
 * Single trace entry
 */
export interface TraceEntry {
	id: string
	event: TraceEvent
	severity: TraceSeverity
	timestamp: number
	duration?: number
	filePath?: string
	details?: Record<string, unknown>
	error?: string
	stack?: string
}

/**
 * Trace span for timing operations
 */
export interface TraceSpan {
	id: string
	event: TraceEvent
	startTime: number
	filePath?: string
	details?: Record<string, unknown>
}

/**
 * TraceCollector - Collects detailed traces for debugging
 */
export class TraceCollector {
	private entries: TraceEntry[] = []
	private activeSpans: Map<string, TraceSpan> = new Map()
	private enabled: boolean = true

	// Configuration
	private readonly maxEntries: number
	private readonly logToConsole: boolean

	constructor(options: { maxEntries?: number; logToConsole?: boolean } = {}) {
		this.maxEntries = options.maxEntries ?? 1000
		this.logToConsole = options.logToConsole ?? false
	}

	/**
	 * Enable or disable tracing
	 */
	setEnabled(enabled: boolean): void {
		this.enabled = enabled
	}

	/**
	 * Check if tracing is enabled
	 */
	isEnabled(): boolean {
		return this.enabled
	}

	/**
	 * Start a trace span
	 */
	startSpan(event: TraceEvent, filePath?: string, details?: Record<string, unknown>): string {
		if (!this.enabled) return ""

		const id = this.generateId()
		const span: TraceSpan = {
			id,
			event,
			startTime: Date.now(),
			filePath,
			details,
		}

		this.activeSpans.set(id, span)
		return id
	}

	/**
	 * End a trace span
	 */
	endSpan(spanId: string, additionalDetails?: Record<string, unknown>): void {
		if (!this.enabled || !spanId) return

		const span = this.activeSpans.get(spanId)
		if (!span) return

		const duration = Date.now() - span.startTime
		this.activeSpans.delete(spanId)

		this.addEntry({
			id: span.id,
			event: span.event,
			severity: TraceSeverity.INFO,
			timestamp: span.startTime,
			duration,
			filePath: span.filePath,
			details: { ...span.details, ...additionalDetails },
		})
	}

	/**
	 * End a span with error
	 */
	endSpanWithError(spanId: string, error: Error | string): void {
		if (!this.enabled || !spanId) return

		const span = this.activeSpans.get(spanId)
		if (!span) return

		const duration = Date.now() - span.startTime
		this.activeSpans.delete(spanId)

		const errorMessage = error instanceof Error ? error.message : error
		const stack = error instanceof Error ? error.stack : undefined

		this.addEntry({
			id: span.id,
			event: span.event,
			severity: TraceSeverity.ERROR,
			timestamp: span.startTime,
			duration,
			filePath: span.filePath,
			details: span.details,
			error: errorMessage,
			stack,
		})
	}

	/**
	 * Record a simple trace event
	 */
	trace(
		event: TraceEvent,
		severity: TraceSeverity = TraceSeverity.INFO,
		details?: {
			filePath?: string
			duration?: number
			error?: string
			data?: Record<string, unknown>
		},
	): void {
		if (!this.enabled) return

		this.addEntry({
			id: this.generateId(),
			event,
			severity,
			timestamp: Date.now(),
			duration: details?.duration,
			filePath: details?.filePath,
			details: details?.data,
			error: details?.error,
		})
	}

	/**
	 * Record an error
	 */
	traceError(event: TraceEvent, error: Error | string, filePath?: string): void {
		if (!this.enabled) return

		const errorMessage = error instanceof Error ? error.message : error
		const stack = error instanceof Error ? error.stack : undefined

		this.addEntry({
			id: this.generateId(),
			event,
			severity: TraceSeverity.ERROR,
			timestamp: Date.now(),
			filePath,
			error: errorMessage,
			stack,
		})
	}

	/**
	 * Get recent trace entries
	 */
	getRecentEntries(count: number = 100): TraceEntry[] {
		return this.entries.slice(-count)
	}

	/**
	 * Get entries by event type
	 */
	getEntriesByEvent(event: TraceEvent, count: number = 50): TraceEntry[] {
		return this.entries.filter((e) => e.event === event).slice(-count)
	}

	/**
	 * Get entries by severity
	 */
	getEntriesBySeverity(severity: TraceSeverity, count: number = 50): TraceEntry[] {
		return this.entries.filter((e) => e.severity === severity).slice(-count)
	}

	/**
	 * Get entries for a specific file
	 */
	getEntriesForFile(filePath: string, count: number = 50): TraceEntry[] {
		return this.entries.filter((e) => e.filePath === filePath).slice(-count)
	}

	/**
	 * Get error entries
	 */
	getErrors(count: number = 50): TraceEntry[] {
		return this.entries.filter((e) => e.severity === TraceSeverity.ERROR).slice(-count)
	}

	/**
	 * Get average duration for an event type
	 */
	getAverageDuration(event: TraceEvent): number {
		const durations = this.entries
			.filter((e) => e.event === event && e.duration !== undefined)
			.map((e) => e.duration!)

		if (durations.length === 0) return 0
		return durations.reduce((sum, d) => sum + d, 0) / durations.length
	}

	/**
	 * Clear all entries
	 */
	clear(): void {
		this.entries = []
		this.activeSpans.clear()
	}

	/**
	 * Export entries for analysis
	 */
	exportEntries(): TraceEntry[] {
		return [...this.entries]
	}

	/**
	 * Get summary statistics
	 */
	getSummary(): {
		totalEntries: number
		errorCount: number
		warningCount: number
		activeSpans: number
		eventCounts: Record<string, number>
	} {
		const eventCounts: Record<string, number> = {}
		let errorCount = 0
		let warningCount = 0

		for (const entry of this.entries) {
			eventCounts[entry.event] = (eventCounts[entry.event] || 0) + 1
			if (entry.severity === TraceSeverity.ERROR) errorCount++
			if (entry.severity === TraceSeverity.WARN) warningCount++
		}

		return {
			totalEntries: this.entries.length,
			errorCount,
			warningCount,
			activeSpans: this.activeSpans.size,
			eventCounts,
		}
	}

	private addEntry(entry: TraceEntry): void {
		this.entries.push(entry)

		if (this.entries.length > this.maxEntries) {
			this.entries.shift()
		}

		if (this.logToConsole) {
			this.logEntry(entry)
		}
	}

	private logEntry(entry: TraceEntry): void {
		const prefix = `[Graph:${entry.event}]`
		const durationStr = entry.duration ? ` (${entry.duration}ms)` : ""
		const fileStr = entry.filePath ? ` - ${entry.filePath}` : ""

		switch (entry.severity) {
			case TraceSeverity.ERROR:
				console.error(`${prefix}${durationStr}${fileStr}`, entry.error || "", entry.details || "")
				break
			case TraceSeverity.WARN:
				console.warn(`${prefix}${durationStr}${fileStr}`, entry.details || "")
				break
			case TraceSeverity.DEBUG:
				console.debug(`${prefix}${durationStr}${fileStr}`, entry.details || "")
				break
			default:
				console.log(`${prefix}${durationStr}${fileStr}`, entry.details || "")
		}
	}

	private generateId(): string {
		return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
	}
}

// Singleton instance for global access
let globalTraceCollector: TraceCollector | undefined

export function getTraceCollector(): TraceCollector {
	if (!globalTraceCollector) {
		globalTraceCollector = new TraceCollector()
	}
	return globalTraceCollector
}

export function resetTraceCollector(): void {
	globalTraceCollector = undefined
}
