import { describe, it, expect } from "vitest"
import type { CondensationContext, CondensationOptions, CondensationResult, ICondensationProvider } from "../types"

describe("Condensation Types", () => {
	it("should have correct CondensationContext structure", () => {
		const context: CondensationContext = {
			messages: [],
			systemPrompt: "test",
			taskId: "task-1",
			prevContextTokens: 1000,
		}

		expect(context).toBeDefined()
		expect(context.messages).toEqual([])
	})

	it("should have correct CondensationOptions structure", () => {
		const options: CondensationOptions = {
			apiHandler: {} as any,
			isAutomaticTrigger: true,
		}

		expect(options).toBeDefined()
		expect(options.isAutomaticTrigger).toBe(true)
	})

	it("should have correct CondensationResult structure", () => {
		const result: CondensationResult = {
			messages: [],
			cost: 0.05,
			newContextTokens: 500,
		}

		expect(result).toBeDefined()
		expect(result.cost).toBe(0.05)
	})
})
