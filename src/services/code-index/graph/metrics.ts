/**
 * Knowledge Graph Metrics Collector
 * Enterprise-grade observability for graph operations
 */

/**
 * Performance metrics for graph operations
 */
export interface GraphMetrics {
	// Build metrics
	totalBuilds: number
	lastBuildDuration: number
	averageBuildDuration: number
	buildErrors: number

	// Parse metrics
	totalParses: number
	parseSuccesses: number
	parseFailures: number
	averageParseDuration: number

	// Query metrics
	totalQueries: number
	queryHits: number
	queryMisses: number
	averageQueryDuration: number

	// Storage metrics
	saveOperations: number
	loadOperations: number
	averageSaveDuration: number
	averageLoadDuration: number

	// Graph metrics
	peakNodeCount: number
	peakEdgeCount: number
	peakMemoryUsage: number

	// Timestamps
	collectionStarted: number
	lastUpdated: number
}

/**
 * Individual operation timing
 */
interface OperationTiming {
	startTime: number
	endTime?: number
	duration?: number
	success: boolean
	error?: string
}

/**
 * Query operation details
 */
interface QueryMetric {
	queryType: string
	duration: number
	cacheHit: boolean
	resultCount: number
	timestamp: number
}

/**
 * MetricsCollector - Collects and aggregates performance metrics
 */
export class MetricsCollector {
	private metrics: GraphMetrics
	private parseTimings: number[] = []
	private queryTimings: number[] = []
	private buildTimings: number[] = []
	private saveTimings: number[] = []
	private loadTimings: number[] = []
	private recentQueries: QueryMetric[] = []

	// Configuration
	private readonly maxTimingHistory = 1000
	private readonly maxRecentQueries = 100

	constructor() {
		this.metrics = this.createInitialMetrics()
	}

	private createInitialMetrics(): GraphMetrics {
		return {
			totalBuilds: 0,
			lastBuildDuration: 0,
			averageBuildDuration: 0,
			buildErrors: 0,

			totalParses: 0,
			parseSuccesses: 0,
			parseFailures: 0,
			averageParseDuration: 0,

			totalQueries: 0,
			queryHits: 0,
			queryMisses: 0,
			averageQueryDuration: 0,

			saveOperations: 0,
			loadOperations: 0,
			averageSaveDuration: 0,
			averageLoadDuration: 0,

			peakNodeCount: 0,
			peakEdgeCount: 0,
			peakMemoryUsage: 0,

			collectionStarted: Date.now(),
			lastUpdated: Date.now(),
		}
	}

	/**
	 * Record a parse operation
	 */
	recordParse(duration: number, success: boolean = true): void {
		this.metrics.totalParses++
		if (success) {
			this.metrics.parseSuccesses++
		} else {
			this.metrics.parseFailures++
		}

		this.parseTimings.push(duration)
		if (this.parseTimings.length > this.maxTimingHistory) {
			this.parseTimings.shift()
		}

		this.metrics.averageParseDuration = this.calculateAverage(this.parseTimings)
		this.metrics.lastUpdated = Date.now()
	}

	/**
	 * Record a query operation
	 */
	recordQuery(duration: number, queryType: string, cacheHit: boolean, resultCount: number = 0): void {
		this.metrics.totalQueries++
		if (cacheHit) {
			this.metrics.queryHits++
		} else {
			this.metrics.queryMisses++
		}

		this.queryTimings.push(duration)
		if (this.queryTimings.length > this.maxTimingHistory) {
			this.queryTimings.shift()
		}

		this.recentQueries.push({
			queryType,
			duration,
			cacheHit,
			resultCount,
			timestamp: Date.now(),
		})
		if (this.recentQueries.length > this.maxRecentQueries) {
			this.recentQueries.shift()
		}

		this.metrics.averageQueryDuration = this.calculateAverage(this.queryTimings)
		this.metrics.lastUpdated = Date.now()
	}

	/**
	 * Record a build operation
	 */
	recordBuild(duration: number, success: boolean = true): void {
		this.metrics.totalBuilds++
		this.metrics.lastBuildDuration = duration

		if (!success) {
			this.metrics.buildErrors++
		}

		this.buildTimings.push(duration)
		if (this.buildTimings.length > this.maxTimingHistory) {
			this.buildTimings.shift()
		}

		this.metrics.averageBuildDuration = this.calculateAverage(this.buildTimings)
		this.metrics.lastUpdated = Date.now()
	}

	/**
	 * Record a save operation
	 */
	recordSave(duration: number): void {
		this.metrics.saveOperations++

		this.saveTimings.push(duration)
		if (this.saveTimings.length > this.maxTimingHistory) {
			this.saveTimings.shift()
		}

		this.metrics.averageSaveDuration = this.calculateAverage(this.saveTimings)
		this.metrics.lastUpdated = Date.now()
	}

	/**
	 * Record a load operation
	 */
	recordLoad(duration: number): void {
		this.metrics.loadOperations++

		this.loadTimings.push(duration)
		if (this.loadTimings.length > this.maxTimingHistory) {
			this.loadTimings.shift()
		}

		this.metrics.averageLoadDuration = this.calculateAverage(this.loadTimings)
		this.metrics.lastUpdated = Date.now()
	}

	/**
	 * Update graph size metrics
	 */
	updateGraphSize(nodeCount: number, edgeCount: number): void {
		this.metrics.peakNodeCount = Math.max(this.metrics.peakNodeCount, nodeCount)
		this.metrics.peakEdgeCount = Math.max(this.metrics.peakEdgeCount, edgeCount)
		this.metrics.peakMemoryUsage = Math.max(this.metrics.peakMemoryUsage, process.memoryUsage().heapUsed)
		this.metrics.lastUpdated = Date.now()
	}

	/**
	 * Get current metrics snapshot
	 */
	getMetrics(): GraphMetrics {
		return { ...this.metrics }
	}

	/**
	 * Get recent queries for debugging
	 */
	getRecentQueries(count: number = 10): QueryMetric[] {
		return this.recentQueries.slice(-count)
	}

	/**
	 * Get query cache hit rate
	 */
	getCacheHitRate(): number {
		if (this.metrics.totalQueries === 0) return 0
		return this.metrics.queryHits / this.metrics.totalQueries
	}

	/**
	 * Get parse success rate
	 */
	getParseSuccessRate(): number {
		if (this.metrics.totalParses === 0) return 0
		return this.metrics.parseSuccesses / this.metrics.totalParses
	}

	/**
	 * Reset all metrics
	 */
	reset(): void {
		this.metrics = this.createInitialMetrics()
		this.parseTimings = []
		this.queryTimings = []
		this.buildTimings = []
		this.saveTimings = []
		this.loadTimings = []
		this.recentQueries = []
	}

	/**
	 * Export metrics for external monitoring
	 */
	exportMetrics(): Record<string, number> {
		return {
			"graph.builds.total": this.metrics.totalBuilds,
			"graph.builds.errors": this.metrics.buildErrors,
			"graph.builds.avg_duration_ms": this.metrics.averageBuildDuration,

			"graph.parses.total": this.metrics.totalParses,
			"graph.parses.success_rate": this.getParseSuccessRate(),
			"graph.parses.avg_duration_ms": this.metrics.averageParseDuration,

			"graph.queries.total": this.metrics.totalQueries,
			"graph.queries.cache_hit_rate": this.getCacheHitRate(),
			"graph.queries.avg_duration_ms": this.metrics.averageQueryDuration,

			"graph.storage.saves": this.metrics.saveOperations,
			"graph.storage.loads": this.metrics.loadOperations,

			"graph.size.peak_nodes": this.metrics.peakNodeCount,
			"graph.size.peak_edges": this.metrics.peakEdgeCount,
			"graph.memory.peak_bytes": this.metrics.peakMemoryUsage,
		}
	}

	private calculateAverage(values: number[]): number {
		if (values.length === 0) return 0
		return values.reduce((sum, v) => sum + v, 0) / values.length
	}
}

// Singleton instance for global access
let globalMetricsCollector: MetricsCollector | undefined

export function getMetricsCollector(): MetricsCollector {
	if (!globalMetricsCollector) {
		globalMetricsCollector = new MetricsCollector()
	}
	return globalMetricsCollector
}

export function resetMetricsCollector(): void {
	globalMetricsCollector = undefined
}
