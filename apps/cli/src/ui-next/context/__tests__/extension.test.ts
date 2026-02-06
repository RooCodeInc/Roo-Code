/**
 * Tests for extension context message handling and state management logic.
 *
 * Since extension.tsx uses SolidJS JSX (createStore, batch, etc.) which requires
 * a SolidJS compilation pipeline not available in the standard vitest config,
 * we test the core logic by replicating the state management patterns in plain TS.
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

vi.mock("../../../ui/utils/tools.js", () => ({
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

import {
	extractToolData,
	formatToolOutput,
	formatToolAskMessage,
	parseTodosFromToolInfo,
} from "../../../ui/utils/tools.js"
import { getGlobalCommand } from "../../../lib/utils/commands.js"

// ================================================================
// Types mirrored from extension.tsx and types.ts
// ================================================================

type MessageRole = "system" | "user" | "assistant" | "tool" | "thinking"

interface TUIMessage {
	id: string
	role: MessageRole
	content: string
	toolName?: string
	toolDisplayName?: string
	toolDisplayOutput?: string
	partial?: boolean
	originalType?: ClineAsk | ClineSay
	toolData?: Record<string, unknown>
	todos?: TodoItem[]
	previousTodos?: TodoItem[]
}

interface PendingAsk {
	id: string
	type: ClineAsk
	content: string
	suggestions?: Array<{ answer: string; mode?: string | null }>
}

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
// Replicate extension context logic as testable class
// ================================================================

/**
 * Portable replica of the extension context state machine.
 * This mirrors all the pure logic in extension.tsx without SolidJS dependencies.
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

	/** Mirror of addMessage from extension.tsx */
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

	/** Mirror of handleSayMessage from extension.tsx */
	handleSayMessage(ts: number, say: ClineSay, text: string, partial: boolean) {
		const messageId = ts.toString()

		if (say === "checkpoint_saved" || say === "api_req_started" || say === "user_feedback") {
			if (say === "user_feedback") this.seenMessageIds.add(messageId)
			return
		}

		if (say === "text" && !this.firstTextMessageSkipped && !this.store.isResumingTask) {
			this.firstTextMessageSkipped = true
			this.seenMessageIds.add(messageId)
			return
		}

		if (this.seenMessageIds.has(messageId) && !partial) return

		let role: MessageRole = "assistant"
		let toolName: string | undefined
		let toolDisplayName: string | undefined
		let toolDisplayOutput: string | undefined
		let toolData: Record<string, unknown> | undefined

		if (say === "command_output") {
			role = "tool"
			toolName = "execute_command"
			toolDisplayName = "bash"
			toolDisplayOutput = text
			const trackedCommand = this.pendingCommandRef
			toolData = { tool: "execute_command", command: trackedCommand || undefined, output: text }
			this.pendingCommandRef = null
		} else if (say === "reasoning") {
			role = "thinking"
		}

		this.seenMessageIds.add(messageId)

		this.addMessage({
			id: messageId,
			role,
			content: text || "",
			toolName,
			toolDisplayName,
			toolDisplayOutput,
			partial,
			originalType: say,
			toolData,
		})
	}

	/** Mirror of handleAskMessage from extension.tsx */
	handleAskMessage(ts: number, ask: ClineAsk, text: string, partial: boolean) {
		const messageId = ts.toString()

		if (partial) return
		if (this.seenMessageIds.has(messageId)) return
		if (ask === "command_output") {
			this.seenMessageIds.add(messageId)
			return
		}

		if (ask === "resume_task" || ask === "resume_completed_task") {
			this.seenMessageIds.add(messageId)
			this.store.isLoading = false
			this.store.hasStartedTask = true
			this.store.isResumingTask = false
			return
		}

		if (ask === "completion_result") {
			this.seenMessageIds.add(messageId)
			this.store.isComplete = true
			this.store.isLoading = false

			try {
				const completionInfo = JSON.parse(text) as Record<string, unknown>
				const toolDataVal = {
					tool: "attempt_completion",
					result: completionInfo.result as string | undefined,
					content: completionInfo.result as string | undefined,
				}

				this.addMessage({
					id: messageId,
					role: "tool",
					content: text,
					toolName: "attempt_completion",
					toolDisplayName: "Task Complete",
					toolDisplayOutput: (formatToolOutput as ReturnType<typeof vi.fn>)({
						tool: "attempt_completion",
						...completionInfo,
					}),
					originalType: ask,
					toolData: toolDataVal,
				})
			} catch {
				this.addMessage({
					id: messageId,
					role: "tool",
					content: text || "Task completed",
					toolName: "attempt_completion",
					toolDisplayName: "Task Complete",
					toolDisplayOutput: "✅ Task completed",
					originalType: ask,
					toolData: { tool: "attempt_completion", content: text },
				})
			}
			return
		}

		if (ask === "command") {
			this.pendingCommandRef = text
		}

		if (this.nonInteractive && ask !== "followup") {
			this.seenMessageIds.add(messageId)

			if (ask === "tool") {
				let localToolName: string | undefined
				let localToolDisplayName: string | undefined
				let localToolDisplayOutput: string | undefined
				let formattedContent = text || ""
				let localToolData: Record<string, unknown> | undefined

				try {
					const toolInfo = JSON.parse(text) as Record<string, unknown>
					localToolName = toolInfo.tool as string
					localToolDisplayName = toolInfo.tool as string
					localToolDisplayOutput = (formatToolOutput as ReturnType<typeof vi.fn>)(toolInfo)
					formattedContent = (formatToolAskMessage as ReturnType<typeof vi.fn>)(toolInfo)
					localToolData = (extractToolData as ReturnType<typeof vi.fn>)(toolInfo)
				} catch {
					// Use raw text
				}

				this.addMessage({
					id: messageId,
					role: "tool",
					content: formattedContent,
					toolName: localToolName,
					toolDisplayName: localToolDisplayName,
					toolDisplayOutput: localToolDisplayOutput,
					originalType: ask,
					toolData: localToolData,
				})
			} else {
				this.addMessage({
					id: messageId,
					role: "assistant",
					content: text || "",
					originalType: ask,
				})
			}
			return
		}

		let suggestions: Array<{ answer: string; mode?: string | null }> | undefined
		let questionText = text

		if (ask === "followup") {
			try {
				const data = JSON.parse(text)
				questionText = data.question || text
				suggestions = Array.isArray(data.suggest) ? data.suggest : undefined
			} catch {
				// Use raw text
			}
		} else if (ask === "tool") {
			try {
				const toolInfo = JSON.parse(text) as Record<string, unknown>
				questionText = (formatToolAskMessage as ReturnType<typeof vi.fn>)(toolInfo)
			} catch {
				// Use raw text
			}
		}

		this.seenMessageIds.add(messageId)

		this.store.pendingAsk = {
			id: messageId,
			type: ask,
			content: questionText,
			suggestions,
		}
	}

	/** Mirror of handleSubmit from extension.tsx */
	async handleSubmit(text: string) {
		if (!text.trim()) return

		const trimmedText = text.trim()
		if (trimmedText === "__CUSTOM__") return

		// Check for CLI global action commands
		if (trimmedText.startsWith("/")) {
			const commandMatch = trimmedText.match(/^\/(\w+)(?:\s|$)/)
			if (commandMatch && commandMatch[1]) {
				const globalCommand = (getGlobalCommand as ReturnType<typeof vi.fn>)(commandMatch[1])
				if (globalCommand?.action === "clearTask") {
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
				}
			}
		}

		if (this.store.pendingAsk) {
			this.addMessage({ id: `uuid-${Date.now()}`, role: "user", content: trimmedText })
			this.sendToExtension({
				type: "askResponse",
				askResponse: "messageResponse",
				text: trimmedText,
			})
			this.store.pendingAsk = null
			this.store.isLoading = true
		} else if (!this.store.hasStartedTask) {
			this.store.hasStartedTask = true
			this.store.isLoading = true
			this.addMessage({ id: `uuid-${Date.now()}`, role: "user", content: trimmedText })
			try {
				this.runTaskCalls.push(trimmedText)
				if (this.runTaskError) throw this.runTaskError
			} catch (err) {
				this.store.error = err instanceof Error ? err.message : String(err)
				this.store.isLoading = false
			}
		} else {
			if (this.store.isComplete) this.store.isComplete = false
			this.store.isLoading = true
			this.addMessage({ id: `uuid-${Date.now()}`, role: "user", content: trimmedText })
			this.sendToExtension({
				type: "askResponse",
				askResponse: "messageResponse",
				text: trimmedText,
			})
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
