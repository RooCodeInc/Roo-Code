import type { ClineMessage } from "@roo-code/types"
import { getPreviousTodos } from "../ChatRow"

describe("getPreviousTodos", () => {
	// Helper to create a mock ClineMessage
	const createMessage = (ts: number, overrides: Partial<ClineMessage> = {}): ClineMessage => ({
		ts,
		type: "say",
		text: "",
		...overrides,
	})

	// Helper to create an updateTodoList tool message
	const createTodoMessage = (
		ts: number,
		todos: Array<{ id: string; content: string; status: string }>,
	): ClineMessage => ({
		ts,
		type: "ask",
		ask: "tool",
		text: JSON.stringify({
			tool: "updateTodoList",
			todos,
		}),
	})

	it("returns empty array when no messages exist", () => {
		const result = getPreviousTodos([], 1000)
		expect(result).toEqual([])
	})

	it("returns empty array when no updateTodoList messages exist", () => {
		const messages: ClineMessage[] = [
			createMessage(100, { type: "say", say: "text", text: "Hello" }),
			createMessage(200, { type: "say", say: "text", text: "World" }),
		]

		const result = getPreviousTodos(messages, 300)
		expect(result).toEqual([])
	})

	it("returns todos from the most recent updateTodoList message before currentMessageTs", () => {
		const todos = [
			{ id: "1", content: "Task 1", status: "pending" },
			{ id: "2", content: "Task 2", status: "completed" },
		]

		const messages: ClineMessage[] = [
			createMessage(100, { type: "say", say: "text", text: "Hello" }),
			createTodoMessage(200, todos),
			createMessage(300, { type: "say", say: "text", text: "World" }),
		]

		const result = getPreviousTodos(messages, 400)
		expect(result).toEqual(todos)
	})

	it("ignores updateTodoList messages at or after currentMessageTs", () => {
		const oldTodos = [{ id: "1", content: "Old Task", status: "pending" }]
		const newTodos = [{ id: "2", content: "New Task", status: "pending" }]

		const messages: ClineMessage[] = [
			createTodoMessage(100, oldTodos),
			createTodoMessage(200, newTodos), // This should be ignored (at currentMessageTs)
		]

		const result = getPreviousTodos(messages, 200)
		expect(result).toEqual(oldTodos)
	})

	it("returns the most recent updateTodoList message when multiple exist", () => {
		const firstTodos = [{ id: "1", content: "First", status: "pending" }]
		const secondTodos = [{ id: "2", content: "Second", status: "pending" }]
		const thirdTodos = [{ id: "3", content: "Third", status: "pending" }]

		const messages: ClineMessage[] = [
			createTodoMessage(100, firstTodos),
			createTodoMessage(200, secondTodos),
			createTodoMessage(300, thirdTodos),
		]

		const result = getPreviousTodos(messages, 400)
		// Should return the most recent one (thirdTodos at ts=300)
		expect(result).toEqual(thirdTodos)
	})

	it("preserves the order of todos in the returned array", () => {
		// This is the key test for the bug fix - todos should maintain their original order
		const todos = [
			{ id: "1", content: "First task", status: "pending" },
			{ id: "2", content: "Second task", status: "in-progress" },
			{ id: "3", content: "Third task", status: "completed" },
			{ id: "4", content: "Fourth task", status: "pending" },
		]

		const messages: ClineMessage[] = [
			createMessage(100, { type: "say", say: "text", text: "Start" }),
			createTodoMessage(200, todos),
			createMessage(300, { type: "say", say: "text", text: "End" }),
		]

		const result = getPreviousTodos(messages, 400)

		// Verify the order is preserved exactly as provided
		expect(result).toHaveLength(4)
		expect(result[0].id).toBe("1")
		expect(result[0].content).toBe("First task")
		expect(result[1].id).toBe("2")
		expect(result[1].content).toBe("Second task")
		expect(result[2].id).toBe("3")
		expect(result[2].content).toBe("Third task")
		expect(result[3].id).toBe("4")
		expect(result[3].content).toBe("Fourth task")
	})

	it("handles malformed JSON gracefully and continues searching", () => {
		const validTodos = [{ id: "1", content: "Valid", status: "pending" }]

		const messages: ClineMessage[] = [
			createTodoMessage(100, validTodos),
			createMessage(200, {
				type: "ask",
				ask: "tool",
				text: "invalid json {{{",
			}),
		]

		const result = getPreviousTodos(messages, 300)
		// Should skip the malformed message and find the valid one
		expect(result).toEqual(validTodos)
	})

	it("returns empty array when todos field is missing", () => {
		const messages: ClineMessage[] = [
			createMessage(100, {
				type: "ask",
				ask: "tool",
				text: JSON.stringify({ tool: "updateTodoList" }), // No todos field
			}),
		]

		const result = getPreviousTodos(messages, 200)
		expect(result).toEqual([])
	})

	it("handles empty todos array", () => {
		const messages: ClineMessage[] = [createTodoMessage(100, [])]

		const result = getPreviousTodos(messages, 200)
		expect(result).toEqual([])
	})

	it("ignores non-tool ask messages", () => {
		const todos = [{ id: "1", content: "Task", status: "pending" }]

		const messages: ClineMessage[] = [
			createTodoMessage(100, todos),
			createMessage(200, { type: "ask", ask: "followup", text: "Question?" }),
		]

		const result = getPreviousTodos(messages, 300)
		expect(result).toEqual(todos)
	})

	it("ignores tool messages that are not updateTodoList", () => {
		const todos = [{ id: "1", content: "Task", status: "pending" }]

		const messages: ClineMessage[] = [
			createTodoMessage(100, todos),
			createMessage(200, {
				type: "ask",
				ask: "tool",
				text: JSON.stringify({ tool: "readFile", path: "/some/file" }),
			}),
		]

		const result = getPreviousTodos(messages, 300)
		expect(result).toEqual(todos)
	})

	it("correctly finds previous todos when current message is in the middle of the array", () => {
		const firstTodos = [{ id: "1", content: "First", status: "pending" }]
		const secondTodos = [{ id: "2", content: "Second", status: "pending" }]

		const messages: ClineMessage[] = [
			createTodoMessage(100, firstTodos),
			createMessage(200, { type: "say", say: "text", text: "Middle" }),
			createTodoMessage(300, secondTodos),
			createMessage(400, { type: "say", say: "text", text: "End" }),
		]

		// Looking for todos before ts=250 should return firstTodos
		const result = getPreviousTodos(messages, 250)
		expect(result).toEqual(firstTodos)
	})

	it("handles messages with null or undefined text", () => {
		const todos = [{ id: "1", content: "Task", status: "pending" }]

		const messages: ClineMessage[] = [
			createTodoMessage(100, todos),
			createMessage(200, { type: "ask", ask: "tool", text: undefined }),
		]

		const result = getPreviousTodos(messages, 300)
		expect(result).toEqual(todos)
	})
})
