/**
 * Prompt State Machine Unit Tests
 *
 * Tests for the PromptStateMachine class.
 */

import { PromptStateMachine, createPromptStateMachine } from "../prompt-state.js"

describe("PromptStateMachine", () => {
	describe("initial state", () => {
		it("should start in idle state", () => {
			const sm = new PromptStateMachine()
			expect(sm.getState()).toBe("idle")
		})

		it("should have null abort signal initially", () => {
			const sm = new PromptStateMachine()
			expect(sm.getAbortSignal()).toBeNull()
		})

		it("should have null prompt text initially", () => {
			const sm = new PromptStateMachine()
			expect(sm.getCurrentPromptText()).toBeNull()
		})
	})

	describe("canStartPrompt", () => {
		it("should return true when idle", () => {
			const sm = new PromptStateMachine()
			expect(sm.canStartPrompt()).toBe(true)
		})

		it("should return false when processing", async () => {
			const sm = new PromptStateMachine()
			sm.startPrompt("test")

			expect(sm.canStartPrompt()).toBe(false)

			// Clean up
			sm.complete(true)
		})
	})

	describe("isProcessing", () => {
		it("should return false when idle", () => {
			const sm = new PromptStateMachine()
			expect(sm.isProcessing()).toBe(false)
		})

		it("should return true when processing", () => {
			const sm = new PromptStateMachine()
			sm.startPrompt("test")

			expect(sm.isProcessing()).toBe(true)

			// Clean up
			sm.complete(true)
		})

		it("should return false after completion", () => {
			const sm = new PromptStateMachine()
			sm.startPrompt("test")
			sm.complete(true)

			expect(sm.isProcessing()).toBe(false)
		})
	})

	describe("startPrompt", () => {
		it("should transition to processing state", () => {
			const sm = new PromptStateMachine()
			sm.startPrompt("test prompt")

			expect(sm.getState()).toBe("processing")

			// Clean up
			sm.complete(true)
		})

		it("should store the prompt text", () => {
			const sm = new PromptStateMachine()
			sm.startPrompt("my test prompt")

			expect(sm.getCurrentPromptText()).toBe("my test prompt")

			// Clean up
			sm.complete(true)
		})

		it("should create abort signal", () => {
			const sm = new PromptStateMachine()
			sm.startPrompt("test")

			expect(sm.getAbortSignal()).not.toBeNull()
			expect(sm.getAbortSignal()?.aborted).toBe(false)

			// Clean up
			sm.complete(true)
		})

		it("should return a promise", () => {
			const sm = new PromptStateMachine()
			const promise = sm.startPrompt("test")

			expect(promise).toBeInstanceOf(Promise)

			// Clean up
			sm.complete(true)
		})

		it("should resolve with end_turn on successful completion", async () => {
			const sm = new PromptStateMachine()
			const promise = sm.startPrompt("test")

			sm.complete(true)
			const result = await promise

			expect(result.stopReason).toBe("end_turn")
		})

		it("should resolve with refusal on failed completion", async () => {
			const sm = new PromptStateMachine()
			const promise = sm.startPrompt("test")

			sm.complete(false)
			const result = await promise

			expect(result.stopReason).toBe("refusal")
		})

		it("should resolve with cancelled on cancel", async () => {
			const sm = new PromptStateMachine()
			const promise = sm.startPrompt("test")

			sm.cancel()
			const result = await promise

			expect(result.stopReason).toBe("cancelled")
		})

		it("should cancel existing prompt if called while processing", async () => {
			const sm = new PromptStateMachine()
			const promise1 = sm.startPrompt("first prompt")

			// Start a second prompt (should cancel first)
			sm.startPrompt("second prompt")

			// First promise should resolve with cancelled
			const result1 = await promise1
			expect(result1.stopReason).toBe("cancelled")

			// Clean up
			sm.complete(true)
		})
	})

	describe("complete", () => {
		it("should transition to idle state", () => {
			const sm = new PromptStateMachine()
			sm.startPrompt("test")
			sm.complete(true)

			expect(sm.getState()).toBe("idle")
		})

		it("should return end_turn for success", () => {
			const sm = new PromptStateMachine()
			sm.startPrompt("test")

			const stopReason = sm.complete(true)
			expect(stopReason).toBe("end_turn")
		})

		it("should return refusal for failure", () => {
			const sm = new PromptStateMachine()
			sm.startPrompt("test")

			const stopReason = sm.complete(false)
			expect(stopReason).toBe("refusal")
		})

		it("should clear prompt text", () => {
			const sm = new PromptStateMachine()
			sm.startPrompt("test")
			sm.complete(true)

			expect(sm.getCurrentPromptText()).toBeNull()
		})

		it("should clear abort controller", () => {
			const sm = new PromptStateMachine()
			sm.startPrompt("test")
			sm.complete(true)

			expect(sm.getAbortSignal()).toBeNull()
		})

		it("should be idempotent (multiple calls ignored)", () => {
			const sm = new PromptStateMachine()
			sm.startPrompt("test")

			const result1 = sm.complete(true)
			const result2 = sm.complete(false) // Should be ignored

			expect(result1).toBe("end_turn")
			expect(result2).toBe("refusal") // Returns mapped value but doesn't change state
			expect(sm.getState()).toBe("idle")
		})
	})

	describe("cancel", () => {
		it("should abort the signal", () => {
			const sm = new PromptStateMachine()
			sm.startPrompt("test")
			const signal = sm.getAbortSignal()

			sm.cancel()

			expect(signal?.aborted).toBe(true)
		})

		it("should transition to idle state", async () => {
			const sm = new PromptStateMachine()
			const promise = sm.startPrompt("test")

			sm.cancel()
			await promise

			expect(sm.getState()).toBe("idle")
		})

		it("should be safe to call when idle", () => {
			const sm = new PromptStateMachine()

			// Should not throw
			expect(() => sm.cancel()).not.toThrow()
			expect(sm.getState()).toBe("idle")
		})

		it("should be idempotent (multiple calls safe)", () => {
			const sm = new PromptStateMachine()
			sm.startPrompt("test")

			sm.cancel()
			sm.cancel() // Should not throw

			expect(sm.getState()).toBe("idle")
		})
	})

	describe("reset", () => {
		it("should transition to idle state", () => {
			const sm = new PromptStateMachine()
			sm.startPrompt("test")
			sm.reset()

			expect(sm.getState()).toBe("idle")
		})

		it("should clear prompt text", () => {
			const sm = new PromptStateMachine()
			sm.startPrompt("test")
			sm.reset()

			expect(sm.getCurrentPromptText()).toBeNull()
		})

		it("should clear abort controller", () => {
			const sm = new PromptStateMachine()
			sm.startPrompt("test")
			sm.reset()

			expect(sm.getAbortSignal()).toBeNull()
		})

		it("should abort any pending operation", () => {
			const sm = new PromptStateMachine()
			sm.startPrompt("test")
			const signal = sm.getAbortSignal()

			sm.reset()

			expect(signal?.aborted).toBe(true)
		})

		it("should be safe to call when idle", () => {
			const sm = new PromptStateMachine()

			expect(() => sm.reset()).not.toThrow()
			expect(sm.getState()).toBe("idle")
		})
	})

	describe("abort signal integration", () => {
		it("should trigger abort handler on cancel", async () => {
			const sm = new PromptStateMachine()
			const promise = sm.startPrompt("test")

			let abortHandlerCalled = false
			sm.getAbortSignal()?.addEventListener("abort", () => {
				abortHandlerCalled = true
			})

			sm.cancel()
			await promise

			expect(abortHandlerCalled).toBe(true)
		})

		it("should resolve promise via abort handler", async () => {
			const sm = new PromptStateMachine()
			const promise = sm.startPrompt("test")

			sm.cancel()
			const result = await promise

			expect(result.stopReason).toBe("cancelled")
		})
	})

	describe("lifecycle scenarios", () => {
		it("should handle multiple prompt cycles", async () => {
			const sm = new PromptStateMachine()

			// First cycle
			const promise1 = sm.startPrompt("prompt 1")
			expect(sm.isProcessing()).toBe(true)
			sm.complete(true)
			const result1 = await promise1
			expect(result1.stopReason).toBe("end_turn")
			expect(sm.isProcessing()).toBe(false)

			// Second cycle
			const promise2 = sm.startPrompt("prompt 2")
			expect(sm.isProcessing()).toBe(true)
			expect(sm.getCurrentPromptText()).toBe("prompt 2")
			sm.complete(false)
			const result2 = await promise2
			expect(result2.stopReason).toBe("refusal")

			// Third cycle with cancellation
			const promise3 = sm.startPrompt("prompt 3")
			sm.cancel()
			const result3 = await promise3
			expect(result3.stopReason).toBe("cancelled")
		})

		it("should handle rapid start/cancel cycles", async () => {
			const sm = new PromptStateMachine()

			const promises: Promise<{ stopReason: string }>[] = []

			for (let i = 0; i < 5; i++) {
				const promise = sm.startPrompt(`prompt ${i}`)
				promises.push(promise)
				sm.cancel()
			}

			// All should resolve with cancelled
			const results = await Promise.all(promises)
			expect(results.every((r) => r.stopReason === "cancelled")).toBe(true)
		})
	})
})

describe("createPromptStateMachine", () => {
	it("should create a new state machine", () => {
		const sm = createPromptStateMachine()

		expect(sm).toBeInstanceOf(PromptStateMachine)
		expect(sm.getState()).toBe("idle")
	})
})
