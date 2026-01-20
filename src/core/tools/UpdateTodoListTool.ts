import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { ToolUse } from "../../shared/tools"
import crypto from "crypto"
import fs from "fs"
import os from "os"
import path from "path"
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
		console.log("[TODO-DEBUG] execute() STEP 0: ENTERED", {
			tool: "update_todo_list",
			paramsTodosType: typeof params?.todos,
			paramsTodosLength: typeof params?.todos === "string" ? params.todos.length : undefined,
		})
		const { pushToolResult, handleError, askApproval, toolProtocol } = callbacks

		try {
			const summarizeTodoForDebug = (t: TodoItem | undefined) => {
				if (!t) return undefined
				return {
					id: typeof t.id === "string" ? t.id : undefined,
					status: typeof t.status === "string" ? t.status : undefined,
					content: typeof t.content === "string" ? t.content.slice(0, 120) : undefined,
					subtaskId: typeof t.subtaskId === "string" ? t.subtaskId : undefined,
					tokens: typeof t.tokens === "number" ? t.tokens : undefined,
					cost: typeof t.cost === "number" ? t.cost : undefined,
					added: typeof t.added === "number" ? t.added : undefined,
					removed: typeof t.removed === "number" ? t.removed : undefined,
				}
			}

			const shouldTodoDebugLog =
				process.env.ROO_DEBUG_TODO_METADATA === "1" ||
				process.env.ROO_DEBUG_TODO_METADATA === "true" ||
				process.env.ROO_CLI_DEBUG_LOG === "1"
			console.log("[TODO-DEBUG] execute() STEP 1: computed debug flags", {
				shouldTodoDebugLog,
				ROO_DEBUG_TODO_METADATA: process.env.ROO_DEBUG_TODO_METADATA,
				ROO_CLI_DEBUG_LOG: process.env.ROO_CLI_DEBUG_LOG,
				toolProtocol,
			})

			const previousFromMemory = getTodoListForTask(task)
			console.log("[TODO-DEBUG] execute() STEP 2: previous todos from memory", {
				previousFromMemoryCount: Array.isArray(previousFromMemory) ? previousFromMemory.length : 0,
				previousFromMemoryPreview: Array.isArray(previousFromMemory)
					? previousFromMemory.slice(0, 10).map((t) => summarizeTodoForDebug(t))
					: undefined,
			})

			const previousFromHistory = getLatestTodo(task.clineMessages) as unknown as TodoItem[] | undefined
			console.log("[TODO-DEBUG] execute() STEP 3: previous todos from history", {
				previousFromHistoryCount: Array.isArray(previousFromHistory) ? previousFromHistory.length : 0,
				previousFromHistoryPreview: Array.isArray(previousFromHistory)
					? previousFromHistory.slice(0, 10).map((t) => summarizeTodoForDebug(t))
					: undefined,
			})

			const historyHasMetadata =
				Array.isArray(previousFromHistory) &&
				previousFromHistory.some(
					(t) =>
						t?.subtaskId !== undefined ||
						t?.tokens !== undefined ||
						t?.cost !== undefined ||
						t?.added !== undefined ||
						t?.removed !== undefined,
				)
			console.log("[TODO-DEBUG] execute() STEP 4: analyzed history metadata", {
				historyHasMetadata,
				historyHasSubtaskId: Array.isArray(previousFromHistory)
					? previousFromHistory.some((t) => typeof t?.subtaskId === "string")
					: false,
				historyHasTokens: Array.isArray(previousFromHistory)
					? previousFromHistory.some((t) => typeof t?.tokens === "number")
					: false,
				historyHasCost: Array.isArray(previousFromHistory)
					? previousFromHistory.some((t) => typeof t?.cost === "number")
					: false,
				historyHasLineChanges: Array.isArray(previousFromHistory)
					? previousFromHistory.some((t) => typeof t?.added === "number" || typeof t?.removed === "number")
					: false,
			})

			const previousTodos: TodoItem[] =
				(previousFromMemory?.length ?? 0) === 0
					? (previousFromHistory ?? [])
					: (previousFromHistory?.length ?? 0) === 0
						? (previousFromMemory ?? [])
						: historyHasMetadata
							? (previousFromHistory ?? [])
							: (previousFromMemory ?? [])
			console.log("[TODO-DEBUG] execute() STEP 5: selected previousTodos", {
				selectedPreviousTodosCount: Array.isArray(previousTodos) ? previousTodos.length : 0,
				selectedPreviousTodosWithSubtaskIdCount: Array.isArray(previousTodos)
					? previousTodos.filter((t) => typeof t?.subtaskId === "string").length
					: 0,
				selectedPreviousTodosPreview: Array.isArray(previousTodos)
					? previousTodos.slice(0, 10).map((t) => summarizeTodoForDebug(t))
					: undefined,
			})

			const todosRaw = params.todos
			if (shouldTodoDebugLog) {
				console.log("[TODO-DEBUG]", "UpdateTodoListTool.execute() received params.todos", {
					tool: "update_todo_list",
					todosRawType: typeof todosRaw,
					todosRawLength: typeof todosRaw === "string" ? todosRaw.length : undefined,
					todosRawPreview: typeof todosRaw === "string" ? todosRaw.slice(0, 500) : undefined,
				})
				console.log("[TODO-DEBUG]", "UpdateTodoListTool.execute() previousTodos summary", {
					previousFromMemoryCount: Array.isArray(previousFromMemory) ? previousFromMemory.length : 0,
					previousFromHistoryCount: Array.isArray(previousFromHistory) ? previousFromHistory.length : 0,
					historyHasMetadata,
					selectedPreviousTodosCount: Array.isArray(previousTodos) ? previousTodos.length : 0,
					previousTodosWithSubtaskIdCount: Array.isArray(previousTodos)
						? previousTodos.filter((t) => typeof t?.subtaskId === "string").length
						: 0,
				})
			}

			let todos: TodoItem[]
			const jsonParseResult = tryParseTodoItemsJson(todosRaw)
			if (jsonParseResult.parsed) {
				todos = jsonParseResult.parsed
				console.log("[TODO-DEBUG] execute() STEP 6: parsed todos via JSON", {
					parsedCount: todos.length,
					parsedPreview: todos.slice(0, 10).map((t) => summarizeTodoForDebug(t)),
				})
				if (shouldTodoDebugLog) {
					console.log("[TODO-DEBUG]", "UpdateTodoListTool.execute() parsed todos from JSON", {
						parsedCount: todos.length,
						hasAnySubtaskId: todos.some((t) => typeof t?.subtaskId === "string"),
						subtaskIds: todos.map((t) => t?.subtaskId).filter(Boolean),
					})
				}
			} else if (jsonParseResult.error) {
				console.log("[TODO-DEBUG] execute() STEP 6: JSON parse/validate error", {
					error: jsonParseResult.error,
					todosRawPreview: typeof todosRaw === "string" ? todosRaw.slice(0, 500) : undefined,
				})
				task.consecutiveMistakeCount++
				task.recordToolError("update_todo_list")
				task.didToolFailInCurrentTurn = true
				pushToolResult(formatResponse.toolError(jsonParseResult.error))
				return
			} else {
				// Backward compatible: fall back to markdown checklist parsing when JSON parsing is not applicable.
				todos = parseMarkdownChecklist(todosRaw || "")
				console.log("[TODO-DEBUG] execute() STEP 6: parsed todos via markdown checklist", {
					parsedCount: todos.length,
					parsedPreview: todos.slice(0, 10).map((t) => summarizeTodoForDebug(t)),
				})
				if (shouldTodoDebugLog) {
					console.log("[TODO-DEBUG]", "UpdateTodoListTool.execute() parsed todos from markdown checklist", {
						parsedCount: todos.length,
						hasAnySubtaskId: todos.some((t) => typeof t?.subtaskId === "string"),
					})
				}
			}

			// Preserve metadata (subtaskId/tokens/cost) for todos whose content matches an existing todo.
			// Matching is by exact content string; duplicates are matched in order.
			// NOTE: Instrumentation is enabled here (once per tool execute) to detect metadata-preservation failures.
			console.log("[TODO-DEBUG] execute() STEP 7: about to call preserveTodoMetadata", {
				nextTodosCount: Array.isArray(todos) ? todos.length : 0,
				previousTodosCount: Array.isArray(previousTodos) ? previousTodos.length : 0,
				enableInstrumentation: true,
			})
			const todosWithPreservedMetadata = preserveTodoMetadata(todos, previousTodos, {
				enableInstrumentation: true,
			})
			console.log("[TODO-DEBUG] execute() STEP 8: returned from preserveTodoMetadata", {
				resultCount: todosWithPreservedMetadata.length,
				resultPreview: todosWithPreservedMetadata.slice(0, 10).map((t) => summarizeTodoForDebug(t)),
			})
			if (shouldTodoDebugLog) {
				console.log("[TODO-DEBUG]", "UpdateTodoListTool.execute() after preserveTodoMetadata()", {
					nextTodosCount: todosWithPreservedMetadata.length,
					todosWithSubtaskIdCount: todosWithPreservedMetadata.filter((t) => typeof t?.subtaskId === "string")
						.length,
					subtaskIds: todosWithPreservedMetadata.map((t) => t?.subtaskId).filter(Boolean),
					hasAnyTokens: todosWithPreservedMetadata.some((t) => typeof t?.tokens === "number"),
					hasAnyCost: todosWithPreservedMetadata.some((t) => typeof t?.cost === "number"),
					hasAnyLineChanges: todosWithPreservedMetadata.some(
						(t) => typeof t?.added === "number" || typeof t?.removed === "number",
					),
				})
			}

			const { valid, error } = validateTodos(todosWithPreservedMetadata)
			console.log("[TODO-DEBUG] execute() STEP 9: validateTodos", {
				valid,
				error,
			})
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
				added: t.added,
				removed: t.removed,
			}))
			console.log("[TODO-DEBUG] execute() STEP 10: normalizedTodos (pre-approval)", {
				normalizedCount: normalizedTodos.length,
				normalizedPreview: normalizedTodos.slice(0, 10).map((t) => summarizeTodoForDebug(t)),
			})
			if (shouldTodoDebugLog) {
				console.log("[TODO-DEBUG]", "UpdateTodoListTool.execute() normalizedTodos (pre-approval)", {
					normalizedCount: normalizedTodos.length,
					todosWithSubtaskIdCount: normalizedTodos.filter((t) => typeof t?.subtaskId === "string").length,
					subtaskIds: normalizedTodos.map((t) => t?.subtaskId).filter(Boolean),
				})
			}

			const approvalMsg = JSON.stringify({
				tool: "updateTodoList",
				todos: normalizedTodos,
			})

			// TodoItem is a flat object shape; a shallow copy is sufficient here.
			approvedTodoList = normalizedTodos.map((t) => ({ ...t }))
			console.log("[TODO-DEBUG] execute() STEP 11: asking approval", {
				approvalPayloadLength: approvalMsg.length,
				normalizedCount: normalizedTodos.length,
			})
			const didApprove = await askApproval("tool", approvalMsg)
			console.log("[TODO-DEBUG] execute() STEP 12: approval result", {
				didApprove,
			})
			if (!didApprove) {
				console.log("[TODO-DEBUG] execute() STEP 13: user declined; returning", {})
				pushToolResult("User declined to update the todoList.")
				return
			}

			const isTodoListChanged =
				approvedTodoList !== undefined && JSON.stringify(normalizedTodos) !== JSON.stringify(approvedTodoList)
			console.log("[TODO-DEBUG] execute() STEP 14: checked approval UI edits", {
				isTodoListChanged,
			})
			if (isTodoListChanged) {
				normalizedTodos = approvedTodoList ?? []
				console.log("[TODO-DEBUG] execute() STEP 15: using user-edited todos", {
					editedCount: normalizedTodos.length,
					editedPreview: normalizedTodos.slice(0, 10).map((t) => summarizeTodoForDebug(t)),
				})
				if (shouldTodoDebugLog) {
					console.log("[TODO-DEBUG]", "UpdateTodoListTool.execute() user edited todos in approval UI", {
						editedCount: normalizedTodos.length,
						todosWithSubtaskIdCount: normalizedTodos.filter((t) => typeof t?.subtaskId === "string").length,
						subtaskIds: normalizedTodos.map((t) => t?.subtaskId).filter(Boolean),
					})
				}

				// If the user-edited todo list dropped metadata fields, re-apply metadata preservation against
				// the previous list (and keep any explicitly provided metadata in the edited list).
				// NOTE: Do not instrument here to avoid double-logging within the same update.
				console.log("[TODO-DEBUG] execute() STEP 16: about to re-call preserveTodoMetadata (user-edited)", {
					enableInstrumentation: false,
				})
				normalizedTodos = preserveTodoMetadata(normalizedTodos, previousTodos, { enableInstrumentation: false })
				console.log("[TODO-DEBUG] execute() STEP 17: returned from re-preserve (user-edited)", {
					normalizedCount: normalizedTodos.length,
					normalizedPreview: normalizedTodos.slice(0, 10).map((t) => summarizeTodoForDebug(t)),
				})
				if (shouldTodoDebugLog) {
					console.log("[TODO-DEBUG]", "UpdateTodoListTool.execute() normalizedTodos after re-preserve", {
						normalizedCount: normalizedTodos.length,
						todosWithSubtaskIdCount: normalizedTodos.filter((t) => typeof t?.subtaskId === "string").length,
						subtaskIds: normalizedTodos.map((t) => t?.subtaskId).filter(Boolean),
					})
				}

				task.say(
					"user_edit_todos",
					JSON.stringify({
						tool: "updateTodoList",
						todos: normalizedTodos,
					}),
				)
			}

			console.log("[TODO-DEBUG] execute() STEP 18: setting todoList on task", {
				finalTodosCount: normalizedTodos.length,
			})
			await setTodoListForTask(task, normalizedTodos)
			console.log("[TODO-DEBUG] execute() STEP 19: setTodoListForTask completed", {
				taskTodoListCount: Array.isArray(task?.todoList) ? task.todoList.length : undefined,
			})

			if (isTodoListChanged) {
				const md = todoListToMarkdown(normalizedTodos)
				console.log("[TODO-DEBUG] execute() STEP 20: returning tool result (user edits)", {
					mdLength: md.length,
				})
				pushToolResult(formatResponse.toolResult("User edits todo:\n\n" + md))
			} else {
				console.log("[TODO-DEBUG] execute() STEP 20: returning tool result (no user edits)", {})
				pushToolResult(formatResponse.toolResult("Todo list updated successfully."))
			}
		} catch (error) {
			console.log("[TODO-DEBUG] execute() STEP 99: caught error", {
				error:
					error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
			})
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

		// Avoid log spam: partial updates can stream frequently.
		todos = preserveTodoMetadata(todos, previousTodos, { enableInstrumentation: false })

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
 * Preserve metadata (subtaskId, tokens, cost, added, removed) from previous todos onto next todos.
 *
 * Matching strategy (in priority order):
 * 1. **Subtask ID match**: If the next todo has a `subtaskId`, match against previous todos with
 *    the same `subtaskId`. This is the most stable identifier when content (and derived IDs)
 *    changes.
 * 2. **ID match**: If both todos have an `id` field and they match exactly, preserve metadata.
 *    This handles the common case where ID is stable across updates.
 * 3. **Content match with position awareness**: For todos without matching subtask IDs or IDs,
 *    fall back to content-based matching. Duplicates are matched in order (first unmatched
 *    previous with same content gets matched to first unmatched next with same content).
 *
 * This approach ensures metadata survives status/content changes (which can alter the derived ID)
 * and handles duplicates deterministically.
 */
function preserveTodoMetadata(
	nextTodos: TodoItem[],
	previousTodos: TodoItem[],
	options?: { enableInstrumentation?: boolean },
): TodoItem[] {
	console.log("[TODO-DEBUG] preserveTodoMetadata() STEP 0: ENTERED", {
		nextTodosCount: Array.isArray(nextTodos) ? nextTodos.length : 0,
		previousTodosCount: Array.isArray(previousTodos) ? previousTodos.length : 0,
		enableInstrumentationOption: options?.enableInstrumentation ?? false,
		ROO_DEBUG_TODO_METADATA: process.env.ROO_DEBUG_TODO_METADATA,
		ROO_CLI_DEBUG_LOG: process.env.ROO_CLI_DEBUG_LOG,
	})

	const shouldTodoDebugLogToConsole =
		process.env.ROO_DEBUG_TODO_METADATA === "1" ||
		process.env.ROO_DEBUG_TODO_METADATA === "true" ||
		process.env.ROO_CLI_DEBUG_LOG === "1"

	const safePrevious = previousTodos ?? []
	const safeNext = nextTodos ?? []

	const summarizeTodoForDebug = (t: TodoItem | undefined) => {
		if (!t) return undefined
		return {
			id: typeof t.id === "string" ? t.id : undefined,
			status: typeof t.status === "string" ? t.status : undefined,
			content: typeof t.content === "string" ? t.content.substring(0, 50) : undefined,
			subtaskId: typeof t.subtaskId === "string" ? t.subtaskId : undefined,
			tokens: typeof t.tokens === "number" ? t.tokens : undefined,
			cost: typeof t.cost === "number" ? t.cost : undefined,
			added: typeof t.added === "number" ? t.added : undefined,
			removed: typeof t.removed === "number" ? t.removed : undefined,
		}
	}

	if (shouldTodoDebugLogToConsole) {
		console.log("[TODO-DEBUG] preserveTodoMetadata INPUT", {
			previousTodosCount: safePrevious.length,
			previousTodos: safePrevious.map((t) => summarizeTodoForDebug(t)),
			newTodosCount: safeNext.length,
			newTodos: safeNext.map((t) => summarizeTodoForDebug(t)),
		})
	}

	// Instrumentation must never write to stdout/stderr (CLI TUI) and should be opt-in.
	// Gate it behind an env var so we don't write files during normal operation.
	const enableInstrumentation =
		(options?.enableInstrumentation ?? false) &&
		(process.env.ROO_CLI_DEBUG_LOG === "1" || process.env.ROO_DEBUG_TODO_METADATA === "1")

	// Track which previous todos have been used (by their index) to avoid double-matching
	const usedPreviousIndices = new Set<number>()

	// Build lookup maps for matching strategies.
	// - Subtask ID: may have duplicates; match in order for determinism.
	// - ID: should be unique; store first occurrence.
	// - Content: may have duplicates; match in order for determinism.
	const previousBySubtaskId = new Map<string, Array<{ todo: TodoItem; index: number }>>()
	const previousById = new Map<string, { todo: TodoItem; index: number }>()
	const previousByContent = new Map<string, Array<{ todo: TodoItem; index: number }>>()

	const previousMetadataIndices = new Set<number>()
	for (let i = 0; i < safePrevious.length; i++) {
		const prev = safePrevious[i]
		if (!prev) continue

		const hasMetadata =
			prev.subtaskId !== undefined ||
			prev.tokens !== undefined ||
			prev.cost !== undefined ||
			prev.added !== undefined ||
			prev.removed !== undefined
		if (hasMetadata) {
			previousMetadataIndices.add(i)
		}

		if (typeof prev.subtaskId === "string") {
			const list = previousBySubtaskId.get(prev.subtaskId)
			if (list) list.push({ todo: prev, index: i })
			else previousBySubtaskId.set(prev.subtaskId, [{ todo: prev, index: i }])
		}

		if (typeof prev.id === "string" && !previousById.has(prev.id)) {
			previousById.set(prev.id, { todo: prev, index: i })
		}

		if (typeof prev.content === "string") {
			const normalizedContent = normalizeTodoContentForId(prev.content)
			const list = previousByContent.get(normalizedContent)
			if (list) list.push({ todo: prev, index: i })
			else previousByContent.set(normalizedContent, [{ todo: prev, index: i }])
		}
	}

	// IMPORTANT: use an explicit fill here (vs a sparse array) so checks like
	// [`Array.prototype.some()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/some)
	// properly visit every index. This is required for the rename-only index-carryover fallback.
	const matchedPreviousIndexByNextIndex: Array<number | undefined> = new Array(safeNext.length).fill(undefined)
	const result: TodoItem[] = new Array(safeNext.length)

	for (let nextIndex = 0; nextIndex < safeNext.length; nextIndex++) {
		const next = safeNext[nextIndex]
		if (!next) {
			result[nextIndex] = next
			continue
		}

		if (shouldTodoDebugLogToConsole) {
			console.log("[TODO-DEBUG] preserveTodoMetadata ITERATION", {
				nextIndex,
				next: summarizeTodoForDebug(next),
				usedPreviousIndicesCount: usedPreviousIndices.size,
			})
		}

		let matchedPrev: TodoItem | undefined = undefined
		let matchedIndex: number | undefined = undefined
		let matchStrategy: "subtaskId" | "id" | "content" | "none" = "none"

		// Strategy 0: Try subtaskId-based matching first (most stable across content/ID changes)
		if (typeof next.subtaskId === "string") {
			const candidates = previousBySubtaskId.get(next.subtaskId)
			if (candidates) {
				if (shouldTodoDebugLogToConsole) {
					console.log("[TODO-DEBUG] preserveTodoMetadata subtaskId candidates", {
						nextIndex,
						subtaskId: next.subtaskId,
						candidatesCount: candidates.length,
					})
				}
				for (const candidate of candidates) {
					if (shouldTodoDebugLogToConsole) {
						console.log("[TODO-DEBUG] preserveTodoMetadata subtaskId candidate", {
							nextIndex,
							candidateIndex: candidate.index,
							candidate: summarizeTodoForDebug(candidate.todo),
							candidateAlreadyUsed: usedPreviousIndices.has(candidate.index),
						})
					}
					if (!usedPreviousIndices.has(candidate.index)) {
						matchedPrev = candidate.todo
						matchedIndex = candidate.index
						matchStrategy = "subtaskId"
						break
					}
				}
			}
		}

		// Strategy 1: Try ID-based matching first (most reliable)
		if (!matchedPrev && next.id && typeof next.id === "string") {
			const byId = previousById.get(next.id)
			if (byId && !usedPreviousIndices.has(byId.index)) {
				matchedPrev = byId.todo
				matchedIndex = byId.index
				matchStrategy = "id"
			}
		}

		// Strategy 2: Fall back to content-based matching if ID didn't match
		if (!matchedPrev && typeof next.content === "string") {
			const normalizedContent = normalizeTodoContentForId(next.content)
			const candidates = previousByContent.get(normalizedContent)
			if (candidates) {
				if (shouldTodoDebugLogToConsole) {
					console.log("[TODO-DEBUG] preserveTodoMetadata content candidates", {
						nextIndex,
						normalizedContent: normalizedContent.substring(0, 50),
						candidatesCount: candidates.length,
					})
				}
				// Find first unused candidate
				for (const candidate of candidates) {
					if (shouldTodoDebugLogToConsole) {
						console.log("[TODO-DEBUG] preserveTodoMetadata content candidate", {
							nextIndex,
							candidateIndex: candidate.index,
							candidate: summarizeTodoForDebug(candidate.todo),
							candidateAlreadyUsed: usedPreviousIndices.has(candidate.index),
						})
					}
					if (!usedPreviousIndices.has(candidate.index)) {
						matchedPrev = candidate.todo
						matchedIndex = candidate.index
						matchStrategy = "content"
						break
					}
				}
			}
		}

		// Mark as used and apply metadata
		if (matchedPrev && matchedIndex !== undefined) {
			const metadataCopiedFromPrev = {
				subtaskId: next.subtaskId === undefined ? matchedPrev.subtaskId : undefined,
				tokens: next.tokens === undefined ? matchedPrev.tokens : undefined,
				cost: next.cost === undefined ? matchedPrev.cost : undefined,
				added: next.added === undefined ? matchedPrev.added : undefined,
				removed: next.removed === undefined ? matchedPrev.removed : undefined,
			}
			if (shouldTodoDebugLogToConsole) {
				console.log("[TODO-DEBUG] preserveTodoMetadata MATCH", {
					nextIndex,
					matchStrategy,
					matchedIndex,
					matchedPrev: summarizeTodoForDebug(matchedPrev),
					metadataCopiedFromPrev,
				})
			}

			usedPreviousIndices.add(matchedIndex)
			matchedPreviousIndexByNextIndex[nextIndex] = matchedIndex
			result[nextIndex] = {
				...next,
				subtaskId: next.subtaskId ?? matchedPrev.subtaskId,
				tokens: next.tokens ?? matchedPrev.tokens,
				cost: next.cost ?? matchedPrev.cost,
				added: next.added ?? matchedPrev.added,
				removed: next.removed ?? matchedPrev.removed,
			}
			continue
		}

		if (shouldTodoDebugLogToConsole) {
			console.log("[TODO-DEBUG] preserveTodoMetadata NO_MATCH", {
				nextIndex,
				next: summarizeTodoForDebug(next),
			})
		}

		result[nextIndex] = next
	}

	// Short-term patch: deterministic “rename-only by index” metadata carryover.
	//
	// Applies only when:
	// - lengths are identical
	// - status sequence matches index-for-index
	// - at least one row could not be matched by subtaskId/id/content
	//
	// For unmatched rows, carry over metadata fields by index.
	const hasUnmatchedRows = matchedPreviousIndexByNextIndex.some((idx) => idx === undefined)
	const canApplyIndexRenameCarryover =
		hasUnmatchedRows &&
		safePrevious.length === safeNext.length &&
		todoStatusSequenceMatchesByIndex(safePrevious, safeNext)

	if (canApplyIndexRenameCarryover) {
		let indexCarryoverCount = 0
		for (let i = 0; i < safeNext.length; i++) {
			if (matchedPreviousIndexByNextIndex[i] !== undefined) continue // already matched by stable strategy
			if (usedPreviousIndices.has(i)) continue // avoid double-using a previous row
			const prev = safePrevious[i]
			const next = result[i]
			if (!prev || !next) continue

			if (shouldTodoDebugLogToConsole) {
				console.log("[TODO-DEBUG] preserveTodoMetadata INDEX_CARRYOVER", {
					nextIndex: i,
					previousIndex: i,
					prev: summarizeTodoForDebug(prev),
					next: summarizeTodoForDebug(next),
					metadataCopiedFromPrev: {
						subtaskId: next.subtaskId === undefined ? prev.subtaskId : undefined,
						tokens: next.tokens === undefined ? prev.tokens : undefined,
						cost: next.cost === undefined ? prev.cost : undefined,
						added: next.added === undefined ? prev.added : undefined,
						removed: next.removed === undefined ? prev.removed : undefined,
					},
				})
			}

			result[i] = {
				...next,
				subtaskId: next.subtaskId ?? prev.subtaskId,
				tokens: next.tokens ?? prev.tokens,
				cost: next.cost ?? prev.cost,
				added: next.added ?? prev.added,
				removed: next.removed ?? prev.removed,
			}
			usedPreviousIndices.add(i)
			indexCarryoverCount++
		}

		if (enableInstrumentation && indexCarryoverCount > 0) {
			appendRooCliDebugLog("[Roo-Debug] preserveTodoMetadata: applied index-based rename carryover", {
				indexCarryoverCount,
				previousTodosCount: safePrevious.length,
				nextTodosCount: safeNext.length,
			})
		}
	}

	// Fallback: carry forward metadata from unmatched delegated todos
	// to new todos that don't have a subtaskId yet.
	//
	// This addresses the case where delegation replaces the original todo content with a synthetic
	// placeholder (e.g. "Delegated to subtask") and an ID like "synthetic-{subtaskId}", but the LLM
	// later rewrites the todo content entirely. In that scenario, subtaskId/id/content matching can all
	// fail, causing the delegated metadata to be lost.
	const unmatchedPreviousDelegatedTodos = safePrevious
		.map((prev, index) => ({ prev, index }))
		.filter(({ prev, index }) => typeof prev?.subtaskId === "string" && !usedPreviousIndices.has(index))

	const nextTodoIndicesWithoutSubtaskId = result
		.map((todo, index) => ({ todo, index }))
		.filter(({ todo }) => todo !== undefined && todo.subtaskId === undefined)
		.map(({ index }) => index)

	for (let i = 0; i < unmatchedPreviousDelegatedTodos.length && i < nextTodoIndicesWithoutSubtaskId.length; i++) {
		const { prev: orphanedPrev, index: orphanedPrevIndex } = unmatchedPreviousDelegatedTodos[i]
		const targetNextIndex = nextTodoIndicesWithoutSubtaskId[i]
		const targetNext = result[targetNextIndex]
		if (!orphanedPrev || !targetNext) continue

		const updatedTarget: TodoItem = {
			...targetNext,
			subtaskId: targetNext.subtaskId ?? orphanedPrev.subtaskId,
			tokens: targetNext.tokens ?? orphanedPrev.tokens,
			cost: targetNext.cost ?? orphanedPrev.cost,
			added: targetNext.added ?? orphanedPrev.added,
			removed: targetNext.removed ?? orphanedPrev.removed,
		}

		result[targetNextIndex] = updatedTarget
		usedPreviousIndices.add(orphanedPrevIndex)
		matchedPreviousIndexByNextIndex[targetNextIndex] = orphanedPrevIndex

		if (shouldTodoDebugLogToConsole) {
			console.log("[TODO-DEBUG] preserveTodoMetadata ORPHAN_CARRYOVER", {
				orphanedContent: orphanedPrev.content?.substring(0, 40),
				orphanedSubtaskId: orphanedPrev.subtaskId,
				targetContent: updatedTarget.content?.substring(0, 40),
				copiedFields: {
					subtaskId: updatedTarget.subtaskId,
					tokens: updatedTarget.tokens,
					cost: updatedTarget.cost,
				},
			})
		}
	}

	// Lightweight debug instrumentation: detect when previous rows that had metadata could not be
	// matched to any next todo row (and therefore their metadata could not be preserved).
	//
	// Keep payload minimal to avoid logging user content.
	if (enableInstrumentation && previousMetadataIndices.size > 0) {
		let lostMetadataRowCount = 0
		for (const prevIndex of previousMetadataIndices) {
			if (!usedPreviousIndices.has(prevIndex)) {
				lostMetadataRowCount++
			}
		}

		if (lostMetadataRowCount > 0) {
			if (shouldTodoDebugLogToConsole) {
				console.log("[TODO-DEBUG] preserveTodoMetadata LOST_METADATA", {
					lostMetadataRowCount,
					previousMetadataRowCount: previousMetadataIndices.size,
					previousTodosCount: safePrevious.length,
					nextTodosCount: safeNext.length,
				})
			}
			// IMPORTANT: do not use console.log here in the CLI TUI. It can corrupt rendering (e.g. dropdowns).
			appendRooCliDebugLog("[Roo-Debug] preserveTodoMetadata: previous todo(s) with metadata were not matched", {
				lostMetadataRowCount,
				previousMetadataRowCount: previousMetadataIndices.size,
				previousTodosCount: safePrevious.length,
				nextTodosCount: safeNext.length,
			})
		}
	}

	if (shouldTodoDebugLogToConsole) {
		console.log("[TODO-DEBUG] preserveTodoMetadata OUTPUT", {
			resultCount: result.length,
			resultTodos: result.map((t) => summarizeTodoForDebug(t)),
		})
	}

	return result
}

function todoStatusSequenceMatchesByIndex(previous: TodoItem[], next: TodoItem[]): boolean {
	const safePrevious = previous ?? []
	const safeNext = next ?? []
	if (safePrevious.length !== safeNext.length) return false
	for (let i = 0; i < safeNext.length; i++) {
		const prevStatus = normalizeStatus(safePrevious[i]?.status)
		const nextStatus = normalizeStatus(safeNext[i]?.status)
		if (prevStatus !== nextStatus) return false
	}
	return true
}

const ROO_CLI_DEBUG_LOG_PATH = path.join(os.tmpdir(), "roo-cli-debug.log")

function appendRooCliDebugLog(message: string, data?: unknown) {
	try {
		const timestamp = new Date().toISOString()
		const entry = data ? `[${timestamp}] ${message}: ${JSON.stringify(data)}\n` : `[${timestamp}] ${message}\n`
		fs.appendFileSync(ROO_CLI_DEBUG_LOG_PATH, entry)
	} catch {
		// Swallow errors: logging must never break tool execution.
	}
}

export function parseMarkdownChecklist(md: string): TodoItem[] {
	if (typeof md !== "string") return []
	const lines = md
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter(Boolean)

	// Tracks occurrences of the same normalized todo content so duplicate rows get
	// deterministic, stable IDs.
	const occurrenceByNormalizedContent = new Map<string, number>()

	const todos: TodoItem[] = []
	for (const line of lines) {
		const match = line.match(/^(?:-\s*)?\[\s*([ xX\-~])\s*\]\s+(.+)$/)
		if (!match) continue
		let status: TodoStatus = "pending"
		if (match[1] === "x" || match[1] === "X") status = "completed"
		else if (match[1] === "-" || match[1] === "~") status = "in_progress"

		const content = match[2]
		const normalizedContent = normalizeTodoContentForId(content)
		const occurrence = (occurrenceByNormalizedContent.get(normalizedContent) ?? 0) + 1
		occurrenceByNormalizedContent.set(normalizedContent, occurrence)

		// ID must be stable across status changes.
		// For duplicates (same normalized content), include occurrence index.
		const id = crypto.createHash("md5").update(`${normalizedContent}#${occurrence}`).digest("hex")
		todos.push({
			id,
			content,
			status,
		})
	}
	return todos
}

function tryParseTodoItemsJson(raw: string): { parsed?: TodoItem[]; error?: string } {
	if (typeof raw !== "string") return {}
	const trimmed = raw.trim()
	if (trimmed.length === 0) return {}

	// Fast-path: avoid trying JSON.parse for obvious markdown inputs.
	// JSON arrays/objects must start with '[' or '{'.
	const firstChar = trimmed[0]
	if (firstChar !== "[" && firstChar !== "{") return {}

	let parsed: unknown
	try {
		parsed = JSON.parse(trimmed)
	} catch {
		return {}
	}

	if (!Array.isArray(parsed)) {
		// Only support the new structured format when it is a JSON array of TodoItem-like objects.
		return {}
	}

	const normalized: TodoItem[] = []
	for (const [i, item] of parsed.entries()) {
		if (!item || typeof item !== "object") {
			return { error: `Item ${i + 1} is not an object` }
		}

		const t = item as Record<string, unknown>
		const id = t.id
		const content = t.content

		if (typeof id !== "string" || id.length === 0) return { error: `Item ${i + 1} is missing id` }
		if (typeof content !== "string" || content.length === 0) return { error: `Item ${i + 1} is missing content` }

		const normalizedItem: TodoItem = {
			id,
			content,
			status: normalizeStatus(typeof t.status === "string" ? t.status : undefined),
			...(typeof t.subtaskId === "string" ? { subtaskId: t.subtaskId } : {}),
			...(typeof t.tokens === "number" ? { tokens: t.tokens } : {}),
			...(typeof t.cost === "number" ? { cost: t.cost } : {}),
			...(typeof t.added === "number" ? { added: t.added } : {}),
			...(typeof t.removed === "number" ? { removed: t.removed } : {}),
		}

		normalized.push(normalizedItem)
	}

	const { valid, error } = validateTodos(normalized)
	if (!valid) return { error: error || "todos JSON validation failed" }

	return { parsed: normalized }
}

function normalizeTodoContentForId(content: string): string {
	// Normalize whitespace so trivial formatting changes don't churn IDs.
	return content.trim().replace(/\s+/g, " ")
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
