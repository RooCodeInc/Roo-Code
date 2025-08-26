import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"

import cloneDeep from "clone-deep"
import crypto from "crypto"
import { TodoItem, TodoStatus, todoStatusSchema } from "@roo-code/types"
import { getLatestTodo } from "../../shared/todo"

interface TodoDiff {
	added: TodoItem[]
	removed: TodoItem[]
	modified: { old: TodoItem; new: TodoItem }[]
}

let approvedTodoList: TodoItem[] | undefined = undefined

/**
 * Add a todo item to the task's todoList.
 */
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

/**
 * Update the status of a todo item by id.
 */
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

/**
 * Remove a todo item by id.
 */
export function removeTodoFromTask(cline: Task, id: string): boolean {
	if (!cline.todoList) return false
	const idx = cline.todoList.findIndex((t) => t.id === id)
	if (idx === -1) return false
	cline.todoList.splice(idx, 1)
	return true
}

/**
 * Get a copy of the todoList.
 */
export function getTodoListForTask(cline: Task): TodoItem[] | undefined {
	return cline.todoList?.slice()
}

/**
 * Set the todoList for the task.
 */
export async function setTodoListForTask(cline?: Task, todos?: TodoItem[]) {
	if (cline === undefined) return
	cline.todoList = Array.isArray(todos) ? todos : []
}

/**
 * Restore the todoList from argument or from clineMessages.
 */
export function restoreTodoListForTask(cline: Task, todoList?: TodoItem[]) {
	if (todoList) {
		cline.todoList = Array.isArray(todoList) ? todoList : []
		return
	}
	cline.todoList = getLatestTodo(cline.clineMessages)
}
/**
 * Convert TodoItem[] to markdown checklist string.
 * @param todos TodoItem array
 * @returns markdown checklist string
 */
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

export function parseMarkdownChecklist(md: string): TodoItem[] {
	if (typeof md !== "string") return []
	const lines = md
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter(Boolean)
	const todos: TodoItem[] = []
	for (const line of lines) {
		const match = line.match(/^\[\s*([ xX\-~])\s*\]\s+(.+)$/)
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

/**
 * Generate a diff between two todo lists
 * @param oldTodos Previous todo list
 * @param newTodos New todo list
 * @returns TodoDiff object containing added, removed, and modified items
 */
function generateTodoDiff(oldTodos: TodoItem[], newTodos: TodoItem[]): TodoDiff {
	const diff: TodoDiff = {
		added: [],
		removed: [],
		modified: [],
	}

	// Create maps to track which items have been matched
	const oldMatched = new Set<number>()
	const newMatched = new Set<number>()

	// First pass: Find exact content matches (may have status changes)
	for (let i = 0; i < oldTodos.length; i++) {
		if (oldMatched.has(i)) continue
		const oldItem = oldTodos[i]

		for (let j = 0; j < newTodos.length; j++) {
			if (newMatched.has(j)) continue
			const newItem = newTodos[j]

			if (oldItem.content === newItem.content) {
				oldMatched.add(i)
				newMatched.add(j)

				// Check if status changed
				if (oldItem.status !== newItem.status) {
					diff.modified.push({ old: oldItem, new: newItem })
				}
				// If status is same, it's unchanged (not added to diff)
				break
			}
		}
	}

	// Second pass: Find similar content (modifications)
	for (let i = 0; i < oldTodos.length; i++) {
		if (oldMatched.has(i)) continue
		const oldItem = oldTodos[i]

		// Look for similar items at the same position first
		if (i < newTodos.length && !newMatched.has(i)) {
			const newItem = newTodos[i]
			const similarity = calculateSimilarity(oldItem.content, newItem.content)

			// If items are at same position and somewhat similar, consider them modified
			if (similarity > 0.3) {
				oldMatched.add(i)
				newMatched.add(i)
				diff.modified.push({ old: oldItem, new: newItem })
			}
		}
	}

	// Third pass: Mark remaining items as removed/added
	for (let i = 0; i < oldTodos.length; i++) {
		if (!oldMatched.has(i)) {
			diff.removed.push(oldTodos[i])
		}
	}

	for (let j = 0; j < newTodos.length; j++) {
		if (!newMatched.has(j)) {
			diff.added.push(newTodos[j])
		}
	}

	return diff
}

/**
 * Calculate similarity between two strings (0 to 1)
 */
function calculateSimilarity(str1: string, str2: string): number {
	if (str1 === str2) return 1.0
	if (str1.length === 0 || str2.length === 0) return 0.0

	// Simple character-based similarity
	const longer = str1.length > str2.length ? str1 : str2
	const shorter = str1.length > str2.length ? str2 : str1

	let matches = 0
	for (let i = 0; i < shorter.length; i++) {
		if (shorter[i] === longer[i]) {
			matches++
		}
	}

	return matches / longer.length
}

/**
 * Format todo diff as a concise string
 * @param diff TodoDiff object
 * @returns Formatted diff string
 */
function formatTodoDiff(diff: TodoDiff): string {
	const lines: string[] = []

	if (diff.added.length > 0) {
		lines.push("Added:")
		for (const item of diff.added) {
			const status = item.status === "completed" ? "[x]" : item.status === "in_progress" ? "[-]" : "[ ]"
			lines.push(`  + ${status} ${item.content}`)
		}
	}

	if (diff.removed.length > 0) {
		if (lines.length > 0) lines.push("")
		lines.push("Removed:")
		for (const item of diff.removed) {
			const status = item.status === "completed" ? "[x]" : item.status === "in_progress" ? "[-]" : "[ ]"
			lines.push(`  - ${status} ${item.content}`)
		}
	}

	if (diff.modified.length > 0) {
		if (lines.length > 0) lines.push("")
		lines.push("Modified:")
		for (const { old, new: newItem } of diff.modified) {
			if (old.content !== newItem.content) {
				lines.push(`  ~ "${old.content}" → "${newItem.content}"`)
			}
			if (old.status !== newItem.status) {
				const oldStatus =
					old.status === "completed" ? "completed" : old.status === "in_progress" ? "in_progress" : "pending"
				const newStatus =
					newItem.status === "completed"
						? "completed"
						: newItem.status === "in_progress"
							? "in_progress"
							: "pending"
				lines.push(`  ~ Status: ${oldStatus} → ${newStatus}`)
			}
		}
	}

	return lines.length > 0 ? lines.join("\n") : "No changes"
}

/**
 * Update the todo list for a task.
 * @param cline Task instance
 * @param block ToolUse block
 * @param askApproval AskApproval function
 * @param handleError HandleError function
 * @param pushToolResult PushToolResult function
 * @param removeClosingTag RemoveClosingTag function
 * @param userEdited If true, only show "User Edit Succeeded" and do nothing else
 */
export async function updateTodoListTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
	userEdited?: boolean,
) {
	// If userEdited is true, only show "User Edit Succeeded" and do nothing else
	if (userEdited === true) {
		pushToolResult("User Edit Succeeded")
		return
	}
	try {
		const todosRaw = block.params.todos

		let todos: TodoItem[]
		try {
			todos = parseMarkdownChecklist(todosRaw || "")
		} catch {
			cline.consecutiveMistakeCount++
			cline.recordToolError("update_todo_list")
			pushToolResult(formatResponse.toolError("The todos parameter is not valid markdown checklist or JSON"))
			return
		}

		const { valid, error } = validateTodos(todos)
		if (!valid && !block.partial) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("update_todo_list")
			pushToolResult(formatResponse.toolError(error || "todos parameter validation failed"))
			return
		}

		let normalizedTodos: TodoItem[] = todos.map((t) => ({
			id: t.id,
			content: t.content,
			status: normalizeStatus(t.status),
		}))

		// Get the previous todo list for diff generation
		const previousTodos = cline.todoList || []
		const diff = generateTodoDiff(previousTodos, normalizedTodos)
		const diffText = formatTodoDiff(diff)

		const approvalMsg = JSON.stringify({
			tool: "updateTodoList",
			todos: normalizedTodos,
			diffText: diffText,
		})
		if (block.partial) {
			await cline.ask("tool", approvalMsg, block.partial).catch(() => {})
			return
		}
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
			cline.say(
				"user_edit_todos",
				JSON.stringify({
					tool: "updateTodoList",
					todos: normalizedTodos,
					diffText: diffText,
				}),
			)
		}

		await setTodoListForTask(cline, normalizedTodos)

		// Regenerate diff if todos were changed by user
		const finalDiff = isTodoListChanged ? generateTodoDiff(previousTodos, normalizedTodos) : diff
		const finalDiffText = isTodoListChanged ? formatTodoDiff(finalDiff) : diffText

		// If todo list changed, output the diff
		if (isTodoListChanged) {
			pushToolResult(formatResponse.toolResult("User edited todo list:\n\n" + finalDiffText))
		} else if (finalDiffText !== "No changes") {
			pushToolResult(formatResponse.toolResult("Todo list updated:\n\n" + finalDiffText))
		} else {
			pushToolResult(formatResponse.toolResult("Todo list updated (no changes)."))
		}
	} catch (error) {
		await handleError("update todo list", error)
	}
}
