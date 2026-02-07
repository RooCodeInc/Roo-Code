/**
 * Tests for extension context message handling and state management logic.
 *
 * The core message-processing logic lives in extension-logic.ts as pure functions.
 * This test harness applies the results of those functions to a plain store object,
 * mirroring how extension.tsx applies them via SolidJS setStore().
 *
 * This tests:
 * 1. handleSayMessage behavior (message filtering, role assignment, dedup)
 * 2. handleAskMessage behavior (ask types, pendingAsk, completion, followup)
 * 3. handleSubmit flow (new task, continue, pending ask, /new command)
 * 4. handleApprove / handleReject (approval/rejection flow)
 * 5. addMessage logic (dedup, streaming debounce)
 * 6. handleExtensionMessage dispatch
 */

import type { ClineAsk, ClineSay, TodoItem } from "@roo-code/types"

vi.mock("../../../lib/utils/tools.js", () => ({
	extractToolData: vi.fn((toolInfo: Record<string, unknown>) => ({
		tool: toolInfo.tool as string,
		path: toolInfo.path as string | undefined,
	})),
	formatToolOutput: vi.fn((toolInfo: Record<string, unknown>) => `Output: ${toolInfo.tool}`),
	formatToolAskMessage: vi.fn((toolInfo: Record<string, unknown>) => `Ask: ${toolInfo.tool}`),
	parseTodosFromToolInfo: vi.fn(() => null),
}))

vi.mock("../../../lib/utils/commands.js", () => ({
	getGlobalCommand: vi.fn((name: string) => {
		if (name === "new") return { name: "new", description: "Start new task", action: "clearTask" }
		return undefined
	}),
	getGlobalCommandsForAutocomplete: vi.fn(() => []),
}))

import { formatToolAskMessage, parseTodosFromToolInfo } from "../../../lib/utils/tools.js"

import type { TUIMessage, PendingAsk } from "../../types.js"
import {
	processSayMessage,
	processAskMessage,
	computeSubmitAction,
	type MessageContext,
	type SayMessageResult,
	type AskMessageResult,
} from "../extension-logic.js"

// ================================================================
// ExtensionStore type (simplified version for tests — avoids
// importing from extension.tsx which requires SolidJS compilation)
// ================================================================

interface ExtensionStore {
	messages: TUIMessage[]
	pendingAsk: PendingAsk | null
	isLoading: boolean
	isComplete: boolean
	hasStartedTask: boolean
	error: string | null
	isResumingTask: boolean
	fileSearchResults: unknown[]
	allSlashCommands: unknown[]
	availableModes: unknown[]
	taskHistory: unknown[]
	currentTaskId: string | null
	currentMode: string | null
	tokenUsage: unknown | null
	currentTodos: TodoItem[]
	previousTodos: TodoItem[]
}

// ================================================================
// Test harness — thin wrapper that delegates to pure functions
// from extension-logic.ts and applies the results to a plain store.
// ================================================================

/**
 * Portable test harness that uses the shared pure functions from
 * extension-logic.ts. This ensures test and production code execute
 * the same business logic.
 */
class ExtensionContextTestHarness {
	store: ExtensionStore = {
		messages: [],
		pendingAsk: null,
		isLoading: false,
		isComplete: false,
		hasStartedTask: false,
		error: null,
		isResumingTask: false,
		fileSearchResults: [],
		allSlashCommands: [],
		availableModes: [],
		taskHistory: [],
		currentTaskId: null,
		currentMode: null,
		tokenUsage: null,
		currentTodos: [],
		previousTodos: [],
	}

	seenMessageIds = new Set<string>()
	firstTextMessageSkipped = false
	pendingCommandRef: string | null = null
	nonInteractive: boolean

	sentMessages: Array<Record<string, unknown>> = []
	runTaskCalls: string[] = []
	runTaskError: Error | null = null

	constructor(options: { nonInteractive?: boolean } = {}) {
		this.nonInteractive = options.nonInteractive ?? false
	}

	private sendToExtension(msg: Record<string, unknown>) {
		this.sentMessages.push(msg)
	}

	/** Build a MessageContext snapshot for pure functions. */
	private get messageContext(): MessageContext {
		return {
			seenMessageIds: this.seenMessageIds,
			firstTextMessageSkipped: this.firstTextMessageSkipped,
			isResumingTask: this.store.isResumingTask,
			pendingCommandRef: this.pendingCommandRef,
			nonInteractive: this.nonInteractive,
			currentTodos: this.store.currentTodos,
		}
	}

	/** Add or update a message in the store (no streaming debounce in tests). */
	addMessage(msg: TUIMessage) {
		const existingIndex = this.store.messages.findIndex((m) => m.id === msg.id)

		if (existingIndex === -1) {
			this.store.messages = [...this.store.messages, msg]
			return
		}

		if (msg.partial) {
			// In the real code this uses debounce; here we update immediately
			const msgs = [...this.store.messages]
			msgs[existingIndex] = { ...msgs[existingIndex]!, content: msg.content, partial: msg.partial }
			this.store.messages = msgs
			return
		}

		// Non-partial update replaces
		const msgs = [...this.store.messages]
		msgs[existingIndex] = msg
		this.store.messages = msgs
	}

	/** Apply result from processSayMessage to the store. */
	private applySayResult(result: SayMessageResult) {
		if (result.trackId) this.seenMessageIds.add(result.trackId)
		if (result.setFirstTextSkipped) this.firstTextMessageSkipped = true
		if (result.clearPendingCommand) this.pendingCommandRef = null
		if (result.message) this.addMessage(result.message)
	}

	/** Apply result from processAskMessage to the store. */
	private applyAskResult(result: AskMessageResult) {
		if (result.trackId) this.seenMessageIds.add(result.trackId)
		if (result.pendingCommand !== undefined) this.pendingCommandRef = result.pendingCommand

		const u = result.storeUpdates
		if (u.isLoading !== undefined) this.store.isLoading = u.isLoading
		if (u.hasStartedTask !== undefined) this.store.hasStartedTask = u.hasStartedTask
		if (u.isResumingTask !== undefined) this.store.isResumingTask = u.isResumingTask
		if (u.isComplete !== undefined) this.store.isComplete = u.isComplete
		if (result.todoUpdate) {
			this.store.previousTodos = result.todoUpdate.previousTodos
			this.store.currentTodos = result.todoUpdate.currentTodos
		}
		if (result.pendingAsk) this.store.pendingAsk = result.pendingAsk
		if (result.message) this.addMessage(result.message)
	}

	/** Delegates to processSayMessage pure function. */
	handleSayMessage(ts: number, say: ClineSay, text: string, partial: boolean) {
		this.applySayResult(processSayMessage(this.messageContext, ts, say, text, partial))
	}

	/** Delegates to processAskMessage pure function. */
	handleAskMessage(ts: number, ask: ClineAsk, text: string, partial: boolean) {
		this.applyAskResult(processAskMessage(this.messageContext, ts, ask, text, partial))
	}

	/** Delegates to computeSubmitAction pure function, then applies. */
	async handleSubmit(text: string) {
		const action = computeSubmitAction(
			{
				pendingAsk: this.store.pendingAsk,
				hasStartedTask: this.store.hasStartedTask,
				isComplete: this.store.isComplete,
			},
			text,
			() => `uuid-${Date.now()}`,
		)

		switch (action.kind) {
			case "none":
				return

			case "clearTask":
				this.store.messages = []
				this.store.pendingAsk = null
				this.store.isLoading = false
				this.store.isComplete = false
				this.store.hasStartedTask = false
				this.store.error = null
				this.store.isResumingTask = false
				this.store.tokenUsage = null
				this.store.currentTodos = []
				this.store.previousTodos = []
				this.seenMessageIds.clear()
				this.firstTextMessageSkipped = false
				this.sendToExtension({ type: "clearTask" })
				this.sendToExtension({ type: "requestCommands" })
				this.sendToExtension({ type: "requestModes" })
				return

			case "respondToAsk":
				this.addMessage(action.userMessage)
				this.sendToExtension({
					type: "askResponse",
					askResponse: "messageResponse",
					text: action.text,
				})
				this.store.pendingAsk = null
				this.store.isLoading = true
				return

			case "startNewTask":
				this.store.hasStartedTask = true
				this.store.isLoading = true
				this.addMessage(action.userMessage)
				try {
					this.runTaskCalls.push(action.text)
					if (this.runTaskError) throw this.runTaskError
				} catch (err) {
					this.store.error = err instanceof Error ? err.message : String(err)
					this.store.isLoading = false
				}
				return

			case "continueTask":
				if (this.store.isComplete) this.store.isComplete = false
				this.store.isLoading = true
				this.addMessage(action.userMessage)
				this.sendToExtension({
					type: "askResponse",
					askResponse: "messageResponse",
					text: action.text,
				})
				return
		}
	}

	handleApprove() {
		this.sendToExtension({ type: "askResponse", askResponse: "yesButtonClicked" })
		this.store.pendingAsk = null
		this.store.isLoading = true
	}

	handleReject() {
		this.sendToExtension({ type: "askResponse", askResponse: "noButtonClicked" })
		this.store.pendingAsk = null
		this.store.isLoading = true
	}

	cancelTask() {
		this.sendToExtension({ type: "cancelTask" })
	}

	resumeTask(taskId: string) {
		this.store.isResumingTask = true
		this.store.hasStartedTask = true
		this.store.isLoading = true
		this.store.isComplete = false
		this.sendToExtension({ type: "showTaskWithId", text: taskId })
	}

	searchFiles(query: string) {
		this.sendToExtension({ type: "searchFiles", query })
	}
}

// ================================================================
// Tests
// ================================================================

describe("Extension Context Logic", () => {
	let ctx: ExtensionContextTestHarness

	beforeEach(() => {
		ctx = new ExtensionContextTestHarness()
		vi.clearAllMocks()
	})

	describe("initial state", () => {
		it("has empty messages array", () => {
			expect(ctx.store.messages).toEqual([])
		})

		it("has no pending ask", () => {
			expect(ctx.store.pendingAsk).toBeNull()
		})

		it("has isLoading false", () => {
			expect(ctx.store.isLoading).toBe(false)
		})

		it("has isComplete false", () => {
			expect(ctx.store.isComplete).toBe(false)
		})

		it("has hasStartedTask false", () => {
			expect(ctx.store.hasStartedTask).toBe(false)
		})

		it("has null error", () => {
			expect(ctx.store.error).toBeNull()
		})

		it("has null tokenUsage", () => {
			expect(ctx.store.tokenUsage).toBeNull()
		})

		it("has empty currentTodos", () => {
			expect(ctx.store.currentTodos).toEqual([])
		})

		it("has empty previousTodos", () => {
			expect(ctx.store.previousTodos).toEqual([])
		})
	})

	// ================================================================
	// handleSayMessage
	// ================================================================

	describe("handleSayMessage", () => {
		it("skips checkpoint_saved messages", () => {
			ctx.handleSayMessage(1000, "checkpoint_saved", "saved", false)
			expect(ctx.store.messages).toEqual([])
		})

		it("skips api_req_started messages", () => {
			ctx.handleSayMessage(1001, "api_req_started", "{}", false)
			expect(ctx.store.messages).toEqual([])
		})

		it("skips user_feedback messages and tracks message id", () => {
			ctx.handleSayMessage(1002, "user_feedback", "feedback", false)
			expect(ctx.store.messages).toEqual([])
			expect(ctx.seenMessageIds.has("1002")).toBe(true)
		})

		it("skips first text message when not resuming", () => {
			expect(ctx.firstTextMessageSkipped).toBe(false)
			ctx.handleSayMessage(2000, "text", "First message", false)
			expect(ctx.store.messages).toEqual([])
			expect(ctx.firstTextMessageSkipped).toBe(true)
		})

		it("does NOT skip first text message when resuming task", () => {
			ctx.store.isResumingTask = true
			ctx.handleSayMessage(2000, "text", "First message", false)
			expect(ctx.store.messages).toHaveLength(1)
			expect(ctx.store.messages[0]!.content).toBe("First message")
		})

		it("adds subsequent text messages as assistant role", () => {
			// Skip the first text message
			ctx.handleSayMessage(2000, "text", "First", false)
			// Second text message should be added
			ctx.handleSayMessage(2001, "text", "Hello!", false)
			expect(ctx.store.messages).toHaveLength(1)
			expect(ctx.store.messages[0]!.role).toBe("assistant")
			expect(ctx.store.messages[0]!.content).toBe("Hello!")
		})

		it("deduplicates non-partial messages with same timestamp", () => {
			ctx.firstTextMessageSkipped = true // skip first-text logic
			ctx.handleSayMessage(3000, "text", "Hello", false)
			ctx.handleSayMessage(3000, "text", "Hello again", false) // same ts
			expect(ctx.store.messages).toHaveLength(1)
			expect(ctx.store.messages[0]!.content).toBe("Hello")
		})

		it("allows partial updates for existing messages", () => {
			ctx.firstTextMessageSkipped = true
			ctx.handleSayMessage(4000, "text", "Part 1", true)
			ctx.handleSayMessage(4000, "text", "Part 1 Part 2", true)
			expect(ctx.store.messages).toHaveLength(1)
			expect(ctx.store.messages[0]!.content).toBe("Part 1 Part 2")
		})

		it("handles command_output as tool role", () => {
			ctx.pendingCommandRef = "ls -la"
			ctx.handleSayMessage(5000, "command_output", "file.txt", false)

			expect(ctx.store.messages).toHaveLength(1)
			const msg = ctx.store.messages[0]!
			expect(msg.role).toBe("tool")
			expect(msg.toolName).toBe("execute_command")
			expect(msg.toolDisplayName).toBe("bash")
			expect(msg.toolData?.command).toBe("ls -la")
			expect(msg.toolData?.output).toBe("file.txt")
		})

		it("clears pendingCommandRef after command_output", () => {
			ctx.pendingCommandRef = "ls -la"
			ctx.handleSayMessage(5000, "command_output", "file.txt", false)
			expect(ctx.pendingCommandRef).toBeNull()
		})

		it("handles reasoning as thinking role", () => {
			ctx.firstTextMessageSkipped = true
			ctx.handleSayMessage(6000, "reasoning", "thinking about it...", false)

			expect(ctx.store.messages).toHaveLength(1)
			expect(ctx.store.messages[0]!.role).toBe("thinking")
		})

		it("handles empty text as empty string content", () => {
			ctx.firstTextMessageSkipped = true
			ctx.handleSayMessage(7000, "text", "", false)
			expect(ctx.store.messages[0]!.content).toBe("")
		})
	})

	// ================================================================
	// handleAskMessage
	// ================================================================

	describe("handleAskMessage", () => {
		it("ignores partial ask messages", () => {
			ctx.handleAskMessage(1000, "followup", "question", true)
			expect(ctx.store.pendingAsk).toBeNull()
			expect(ctx.store.messages).toEqual([])
		})

		it("deduplicates already-seen ask messages", () => {
			ctx.seenMessageIds.add("1000")
			ctx.handleAskMessage(1000, "followup", "question", false)
			expect(ctx.store.pendingAsk).toBeNull()
		})

		it("skips command_output ask type", () => {
			ctx.handleAskMessage(2000, "command_output", "output", false)
			expect(ctx.store.pendingAsk).toBeNull()
			expect(ctx.seenMessageIds.has("2000")).toBe(true)
		})

		it("handles resume_task by resetting loading state", () => {
			ctx.store.isLoading = true
			ctx.handleAskMessage(3000, "resume_task", "", false)

			expect(ctx.store.isLoading).toBe(false)
			expect(ctx.store.hasStartedTask).toBe(true)
			expect(ctx.store.isResumingTask).toBe(false)
		})

		it("handles resume_completed_task similarly to resume_task", () => {
			ctx.store.isLoading = true
			ctx.handleAskMessage(3001, "resume_completed_task", "", false)

			expect(ctx.store.isLoading).toBe(false)
			expect(ctx.store.hasStartedTask).toBe(true)
			expect(ctx.store.isResumingTask).toBe(false)
		})

		it("handles completion_result by marking complete and adding message", () => {
			const completionData = JSON.stringify({ result: "All done!" })
			ctx.handleAskMessage(4000, "completion_result", completionData, false)

			expect(ctx.store.isComplete).toBe(true)
			expect(ctx.store.isLoading).toBe(false)
			expect(ctx.store.messages).toHaveLength(1)

			const msg = ctx.store.messages[0]!
			expect(msg.role).toBe("tool")
			expect(msg.toolName).toBe("attempt_completion")
			expect(msg.toolDisplayName).toBe("Task Complete")
			expect(msg.toolData?.result).toBe("All done!")
		})

		it("handles completion_result with invalid JSON gracefully", () => {
			ctx.handleAskMessage(4001, "completion_result", "plain text", false)

			expect(ctx.store.isComplete).toBe(true)
			expect(ctx.store.messages).toHaveLength(1)

			const msg = ctx.store.messages[0]!
			expect(msg.toolDisplayOutput).toBe("✅ Task completed")
			expect(msg.content).toBe("plain text")
		})

		it("handles completion_result with empty text", () => {
			ctx.handleAskMessage(4002, "completion_result", "", false)

			expect(ctx.store.isComplete).toBe(true)
			expect(ctx.store.messages).toHaveLength(1)

			const msg = ctx.store.messages[0]!
			expect(msg.content).toBe("Task completed")
		})

		it("tracks command text via pendingCommandRef for 'command' ask type", () => {
			ctx.handleAskMessage(5000, "command", "npm test", false)
			expect(ctx.pendingCommandRef).toBe("npm test")
		})

		it("sets pendingAsk for followup type with parsed JSON", () => {
			const data = JSON.stringify({
				question: "What do you want?",
				suggest: [{ answer: "Option A" }, { answer: "Option B" }],
			})
			ctx.handleAskMessage(6000, "followup", data, false)

			expect(ctx.store.pendingAsk).not.toBeNull()
			expect(ctx.store.pendingAsk!.type).toBe("followup")
			expect(ctx.store.pendingAsk!.content).toBe("What do you want?")
			expect(ctx.store.pendingAsk!.suggestions).toHaveLength(2)
		})

		it("sets pendingAsk for followup with raw text when JSON parse fails", () => {
			ctx.handleAskMessage(6001, "followup", "What do you want?", false)

			expect(ctx.store.pendingAsk!.content).toBe("What do you want?")
			expect(ctx.store.pendingAsk!.suggestions).toBeUndefined()
		})

		it("formats tool ask message for 'tool' ask type", () => {
			const toolInfo = JSON.stringify({ tool: "readFile", path: "/test.ts" })
			ctx.handleAskMessage(7000, "tool", toolInfo, false)

			expect(formatToolAskMessage).toHaveBeenCalledWith({ tool: "readFile", path: "/test.ts" })
			expect(ctx.store.pendingAsk!.content).toBe("Ask: readFile")
		})

		describe("nonInteractive mode", () => {
			let nonInteractiveCtx: ExtensionContextTestHarness

			beforeEach(() => {
				nonInteractiveCtx = new ExtensionContextTestHarness({ nonInteractive: true })
			})

			it("auto-processes tool ask as message instead of pendingAsk", () => {
				const toolInfo = JSON.stringify({ tool: "readFile", path: "/test.ts" })
				nonInteractiveCtx.handleAskMessage(8000, "tool", toolInfo, false)

				expect(nonInteractiveCtx.store.pendingAsk).toBeNull()
				expect(nonInteractiveCtx.store.messages).toHaveLength(1)
				expect(nonInteractiveCtx.store.messages[0]!.role).toBe("tool")
			})

			it("auto-processes non-tool ask as assistant message", () => {
				nonInteractiveCtx.handleAskMessage(8001, "command", "npm test", false)

				expect(nonInteractiveCtx.store.pendingAsk).toBeNull()
				expect(nonInteractiveCtx.store.messages).toHaveLength(1)
				expect(nonInteractiveCtx.store.messages[0]!.role).toBe("assistant")
			})

			it("still shows followup as pendingAsk even in nonInteractive mode", () => {
				nonInteractiveCtx.handleAskMessage(8002, "followup", "What?", false)
				expect(nonInteractiveCtx.store.pendingAsk).not.toBeNull()
				expect(nonInteractiveCtx.store.pendingAsk!.type).toBe("followup")
			})

			it("handles tool ask with invalid JSON text", () => {
				nonInteractiveCtx.handleAskMessage(8003, "tool", "invalid json", false)

				expect(nonInteractiveCtx.store.messages).toHaveLength(1)
				expect(nonInteractiveCtx.store.messages[0]!.content).toBe("invalid json")
				expect(nonInteractiveCtx.store.messages[0]!.toolName).toBeUndefined()
			})

			it("handles update_todo_list tool by updating todos in store", () => {
				const mockTodos: TodoItem[] = [
					{ id: "1", content: "Fix bug", status: "in_progress" },
					{ id: "2", content: "Write tests", status: "pending" },
				]
				vi.mocked(parseTodosFromToolInfo).mockReturnValueOnce(mockTodos)

				// Set some existing todos
				nonInteractiveCtx.store.currentTodos = [{ id: "0", content: "Old todo", status: "completed" }]

				const toolInfo = JSON.stringify({ tool: "update_todo_list", todos: "..." })
				nonInteractiveCtx.handleAskMessage(8004, "tool", toolInfo, false)

				// Store todos should be updated
				expect(nonInteractiveCtx.store.currentTodos).toEqual(mockTodos)
				expect(nonInteractiveCtx.store.previousTodos).toEqual([
					{ id: "0", content: "Old todo", status: "completed" },
				])

				// Message should contain todo data
				const msg = nonInteractiveCtx.store.messages[0]!
				expect(msg.todos).toEqual(mockTodos)
				expect(msg.previousTodos).toEqual([{ id: "0", content: "Old todo", status: "completed" }])
			})
		})
	})

	// ================================================================
	// addMessage
	// ================================================================

	describe("addMessage", () => {
		it("adds new messages", () => {
			ctx.addMessage({ id: "1", role: "user", content: "Hello" })
			ctx.addMessage({ id: "2", role: "assistant", content: "Hi" })
			expect(ctx.store.messages).toHaveLength(2)
		})

		it("updates existing message by id (non-partial)", () => {
			ctx.addMessage({ id: "1", role: "assistant", content: "Draft" })
			ctx.addMessage({ id: "1", role: "assistant", content: "Final" })
			expect(ctx.store.messages).toHaveLength(1)
			expect(ctx.store.messages[0]!.content).toBe("Final")
		})

		it("updates existing message content for partial messages", () => {
			ctx.addMessage({ id: "1", role: "assistant", content: "Start", partial: true })
			ctx.addMessage({ id: "1", role: "assistant", content: "Start continued", partial: true })
			expect(ctx.store.messages).toHaveLength(1)
			expect(ctx.store.messages[0]!.content).toBe("Start continued")
		})
	})

	// ================================================================
	// handleSubmit
	// ================================================================

	describe("handleSubmit", () => {
		it("ignores empty text", async () => {
			await ctx.handleSubmit("")
			expect(ctx.store.messages).toEqual([])
			expect(ctx.sentMessages).toEqual([])
		})

		it("ignores whitespace-only text", async () => {
			await ctx.handleSubmit("   ")
			expect(ctx.store.messages).toEqual([])
		})

		it("ignores __CUSTOM__ text", async () => {
			await ctx.handleSubmit("__CUSTOM__")
			expect(ctx.store.messages).toEqual([])
		})

		it("starts a new task when hasStartedTask is false", async () => {
			await ctx.handleSubmit("Hello agent")

			expect(ctx.store.hasStartedTask).toBe(true)
			expect(ctx.store.isLoading).toBe(true)
			expect(ctx.runTaskCalls).toEqual(["Hello agent"])
			expect(ctx.store.messages).toHaveLength(1)
			expect(ctx.store.messages[0]!.role).toBe("user")
			expect(ctx.store.messages[0]!.content).toBe("Hello agent")
		})

		it("sends askResponse when pendingAsk exists", async () => {
			// Start task first
			await ctx.handleSubmit("Start task")

			// Set pending ask
			ctx.store.pendingAsk = {
				id: "ask-1",
				type: "followup" as ClineAsk,
				content: "What do you want?",
			}

			ctx.sentMessages = [] // clear
			await ctx.handleSubmit("My answer")

			expect(ctx.sentMessages).toContainEqual({
				type: "askResponse",
				askResponse: "messageResponse",
				text: "My answer",
			})
			expect(ctx.store.pendingAsk).toBeNull()
			expect(ctx.store.isLoading).toBe(true)
		})

		it("sends continue message when task already started", async () => {
			await ctx.handleSubmit("Start task")
			ctx.sentMessages = []

			await ctx.handleSubmit("Continue with this")

			expect(ctx.sentMessages).toContainEqual({
				type: "askResponse",
				askResponse: "messageResponse",
				text: "Continue with this",
			})
		})

		it("handles /new command by resetting state", async () => {
			await ctx.handleSubmit("Start task")
			expect(ctx.store.hasStartedTask).toBe(true)

			ctx.sentMessages = []
			await ctx.handleSubmit("/new")

			expect(ctx.store.messages).toEqual([])
			expect(ctx.store.pendingAsk).toBeNull()
			expect(ctx.store.isLoading).toBe(false)
			expect(ctx.store.isComplete).toBe(false)
			expect(ctx.store.hasStartedTask).toBe(false)
			expect(ctx.store.error).toBeNull()
			expect(ctx.store.tokenUsage).toBeNull()
			expect(ctx.store.currentTodos).toEqual([])
			expect(ctx.store.previousTodos).toEqual([])

			expect(ctx.sentMessages).toContainEqual({ type: "clearTask" })
			expect(ctx.sentMessages).toContainEqual({ type: "requestCommands" })
			expect(ctx.sentMessages).toContainEqual({ type: "requestModes" })
		})

		it("handles runTask errors", async () => {
			ctx.runTaskError = new Error("Connection failed")
			await ctx.handleSubmit("Start task")

			expect(ctx.store.error).toBe("Connection failed")
			expect(ctx.store.isLoading).toBe(false)
		})

		it("handles non-Error runTask rejections", async () => {
			ctx.runTaskError = new Error("string error")
			await ctx.handleSubmit("Start task")

			expect(ctx.store.error).toBe("string error")
			expect(ctx.store.isLoading).toBe(false)
		})

		it("resets isComplete when continuing after completion", async () => {
			await ctx.handleSubmit("Start task")
			ctx.store.isComplete = true

			await ctx.handleSubmit("Do something else")
			expect(ctx.store.isComplete).toBe(false)
		})

		it("trims whitespace from input", async () => {
			await ctx.handleSubmit("  Hello agent  ")
			expect(ctx.store.messages[0]!.content).toBe("Hello agent")
		})

		it("ignores unknown slash commands (not global)", async () => {
			// /unknown is not a global command, so it should be treated as regular text
			await ctx.handleSubmit("/unknown")
			expect(ctx.store.hasStartedTask).toBe(true)
			expect(ctx.runTaskCalls).toEqual(["/unknown"])
		})

		it("clears seenMessageIds on /new", async () => {
			ctx.seenMessageIds.add("old-id")
			ctx.firstTextMessageSkipped = true

			await ctx.handleSubmit("/new")

			expect(ctx.seenMessageIds.size).toBe(0)
			expect(ctx.firstTextMessageSkipped).toBe(false)
		})
	})

	// ================================================================
	// handleApprove / handleReject
	// ================================================================

	describe("handleApprove", () => {
		it("sends yesButtonClicked response", () => {
			ctx.handleApprove()
			expect(ctx.sentMessages).toContainEqual({
				type: "askResponse",
				askResponse: "yesButtonClicked",
			})
		})

		it("clears pendingAsk and sets isLoading", () => {
			ctx.store.pendingAsk = {
				id: "ask-1",
				type: "tool" as ClineAsk,
				content: "Approve?",
			}

			ctx.handleApprove()
			expect(ctx.store.pendingAsk).toBeNull()
			expect(ctx.store.isLoading).toBe(true)
		})
	})

	describe("handleReject", () => {
		it("sends noButtonClicked response", () => {
			ctx.handleReject()
			expect(ctx.sentMessages).toContainEqual({
				type: "askResponse",
				askResponse: "noButtonClicked",
			})
		})

		it("clears pendingAsk and sets isLoading", () => {
			ctx.store.pendingAsk = {
				id: "ask-1",
				type: "tool" as ClineAsk,
				content: "Reject?",
			}

			ctx.handleReject()
			expect(ctx.store.pendingAsk).toBeNull()
			expect(ctx.store.isLoading).toBe(true)
		})
	})

	// ================================================================
	// Utility methods
	// ================================================================

	describe("searchFiles", () => {
		it("sends searchFiles message to extension", () => {
			ctx.searchFiles("*.ts")
			expect(ctx.sentMessages).toContainEqual({
				type: "searchFiles",
				query: "*.ts",
			})
		})
	})

	describe("cancelTask", () => {
		it("sends cancelTask message", () => {
			ctx.cancelTask()
			expect(ctx.sentMessages).toContainEqual({ type: "cancelTask" })
		})
	})

	describe("resumeTask", () => {
		it("sets resuming state and sends showTaskWithId message", () => {
			ctx.resumeTask("task-123")

			expect(ctx.store.isResumingTask).toBe(true)
			expect(ctx.store.hasStartedTask).toBe(true)
			expect(ctx.store.isLoading).toBe(true)
			expect(ctx.store.isComplete).toBe(false)
			expect(ctx.sentMessages).toContainEqual({
				type: "showTaskWithId",
				text: "task-123",
			})
		})
	})

	// ================================================================
	// Integration: message handling flow
	// ================================================================

	describe("integration: message handling flow", () => {
		it("processes a full conversation flow", async () => {
			// 1. User starts task
			await ctx.handleSubmit("Fix the bug")
			expect(ctx.store.hasStartedTask).toBe(true)
			expect(ctx.store.messages).toHaveLength(1)

			// 2. Agent responds with text (first text is skipped)
			ctx.handleSayMessage(1000, "text", "Analyzing...", false)
			expect(ctx.store.messages).toHaveLength(1) // still 1 - first text skipped

			// 3. Agent sends second text message
			ctx.handleSayMessage(1001, "text", "I found the issue.", false)
			expect(ctx.store.messages).toHaveLength(2)

			// 4. Agent asks for tool approval (interactive mode)
			ctx.handleAskMessage(1002, "tool", '{"tool":"readFile","path":"bug.ts"}', false)
			expect(ctx.store.pendingAsk).not.toBeNull()
			expect(ctx.store.pendingAsk!.type).toBe("tool")

			// 5. User approves
			ctx.handleApprove()
			expect(ctx.store.pendingAsk).toBeNull()
			expect(ctx.store.isLoading).toBe(true)

			// 6. Agent completes task
			ctx.handleAskMessage(1003, "completion_result", '{"result":"Bug fixed!"}', false)
			expect(ctx.store.isComplete).toBe(true)
			expect(ctx.store.messages).toHaveLength(3) // user + text + completion
		})

		it("processes command_output with tracked command", () => {
			ctx.firstTextMessageSkipped = true

			// Agent asks to run command
			ctx.handleAskMessage(2000, "command", "npm test", false)
			expect(ctx.pendingCommandRef).toBe("npm test")

			// Then says the output
			ctx.handleSayMessage(2001, "command_output", "All tests pass", false)

			const cmdMsg = ctx.store.messages.find((m) => m.toolName === "execute_command")
			expect(cmdMsg).toBeDefined()
			expect(cmdMsg!.toolData?.command).toBe("npm test")
			expect(cmdMsg!.toolData?.output).toBe("All tests pass")
		})

		it("handles /new reset mid-conversation", async () => {
			await ctx.handleSubmit("Start task")
			ctx.handleSayMessage(1000, "text", "First ignored", false)
			ctx.handleSayMessage(1001, "text", "Working on it", false)

			expect(ctx.store.messages).toHaveLength(2) // user + text

			await ctx.handleSubmit("/new")

			expect(ctx.store.messages).toEqual([])
			expect(ctx.store.hasStartedTask).toBe(false)
			expect(ctx.store.isComplete).toBe(false)
			expect(ctx.firstTextMessageSkipped).toBe(false)
		})
	})
})
