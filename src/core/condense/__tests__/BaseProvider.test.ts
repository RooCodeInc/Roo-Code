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

	describe("retryWithBackoff", () => {
		it("should succeed on first attempt without retrying", async () => {
			const provider = new TestProvider()
			let attempts = 0

			const result = await (provider as any).retryWithBackoff(async () => {
				attempts++
				return "success"
			})

			expect(result).toBe("success")
			expect(attempts).toBe(1)
		})

		it("should retry with exponential backoff delays", async () => {
			const provider = new TestProvider()
			let attempts = 0
			const delays: number[] = []
			let lastTime = Date.now()

			const result = await (provider as any).retryWithBackoff(
				async () => {
					attempts++
					if (attempts < 3) {
						const now = Date.now()
						if (attempts > 1) {
							delays.push(now - lastTime)
						}
						lastTime = now
						throw new Error(`Attempt ${attempts} failed`)
					}
					return "success"
				},
				3,
				100, // 100ms base delay for faster tests
			)

			expect(result).toBe("success")
			expect(attempts).toBe(3)
			// First retry: ~100ms, second retry: ~200ms (with some tolerance)
			expect(delays[0]).toBeGreaterThanOrEqual(90)
			expect(delays[0]).toBeLessThan(150)
		})

		it("should throw last error after max retries", async () => {
			const provider = new TestProvider()
			let attempts = 0

			await expect(
				(provider as any).retryWithBackoff(
					async () => {
						attempts++
						throw new Error(`Failure ${attempts}`)
					},
					3,
					10, // Fast for tests
				),
			).rejects.toThrow("Failure 3")

			expect(attempts).toBe(3)
		})

		it("should use custom maxRetries and baseDelay", async () => {
			const provider = new TestProvider()
			let attempts = 0

			await expect(
				(provider as any).retryWithBackoff(
					async () => {
						attempts++
						throw new Error("Always fails")
					},
					2, // Only 2 retries
					50, // 50ms base
				),
			).rejects.toThrow("Always fails")

			expect(attempts).toBe(2)
		})

		it("should calculate exponential delays correctly", async () => {
			const provider = new TestProvider()
			const delays: number[] = []
			let lastTime = Date.now()
			let attempts = 0

			try {
				await (provider as any).retryWithBackoff(
					async () => {
						attempts++
						const now = Date.now()
						if (attempts > 1) {
							delays.push(now - lastTime)
						}
						lastTime = now
						throw new Error("Test")
					},
					4, // 4 attempts
					100, // 100ms base
				)
			} catch {
				// Expected to fail
			}

			expect(attempts).toBe(4)
			// Delays should be approximately: 100ms, 200ms, 400ms
			expect(delays[0]).toBeGreaterThanOrEqual(90) // ~100ms
			expect(delays[0]).toBeLessThan(150)
			expect(delays[1]).toBeGreaterThanOrEqual(190) // ~200ms
			expect(delays[1]).toBeLessThan(250)
			expect(delays[2]).toBeGreaterThanOrEqual(390) // ~400ms
			expect(delays[2]).toBeLessThan(450)
		})
	})
})
