import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { ToolUse } from "../../shared/tools"
import cloneDeep from "clone-deep"
import crypto from "crypto"
import { TodoItem, TodoStatus, todoStatusSchema } from "@roo-code/types"
import { getLatestTodo } from "../../shared/todo"

interface UpdateTodoListParams {
	todos: string
}

let approvedTodoList: TodoItem[] | undefined = undefined

export class UpdateTodoListTool extends BaseTool<"update_todo_list"> {
	readonly name = "update_todo_list" as const

	parseLegacy(params: Partial<Record<string, string>>): UpdateTodoListParams {
		return {
			todos: params.todos || "",
		}
	}

	async execute(params: UpdateTodoListParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { pushToolResult, handleError, askApproval, toolProtocol } = callbacks

		try {
			// Pull the previous todo list so we can preserve metadata fields across update_todo_list calls.
			// Prefer the in-memory task.todoList when available; otherwise fall back to the latest todo list
			// stored in the conversation history.
			const previousTodos =
				getTodoListForTask(task) ?? (getLatestTodo(task.clineMessages) as unknown as TodoItem[])

			const todosRaw = params.todos

			let todos: TodoItem[]
			try {
				todos = parseMarkdownChecklist(todosRaw || "")
			} catch {
				task.consecutiveMistakeCount++
				task.recordToolError("update_todo_list")
				task.didToolFailInCurrentTurn = true
				pushToolResult(formatResponse.toolError("The todos parameter is not valid markdown checklist or JSON"))
				return
			}

			// Preserve metadata (subtaskId/tokens/cost) for todos whose content matches an existing todo.
			// Matching is by exact content string; duplicates are matched in order.
			const todosWithPreservedMetadata = preserveTodoMetadata(todos, previousTodos)

			const { valid, error } = validateTodos(todos)
			if (!valid) {
				task.consecutiveMistakeCount++
				task.recordToolError("update_todo_list")
				task.didToolFailInCurrentTurn = true
				pushToolResult(formatResponse.toolError(error || "todos parameter validation failed"))
				return
			}

			let normalizedTodos: TodoItem[] = todosWithPreservedMetadata.map((t) => ({
				id: t.id,
				content: t.content,
				status: normalizeStatus(t.status),
				subtaskId: t.subtaskId,
				tokens: t.tokens,
				cost: t.cost,
			}))

			const approvalMsg = JSON.stringify({
				tool: "updateTodoList",
				todos: normalizedTodos,
			})

			approvedTodoList = cloneDeep(normalizedTodos)
			const didApprove = await askApproval("tool", approvalMsg)
			if (!didApprove) {
				pushToolResult("User declined to update the todoList.")
				return
			}

			const isTodoListChanged =
				approvedTodoList !== undefined && JSON.stringify(normalizedTodos) !== JSON.stringify(approvedTodoList)
			if (isTodoListChanged) {
				normalizedTodos = approvedTodoList ?? []

				// If the user-edited todo list dropped metadata fields, re-apply metadata preservation against
				// the previous list (and keep any explicitly provided metadata in the edited list).
				normalizedTodos = preserveTodoMetadata(normalizedTodos, previousTodos)

				task.say(
					"user_edit_todos",
					JSON.stringify({
						tool: "updateTodoList",
						todos: normalizedTodos,
					}),
				)
			}

			await setTodoListForTask(task, normalizedTodos)

			if (isTodoListChanged) {
				const md = todoListToMarkdown(normalizedTodos)
				pushToolResult(formatResponse.toolResult("User edits todo:\n\n" + md))
			} else {
				pushToolResult(formatResponse.toolResult("Todo list updated successfully."))
			}
		} catch (error) {
			await handleError("update todo list", error as Error)
		}
	}

	override async handlePartial(task: Task, block: ToolUse<"update_todo_list">): Promise<void> {
		const todosRaw = block.params.todos
		const previousTodos = getTodoListForTask(task) ?? (getLatestTodo(task.clineMessages) as unknown as TodoItem[])

		// Parse the markdown checklist to maintain consistent format with execute()
		let todos: TodoItem[]
		try {
			todos = parseMarkdownChecklist(todosRaw || "")
		} catch {
			// If parsing fails during partial, send empty array
			todos = []
		}

		todos = preserveTodoMetadata(todos, previousTodos)

		const approvalMsg = JSON.stringify({
			tool: "updateTodoList",
			todos: todos,
		})
		await task.ask("tool", approvalMsg, block.partial).catch(() => {})
	}
}

export function addTodoToTask(cline: Task, content: string, status: TodoStatus = "pending", id?: string): TodoItem {
	const todo: TodoItem = {
		id: id ?? crypto.randomUUID(),
		content,
		status,
	}
	if (!cline.todoList) cline.todoList = []
	cline.todoList.push(todo)
	return todo
}

export function updateTodoStatusForTask(cline: Task, id: string, nextStatus: TodoStatus): boolean {
	if (!cline.todoList) return false
	const idx = cline.todoList.findIndex((t) => t.id === id)
	if (idx === -1) return false
	const current = cline.todoList[idx]
	if (
		(current.status === "pending" && nextStatus === "in_progress") ||
		(current.status === "in_progress" && nextStatus === "completed") ||
		current.status === nextStatus
	) {
		cline.todoList[idx] = { ...current, status: nextStatus }
		return true
	}
	return false
}

export function removeTodoFromTask(cline: Task, id: string): boolean {
	if (!cline.todoList) return false
	const idx = cline.todoList.findIndex((t) => t.id === id)
	if (idx === -1) return false
	cline.todoList.splice(idx, 1)
	return true
}

export function getTodoListForTask(cline: Task): TodoItem[] | undefined {
	return cline.todoList?.slice()
}

export async function setTodoListForTask(cline?: Task, todos?: TodoItem[]) {
	if (cline === undefined) return
	cline.todoList = Array.isArray(todos) ? todos : []
}

export function restoreTodoListForTask(cline: Task, todoList?: TodoItem[]) {
	if (todoList) {
		cline.todoList = Array.isArray(todoList) ? todoList : []
		return
	}
	cline.todoList = getLatestTodo(cline.clineMessages)
}

function todoListToMarkdown(todos: TodoItem[]): string {
	return todos
		.map((t) => {
			let box = "[ ]"
			if (t.status === "completed") box = "[x]"
			else if (t.status === "in_progress") box = "[-]"
			return `${box} ${t.content}`
		})
		.join("\n")
}

function normalizeStatus(status: string | undefined): TodoStatus {
	if (status === "completed") return "completed"
	if (status === "in_progress") return "in_progress"
	return "pending"
}

/**
 * Preserve metadata (subtaskId, tokens, cost) from previous todos onto next todos.
 *
 * Matching strategy (in priority order):
 * 1. **ID match**: If both todos have an `id` field and they match exactly, preserve metadata.
 *    This handles the common case where ID is stable across updates.
 * 2. **Content match with position awareness**: For todos without matching IDs, fall back to
 *    content-based matching. Duplicates are matched in order (first unmatched previous with
 *    same content gets matched to first unmatched next with same content).
 *
 * This approach ensures metadata survives status changes (which can alter the derived ID)
 * and handles duplicates deterministically.
 */
function preserveTodoMetadata(nextTodos: TodoItem[], previousTodos: TodoItem[]): TodoItem[] {
	const safePrevious = previousTodos ?? []
	const safeNext = nextTodos ?? []

	// Build ID -> todo mapping for O(1) lookup
	const previousById = new Map<string, TodoItem>()
	for (const prev of safePrevious) {
		if (prev?.id && typeof prev.id === "string") {
			// Only store the first occurrence for each ID (handle duplicates deterministically)
			if (!previousById.has(prev.id)) {
				previousById.set(prev.id, prev)
			}
		}
	}

	// Track which previous todos have been used (by their index) to avoid double-matching
	const usedPreviousIndices = new Set<number>()

	// Build content -> queue mapping for fallback (content-based matching)
	// Each queue entry includes the original index for tracking
	const previousByContent = new Map<string, Array<{ todo: TodoItem; index: number }>>()
	for (let i = 0; i < safePrevious.length; i++) {
		const prev = safePrevious[i]
		if (!prev || typeof prev.content !== "string") continue
		const list = previousByContent.get(prev.content)
		if (list) list.push({ todo: prev, index: i })
		else previousByContent.set(prev.content, [{ todo: prev, index: i }])
	}

	return safeNext.map((next) => {
		if (!next) return next

		let matchedPrev: TodoItem | undefined = undefined
		let matchedIndex: number | undefined = undefined

		// Strategy 1: Try ID-based matching first (most reliable)
		if (next.id && typeof next.id === "string") {
			const byId = previousById.get(next.id)
			if (byId) {
				// Find the index of this todo in the original array
				const idx = safePrevious.findIndex((p) => p === byId)
				if (idx !== -1 && !usedPreviousIndices.has(idx)) {
					matchedPrev = byId
					matchedIndex = idx
				}
			}
		}

		// Strategy 2: Fall back to content-based matching if ID didn't match
		if (!matchedPrev && typeof next.content === "string") {
			const candidates = previousByContent.get(next.content)
			if (candidates) {
				// Find first unused candidate
				for (const candidate of candidates) {
					if (!usedPreviousIndices.has(candidate.index)) {
						matchedPrev = candidate.todo
						matchedIndex = candidate.index
						break
					}
				}
			}
		}

		// Mark as used and apply metadata
		if (matchedPrev && matchedIndex !== undefined) {
			usedPreviousIndices.add(matchedIndex)
			return {
				...next,
				subtaskId: next.subtaskId ?? matchedPrev.subtaskId,
				tokens: next.tokens ?? matchedPrev.tokens,
				cost: next.cost ?? matchedPrev.cost,
			}
		}

		return next
	})
}

export function parseMarkdownChecklist(md: string): TodoItem[] {
	if (typeof md !== "string") return []
	const lines = md
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter(Boolean)
	const todos: TodoItem[] = []
	for (const line of lines) {
		const match = line.match(/^(?:-\s*)?\[\s*([ xX\-~])\s*\]\s+(.+)$/)
		if (!match) continue
		let status: TodoStatus = "pending"
		if (match[1] === "x" || match[1] === "X") status = "completed"
		else if (match[1] === "-" || match[1] === "~") status = "in_progress"
		const id = crypto
			.createHash("md5")
			.update(match[2] + status)
			.digest("hex")
		todos.push({
			id,
			content: match[2],
			status,
		})
	}
	return todos
}

export function setPendingTodoList(todos: TodoItem[]) {
	approvedTodoList = todos
}

function validateTodos(todos: any[]): { valid: boolean; error?: string } {
	if (!Array.isArray(todos)) return { valid: false, error: "todos must be an array" }
	for (const [i, t] of todos.entries()) {
		if (!t || typeof t !== "object") return { valid: false, error: `Item ${i + 1} is not an object` }
		if (!t.id || typeof t.id !== "string") return { valid: false, error: `Item ${i + 1} is missing id` }
		if (!t.content || typeof t.content !== "string")
			return { valid: false, error: `Item ${i + 1} is missing content` }
		if (t.status && !todoStatusSchema.options.includes(t.status as TodoStatus))
			return { valid: false, error: `Item ${i + 1} has invalid status` }
	}
	return { valid: true }
}

export const updateTodoListTool = new UpdateTodoListTool()
