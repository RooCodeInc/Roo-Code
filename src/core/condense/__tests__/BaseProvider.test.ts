import { describe, it, expect, vi } from "vitest"
import { BaseCondensationProvider } from "../BaseProvider"
import type { CondensationContext, CondensationOptions, CondensationResult } from "../types"

// Concrete test implementation
class TestProvider extends BaseCondensationProvider {
	readonly id = "test-provider"
	readonly name = "Test Provider"
	readonly description = "Test implementation"

	protected async condenseInternal(
		context: CondensationContext,
		options: CondensationOptions,
	): Promise<CondensationResult> {
		return {
			messages: context.messages.slice(0, 1),
			cost: 0.01,
			newContextTokens: 100,
		}
	}

	async estimateCost(context: CondensationContext): Promise<number> {
		return 0.01
	}
}

describe("BaseCondensationProvider", () => {
	const mockContext: CondensationContext = {
		messages: [{ role: "user", content: "test message" }] as any,
		systemPrompt: "test",
		taskId: "task-1",
		prevContextTokens: 1000,
	}

	const mockOptions: CondensationOptions = {
		apiHandler: {} as any,
	}

	it("should validate context before condensing", async () => {
		const provider = new TestProvider()

		const invalidContext = { ...mockContext, messages: [] }
		const result = await provider.condense(invalidContext, mockOptions)

		expect(result.error).toBeDefined()
		expect(result.error).toContain("No messages")
	})

	it("should call condenseInternal and add metrics", async () => {
		const provider = new TestProvider()

		const result = await provider.condense(mockContext, mockOptions)

		expect(result.error).toBeUndefined()
		expect(result.metrics).toBeDefined()
		expect(result.metrics?.providerId).toBe("test-provider")
		expect(result.metrics?.timeElapsed).toBeGreaterThanOrEqual(0)
	})

	it("should handle errors in condenseInternal", async () => {
		class ErrorProvider extends BaseCondensationProvider {
			readonly id = "error-provider"
			readonly name = "Error Provider"
			readonly description = "Throws errors"

			protected async condenseInternal(): Promise<CondensationResult> {
				throw new Error("Test error")
			}

			async estimateCost(): Promise<number> {
				return 0
			}
		}

		const provider = new ErrorProvider()
		const result = await provider.condense(mockContext, mockOptions)

		expect(result.error).toBe("Test error")
		expect(result.cost).toBe(0)
	})

	it("should count tokens correctly", async () => {
		const provider = new TestProvider()

		// Access protected method via type assertion
		const count = (provider as any).countTokens("hello world")

		expect(count).toBeGreaterThan(0)
		expect(count).toBe(Math.ceil("hello world".length / 4))
	})
})
