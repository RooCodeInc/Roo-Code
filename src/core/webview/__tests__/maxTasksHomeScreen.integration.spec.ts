import { describe, it, expect } from "vitest"
import type { ExtensionState } from "../../../shared/ExtensionMessage"

/**
 * Integration test for maxTasksHomeScreen setting
 * This test verifies that the setting is properly typed in ExtensionState
 */
describe("maxTasksHomeScreen integration", () => {
	it("should be a valid ExtensionState property", () => {
		// Type-level test: This will fail to compile if maxTasksHomeScreen is not in ExtensionState
		const state: Partial<ExtensionState> = {
			maxTasksHomeScreen: 10,
		}

		expect(state.maxTasksHomeScreen).toBe(10)
	})

	it("should accept valid range values", () => {
		const validValues = [0, 4, 10, 15, 20]

		validValues.forEach((value) => {
			const state: Partial<ExtensionState> = {
				maxTasksHomeScreen: value,
			}
			expect(state.maxTasksHomeScreen).toBe(value)
		})
	})
})
