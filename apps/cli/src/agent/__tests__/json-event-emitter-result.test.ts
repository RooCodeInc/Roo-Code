import type { ClineMessage } from "@roo-code/types"
import { Writable } from "stream"

import type { TaskCompletedEvent } from "../events.js"
import { JsonEventEmitter } from "../json-event-emitter.js"
import { AgentLoopState, type AgentStateInfo } from "../agent-state.js"

function createMockStdout(): { stdout: NodeJS.WriteStream; lines: () => Record<string, unknown>[] } {
	const chunks: string[] = []

	const writable = new Writable({
		write(chunk, _encoding, callback) {
			chunks.push(chunk.toString())
			callback()
		},
	}) as unknown as NodeJS.WriteStream

	const lines = () =>
		chunks
			.join("")
			.split("\n")
			.filter((line) => line.length > 0)
			.map((line) => JSON.parse(line) as Record<string, unknown>)

	return { stdout: writable, lines }
}

function emitMessage(emitter: JsonEventEmitter, message: ClineMessage): void {
	;(emitter as unknown as { handleMessage: (msg: ClineMessage, isUpdate: boolean) => void }).handleMessage(
		message,
		false,
	)
}

function emitMessageUpdate(emitter: JsonEventEmitter, message: ClineMessage): void {
	;(emitter as unknown as { handleMessage: (msg: ClineMessage, isUpdate: boolean) => void }).handleMessage(
		message,
		true,
	)
}

function emitTaskCompleted(emitter: JsonEventEmitter, event: TaskCompletedEvent): void {
	;(emitter as unknown as { handleTaskCompleted: (taskCompleted: TaskCompletedEvent) => void }).handleTaskCompleted(
		event,
	)
}

function createAskCompletionMessage(ts: number, text = ""): ClineMessage {
	return {
		ts,
		type: "ask",
		ask: "completion_result",
		partial: false,
		text,
	} as ClineMessage
}

function createCompletedStateInfo(message: ClineMessage): AgentStateInfo {
	return {
		state: AgentLoopState.IDLE,
		isWaitingForInput: true,
		isRunning: false,
		isStreaming: false,
		currentAsk: "completion_result",
		requiredAction: "start_task",
		lastMessageTs: message.ts,
		lastMessage: message,
		description: "Task completed successfully. You can provide feedback or start a new task.",
	}
}

describe("JsonEventEmitter result emission", () => {
	it("reports context usage when context window is configured", () => {
		const { stdout, lines } = createMockStdout()
		const emitter = new JsonEventEmitter({ mode: "stream-json", stdout, contextWindow: 200 })

		emitMessage(emitter, {
			ts: 5,
			type: "say",
			say: "api_req_started",
			partial: false,
			text: JSON.stringify({
				cost: 0.001,
				tokensIn: 40,
				tokensOut: 20,
			}),
		} as ClineMessage)

		emitMessage(emitter, {
			ts: 6,
			type: "say",
			say: "api_req_started",
			partial: false,
			text: JSON.stringify({
				cost: 0.002,
				tokensIn: 30,
				tokensOut: 10,
			}),
		} as ClineMessage)

		const completionMessage = createAskCompletionMessage(7, "done")
		emitTaskCompleted(emitter, {
			success: true,
			stateInfo: createCompletedStateInfo(completionMessage),
			message: completionMessage,
		})

		const result = lines().find((line) => line.type === "result")
		const cost = result?.cost as Record<string, unknown>

		expect(cost?.contextWindow).toBe(200)
		expect(cost?.contextTokens).toBe(40)
		expect(cost?.contextUsagePercent).toBe(20)
	})

	it("reports token usage and context usage when api_req_started has no cost field", () => {
		const { stdout, lines } = createMockStdout()
		const emitter = new JsonEventEmitter({ mode: "stream-json", stdout, contextWindow: 1000 })

		emitMessage(emitter, {
			ts: 8,
			type: "say",
			say: "api_req_started",
			partial: false,
			text: JSON.stringify({
				tokensIn: 120,
				tokensOut: 30,
				cacheWrites: 10,
				cacheReads: 5,
			}),
		} as ClineMessage)

		const completionMessage = createAskCompletionMessage(9, "done")
		emitTaskCompleted(emitter, {
			success: true,
			stateInfo: createCompletedStateInfo(completionMessage),
			message: completionMessage,
		})

		const result = lines().find((line) => line.type === "result")
		const cost = result?.cost as Record<string, unknown>

		expect(cost?.inputTokens).toBe(120)
		expect(cost?.outputTokens).toBe(30)
		expect(cost?.cacheWrites).toBe(10)
		expect(cost?.cacheReads).toBe(5)
		expect(cost).not.toHaveProperty("totalCost")
		expect(cost?.contextTokens).toBe(150)
		expect(cost?.contextWindow).toBe(1000)
		expect(cost?.contextUsagePercent).toBe(15)
	})

	it("aggregates token usage and cost across api requests in a completion turn", () => {
		const { stdout, lines } = createMockStdout()
		const emitter = new JsonEventEmitter({ mode: "stream-json", stdout })

		emitMessage(emitter, {
			ts: 10,
			type: "say",
			say: "api_req_started",
			partial: false,
			text: JSON.stringify({
				cost: 0.01,
				tokensIn: 100,
				tokensOut: 50,
				cacheWrites: 20,
				cacheReads: 10,
			}),
		} as ClineMessage)

		emitMessage(emitter, {
			ts: 11,
			type: "say",
			say: "api_req_started",
			partial: false,
			text: JSON.stringify({
				cost: 0.02,
				tokensIn: 25,
				tokensOut: 10,
				cacheWrites: 5,
				cacheReads: 2,
			}),
		} as ClineMessage)

		const completionMessage = createAskCompletionMessage(12, "done")
		emitTaskCompleted(emitter, {
			success: true,
			stateInfo: createCompletedStateInfo(completionMessage),
			message: completionMessage,
		})

		const result = lines().find((line) => line.type === "result")
		expect(result).toBeDefined()
		expect(result?.cost).toMatchObject({
			totalCost: 0.03,
			inputTokens: 125,
			outputTokens: 60,
			cacheWrites: 25,
			cacheReads: 12,
		})
	})

	it("captures cost from updated api_req_started messages with the same message id", () => {
		const { stdout, lines } = createMockStdout()
		const emitter = new JsonEventEmitter({ mode: "stream-json", stdout })

		// Placeholder message without final usage.
		emitMessage(emitter, {
			ts: 20,
			type: "say",
			say: "api_req_started",
			partial: false,
			text: JSON.stringify({ apiProtocol: "openai" }),
		} as ClineMessage)

		// Later update of the same message with finalized usage/cost.
		emitMessageUpdate(emitter, {
			ts: 20,
			type: "say",
			say: "api_req_started",
			partial: false,
			text: JSON.stringify({
				apiProtocol: "openai",
				cost: 0.004,
				tokensIn: 40,
				tokensOut: 10,
			}),
		} as ClineMessage)

		const completionMessage = createAskCompletionMessage(21, "done")
		emitTaskCompleted(emitter, {
			success: true,
			stateInfo: createCompletedStateInfo(completionMessage),
			message: completionMessage,
		})

		const result = lines().find((line) => line.type === "result")
		expect(result?.cost).toMatchObject({
			totalCost: 0.004,
			inputTokens: 40,
			outputTokens: 10,
		})
	})

	it("prefers current completion message content over stale cached completion text", () => {
		const { stdout, lines } = createMockStdout()
		const emitter = new JsonEventEmitter({ mode: "stream-json", stdout })

		emitMessage(emitter, {
			ts: 100,
			type: "say",
			say: "completion_result",
			partial: false,
			text: "FIRST",
		} as ClineMessage)

		const firstCompletionMessage = createAskCompletionMessage(101, "")
		emitTaskCompleted(emitter, {
			success: true,
			stateInfo: createCompletedStateInfo(firstCompletionMessage),
			message: firstCompletionMessage,
		})

		const secondCompletionMessage = createAskCompletionMessage(102, "SECOND")
		emitTaskCompleted(emitter, {
			success: true,
			stateInfo: createCompletedStateInfo(secondCompletionMessage),
			message: secondCompletionMessage,
		})

		const output = lines().filter((line) => line.type === "result")
		expect(output).toHaveLength(2)
		expect(output[0]?.content).toBe("FIRST")
		expect(output[1]?.content).toBe("SECOND")
	})

	it("clears cached completion text after each result emission", () => {
		const { stdout, lines } = createMockStdout()
		const emitter = new JsonEventEmitter({ mode: "stream-json", stdout })

		emitMessage(emitter, {
			ts: 200,
			type: "say",
			say: "completion_result",
			partial: false,
			text: "FIRST",
		} as ClineMessage)

		const firstCompletionMessage = createAskCompletionMessage(201, "")
		emitTaskCompleted(emitter, {
			success: true,
			stateInfo: createCompletedStateInfo(firstCompletionMessage),
			message: firstCompletionMessage,
		})

		const secondCompletionMessage = createAskCompletionMessage(202, "")
		emitTaskCompleted(emitter, {
			success: true,
			stateInfo: createCompletedStateInfo(secondCompletionMessage),
			message: secondCompletionMessage,
		})

		const output = lines().filter((line) => line.type === "result")
		expect(output).toHaveLength(2)
		expect(output[0]?.content).toBe("FIRST")
		expect(output[1]).not.toHaveProperty("content")
		expect(output[1]).not.toHaveProperty("cost")
	})
})
