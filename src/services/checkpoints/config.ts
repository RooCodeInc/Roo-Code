/**
 * Configuration for checkpoint retention and cleanup policies
 */
export interface CheckpointConfig {
	/**
	 * Maximum number of checkpoints to retain per task
	 * Older checkpoints will be removed when this limit is exceeded
	 */
	maxCheckpointsPerTask?: number

	/**
	 * Maximum age of checkpoints in days
	 * Checkpoints older than this will be removed during cleanup
	 */
	maxCheckpointAgeDays?: number

	/**
	 * Maximum total size of checkpoint storage in MB
	 * When exceeded, oldest checkpoints will be removed
	 */
	maxTotalSizeMB?: number

	/**
	 * Whether to automatically clean up old checkpoints
	 * If false, cleanup must be triggered manually
	 */
	autoCleanup?: boolean

	/**
	 * Interval in minutes between automatic cleanup runs
	 * Only applies if autoCleanup is true
	 */
	cleanupIntervalMinutes?: number
}

/**
 * Default checkpoint configuration
 */
export const DEFAULT_CHECKPOINT_CONFIG: CheckpointConfig = {
	maxCheckpointsPerTask: 50, // Keep last 50 checkpoints per task
	maxCheckpointAgeDays: 7, // Remove checkpoints older than 7 days
	maxTotalSizeMB: 5000, // 5GB total limit
	autoCleanup: true,
	cleanupIntervalMinutes: 60, // Run cleanup every hour
}
