import { renderHook } from "@testing-library/react"
import React, { ReactNode } from "react"
import { DismissedUpsellsProvider } from "@src/context/DismissedUpsellsContext"
import {
	useUpsellVisibility,
	useMultipleUpsellVisibility,
	useAnyUpsellVisible,
	useAllUpsellsVisible,
	useUpsellManager,
} from "../useUpsellVisibility"
import { UPSELL_IDS } from "@src/constants/upsellIds"
import { act } from "@testing-library/react"

// Mock vscode
vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

describe("useUpsellVisibility hooks", () => {
	let messageHandler: ((event: MessageEvent) => void) | null = null

	const wrapper = ({ children }: { children: ReactNode }) => (
		<DismissedUpsellsProvider>{children}</DismissedUpsellsProvider>
	)

	beforeEach(() => {
		vi.clearAllMocks()

		// Capture the message event handler
		window.addEventListener = vi.fn((event, handler) => {
			if (event === "message") {
				messageHandler = handler as (event: MessageEvent) => void
			}
		})

		window.removeEventListener = vi.fn()
	})

	afterEach(() => {
		messageHandler = null
	})

	const sendDismissedList = (list: string[]) => {
		act(() => {
			messageHandler?.({
				data: {
					type: "dismissedUpsells",
					list,
				},
			} as MessageEvent)
		})
	}

	describe("useUpsellVisibility", () => {
		it("should return true when upsell is not dismissed", () => {
			const { result } = renderHook(() => useUpsellVisibility("test-upsell"), { wrapper })

			sendDismissedList([])

			expect(result.current).toBe(true)
		})

		it("should return false when upsell is dismissed", () => {
			const { result } = renderHook(() => useUpsellVisibility("test-upsell"), { wrapper })

			sendDismissedList(["test-upsell"])

			expect(result.current).toBe(false)
		})

		it("should work with UPSELL_IDS constants", () => {
			const { result } = renderHook(() => useUpsellVisibility(UPSELL_IDS.TASK_LIST), { wrapper })

			sendDismissedList([UPSELL_IDS.TASK_LIST])

			expect(result.current).toBe(false)
		})

		it("should update when dismissed list changes", () => {
			const { result } = renderHook(() => useUpsellVisibility("dynamic-upsell"), { wrapper })

			sendDismissedList([])
			expect(result.current).toBe(true)

			sendDismissedList(["dynamic-upsell"])
			expect(result.current).toBe(false)

			sendDismissedList([])
			expect(result.current).toBe(true)
		})
	})

	describe("useMultipleUpsellVisibility", () => {
		it("should return visibility status for multiple upsells", () => {
			const upsellIds = ["upsell-1", "upsell-2", "upsell-3"]
			const { result } = renderHook(() => useMultipleUpsellVisibility(upsellIds), { wrapper })

			sendDismissedList(["upsell-1", "upsell-3"])

			expect(result.current).toEqual({
				"upsell-1": false,
				"upsell-2": true,
				"upsell-3": false,
			})
		})

		it("should handle empty array", () => {
			const { result } = renderHook(() => useMultipleUpsellVisibility([]), { wrapper })

			sendDismissedList(["some-upsell"])

			expect(result.current).toEqual({})
		})

		it("should update when dismissed list changes", () => {
			const upsellIds = ["upsell-a", "upsell-b"]
			const { result } = renderHook(() => useMultipleUpsellVisibility(upsellIds), { wrapper })

			sendDismissedList([])
			expect(result.current).toEqual({
				"upsell-a": true,
				"upsell-b": true,
			})

			sendDismissedList(["upsell-a"])
			expect(result.current).toEqual({
				"upsell-a": false,
				"upsell-b": true,
			})
		})
	})

	describe("useAnyUpsellVisible", () => {
		it("should return true if at least one upsell is visible", () => {
			const upsellIds = ["upsell-1", "upsell-2", "upsell-3"]
			const { result } = renderHook(() => useAnyUpsellVisible(upsellIds), { wrapper })

			sendDismissedList(["upsell-1", "upsell-3"])

			expect(result.current).toBe(true)
		})

		it("should return false if all upsells are dismissed", () => {
			const upsellIds = ["upsell-1", "upsell-2", "upsell-3"]
			const { result } = renderHook(() => useAnyUpsellVisible(upsellIds), { wrapper })

			sendDismissedList(["upsell-1", "upsell-2", "upsell-3"])

			expect(result.current).toBe(false)
		})

		it("should return true if no upsells are dismissed", () => {
			const upsellIds = ["upsell-1", "upsell-2"]
			const { result } = renderHook(() => useAnyUpsellVisible(upsellIds), { wrapper })

			sendDismissedList([])

			expect(result.current).toBe(true)
		})

		it("should handle empty array", () => {
			const { result } = renderHook(() => useAnyUpsellVisible([]), { wrapper })

			sendDismissedList(["some-upsell"])

			expect(result.current).toBe(false)
		})
	})

	describe("useAllUpsellsVisible", () => {
		it("should return true if all upsells are visible", () => {
			const upsellIds = ["upsell-1", "upsell-2", "upsell-3"]
			const { result } = renderHook(() => useAllUpsellsVisible(upsellIds), { wrapper })

			sendDismissedList(["other-upsell"])

			expect(result.current).toBe(true)
		})

		it("should return false if at least one upsell is dismissed", () => {
			const upsellIds = ["upsell-1", "upsell-2", "upsell-3"]
			const { result } = renderHook(() => useAllUpsellsVisible(upsellIds), { wrapper })

			sendDismissedList(["upsell-2"])

			expect(result.current).toBe(false)
		})

		it("should return false if all upsells are dismissed", () => {
			const upsellIds = ["upsell-1", "upsell-2"]
			const { result } = renderHook(() => useAllUpsellsVisible(upsellIds), { wrapper })

			sendDismissedList(["upsell-1", "upsell-2"])

			expect(result.current).toBe(false)
		})

		it("should handle empty array", () => {
			const { result } = renderHook(() => useAllUpsellsVisible([]), { wrapper })

			sendDismissedList(["some-upsell"])

			expect(result.current).toBe(true)
		})
	})

	describe("useUpsellManager", () => {
		it("should provide dismissUpsell function", () => {
			const { result } = renderHook(() => useUpsellManager(), { wrapper })

			sendDismissedList([])

			act(() => {
				result.current.dismissUpsell("test-upsell")
			})

			expect(result.current.dismissedUpsells).toContain("test-upsell")
		})

		it("should provide dismissMultiple function", () => {
			const { result } = renderHook(() => useUpsellManager(), { wrapper })

			sendDismissedList([])

			act(() => {
				result.current.dismissMultiple(["upsell-1", "upsell-2", "upsell-3"])
			})

			expect(result.current.dismissedUpsells).toContain("upsell-1")
			expect(result.current.dismissedUpsells).toContain("upsell-2")
			expect(result.current.dismissedUpsells).toContain("upsell-3")
		})

		it("should provide getDismissedCount function", () => {
			const { result } = renderHook(() => useUpsellManager(), { wrapper })

			sendDismissedList(["upsell-1", "upsell-2"])

			expect(result.current.getDismissedCount()).toBe(2)
		})

		it("should provide dismissedUpsells array", () => {
			const { result } = renderHook(() => useUpsellManager(), { wrapper })

			sendDismissedList(["upsell-a", "upsell-b", "upsell-c"])

			expect(result.current.dismissedUpsells).toEqual(["upsell-a", "upsell-b", "upsell-c"])
		})

		it("should provide isLoading state", () => {
			const { result } = renderHook(() => useUpsellManager(), { wrapper })

			expect(result.current.isLoading).toBe(true)

			sendDismissedList([])

			expect(result.current.isLoading).toBe(false)
		})

		it("should log warning for clearAllDismissed", () => {
			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
			const { result } = renderHook(() => useUpsellManager(), { wrapper })

			act(() => {
				result.current.clearAllDismissed()
			})

			expect(consoleSpy).toHaveBeenCalledWith(
				"clearAllDismissed is not yet implemented. It requires extension-side support.",
			)

			consoleSpy.mockRestore()
		})

		it("should not dismiss same upsell multiple times", () => {
			const { result } = renderHook(() => useUpsellManager(), { wrapper })

			sendDismissedList([])

			// Dismiss once
			act(() => {
				result.current.dismissUpsell("test-upsell")
			})

			// Wait for the state to update
			expect(result.current.dismissedUpsells).toContain("test-upsell")

			// Try to dismiss again (should not add duplicate)
			act(() => {
				result.current.dismissUpsell("test-upsell")
			})

			const count = result.current.dismissedUpsells.filter((id) => id === "test-upsell").length
			expect(count).toBe(1)
		})
	})
})
