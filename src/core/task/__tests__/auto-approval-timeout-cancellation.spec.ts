import { Task } from "../Task"

// Mock checkAutoApproval to return a "timeout" decision, simulating a followup
// with auto-approve enabled and a configured countdown.
vi.mock("../../auto-approval", () => ({
	checkAutoApproval: vi.fn(),
	AutoApprovalHandler: vi.fn(),
}))

import { checkAutoApproval } from "../../auto-approval"

const mockedCheckAutoApproval = vi.mocked(checkAutoApproval)

/**
 * Regression test for the auto-approval countdown desynchronization bug.
 *
 * Scenario:
 *   1. A followup ask is presented with auto-approve enabled and a 60s timeout.
 *   2. The UI countdown starts and the backend setTimeout is scheduled.
 *   3. User disables auto-approve while the countdown is running.
 *   4. The UI countdown stops (FollowUpSuggest clears its interval).
 *   5. ~40s later, the backend setTimeout fires and auto-selects an option.
 *
 * Root cause (two-timer split):
 *   - UI countdown: setInterval in FollowUpSuggest.tsx (visual only).
 *   - Auto-select: setTimeout in Task.ts (commits the choice).
 *   - Disabling auto-approve stopped the UI timer but did NOT cancel the
 *     backend setTimeout, and the callback did NOT re-check autoApprovalEnabled.
 *
 * Fix (three parts):
 *   A. webviewMessageHandler cancels timeout when autoApprovalEnabled toggled off.
 *   B. Task.ts timeout callback re-checks autoApprovalEnabled (defensive gate).
 *   C. ChatView wires onFollowUpUnmount to ChatRow so FollowUpSuggest cleanup
 *      actually sends the cancelAutoApproval message.
 */
describe("Auto-approval timeout cancellation", () => {
	// Provider mock that returns mutable state (auto-approval can be toggled)
	let mockAutoApprovalEnabled: boolean
	const mockProvider = {
		getState: vi.fn(async () => ({
			autoApprovalEnabled: mockAutoApprovalEnabled,
		})),
		postStateToWebview: vi.fn(async () => {}),
	}

	async function buildTask(): Promise<Task> {
		const task = Object.create(Task.prototype) as Task
		;(task as any).abort = false
		;(task as any).clineMessages = []
		;(task as any).askResponse = undefined
		;(task as any).askResponseText = undefined
		;(task as any).askResponseImages = undefined
		;(task as any).lastMessageTs = undefined
		;(task as any).autoApprovalTimeoutRef = undefined
		;(task as any).providerRef = { deref: () => mockProvider }

		const { MessageQueueService } = await import("../../message-queue/MessageQueueService")
		;(task as any).messageQueueService = new MessageQueueService()

		;(task as any).addToClineMessages = vi.fn(async () => {})
		;(task as any).saveClineMessages = vi.fn(async () => {})
		;(task as any).updateClineMessage = vi.fn(async () => {})
		;(task as any).checkpointSave = vi.fn(async () => {})
		;(task as any).emit = vi.fn()
		;(task as any).findMessageByTimestamp = vi.fn(() => undefined)
		return task
	}

	beforeEach(() => {
		vi.clearAllMocks()
		vi.useFakeTimers()
		mockAutoApprovalEnabled = true
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("should NOT auto-select when cancelAutoApprovalTimeout() is called before the timeout fires", async () => {
		const task = await buildTask()

		const autoSelectFn = vi.fn(() => ({
			askResponse: "messageResponse" as const,
			text: "auto-selected answer",
		}))

		mockedCheckAutoApproval.mockResolvedValue({
			decision: "timeout",
			timeout: 60_000,
			fn: autoSelectFn,
		})

		// Start the ask -- it will block on pWaitFor internally
		const askPromise = task.ask("followup", '{"suggest":[{"answer":"yes"}]}', false)

		// Let the initial async setup of ask() complete (checkAutoApproval, setTimeout scheduling)
		await vi.advanceTimersByTimeAsync(0)

		// 5 seconds pass -- user is watching countdown
		await vi.advanceTimersByTimeAsync(5_000)
		expect(autoSelectFn).not.toHaveBeenCalled()

		// User disables auto-approve --> extension host calls cancelAutoApprovalTimeout()
		task.cancelAutoApprovalTimeout()

		// Advance well past the original 60s deadline
		await vi.advanceTimersByTimeAsync(120_000)

		// The auto-select function must NOT have been called
		expect(autoSelectFn).not.toHaveBeenCalled()

		// Resolve the ask by simulating a manual user response.
		// handleWebviewAskResponse sets askResponse without changing lastMessageTs,
		// so pWaitFor resolves and the result is NOT "superseded".
		task.handleWebviewAskResponse("messageResponse", "manual response")

		// Advance to let pWaitFor poll (100ms interval) detect the response
		await vi.advanceTimersByTimeAsync(200)

		const result = await askPromise
		expect(result.response).toBe("messageResponse")
		expect(result.text).toBe("manual response")
	})

	it("should NOT auto-select when auto-approve is disabled after timeout fires (defensive gate)", async () => {
		const task = await buildTask()

		const autoSelectFn = vi.fn(() => ({
			askResponse: "messageResponse" as const,
			text: "auto-selected answer",
		}))

		mockedCheckAutoApproval.mockResolvedValue({
			decision: "timeout",
			timeout: 10_000, // shorter timeout for this test
			fn: autoSelectFn,
		})

		const askPromise = task.ask("followup", '{"suggest":[{"answer":"yes"}]}', false)
		await vi.advanceTimersByTimeAsync(0)

		// User disables auto-approve (state change) but does NOT call
		// cancelAutoApprovalTimeout -- simulating the pre-fix scenario where
		// the cancellation message was never sent.
		mockAutoApprovalEnabled = false

		// Advance past the timeout -- the callback fires but the defensive gate
		// calls getState() and sees autoApprovalEnabled=false.
		await vi.advanceTimersByTimeAsync(10_000)

		// Flush microtasks to let the async gate (getState) resolve
		await vi.advanceTimersByTimeAsync(0)

		// The auto-select function must NOT have been called
		expect(autoSelectFn).not.toHaveBeenCalled()

		// Provider.getState should have been called by the defensive gate
		expect(mockProvider.getState).toHaveBeenCalled()

		// Resolve the ask manually
		task.handleWebviewAskResponse("messageResponse", "manual response")
		await vi.advanceTimersByTimeAsync(200)

		const result = await askPromise
		expect(result.response).toBe("messageResponse")
		expect(result.text).toBe("manual response")
	})

	it("should NOT auto-select when the ask has been superseded by a newer message", async () => {
		const task = await buildTask()

		const autoSelectFn = vi.fn(() => ({
			askResponse: "messageResponse" as const,
			text: "auto-selected answer",
		}))

		mockedCheckAutoApproval.mockResolvedValue({
			decision: "timeout",
			timeout: 10_000,
			fn: autoSelectFn,
		})

		const askPromise = task.ask("followup", '{"suggest":[{"answer":"yes"}]}', false)

		// Attach rejection handler BEFORE advancing timers to prevent
		// "unhandled rejection" warning when pWaitFor resolves during advancement.
		const rejectionPromise = askPromise.catch((err) => err)

		await vi.advanceTimersByTimeAsync(0)

		// Simulate a new message arriving, which updates lastMessageTs.
		// This makes the scheduled ask "stale". Use lastMessageTs + 1 to
		// deterministically differ from the captured scheduledAskTs.
		;(task as any).lastMessageTs = (task as any).lastMessageTs + 1

		// Auto-approve is still enabled
		mockAutoApprovalEnabled = true

		// Advance past the timeout
		await vi.advanceTimersByTimeAsync(10_000)
		await vi.advanceTimersByTimeAsync(0)

		// The auto-select function must NOT have been called (stale ask)
		expect(autoSelectFn).not.toHaveBeenCalled()

		// The pWaitFor resolved because lastMessageTs !== askTs, causing
		// ask() to throw AskIgnoredError("superseded").
		const error = await rejectionPromise
		expect(error).toBeDefined()
		expect(error.message).toMatch(/superseded/)
	})

	it("should auto-select when conditions are still valid at timeout", async () => {
		const task = await buildTask()

		const autoSelectFn = vi.fn(() => ({
			askResponse: "messageResponse" as const,
			text: "auto-selected answer",
		}))

		mockedCheckAutoApproval.mockResolvedValue({
			decision: "timeout",
			timeout: 5_000,
			fn: autoSelectFn,
		})

		const askPromise = task.ask("followup", '{"suggest":[{"answer":"yes"}]}', false)
		await vi.advanceTimersByTimeAsync(0)

		// Auto-approve still enabled, no superseding message
		mockAutoApprovalEnabled = true

		// Advance past the timeout -- callback fires, gate passes, auto-selects
		await vi.advanceTimersByTimeAsync(5_000)

		// Flush microtasks for the async gate
		await vi.advanceTimersByTimeAsync(0)

		// The auto-select function SHOULD have been called
		expect(autoSelectFn).toHaveBeenCalledOnce()

		// Let pWaitFor poll detect the response
		await vi.advanceTimersByTimeAsync(200)

		const result = await askPromise
		expect(result.response).toBe("messageResponse")
		expect(result.text).toBe("auto-selected answer")
	})
})
