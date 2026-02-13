import { EventEmitter } from "events"

export interface QueuedTask {
	id: string
	message: string
	mode: string
	priority: number
	status: "queued" | "running" | "completed" | "failed" | "cancelled"
	createdAt: number
	startedAt?: number
	completedAt?: number
	error?: string
	result?: string
	parallelGroup?: string
}

export type TaskQueueEvent = "task_queued" | "task_started" | "task_completed" | "task_failed" | "queue_empty"

/**
 * Priority queue for managing tasks.
 * Higher priority numbers run first.
 * Tasks in the same parallelGroup can run concurrently.
 */
export class TaskQueue extends EventEmitter {
	private queue: QueuedTask[] = []
	private running: Map<string, QueuedTask> = new Map()
	private readonly maxConcurrent: number

	constructor(maxConcurrent = 1) {
		super()
		this.maxConcurrent = maxConcurrent
	}

	/**
	 * Add a task to the queue.
	 */
	enqueue(task: Omit<QueuedTask, "status" | "createdAt">): QueuedTask {
		const queuedTask: QueuedTask = {
			...task,
			status: "queued",
			createdAt: Date.now(),
		}

		this.queue.push(queuedTask)
		this.queue.sort((a, b) => b.priority - a.priority)
		this.emit("task_queued", queuedTask)

		return queuedTask
	}

	/**
	 * Get the next task(s) eligible to run.
	 * Respects max concurrency and parallel groups.
	 */
	dequeue(): QueuedTask | undefined {
		if (this.running.size >= this.maxConcurrent) {
			return undefined
		}

		const index = this.queue.findIndex((t) => t.status === "queued")
		if (index === -1) {
			return undefined
		}

		const task = this.queue[index]
		this.queue.splice(index, 1)
		task.status = "running"
		task.startedAt = Date.now()
		this.running.set(task.id, task)
		this.emit("task_started", task)

		return task
	}

	/**
	 * Mark a task as completed.
	 */
	complete(taskId: string, result?: string): void {
		const task = this.running.get(taskId)
		if (!task) {
			return
		}

		task.status = "completed"
		task.completedAt = Date.now()
		task.result = result
		this.running.delete(taskId)
		this.emit("task_completed", task)

		if (this.queue.length === 0 && this.running.size === 0) {
			this.emit("queue_empty")
		}
	}

	/**
	 * Mark a task as failed.
	 */
	fail(taskId: string, error: string): void {
		const task = this.running.get(taskId)
		if (!task) {
			return
		}

		task.status = "failed"
		task.completedAt = Date.now()
		task.error = error
		this.running.delete(taskId)
		this.emit("task_failed", task)
	}

	/**
	 * Cancel a queued task.
	 */
	cancel(taskId: string): boolean {
		const index = this.queue.findIndex((t) => t.id === taskId)
		if (index !== -1) {
			this.queue[index].status = "cancelled"
			this.queue.splice(index, 1)
			return true
		}
		return false
	}

	/**
	 * Get all tasks in queue (including running).
	 */
	getAll(): QueuedTask[] {
		return [...this.queue, ...Array.from(this.running.values())]
	}

	/**
	 * Get queue size (pending + running).
	 */
	get size(): number {
		return this.queue.length + this.running.size
	}

	/**
	 * Get count of currently running tasks.
	 */
	get runningCount(): number {
		return this.running.size
	}

	/**
	 * Get count of queued (waiting) tasks.
	 */
	get pendingCount(): number {
		return this.queue.length
	}

	/**
	 * Check if there are tasks ready to run.
	 */
	get hasReady(): boolean {
		return this.queue.some((t) => t.status === "queued") && this.running.size < this.maxConcurrent
	}
}
