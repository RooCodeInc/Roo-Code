import * as vscode from "vscode"

import { TodoItem } from "@roo-code/types"
<<<<<<< HEAD
import type { SubtaskQueueItem } from "@roo-code/types"
=======
>>>>>>> 6c51a5d52 (fix: three bugs in task permissions - parser, deniedTools exemption, pattern merging)
import { type TaskPermissions, taskPermissionsSchema, toTaskPermissions } from "@roo-code/types"

import { Task } from "../task/Task"
import { getModeBySlug } from "../../shared/modes"
import { formatResponse } from "../prompts/responses"
import { t } from "../../i18n"
import { parseMarkdownChecklist } from "./UpdateTodoListTool"
import { Package } from "../../shared/package"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { ToolUse } from "../../shared/tools"

interface NewTaskParams {
	mode: string
	message: string
	todos?: string
	task_queue?: string
	permissions?: string
}

export class NewTaskTool extends BaseTool<"new_task"> {
	readonly name = "new_task" as const

	async execute(params: NewTaskParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { mode, message, todos, task_queue, permissions: permissionsJson } = params
		const { askApproval, handleError, pushToolResult } = callbacks

		try {
			// Validate required parameters.
			if (!mode) {
				task.consecutiveMistakeCount++
				task.recordToolError("new_task")
				task.didToolFailInCurrentTurn = true
				pushToolResult(await task.sayAndCreateMissingParamError("new_task", "mode"))
				return
			}

			if (!message) {
				task.consecutiveMistakeCount++
				task.recordToolError("new_task")
				task.didToolFailInCurrentTurn = true
				pushToolResult(await task.sayAndCreateMissingParamError("new_task", "message"))
				return
			}

			// Get the VSCode setting for requiring todos.
			const provider = task.providerRef.deref()

			if (!provider) {
				pushToolResult(formatResponse.toolError("Provider reference lost"))
				return
			}

			const state = await provider.getState()

			// Use Package.name (dynamic at build time) as the VSCode configuration namespace.
			// Supports multiple extension variants (e.g., stable/nightly) without hardcoded strings.
			const requireTodos = vscode.workspace
				.getConfiguration(Package.name)
				.get<boolean>("newTaskRequireTodos", false)

			// Check if todos are required based on VSCode setting.
			// Note: `undefined` means not provided, empty string is valid.
			if (requireTodos && todos === undefined) {
				task.consecutiveMistakeCount++
				task.recordToolError("new_task")
				task.didToolFailInCurrentTurn = true
				pushToolResult(await task.sayAndCreateMissingParamError("new_task", "todos"))
				return
			}

			// Parse todos if provided, otherwise use empty array
			let todoItems: TodoItem[] = []
			if (todos) {
				try {
					todoItems = parseMarkdownChecklist(todos)
				} catch (error) {
					task.consecutiveMistakeCount++
					task.recordToolError("new_task")
					task.didToolFailInCurrentTurn = true
					pushToolResult(formatResponse.toolError("Invalid todos format: must be a markdown checklist"))
					return
				}
			}

			// Parse and validate permissions if provided
			let parsedPermissions: TaskPermissions | undefined
			if (permissionsJson) {
				try {
					const raw = JSON.parse(permissionsJson)
					const result = taskPermissionsSchema.safeParse(raw)
					if (!result.success) {
						task.consecutiveMistakeCount++
						task.recordToolError("new_task")
						task.didToolFailInCurrentTurn = true
						pushToolResult(
							formatResponse.toolError(
								`Invalid permissions format: ${result.error.issues.map((i) => i.message).join(", ")}`,
							),
						)
						return
					}
					parsedPermissions = toTaskPermissions(result.data)
				} catch (error) {
					task.consecutiveMistakeCount++
					task.recordToolError("new_task")
					task.didToolFailInCurrentTurn = true
					pushToolResult(formatResponse.toolError("Invalid permissions: must be a valid JSON string"))
					return
				}
			}

			task.consecutiveMistakeCount = 0

			// Un-escape one level of backslashes before '@' for hierarchical subtasks
			// Un-escape one level: \\@ -> \@ (removes one backslash for hierarchical subtasks)
			const unescapedMessage = message.replace(/\\\\@/g, "\\@")

			// Verify the mode exists
			const targetMode = getModeBySlug(mode, state?.customModes)

			if (!targetMode) {
				pushToolResult(formatResponse.toolError(`Invalid mode: ${mode}`))
				return
			}

			// Parse task_queue if provided (sequential fan-out)
			let queueItems: SubtaskQueueItem[] = []
			if (task_queue) {
				try {
					const parsed = JSON.parse(task_queue)
					if (Array.isArray(parsed)) {
						for (const item of parsed) {
							if (typeof item.mode === "string" && typeof item.message === "string") {
								// Validate each queued mode exists
								const queuedMode = getModeBySlug(item.mode, state?.customModes)
								if (!queuedMode) {
									pushToolResult(
										formatResponse.toolError(
											`Invalid mode in task_queue: "${item.mode}". All queued subtasks must use valid modes.`,
										),
									)
									return
								}
								queueItems.push({ mode: item.mode, message: item.message })
							}
						}
					}
				} catch {
					task.consecutiveMistakeCount++
					task.recordToolError("new_task")
					task.didToolFailInCurrentTurn = true
					pushToolResult(
						formatResponse.toolError(
							"Invalid task_queue format: must be a JSON array of objects with 'mode' and 'message' properties.",
						),
					)
					return
				}
			}

			const toolMessage = JSON.stringify({
				tool: "newTask",
				mode: targetMode.name,
				content: message,
				todos: todoItems,
				taskQueue: queueItems.length > 0 ? queueItems : undefined,
				...(parsedPermissions ? { permissions: parsedPermissions } : {}),
			})

			const didApprove = await askApproval("tool", toolMessage)

			if (!didApprove) {
				return
			}

			// Delegate parent and open child as sole active task
			const child = await (provider as any).delegateParentAndOpenChild({
				parentTaskId: task.taskId,
				message: unescapedMessage,
				initialTodos: todoItems,
				mode,
				subtaskQueue: queueItems.length > 0 ? queueItems : undefined,
				permissions: parsedPermissions,
			})

			// Reflect delegation in tool result (no pause/unpause, no wait)
			const queueMsg =
				queueItems.length > 0
					? ` (${queueItems.length} additional subtask${queueItems.length > 1 ? "s" : ""} queued)`
					: ""
			pushToolResult(`Delegated to child task ${child.taskId}${queueMsg}`)
			return
		} catch (error) {
			await handleError("creating new task", error)
			return
		}
	}

	override async handlePartial(task: Task, block: ToolUse<"new_task">): Promise<void> {
		const mode: string | undefined = block.params.mode
		const message: string | undefined = block.params.message
		const todos: string | undefined = block.params.todos
		const taskQueue: string | undefined = block.params.task_queue

		const partialMessage = JSON.stringify({
			tool: "newTask",
			mode: mode ?? "",
			content: message ?? "",
			todos: todos,
			taskQueue: taskQueue,
		})

		await task.ask("tool", partialMessage, block.partial).catch(() => {})
	}
}

export const newTaskTool = new NewTaskTool()
