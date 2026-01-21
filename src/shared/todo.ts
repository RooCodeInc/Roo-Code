import { ClineMessage, TodoItem } from "@roo-code/types"

export function getLatestTodo(clineMessages: ClineMessage[]): TodoItem[] {
	if (!Array.isArray(clineMessages) || clineMessages.length === 0) {
		return []
	}

	const candidateMessages = clineMessages.filter(
		(msg) =>
			(msg.type === "ask" && msg.ask === "tool") ||
			(msg.type === "say" && (msg.say === "user_edit_todos" || msg.say === "system_update_todos")),
	)

	let lastTodos: TodoItem[] | undefined
	let matchedUpdateTodoListCount = 0
	let parseFailureCount = 0

	for (const msg of candidateMessages) {
		let parsed: any
		try {
			parsed = JSON.parse(msg.text ?? "{}")
		} catch {
			parseFailureCount++
			continue
		}

		if (parsed && parsed.tool === "updateTodoList" && Array.isArray(parsed.todos)) {
			matchedUpdateTodoListCount++
			lastTodos = parsed.todos as TodoItem[]
		}
	}

	return Array.isArray(lastTodos) ? lastTodos : []
}
