import { describe, it, expect, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { useState, useEffect, useCallback } from "react"

describe("React Hooks Testing", () => {
	beforeEach(() => {
		// Reset any global state if needed
	})

	it("should test useState hook with renderHook", () => {
		const { result } = renderHook(() => useState("initial"))

		expect(result.current[0]).toBe("initial")
		expect(typeof result.current[1]).toBe("function")
	})

	it("should test useEffect hook with renderHook", async () => {
		const effectFn = vi.fn()

		renderHook(() => {
			useEffect(() => {
				effectFn()
			}, [])
		})

		await waitFor(() => {
			expect(effectFn).toHaveBeenCalled()
		})
	})

	it("should test useCallback hook with renderHook", () => {
		const callbackFn = vi.fn()

		const { result } = renderHook(() => useCallback(callbackFn, []))

		expect(typeof result.current).toBe("function")
		result.current("test")
		expect(callbackFn).toHaveBeenCalledWith("test")
	})
})
