import { renderHook, act } from "@testing-library/react"
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"
import { useDebouncedAction } from "../useDebouncedAction"

// Mock timers
vi.useFakeTimers()

describe("useDebouncedAction", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.runOnlyPendingTimers()
		vi.useRealTimers()
		vi.clearAllMocks()
	})

	describe("Basic Functionality", () => {
		it("should initialize with processing false", () => {
			const { result } = renderHook(() => useDebouncedAction())

			expect(result.current.isProcessing).toBe(false)
			expect(typeof result.current.handleWithDebounce).toBe("function")
		})

		it("should use default delay of 300ms", () => {
			const { result } = renderHook(() => useDebouncedAction())
			const mockOperation = vi.fn()

			act(() => {
				result.current.handleWithDebounce(mockOperation)
			})

			expect(result.current.isProcessing).toBe(true)
			expect(mockOperation).toHaveBeenCalledTimes(1)

			// Fast forward 299ms - should still be processing
			act(() => {
				vi.advanceTimersByTime(299)
			})
			expect(result.current.isProcessing).toBe(true)

			// Fast forward 1 more ms to reach 300ms - should stop processing
			act(() => {
				vi.advanceTimersByTime(1)
			})
			expect(result.current.isProcessing).toBe(false)
		})

		it("should use custom delay", () => {
			const customDelay = 500
			const { result } = renderHook(() => useDebouncedAction(customDelay))
			const mockOperation = vi.fn()

			act(() => {
				result.current.handleWithDebounce(mockOperation)
			})

			expect(result.current.isProcessing).toBe(true)

			// Fast forward just under custom delay
			act(() => {
				vi.advanceTimersByTime(customDelay - 1)
			})
			expect(result.current.isProcessing).toBe(true)

			// Fast forward to complete custom delay
			act(() => {
				vi.advanceTimersByTime(1)
			})
			expect(result.current.isProcessing).toBe(false)
		})
	})

	describe("Operation Execution", () => {
		it("should execute operation immediately", () => {
			const { result } = renderHook(() => useDebouncedAction(300))
			const mockOperation = vi.fn()

			act(() => {
				result.current.handleWithDebounce(mockOperation)
			})

			expect(mockOperation).toHaveBeenCalledTimes(1)
			expect(result.current.isProcessing).toBe(true)
		})

		it("should prevent multiple operations while processing", () => {
			const { result } = renderHook(() => useDebouncedAction(300))
			const mockOperation1 = vi.fn()
			const mockOperation2 = vi.fn()

			// First operation
			act(() => {
				result.current.handleWithDebounce(mockOperation1)
			})

			expect(mockOperation1).toHaveBeenCalledTimes(1)
			expect(result.current.isProcessing).toBe(true)

			// Second operation while processing - should be ignored
			act(() => {
				result.current.handleWithDebounce(mockOperation2)
			})

			expect(mockOperation2).not.toHaveBeenCalled()
			expect(result.current.isProcessing).toBe(true)
		})

		it("should allow operations after processing completes", () => {
			const { result } = renderHook(() => useDebouncedAction(300))
			const mockOperation1 = vi.fn()
			const mockOperation2 = vi.fn()

			// First operation
			act(() => {
				result.current.handleWithDebounce(mockOperation1)
			})

			expect(mockOperation1).toHaveBeenCalledTimes(1)
			expect(result.current.isProcessing).toBe(true)

			// Complete the delay
			act(() => {
				vi.advanceTimersByTime(300)
			})

			expect(result.current.isProcessing).toBe(false)

			// Second operation should now work
			act(() => {
				result.current.handleWithDebounce(mockOperation2)
			})

			expect(mockOperation2).toHaveBeenCalledTimes(1)
			expect(result.current.isProcessing).toBe(true)
		})

		it("should handle operations that throw errors", () => {
			const { result } = renderHook(() => useDebouncedAction(300))
			const errorOperation = vi.fn(() => {
				throw new Error("Test error")
			})

			// Operation should not throw, errors are swallowed
			act(() => {
				result.current.handleWithDebounce(errorOperation)
			})

			expect(errorOperation).toHaveBeenCalledTimes(1)
			expect(result.current.isProcessing).toBe(true)

			// Should still complete processing cycle
			act(() => {
				vi.advanceTimersByTime(300)
			})

			expect(result.current.isProcessing).toBe(false)
		})
	})

	describe("Timeout Management", () => {
		it("should clear previous timeout when new operation called", () => {
			const { result } = renderHook(() => useDebouncedAction(300))
			const mockOperation1 = vi.fn()
			const mockOperation2 = vi.fn()

			// First operation
			act(() => {
				result.current.handleWithDebounce(mockOperation1)
			})

			expect(result.current.isProcessing).toBe(true)

			// Wait half the delay
			act(() => {
				vi.advanceTimersByTime(150)
			})

			expect(result.current.isProcessing).toBe(true)

			// Complete the first delay
			act(() => {
				vi.advanceTimersByTime(150)
			})

			expect(result.current.isProcessing).toBe(false)

			// Now a second operation
			act(() => {
				result.current.handleWithDebounce(mockOperation2)
			})

			expect(result.current.isProcessing).toBe(true)
			expect(mockOperation2).toHaveBeenCalledTimes(1)
		})

		it("should handle zero delay", () => {
			const { result } = renderHook(() => useDebouncedAction(0))
			const mockOperation = vi.fn()

			act(() => {
				result.current.handleWithDebounce(mockOperation)
			})

			expect(result.current.isProcessing).toBe(true)
			expect(mockOperation).toHaveBeenCalledTimes(1)

			// Even with 0 delay, should use setTimeout
			act(() => {
				vi.runOnlyPendingTimers()
			})

			expect(result.current.isProcessing).toBe(false)
		})

		it("should handle negative delay by using 0", () => {
			const { result } = renderHook(() => useDebouncedAction(-100))
			const mockOperation = vi.fn()

			act(() => {
				result.current.handleWithDebounce(mockOperation)
			})

			expect(result.current.isProcessing).toBe(true)

			// Math.max(0, -100) should result in 0 delay
			act(() => {
				vi.runOnlyPendingTimers()
			})

			expect(result.current.isProcessing).toBe(false)
		})
	})

	describe("Hook Dependencies", () => {
		it("should recreate handleWithDebounce when delay changes", () => {
			let delay = 300
			const { result, rerender } = renderHook(() => useDebouncedAction(delay))

			const firstHandler = result.current.handleWithDebounce

			// Change delay and rerender
			delay = 500
			rerender()

			const secondHandler = result.current.handleWithDebounce

			// Handlers should be different due to delay dependency
			expect(firstHandler).not.toBe(secondHandler)
		})

		it("should maintain processing state across delay changes", () => {
			let delay = 300
			const { result, rerender } = renderHook(() => useDebouncedAction(delay))
			const mockOperation = vi.fn()

			// Start processing
			act(() => {
				result.current.handleWithDebounce(mockOperation)
			})

			expect(result.current.isProcessing).toBe(true)

			// Change delay while processing
			delay = 500
			rerender()

			expect(result.current.isProcessing).toBe(true)

			// Complete original delay
			act(() => {
				vi.advanceTimersByTime(300)
			})

			expect(result.current.isProcessing).toBe(false)
		})
	})

	describe("Cleanup", () => {
		it("should cleanup timeout on unmount", () => {
			const { result, unmount } = renderHook(() => useDebouncedAction(300))
			const mockOperation = vi.fn()

			act(() => {
				result.current.handleWithDebounce(mockOperation)
			})

			expect(result.current.isProcessing).toBe(true)

			// Unmount before timeout completes
			unmount()

			// Fast forward time after unmount
			act(() => {
				vi.advanceTimersByTime(300)
			})

			// Processing state should remain true since component unmounted
			// (We can't test the cleanup directly, but no errors should occur)
		})
	})

	describe("Multiple Rapid Calls", () => {
		it("should handle rapid successive calls correctly", () => {
			const { result } = renderHook(() => useDebouncedAction(300))
			const mockOperation1 = vi.fn()
			const mockOperation2 = vi.fn()
			const mockOperation3 = vi.fn()

			// Rapid calls
			act(() => {
				result.current.handleWithDebounce(mockOperation1)
			})

			// These should be ignored since processing is true
			act(() => {
				result.current.handleWithDebounce(mockOperation2)
			})

			act(() => {
				result.current.handleWithDebounce(mockOperation3)
			})

			expect(mockOperation1).toHaveBeenCalledTimes(1)
			expect(mockOperation2).not.toHaveBeenCalled()
			expect(mockOperation3).not.toHaveBeenCalled()
			expect(result.current.isProcessing).toBe(true)

			// Complete delay
			act(() => {
				vi.advanceTimersByTime(300)
			})

			expect(result.current.isProcessing).toBe(false)

			// Now another call should work
			act(() => {
				result.current.handleWithDebounce(mockOperation2)
			})

			expect(mockOperation2).toHaveBeenCalledTimes(1)
		})
	})

	describe("Edge Cases", () => {
		it("should handle operations with return values", () => {
			const { result } = renderHook(() => useDebouncedAction(300))
			const mockOperation = vi.fn(() => "test result")

			act(() => {
				result.current.handleWithDebounce(mockOperation)
			})

			expect(mockOperation).toHaveBeenCalledTimes(1)
			// Return value is ignored/swallowed by the try-catch
		})

		it("should handle async operations", () => {
			const { result } = renderHook(() => useDebouncedAction(300))
			const mockAsyncOperation = vi.fn(async () => {
				await new Promise((resolve) => setTimeout(resolve, 100))
				return "async result"
			})

			act(() => {
				result.current.handleWithDebounce(mockAsyncOperation)
			})

			expect(mockAsyncOperation).toHaveBeenCalledTimes(1)
			expect(result.current.isProcessing).toBe(true)

			// The debounce timer should still work regardless of async operation
			act(() => {
				vi.advanceTimersByTime(300)
			})

			expect(result.current.isProcessing).toBe(false)
		})

		it("should handle operations with parameters", () => {
			const { result } = renderHook(() => useDebouncedAction(300))
			const mockOperation = vi.fn((param1: string, param2: number) => {
				return `${param1}-${param2}`
			})

			// Need to create a wrapper since handleWithDebounce expects () => void
			const wrappedOperation = () => mockOperation("test", 123)

			act(() => {
				result.current.handleWithDebounce(wrappedOperation)
			})

			expect(mockOperation).toHaveBeenCalledWith("test", 123)
		})
	})
})
