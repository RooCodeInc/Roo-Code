import { ClineMessage, TodoItem } from "@roo-code/types"

export function getLatestTodo(clineMessages: ClineMessage[]): TodoItem[] {
	if (!Array.isArray(clineMessages) || clineMessages.length === 0) {
		console.log("[TODO-DEBUG]", "getLatestTodo called with empty clineMessages")
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

	console.log("[TODO-DEBUG]", "getLatestTodo scanned messages", {
		totalMessages: clineMessages.length,
		candidateMessages: candidateMessages.length,
		matchedUpdateTodoListCount,
		parseFailureCount,
		returnedTodosCount: Array.isArray(lastTodos) ? lastTodos.length : 0,
		// Only log lightweight metadata for the last few candidates (avoid dumping full message content)
		lastCandidates: candidateMessages.slice(-5).map((m) => ({
			ts: m.ts,
			type: m.type,
			ask: (m as any).ask,
			say: (m as any).say,
			textLength: typeof m.text === "string" ? m.text.length : 0,
		})),
	})

	return Array.isArray(lastTodos) ? lastTodos : []
}
