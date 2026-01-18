import { useUIStateStore } from "../stores/uiStateStore.js"

describe("useUIStateStore", () => {
	beforeEach(() => {
		// Reset store to initial state before each test
		useUIStateStore.getState().resetUIState()
	})

	describe("initialState", () => {
		it("should have isCancelling set to false initially", () => {
			const state = useUIStateStore.getState()
			expect(state.isCancelling).toBe(false)
		})

		it("should have showExitHint set to false initially", () => {
			const state = useUIStateStore.getState()
			expect(state.showExitHint).toBe(false)
		})

		it("should have pendingExit set to false initially", () => {
			const state = useUIStateStore.getState()
			expect(state.pendingExit).toBe(false)
		})

		it("should have showTodoViewer set to false initially", () => {
			const state = useUIStateStore.getState()
			expect(state.showTodoViewer).toBe(false)
		})
	})

	describe("setIsCancelling", () => {
		it("should set isCancelling to true", () => {
			useUIStateStore.getState().setIsCancelling(true)
			expect(useUIStateStore.getState().isCancelling).toBe(true)
		})

		it("should set isCancelling to false", () => {
			useUIStateStore.getState().setIsCancelling(true)
			useUIStateStore.getState().setIsCancelling(false)
			expect(useUIStateStore.getState().isCancelling).toBe(false)
		})
	})

	describe("resetUIState", () => {
		it("should reset isCancelling to false", () => {
			useUIStateStore.getState().setIsCancelling(true)
			useUIStateStore.getState().resetUIState()
			expect(useUIStateStore.getState().isCancelling).toBe(false)
		})

		it("should reset all UI state to initial values", () => {
			// Set some state first
			const store = useUIStateStore.getState()
			store.setShowExitHint(true)
			store.setPendingExit(true)
			store.setIsCancelling(true)
			store.setCountdownSeconds(30)
			store.setShowCustomInput(true)
			store.setShowTodoViewer(true)

			// Reset
			useUIStateStore.getState().resetUIState()

			// Verify all state is reset
			const resetState = useUIStateStore.getState()
			expect(resetState.showExitHint).toBe(false)
			expect(resetState.pendingExit).toBe(false)
			expect(resetState.isCancelling).toBe(false)
			expect(resetState.countdownSeconds).toBeNull()
			expect(resetState.showCustomInput).toBe(false)
			expect(resetState.showTodoViewer).toBe(false)
		})
	})

	describe("task cancellation flow", () => {
		it("should allow setting isCancelling for the escape key spam protection", () => {
			const store = useUIStateStore.getState

			// Initially not cancelling
			expect(store().isCancelling).toBe(false)

			// First escape press sets cancelling to true
			store().setIsCancelling(true)
			expect(store().isCancelling).toBe(true)

			// Subsequent escape presses should be ignored while isCancelling is true
			// (this logic is in useGlobalInput, here we just verify the state holds)
			expect(store().isCancelling).toBe(true)

			// When task finishes cancelling (isLoading becomes false),
			// isCancelling is reset
			store().setIsCancelling(false)
			expect(store().isCancelling).toBe(false)
		})

		it("should allow reading isCancelling synchronously during input handling", () => {
			const store = useUIStateStore.getState

			// Set the flag
			store().setIsCancelling(true)

			// Simulate synchronous read during input handling
			const isCancelling = store().isCancelling
			expect(isCancelling).toBe(true)

			// The handler can use this to decide whether to send cancelTask
			if (isCancelling) {
				// Would show "Cancel in progress..." message
			} else {
				// Would send cancelTask and set isCancelling to true
			}

			// After task finishes, reset the flag
			store().setIsCancelling(false)
			expect(store().isCancelling).toBe(false)
		})
	})
})
