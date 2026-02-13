import * as vscode from "vscode"

import { TodoItem } from "@roo-code/types"

import { Task } from "../task/Task"
import { getModeBySlug } from "../../shared/modes"
import { formatResponse } from "../prompts/responses"
import { t } from "../../i18n"
import { parseMarkdownChecklist } from "./UpdateTodoListTool"
import { Package } from "../../shared/package"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { ToolUse } from "../../shared/tools"
import { ContextDistiller } from "../rpi/ContextDistiller"
import { buildEnvelope, serializeEnvelope } from "../rpi/TaskContextEnvelope"

interface NewTaskParams {
	mode: string
	message: string
	todos?: string
	parallel_group?: string
}

const MAX_DISTILLED_CONTEXT_CHARS = 8000

export class NewTaskTool extends BaseTool<"new_task"> {
	readonly name = "new_task" as const

	async execute(params: NewTaskParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { mode, message, todos, parallel_group } = params
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

			// Apply context distillation if RPI autopilot has observations
			let finalMessage = unescapedMessage
			try {
				const rpiAutopilot = (task as any).rpiAutopilot
				if (rpiAutopilot) {
					const distiller = new ContextDistiller()
					const distilled = distiller.distill({
						parentMessage: unescapedMessage,
						parentObservations: rpiAutopilot.currentObservations ?? [],
						parentPlan: rpiAutopilot.currentPlan,
						targetMode: mode,
						maxContextChars: MAX_DISTILLED_CONTEXT_CHARS,
					})

					// Wrap with envelope for structured context
					const envelope = buildEnvelope(distilled)
					const envelopeStr = serializeEnvelope(envelope)
					finalMessage = `${envelopeStr}\n\n${distilled.formattedMessage}`
				}
			} catch {
				// Context distillation is best-effort, use original message on failure
			}

			const toolMessage = JSON.stringify({
				tool: "newTask",
				mode: targetMode.name,
				content: message,
				todos: todoItems,
				parallel_group: parallel_group ?? undefined,
			})

			const didApprove = await askApproval("tool", toolMessage)

			if (!didApprove) {
				return
			}

			// Delegate parent and open child as sole active task
			const child = await (provider as any).delegateParentAndOpenChild({
				parentTaskId: task.taskId,
				message: finalMessage,
				initialTodos: todoItems,
				mode,
				parallelGroup: parallel_group,
			})

			// Reflect delegation in tool result (no pause/unpause, no wait)
			pushToolResult(`Delegated to child task ${child.taskId}`)
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
		const parallel_group: string | undefined = block.params.parallel_group

		const partialMessage = JSON.stringify({
			tool: "newTask",
			mode: mode ?? "",
			content: message ?? "",
			todos: todos,
			parallel_group: parallel_group ?? undefined,
		})

		await task.ask("tool", partialMessage, block.partial).catch(() => {})
	}
}

export const newTaskTool = new NewTaskTool()
