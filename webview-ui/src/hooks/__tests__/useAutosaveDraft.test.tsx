import { renderHook, act } from "@testing-library/react"
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"
import { useAutosaveDraft } from "../useAutosaveDraft"

// Mock localStorage
const localStorageMock = {
	getItem: vi.fn(),
	setItem: vi.fn(),
	removeItem: vi.fn(),
	clear: vi.fn(),
}
Object.defineProperty(window, "localStorage", { value: localStorageMock })

describe("useAutosaveDraft", () => {
	beforeEach(() => {
		localStorageMock.getItem.mockClear()
		localStorageMock.setItem.mockClear()
		localStorageMock.removeItem.mockClear()
		localStorageMock.clear.mockClear()
		vi.clearAllTimers()
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.runOnlyPendingTimers()
		vi.useRealTimers()
	})

	describe("Initialization", () => {
		it("should initialize with empty content when no saved draft exists", () => {
			localStorageMock.getItem.mockReturnValue(null)

			const { result } = renderHook(() => useAutosaveDraft({ key: "test-conversation" }))

			expect(result.current.draftContent).toBe("")
			expect(result.current.hasInitialDraft).toBe(false)
			expect(result.current.isDebouncing).toBe(false)
			expect(localStorageMock.getItem).toHaveBeenCalledWith("roo-draft.test-conversation")
		})

		it("should restore saved draft on initialization", () => {
			localStorageMock.getItem.mockReturnValue("Saved content")

			const { result } = renderHook(() => useAutosaveDraft({ key: "test-conversation" }))

			expect(result.current.draftContent).toBe("Saved content")
			expect(result.current.hasInitialDraft).toBe(true)
			expect(localStorageMock.getItem).toHaveBeenCalledWith("roo-draft.test-conversation")
		})

		it("should ignore empty or whitespace-only drafts during restoration", () => {
			localStorageMock.getItem.mockReturnValue("   ")

			const { result } = renderHook(() => useAutosaveDraft({ key: "test-conversation" }))

			expect(result.current.draftContent).toBe("")
			expect(result.current.hasInitialDraft).toBe(false)
		})

		it("should use custom storage prefix when provided", () => {
			localStorageMock.getItem.mockReturnValue(null)

			renderHook(() =>
				useAutosaveDraft({
					key: "test-conversation",
					storagePrefix: "custom-prefix",
				}),
			)

			expect(localStorageMock.getItem).toHaveBeenCalledWith("custom-prefix.test-conversation")
		})
	})

	describe("Draft Updates", () => {
		it("should update draft content immediately", () => {
			const { result } = renderHook(() => useAutosaveDraft({ key: "test", debounceMs: 500 }))

			act(() => {
				result.current.updateDraft("New content")
			})

			expect(result.current.draftContent).toBe("New content")
			expect(result.current.isDebouncing).toBe(true)
		})

		it("should debounce save operations", async () => {
			const { result } = renderHook(() => useAutosaveDraft({ key: "test", debounceMs: 500 }))

			act(() => {
				result.current.updateDraft("First update")
			})

			// Should not save immediately
			expect(localStorageMock.setItem).not.toHaveBeenCalled()
			expect(result.current.isDebouncing).toBe(true)

			// Fast-forward time
			act(() => {
				vi.advanceTimersByTime(500)
			})

			expect(localStorageMock.setItem).toHaveBeenCalledWith("roo-draft.test", "First update")
			expect(result.current.isDebouncing).toBe(false)
		})

		it("should reset debounce timer on multiple rapid updates", async () => {
			const { result } = renderHook(() => useAutosaveDraft({ key: "test", debounceMs: 500 }))

			act(() => {
				result.current.updateDraft("First update")
			})

			act(() => {
				vi.advanceTimersByTime(250)
			})

			act(() => {
				result.current.updateDraft("Second update")
			})

			// Should still not have saved after 250ms more (500ms total from first update)
			act(() => {
				vi.advanceTimersByTime(250)
			})

			expect(localStorageMock.setItem).not.toHaveBeenCalled()

			// Should save after another 250ms (500ms from second update)
			act(() => {
				vi.advanceTimersByTime(250)
			})

			expect(localStorageMock.setItem).toHaveBeenCalledWith("roo-draft.test", "Second update")
		})

		it("should remove empty content from localStorage", async () => {
			const { result } = renderHook(() => useAutosaveDraft({ key: "test", debounceMs: 100 }))

			act(() => {
				result.current.updateDraft("   ")
			})

			act(() => {
				vi.advanceTimersByTime(100)
			})

			expect(localStorageMock.removeItem).toHaveBeenCalledWith("roo-draft.test")
			expect(localStorageMock.setItem).not.toHaveBeenCalled()
		})
	})

	describe("Clear Draft", () => {
		it("should clear draft content and localStorage", () => {
			const { result } = renderHook(() => useAutosaveDraft({ key: "test" }))

			// Set some content first
			act(() => {
				result.current.updateDraft("Some content")
			})

			expect(result.current.draftContent).toBe("Some content")

			// Clear draft
			act(() => {
				result.current.clearDraft()
			})

			expect(result.current.draftContent).toBe("")
			expect(result.current.hasInitialDraft).toBe(false)
			expect(result.current.isDebouncing).toBe(false)
			expect(localStorageMock.removeItem).toHaveBeenCalledWith("roo-draft.test")
		})

		it("should cancel pending debounced saves when clearing", () => {
			const { result } = renderHook(() => useAutosaveDraft({ key: "test", debounceMs: 500 }))

			act(() => {
				result.current.updateDraft("Some content")
			})

			expect(result.current.isDebouncing).toBe(true)

			act(() => {
				result.current.clearDraft()
			})

			expect(result.current.isDebouncing).toBe(false)

			// Advance time - should not trigger save since timer was cleared
			act(() => {
				vi.advanceTimersByTime(500)
			})

			expect(localStorageMock.setItem).not.toHaveBeenCalled()
		})
	})

	describe("Error Handling", () => {
		it("should handle localStorage getItem errors gracefully", () => {
			localStorageMock.getItem.mockImplementation(() => {
				throw new Error("Storage unavailable")
			})

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			const { result } = renderHook(() => useAutosaveDraft({ key: "test" }))

			expect(result.current.draftContent).toBe("")
			expect(result.current.hasInitialDraft).toBe(false)
			expect(consoleSpy).toHaveBeenCalledWith(
				"[useAutosaveDraft] localStorage operation failed:",
				expect.any(Error),
			)

			consoleSpy.mockRestore()
		})

		it("should handle localStorage setItem errors gracefully", async () => {
			localStorageMock.setItem.mockImplementation(() => {
				throw new Error("Storage quota exceeded")
			})

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			const { result } = renderHook(() => useAutosaveDraft({ key: "test", debounceMs: 100 }))

			act(() => {
				result.current.updateDraft("Test content")
			})

			act(() => {
				vi.advanceTimersByTime(100)
			})

			expect(consoleSpy).toHaveBeenCalledWith(
				"[useAutosaveDraft] localStorage operation failed:",
				expect.any(Error),
			)

			consoleSpy.mockRestore()
		})

		it("should handle localStorage removeItem errors gracefully", () => {
			localStorageMock.removeItem.mockImplementation(() => {
				throw new Error("Storage error")
			})

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			const { result } = renderHook(() => useAutosaveDraft({ key: "test" }))

			act(() => {
				result.current.clearDraft()
			})

			expect(consoleSpy).toHaveBeenCalledWith(
				"[useAutosaveDraft] localStorage operation failed:",
				expect.any(Error),
			)

			consoleSpy.mockRestore()
		})
	})

	describe("Configuration Options", () => {
		it("should use custom debounce time", async () => {
			const { result } = renderHook(() => useAutosaveDraft({ key: "test", debounceMs: 1000 }))

			act(() => {
				result.current.updateDraft("Test content")
			})

			// Should not save after 500ms
			act(() => {
				vi.advanceTimersByTime(500)
			})

			expect(localStorageMock.setItem).not.toHaveBeenCalled()

			// Should save after 1000ms
			act(() => {
				vi.advanceTimersByTime(500)
			})

			expect(localStorageMock.setItem).toHaveBeenCalledWith("roo-draft.test", "Test content")
		})

		it("should work with different storage keys", () => {
			const { result: result1 } = renderHook(() => useAutosaveDraft({ key: "conversation-1" }))

			const { result: result2 } = renderHook(() => useAutosaveDraft({ key: "conversation-2" }))

			act(() => {
				result1.current.updateDraft("Content 1")
			})

			act(() => {
				result2.current.updateDraft("Content 2")
			})

			act(() => {
				vi.advanceTimersByTime(500)
			})

			expect(localStorageMock.setItem).toHaveBeenCalledWith("roo-draft.conversation-1", "Content 1")
			expect(localStorageMock.setItem).toHaveBeenCalledWith("roo-draft.conversation-2", "Content 2")
		})
	})

	describe("Cleanup", () => {
		it("should cleanup timers on unmount", () => {
			const { result, unmount } = renderHook(() => useAutosaveDraft({ key: "test", debounceMs: 500 }))

			act(() => {
				result.current.updateDraft("Test content")
			})

			expect(result.current.isDebouncing).toBe(true)

			unmount()

			// After unmount, advancing time should not trigger save
			act(() => {
				vi.advanceTimersByTime(500)
			})

			expect(localStorageMock.setItem).not.toHaveBeenCalled()
		})
	})

	describe("Real-world Usage Scenarios", () => {
		it("should handle conversation switching", () => {
			// Simulate switching between different conversations
			const { result, rerender } = renderHook(({ key }) => useAutosaveDraft({ key }), {
				initialProps: { key: "task-123" },
			})

			// Type in first conversation
			act(() => {
				result.current.updateDraft("Draft for task 123")
			})

			expect(result.current.draftContent).toBe("Draft for task 123")

			// Switch to different conversation
			rerender({ key: "task-456" })

			// Should start with empty content for new conversation
			expect(result.current.draftContent).toBe("")
			expect(result.current.hasInitialDraft).toBe(false)
		})

		it("should handle rapid typing simulation", async () => {
			const { result } = renderHook(() => useAutosaveDraft({ key: "test", debounceMs: 300 }))

			// Simulate rapid typing
			const updates = [
				"H",
				"He",
				"Hel",
				"Hell",
				"Hello",
				"Hello ",
				"Hello w",
				"Hello wo",
				"Hello wor",
				"Hello worl",
				"Hello world",
			]

			for (const update of updates) {
				act(() => {
					result.current.updateDraft(update)
				})
				// Small delay to simulate typing
				act(() => {
					vi.advanceTimersByTime(50)
				})
			}

			expect(result.current.draftContent).toBe("Hello world")
			expect(result.current.isDebouncing).toBe(true)

			// Should only save once after debounce period
			act(() => {
				vi.advanceTimersByTime(300)
			})

			expect(localStorageMock.setItem).toHaveBeenCalledTimes(1)
			expect(localStorageMock.setItem).toHaveBeenCalledWith("roo-draft.test", "Hello world")
		})

		it("should handle message send and clear workflow", async () => {
			const { result } = renderHook(() => useAutosaveDraft({ key: "test", debounceMs: 100 }))

			// Type a message
			act(() => {
				result.current.updateDraft("Hello, how can I help?")
			})

			expect(result.current.draftContent).toBe("Hello, how can I help?")

			// Simulate sending message (clear draft)
			act(() => {
				result.current.clearDraft()
			})

			expect(result.current.draftContent).toBe("")

			// Verify localStorage was cleaned up
			expect(localStorageMock.removeItem).toHaveBeenCalledWith("roo-draft.test")
		})
	})
})
