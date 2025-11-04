import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { ClineProvider } from "../ClineProvider"

describe("ClineProvider.cancelTask - schedules presentResumableAsk", () => {
	let provider: ClineProvider
	let mockTask: any

	beforeEach(() => {
		vi.useFakeTimers()
		// Create a bare instance without running constructor
		provider = Object.create(ClineProvider.prototype) as ClineProvider

		mockTask = {
			taskId: "task-1",
			instanceId: "inst-1",
			abortReason: undefined,
			abandoned: false,
			abortTask: vi.fn().mockResolvedValue(undefined),
			isStreaming: false,
			didFinishAbortingStream: true,
			isWaitingForFirstChunk: false,
			// Last api_req_started without cost/cancelReason so provider injects cancelReason
			clineMessages: [
				{ ts: Date.now() - 2000, type: "say", say: "text", text: "hello" },
				{ ts: Date.now() - 1000, type: "say", say: "api_req_started", text: JSON.stringify({}) },
			],
			overwriteClineMessages: vi.fn().mockResolvedValue(undefined),
			presentResumableAsk: vi.fn().mockResolvedValue(undefined),
		}

		// Patch required instance methods used by cancelTask
		;(provider as any).getCurrentTask = vi.fn().mockReturnValue(mockTask)
		;(provider as any).postStateToWebview = vi.fn().mockResolvedValue(undefined)
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("injects cancelReason and schedules presentResumableAsk on soft cancel", async () => {
		// Act
		await (provider as any).cancelTask()

		// Assert that abort was initiated
		expect(mockTask.abortTask).toHaveBeenCalledWith(false)

		// cancelReason injected for spinner stop
		const last = mockTask.clineMessages.at(-1)
		expect(last.say).toBe("api_req_started")
		const parsed = JSON.parse(last.text || "{}")
		expect(parsed.cancelReason).toBe("user_cancelled")

		// presentResumableAsk is scheduled via setImmediate
		expect(mockTask.presentResumableAsk).not.toHaveBeenCalled()
		vi.runAllTimers()
		// run microtasks as well to flush any pending promises in the scheduled callback
		await Promise.resolve()
		expect(mockTask.presentResumableAsk).toHaveBeenCalledTimes(1)
	})
})
