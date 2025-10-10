import type { ClineMessage } from "@roo-code/types"
import type { TelemetryService } from "@roo-code/telemetry"
import type { ImageManager } from "../image-storage/ImageManager"

/**
 * Memory usage metrics in megabytes
 */
export interface MemoryUsage {
	messagesMemoryMB: number
	imagesMemoryMB: number
	apiHistoryMemoryMB: number
	totalMemoryMB: number
}

/**
 * Memory monitoring configuration
 */
interface MemoryMonitorConfig {
	/** Warning threshold in MB (default: 500MB) */
	warningThresholdMB?: number
	/** Critical threshold in MB (default: 1000MB) */
	criticalThresholdMB?: number
	/** Monitoring interval in milliseconds (default: 30000ms = 30s) */
	monitoringIntervalMs?: number
}

/**
 * MemoryMonitor class for tracking and alerting on task memory usage
 */
export class MemoryMonitor {
	private readonly taskId: string
	private readonly telemetryService: TelemetryService
	private readonly imageManager: ImageManager
	private readonly warningThresholdMB: number
	private readonly criticalThresholdMB: number
	private readonly monitoringIntervalMs: number
	private monitoringTimer: NodeJS.Timeout | null = null
	private lastWarningLevel: "none" | "warning" | "critical" = "none"
	private getMessages: () => ClineMessage[]
	private getApiConversationHistory: () => any[]

	constructor(
		taskId: string,
		telemetryService: TelemetryService,
		imageManager: ImageManager,
		getMessages: () => ClineMessage[],
		getApiConversationHistory: () => any[],
		config: MemoryMonitorConfig = {},
	) {
		this.taskId = taskId
		this.telemetryService = telemetryService
		this.imageManager = imageManager
		this.getMessages = getMessages
		this.getApiConversationHistory = getApiConversationHistory
		this.warningThresholdMB = config.warningThresholdMB ?? 500
		this.criticalThresholdMB = config.criticalThresholdMB ?? 1000
		this.monitoringIntervalMs = config.monitoringIntervalMs ?? 30000 // 30 seconds
	}

	/**
	 * Start memory monitoring
	 */
	start(): void {
		if (this.monitoringTimer) {
			return // Already monitoring
		}

		// Initial check
		this.checkMemoryUsage()

		// Schedule periodic checks
		this.monitoringTimer = setInterval(() => {
			this.checkMemoryUsage()
		}, this.monitoringIntervalMs)
	}

	/**
	 * Stop memory monitoring
	 */
	stop(): void {
		if (this.monitoringTimer) {
			clearInterval(this.monitoringTimer)
			this.monitoringTimer = null
		}
	}

	/**
	 * Get current memory usage
	 */
	getMemoryUsage(): MemoryUsage {
		const messages = this.getMessages()
		const apiHistory = this.getApiConversationHistory()

		// Estimate messages memory (rough estimate based on JSON size)
		const messagesMemoryMB = this.estimateMemorySize(messages)

		// Estimate images memory from ImageManager
		const imagesMemoryMB = this.imageManager.getEstimatedMemoryUsage()

		// Estimate API history memory
		const apiHistoryMemoryMB = this.estimateMemorySize(apiHistory)

		const totalMemoryMB = messagesMemoryMB + imagesMemoryMB + apiHistoryMemoryMB

		return {
			messagesMemoryMB,
			imagesMemoryMB,
			apiHistoryMemoryMB,
			totalMemoryMB,
		}
	}

	/**
	 * Check memory usage and trigger warnings if needed
	 */
	private checkMemoryUsage(): void {
		const memoryUsage = this.getMemoryUsage()

		// Capture memory usage metrics
		this.telemetryService.captureMemoryUsage(this.taskId, memoryUsage)

		// Check thresholds
		let currentLevel: "none" | "warning" | "critical" = "none"
		if (memoryUsage.totalMemoryMB >= this.criticalThresholdMB) {
			currentLevel = "critical"
		} else if (memoryUsage.totalMemoryMB >= this.warningThresholdMB) {
			currentLevel = "warning"
		}

		// Only trigger warning if level has changed (avoid spam)
		if (currentLevel !== "none" && currentLevel !== this.lastWarningLevel) {
			const thresholdMB = currentLevel === "critical" ? this.criticalThresholdMB : this.warningThresholdMB

			this.telemetryService.captureMemoryWarning(
				this.taskId,
				currentLevel,
				memoryUsage.totalMemoryMB,
				thresholdMB,
			)

			this.lastWarningLevel = currentLevel
		} else if (currentLevel === "none") {
			this.lastWarningLevel = "none"
		}
	}

	/**
	 * Estimate memory size of an object in megabytes
	 * Uses JSON.stringify as a rough approximation
	 */
	private estimateMemorySize(obj: any): number {
		try {
			// UTF-16 strings use 2 bytes per character
			const jsonString = JSON.stringify(obj)
			const bytes = jsonString.length * 2
			const megabytes = bytes / (1024 * 1024)
			return Math.round(megabytes * 100) / 100 // Round to 2 decimal places
		} catch (error) {
			// If serialization fails, return 0
			return 0
		}
	}

	/**
	 * Dispose of the monitor and clean up resources
	 */
	dispose(): void {
		this.stop()
	}
}
