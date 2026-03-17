import {
	isCancellationLikeError,
	isExpectedControlFlowError,
	isNoActiveTaskLikeError,
	isStreamTeardownLikeError,
} from "../cancellation.js"

describe("isCancellationLikeError", () => {
	it("returns true for aborted error messages", () => {
		expect(isCancellationLikeError(new Error("[RooCode#say] task 123 aborted"))).toBe(true)
		expect(isCancellationLikeError("AbortError: operation aborted")).toBe(true)
	})

	it("returns true for abort/cancel error names and codes", () => {
		expect(isCancellationLikeError({ name: "AbortError", message: "stop now" })).toBe(true)
		expect(isCancellationLikeError({ code: "ABORT_ERR", message: "aborted" })).toBe(true)
		expect(isCancellationLikeError({ code: "ERR_CANCELED", message: "request failed" })).toBe(true)
	})

	it("returns true for canceled/cancelled error messages", () => {
		expect(isCancellationLikeError(new Error("Request canceled"))).toBe(true)
		expect(isCancellationLikeError(new Error("request cancelled by user"))).toBe(true)
	})

	it("returns false for non-cancellation errors", () => {
		expect(isCancellationLikeError(new Error("network timeout"))).toBe(false)
		expect(isCancellationLikeError("validation failed")).toBe(false)
	})
})

describe("isNoActiveTaskLikeError", () => {
	it("matches task-settled cancel race messages", () => {
		expect(isNoActiveTaskLikeError(new Error("no active task to cancel"))).toBe(true)
		expect(isNoActiveTaskLikeError(new Error("task not found"))).toBe(true)
		expect(isNoActiveTaskLikeError("already completed")).toBe(true)
	})

	it("does not match unrelated messages", () => {
		expect(isNoActiveTaskLikeError("network timeout")).toBe(false)
	})
})

describe("isStreamTeardownLikeError", () => {
	it("matches common stream teardown errors", () => {
		expect(isStreamTeardownLikeError({ code: "EPIPE", message: "broken pipe" })).toBe(true)
		expect(isStreamTeardownLikeError({ code: "ERR_STREAM_DESTROYED", message: "stream destroyed" })).toBe(true)
		expect(isStreamTeardownLikeError(new Error("write after end"))).toBe(true)
	})

	it("does not match unrelated stream errors", () => {
		expect(isStreamTeardownLikeError(new Error("permission denied"))).toBe(false)
	})
})

describe("isExpectedControlFlowError", () => {
	it("returns false when not in stdin stream mode", () => {
		expect(
			isExpectedControlFlowError(new Error("AbortError: aborted"), {
				stdinStreamMode: false,
				operation: "runtime",
			}),
		).toBe(false)
	})

	it("accepts cancellation-like runtime errors in stdin stream mode", () => {
		expect(
			isExpectedControlFlowError(new Error("AbortError: aborted"), {
				stdinStreamMode: true,
				operation: "runtime",
			}),
		).toBe(true)
	})

	it("accepts no-active-task races for cancel operations", () => {
		expect(
			isExpectedControlFlowError(new Error("task not found"), {
				stdinStreamMode: true,
				operation: "cancel",
			}),
		).toBe(true)
	})

	it("accepts stream teardown errors during shutdown", () => {
		expect(
			isExpectedControlFlowError(
				{ code: "EPIPE", message: "broken pipe" },
				{
					stdinStreamMode: true,
					shuttingDown: true,
					operation: "runtime",
				},
			),
		).toBe(true)
	})

	it("rejects unrelated errors", () => {
		expect(
			isExpectedControlFlowError(new Error("authentication failed"), {
				stdinStreamMode: true,
				operation: "runtime",
			}),
		).toBe(false)
	})
})
