import type { Socket } from "socket.io-client"

import {
	type ClineMessage,
	type TaskEvents,
	type TaskLike,
	type TaskBridgeCommand,
	type TaskBridgeEvent,
	type JoinResponse,
	type LeaveResponse,
	RooCodeEventName,
	TaskBridgeEventName,
	TaskBridgeCommandName,
	TaskSocketEvents,
} from "@roo-code/types"

import { BaseChannel } from "./BaseChannel.js"

type TaskEventListener = {
	[K in keyof TaskEvents]: (...args: TaskEvents[K]) => void | Promise<void>
}[keyof TaskEvents]

const TASK_EVENT_MAPPING: Record<TaskBridgeEventName, keyof TaskEvents> = {
	[TaskBridgeEventName.Message]: RooCodeEventName.Message,
	[TaskBridgeEventName.TaskModeSwitched]: RooCodeEventName.TaskModeSwitched,
	[TaskBridgeEventName.TaskInteractive]: RooCodeEventName.TaskInteractive,
}

/**
 * Manages task-level communication channels.
 * Handles task subscriptions, messaging, and task-specific commands.
 */
export class TaskChannel extends BaseChannel<
	TaskBridgeCommand,
	TaskSocketEvents,
	TaskBridgeEvent | { taskId: string }
> {
	private subscribedTasks: Map<string, TaskLike> = new Map()
	private pendingTasks: Map<string, TaskLike> = new Map()
	private taskListeners: Map<string, Map<TaskBridgeEventName, TaskEventListener>> = new Map()

	constructor(instanceId: string) {
		super(instanceId)
	}

	public handleCommand(command: TaskBridgeCommand): void {
		const task = this.subscribedTasks.get(command.taskId)

		if (!task) {
			console.error(`[TaskChannel] Unable to find task ${command.taskId}`)
			return
		}

		switch (command.type) {
			case TaskBridgeCommandName.Message:
				console.log(
					`[TaskChannel] ${TaskBridgeCommandName.Message} ${command.taskId} -> submitUserMessage()`,
					command,
				)
				task.submitUserMessage(command.payload.text, command.payload.images)
				break

			case TaskBridgeCommandName.ApproveAsk:
				console.log(
					`[TaskChannel] ${TaskBridgeCommandName.ApproveAsk} ${command.taskId} -> approveAsk()`,
					command,
				)
				task.approveAsk(command.payload)
				break

			case TaskBridgeCommandName.DenyAsk:
				console.log(`[TaskChannel] ${TaskBridgeCommandName.DenyAsk} ${command.taskId} -> denyAsk()`, command)
				task.denyAsk(command.payload)
				break
		}
	}

	protected async handleConnect(socket: Socket): Promise<void> {
		// Rejoin all subscribed tasks.
		for (const taskId of this.subscribedTasks.keys()) {
			await this.publish(TaskSocketEvents.JOIN, { taskId })
		}

		// Subscribe to any pending tasks.
		for (const task of this.pendingTasks.values()) {
			await this.subscribeToTask(task, socket)
		}

		this.pendingTasks.clear()
	}

	protected async handleReconnect(_socket: Socket): Promise<void> {
		// Rejoin all subscribed tasks.
		for (const taskId of this.subscribedTasks.keys()) {
			await this.publish(TaskSocketEvents.JOIN, { taskId })
		}
	}

	protected async handleCleanup(socket: Socket): Promise<void> {
		const unsubscribePromises = []

		for (const taskId of this.subscribedTasks.keys()) {
			unsubscribePromises.push(this.unsubscribeFromTask(taskId, socket))
		}

		await Promise.allSettled(unsubscribePromises)
		this.subscribedTasks.clear()
		this.taskListeners.clear()
		this.pendingTasks.clear()
	}

	/**
	 * Add a task to the pending queue (will be subscribed when connected).
	 */
	public addPendingTask(task: TaskLike): void {
		this.pendingTasks.set(task.taskId, task)
	}

	public async subscribeToTask(task: TaskLike, _socket: Socket): Promise<void> {
		const taskId = task.taskId

		await this.publish(TaskSocketEvents.JOIN, { taskId }, (response: JoinResponse) => {
			if (response.success) {
				console.log(`[TaskChannel#subscribeToTask] subscribed to ${taskId}`)
				this.subscribedTasks.set(taskId, task)
				this.setupTaskListeners(task)
			} else {
				console.error(`[TaskChannel#subscribeToTask] failed to subscribe to ${taskId}: ${response.error}`)
			}
		})
	}

	public async unsubscribeFromTask(taskId: string, _socket: Socket): Promise<void> {
		const task = this.subscribedTasks.get(taskId)

		await this.publish(TaskSocketEvents.LEAVE, { taskId }, (response: LeaveResponse) => {
			if (response.success) {
				console.log(`[TaskChannel#unsubscribeFromTask] unsubscribed from ${taskId}`, response)
			} else {
				console.error(`[TaskChannel#unsubscribeFromTask] failed to unsubscribe from ${taskId}`)
			}

			// If we failed to unsubscribe then something is probably wrong and
			// we should still discard this task from `subscribedTasks`.
			if (task) {
				this.removeTaskListeners(task)
				this.subscribedTasks.delete(taskId)
			}
		})
	}

	private setupTaskListeners(task: TaskLike): void {
		if (this.taskListeners.has(task.taskId)) {
			console.warn("[TaskChannel] Listeners already exist for task, removing old listeners:", task.taskId)
			this.removeTaskListeners(task)
		}

		const listeners = new Map<TaskBridgeEventName, TaskEventListener>()

		const onMessage = ({ action, message }: { action: string; message: ClineMessage }) => {
			this.publish(TaskSocketEvents.EVENT, {
				type: TaskBridgeEventName.Message,
				taskId: task.taskId,
				action,
				message,
			})
		}
		task.on(RooCodeEventName.Message, onMessage)
		listeners.set(TaskBridgeEventName.Message, onMessage)

		const onTaskModeSwitched = (mode: string) => {
			this.publish(TaskSocketEvents.EVENT, {
				type: TaskBridgeEventName.TaskModeSwitched,
				taskId: task.taskId,
				mode,
			})
		}
		task.on(RooCodeEventName.TaskModeSwitched, onTaskModeSwitched)
		listeners.set(TaskBridgeEventName.TaskModeSwitched, onTaskModeSwitched)

		const onTaskInteractive = (_taskId: string) => {
			this.publish(TaskSocketEvents.EVENT, {
				type: TaskBridgeEventName.TaskInteractive,
				taskId: task.taskId,
			})
		}
		task.on(RooCodeEventName.TaskInteractive, onTaskInteractive)
		listeners.set(TaskBridgeEventName.TaskInteractive, onTaskInteractive)

		this.taskListeners.set(task.taskId, listeners)
	}

	private removeTaskListeners(task: TaskLike): void {
		const listeners = this.taskListeners.get(task.taskId)

		if (!listeners) {
			return
		}

		listeners.forEach((listener, eventName) => {
			try {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				task.off(TASK_EVENT_MAPPING[eventName], listener as any)
			} catch (error) {
				console.error(
					`[TaskChannel] task.off(${TASK_EVENT_MAPPING[eventName]}) failed for task ${task.taskId}: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		})

		this.taskListeners.delete(task.taskId)
	}
}
