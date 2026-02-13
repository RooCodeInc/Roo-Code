import { TaskQueue, type QueuedTask } from "./TaskQueue"

/**
 * Manages the lifecycle of the task queue.
 * Integrates with ClineProvider to start and monitor queued tasks.
 */
export class TaskQueueManager {
	private readonly queue: TaskQueue
	private processing = false
	private onStartTask?: (task: QueuedTask) => Promise<void>

	constructor(maxConcurrent = 1) {
		this.queue = new TaskQueue(maxConcurrent)

		this.queue.on("task_queued", () => {
			this.processNext()
		})

		this.queue.on("task_completed", () => {
			this.processNext()
		})

		this.queue.on("task_failed", () => {
			this.processNext()
		})
	}

	/**
	 * Set the callback to invoke when a queued task should start.
	 */
	setTaskStartHandler(handler: (task: QueuedTask) => Promise<void>): void {
		this.onStartTask = handler
	}

	/**
	 * Add a task to the queue.
	 */
	addTask(params: {
		id: string
		message: string
		mode: string
		priority?: number
		parallelGroup?: string
	}): QueuedTask {
		return this.queue.enqueue({
			id: params.id,
			message: params.message,
			mode: params.mode,
			priority: params.priority ?? 0,
			parallelGroup: params.parallelGroup,
		})
	}

	/**
	 * Mark a task as completed.
	 */
	completeTask(taskId: string, result?: string): void {
		this.queue.complete(taskId, result)
	}

	/**
	 * Mark a task as failed.
	 */
	failTask(taskId: string, error: string): void {
		this.queue.fail(taskId, error)
	}

	/**
	 * Cancel a queued task.
	 */
	cancelTask(taskId: string): boolean {
		return this.queue.cancel(taskId)
	}

	/**
	 * Get all tasks in the queue.
	 */
	getAllTasks(): QueuedTask[] {
		return this.queue.getAll()
	}

	/**
	 * Get queue stats.
	 */
	getStats(): { pending: number; running: number; total: number } {
		return {
			pending: this.queue.pendingCount,
			running: this.queue.runningCount,
			total: this.queue.size,
		}
	}

	private async processNext(): Promise<void> {
		if (this.processing || !this.queue.hasReady || !this.onStartTask) {
			return
		}

		this.processing = true

		try {
			while (this.queue.hasReady) {
				const task = this.queue.dequeue()
				if (!task) break

				try {
					await this.onStartTask(task)
				} catch (error) {
					this.queue.fail(task.id, error instanceof Error ? error.message : String(error))
				}
			}
		} finally {
			this.processing = false
		}
	}
}
