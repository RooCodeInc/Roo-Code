import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { CondensationManager, getCondensationManager } from "../CondensationManager"
import { getProviderRegistry } from "../ProviderRegistry"
import { BaseCondensationProvider } from "../BaseProvider"
import { NativeCondensationProvider } from "../providers/NativeProvider"
import type { CondensationContext, CondensationOptions, CondensationResult } from "../types"
import type { ApiHandler } from "../../../api/index"

// Test provider
class TestProvider extends BaseCondensationProvider {
	readonly id = "test-provider"
	readonly name = "Test Provider"
	readonly description = "Test"

	protected async condenseInternal(): Promise<CondensationResult> {
		return { messages: [], cost: 0.05, newContextTokens: 100 }
	}

	async estimateCost(): Promise<number> {
		return 0.05
	}
}

// Additional test providers for priority testing
class TestProvider1 extends BaseCondensationProvider {
	readonly id = "test-1"
	readonly name = "Test Provider 1"
	readonly description = "Test 1"

	protected async condenseInternal(): Promise<CondensationResult> {
		return { messages: [], cost: 0.05, newContextTokens: 100 }
	}

	async estimateCost(): Promise<number> {
		return 0.05
	}
}

class TestProvider2 extends BaseCondensationProvider {
	readonly id = "test-2"
	readonly name = "Test Provider 2"
	readonly description = "Test 2"

	protected async condenseInternal(): Promise<CondensationResult> {
		return { messages: [], cost: 0.05, newContextTokens: 100 }
	}

	async estimateCost(): Promise<number> {
		return 0.05
	}
}

describe("CondensationManager", () => {
	let manager: CondensationManager
	let mockApiHandler: ApiHandler

	beforeEach(() => {
		// Clear registry
		const registry = getProviderRegistry()
		registry.clear()

		// Get manager instance (singleton)
		manager = CondensationManager.getInstance()

		// Clear loop guard attempts map
		const managerAny = manager as any
		managerAny.condensationAttempts.clear()

		// Re-register native provider since registry was cleared
		const nativeProvider = new NativeCondensationProvider()
		registry.register(nativeProvider, {
			enabled: true,
			priority: 100,
		})

		// Reset default provider to native (since manager is singleton)
		manager.setDefaultProvider("native")

		// Mock API handler
		mockApiHandler = {
			createMessage: vi.fn(),
			getModel: vi.fn(),
			countTokens: vi.fn().mockResolvedValue(100),
		} as any
	})

	afterEach(() => {
		const registry = getProviderRegistry()
		registry.clear()
	})

	it("should be a singleton", () => {
		const instance1 = CondensationManager.getInstance()
		const instance2 = CondensationManager.getInstance()

		expect(instance1).toBe(instance2)
	})

	it("should register native provider by default", () => {
		const providers = manager.listProviders()

		expect(providers).toHaveLength(1)
		expect(providers[0].id).toBe("native")
	})

	it("should set and get default provider", () => {
		expect(manager.getDefaultProvider()).toBe("native")

		const registry = getProviderRegistry()
		const testProvider = new TestProvider()
		registry.register(testProvider)

		manager.setDefaultProvider("test-provider")
		expect(manager.getDefaultProvider()).toBe("test-provider")
	})

	it("should throw error when setting non-existent provider", () => {
		expect(() => {
			manager.setDefaultProvider("non-existent")
		}).toThrow("Provider 'non-existent' not found")
	})

	it("should condense using default provider", async () => {
		const messages = [
			{ role: "user", content: "Hello" },
			{ role: "assistant", content: "Hi there!" },
			{ role: "user", content: "How are you?" },
			{ role: "assistant", content: "I'm doing well!" },
			{ role: "user", content: "Can you help me?" },
		] as any

		// Mock the native provider's API response
		const mockStream = {
			async *[Symbol.asyncIterator]() {
				yield { type: "text" as const, text: "Summary" }
				yield {
					type: "usage" as const,
					inputTokens: 50,
					outputTokens: 10,
					totalCost: 0.0003,
				}
			},
		}

		vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream as any)
		// Mock countTokens to return a reasonable value that shows context shrinkage
		vi.mocked(mockApiHandler.countTokens).mockResolvedValue(80)

		const result = await manager.condense(messages, mockApiHandler, {
			prevContextTokens: 200, // Ensure we have a baseline to compare against
		})

		expect(result.error).toBeUndefined()
		expect(result.cost).toBeGreaterThan(0)
	})

	it("should condense using specified provider", async () => {
		const registry = getProviderRegistry()
		const testProvider = new TestProvider()
		registry.register(testProvider)

		const messages = [{ role: "user", content: "Hello" }] as any

		const result = await manager.condense(messages, mockApiHandler, {
			providerId: "test-provider",
		})

		expect(result.error).toBeUndefined()
		expect(result.cost).toBe(0.05)
	})

	it("should throw error when provider not found", async () => {
		const messages = [{ role: "user", content: "Hello" }] as any

		await expect(
			manager.condense(messages, mockApiHandler, {
				providerId: "non-existent",
			}),
		).rejects.toThrow("Provider 'non-existent' not found")
	})

	it("should throw error when provider is disabled", async () => {
		const registry = getProviderRegistry()
		const testProvider = new TestProvider()
		registry.register(testProvider, { enabled: false })

		const messages = [{ role: "user", content: "Hello" }] as any

		await expect(
			manager.condense(messages, mockApiHandler, {
				providerId: "test-provider",
			}),
		).rejects.toThrow("Provider 'test-provider' is disabled")
	})

	it("should estimate cost", async () => {
		const messages = [{ role: "user", content: "Hello world" }] as any

		const cost = await manager.estimateCost(messages)

		expect(cost).toBeGreaterThan(0)
	})

	it("should list all providers", () => {
		const registry = getProviderRegistry()
		const testProvider = new TestProvider()
		registry.register(testProvider, { priority: 50 })

		const providers = manager.listProviders()

		expect(providers).toHaveLength(2) // native + test
		expect(providers.some((p) => p.id === "native")).toBe(true)
		expect(providers.some((p) => p.id === "test-provider")).toBe(true)

		const testProviderInfo = providers.find((p) => p.id === "test-provider")
		expect(testProviderInfo?.priority).toBe(50)
	})

	it("should pass all options to provider", async () => {
		const messages = [{ role: "user", content: "Hello" }] as any
		const dedicatedHandler = {
			createMessage: vi.fn(),
			getModel: vi.fn(),
			countTokens: vi.fn().mockResolvedValue(100),
		} as any

		const mockStream = {
			async *[Symbol.asyncIterator]() {
				yield { type: "text" as const, text: "Summary" }
				yield {
					type: "usage" as const,
					inputTokens: 50,
					outputTokens: 10,
					totalCost: 0.0003,
				}
			},
		}

		vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream as any)

		await manager.condense(messages, mockApiHandler, {
			systemPrompt: "Test prompt",
			taskId: "task-123",
			prevContextTokens: 1000,
			targetTokens: 500,
			condensingApiHandler: dedicatedHandler,
			customCondensingPrompt: "Custom prompt",
			isAutomaticTrigger: true,
		})

		// Should not throw
		expect(true).toBe(true)
	})

	it("should work with convenience function", () => {
		const manager1 = getCondensationManager()
		const manager2 = getCondensationManager()

		expect(manager1).toBe(manager2)
	})

	it("should handle empty messages array", async () => {
		const messages: any[] = []

		const result = await manager.condense(messages, mockApiHandler)

		expect(result.error).toBeDefined()
		expect(result.messages).toEqual([])
	})

	it("should handle null context gracefully", async () => {
		const result = await manager.condense(null as any, mockApiHandler)

		expect(result.error).toBeDefined()
	})

	it("should handle null api handler gracefully", async () => {
		const messages = [
			{ role: "user", content: "Hello" },
			{ role: "assistant", content: "Hi" },
			{ role: "user", content: "Question" },
			{ role: "assistant", content: "Answer" },
			{ role: "user", content: "Final" },
		] as any

		const result = await manager.condense(messages, null as any)

		expect(result.error).toBeDefined()
		expect(result.messages).toEqual(messages)
	})

	it("should preserve provider priority order in listing", () => {
		const registry = getProviderRegistry()

		const testProvider1 = new TestProvider1()
		registry.register(testProvider1, { priority: 200 })

		const testProvider2 = new TestProvider2()
		registry.register(testProvider2, { priority: 50 })

		const providers = manager.listProviders()

		const native = providers.find((p) => p.id === "native")
		const test1 = providers.find((p) => p.id === "test-1")
		const test2 = providers.find((p) => p.id === "test-2")

		expect(native?.priority).toBe(100)
		expect(test1?.priority).toBe(200)
		expect(test2?.priority).toBe(50)
	})

	it("should handle provider becoming disabled during operation", async () => {
		const registry = getProviderRegistry()
		const testProvider = new TestProvider()
		registry.register(testProvider, { enabled: true })

		// Disable provider before condensation
		registry.register(testProvider, { enabled: false })

		const messages = [
			{ role: "user", content: "Hello" },
			{ role: "assistant", content: "Hi" },
			{ role: "user", content: "Question" },
			{ role: "assistant", content: "Answer" },
			{ role: "user", content: "Final" },
		] as any

		await expect(
			manager.condense(messages, mockApiHandler, {
				providerId: "test-provider",
			}),
		).rejects.toThrow("disabled")
	})

	it("should reset to native provider after setting invalid provider", () => {
		const registry = getProviderRegistry()
		const testProvider = new TestProvider()
		registry.register(testProvider)

		manager.setDefaultProvider("test-provider")
		expect(manager.getDefaultProvider()).toBe("test-provider")

		// Remove test provider
		registry.clear()
		const nativeProvider = new NativeCondensationProvider()
		registry.register(nativeProvider, { enabled: true, priority: 100 })
		manager.setDefaultProvider("native")

		expect(manager.getDefaultProvider()).toBe("native")
	})

	it("should handle estimateCost with empty provider ID", async () => {
		const messages = [{ role: "user", content: "Test" }] as any

		const cost = await manager.estimateCost(messages, {
			providerId: "", // Empty string should fall back to default
		})

		expect(cost).toBeGreaterThan(0)
	})

	it("should maintain singleton across multiple getInstance calls", () => {
		const instances = Array.from({ length: 10 }, () => CondensationManager.getInstance())

		const firstInstance = instances[0]
		instances.forEach((instance) => {
			expect(instance).toBe(firstInstance)
		})
	})

	it("should handle concurrent condensation requests", async () => {
		const messages = [
			{ role: "user", content: "Hello" },
			{ role: "assistant", content: "Hi" },
			{ role: "user", content: "Question" },
			{ role: "assistant", content: "Answer" },
			{ role: "user", content: "Final" },
		] as any

		const mockStream = {
			async *[Symbol.asyncIterator]() {
				yield { type: "text" as const, text: "Summary" }
				yield {
					type: "usage" as const,
					inputTokens: 50,
					outputTokens: 10,
					totalCost: 0.0003,
				}
			},
		}

		vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream as any)
		vi.mocked(mockApiHandler.countTokens).mockResolvedValue(80)

		// Launch multiple concurrent requests with unique task IDs
		const promises = Array.from({ length: 5 }, (_, i) =>
			manager.condense(messages, mockApiHandler, {
				taskId: `concurrent-task-${i}`,
				prevContextTokens: 200,
			}),
		)

		const results = await Promise.all(promises)

		results.forEach((result) => {
			expect(result.error).toBeUndefined()
			expect(result.cost).toBeGreaterThan(0)
		})
	})

	describe("Loop Guard", () => {
		it("should allow 3 successive attempts", async () => {
			const messages = [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: "Hi there!" },
				{ role: "user", content: "How are you?" },
				{ role: "assistant", content: "I'm doing well!" },
				{ role: "user", content: "Can you help me?" },
			] as any

			// Mock successful condensation
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					yield { type: "text" as const, text: "Summary" }
					yield {
						type: "usage" as const,
						inputTokens: 50,
						outputTokens: 10,
						totalCost: 0.0003,
					}
				},
			}

			vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream as any)
			vi.mocked(mockApiHandler.countTokens).mockResolvedValue(80)

			// Execute 3 successive attempts - all should pass
			for (let i = 0; i < 3; i++) {
				const result = await manager.condense(messages, mockApiHandler, {
					taskId: "test-task",
					prevContextTokens: 200,
				})

				expect(result.error).toBeUndefined()
				expect(result.cost).toBeGreaterThan(0)
			}
		})

		it("should trigger loop guard on 4th attempt", async () => {
			const messages = [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: "Hi there!" },
				{ role: "user", content: "How are you?" },
				{ role: "assistant", content: "I'm doing well!" },
				{ role: "user", content: "Can you help me?" },
			] as any

			// Mock condensation that doesn't reduce context (triggers loop guard)
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					yield { type: "text" as const, text: "Summary" }
					yield {
						type: "usage" as const,
						inputTokens: 50,
						outputTokens: 10,
						totalCost: 0.0003,
					}
				},
			}

			vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream as any)
			// Return same or higher token count to prevent counter reset
			vi.mocked(mockApiHandler.countTokens).mockResolvedValue(200)

			// Execute 3 attempts first - they won't reset counter because context doesn't reduce
			for (let i = 0; i < 3; i++) {
				await manager.condense(messages, mockApiHandler, {
					taskId: "test-task-guard",
					prevContextTokens: 200,
				})
			}

			// 4th attempt should trigger loop guard
			const result = await manager.condense(messages, mockApiHandler, {
				taskId: "test-task-guard",
				prevContextTokens: 200,
			})

			expect(result.error).toBe("Loop guard: max 3 attempts reached")
			expect(result.cost).toBe(0)
			expect(result.messages).toEqual(messages)
			expect(result.metrics?.loopGuardTriggered).toBe(true)
		})

		it("should reset counter after cooldown", async () => {
			const messages = [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: "Hi there!" },
				{ role: "user", content: "How are you?" },
				{ role: "assistant", content: "I'm doing well!" },
				{ role: "user", content: "Can you help me?" },
			] as any

			// Mock successful condensation
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					yield { type: "text" as const, text: "Summary" }
					yield {
						type: "usage" as const,
						inputTokens: 50,
						outputTokens: 10,
						totalCost: 0.0003,
					}
				},
			}

			vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream as any)
			vi.mocked(mockApiHandler.countTokens).mockResolvedValue(80)

			// Execute 3 attempts
			for (let i = 0; i < 3; i++) {
				await manager.condense(messages, mockApiHandler, {
					taskId: "test-task-cooldown",
					prevContextTokens: 200,
				})
			}

			// Wait for cooldown (simulate by directly manipulating the attempts map)
			// Access private field for testing
			const managerAny = manager as any
			const attempts = managerAny.condensationAttempts.get("test-task-cooldown")
			if (attempts) {
				attempts.lastAttempt = Date.now() - 61000 // 61 seconds ago
			}

			// Next attempt should succeed (cooldown expired)
			const result = await manager.condense(messages, mockApiHandler, {
				taskId: "test-task-cooldown",
				prevContextTokens: 200,
			})

			expect(result.error).toBeUndefined()
			expect(result.cost).toBeGreaterThan(0)
		})

		it("should reset counter on successful condensation", async () => {
			const messages = [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: "Hi there!" },
				{ role: "user", content: "How are you?" },
				{ role: "assistant", content: "I'm doing well!" },
				{ role: "user", content: "Can you help me?" },
			] as any

			// Mock successful condensation
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					yield { type: "text" as const, text: "Summary" }
					yield {
						type: "usage" as const,
						inputTokens: 50,
						outputTokens: 10,
						totalCost: 0.0003,
					}
				},
			}

			vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream as any)
			vi.mocked(mockApiHandler.countTokens).mockResolvedValue(80)

			// First 2 attempts that don't reduce context
			vi.mocked(mockApiHandler.countTokens).mockResolvedValue(200)
			for (let i = 0; i < 2; i++) {
				await manager.condense(messages, mockApiHandler, {
					taskId: "test-task-success",
					prevContextTokens: 200,
				})
			}

			// Verify counter exists before last condensation
			const managerAny = manager as any
			let attempts = managerAny.condensationAttempts.get("test-task-success")
			expect(attempts).toBeDefined()
			expect(attempts.count).toBe(2)

			// Execute one more condensation that DOES reduce context
			vi.mocked(mockApiHandler.countTokens).mockResolvedValue(80)
			await manager.condense(messages, mockApiHandler, {
				taskId: "test-task-success",
				prevContextTokens: 200,
			})

			// Counter should be reset after successful reduction
			attempts = managerAny.condensationAttempts.get("test-task-success")
			expect(attempts).toBeUndefined()
		})

		it("should maintain independent counters for different tasks", async () => {
			const messages = [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: "Hi there!" },
				{ role: "user", content: "How are you?" },
				{ role: "assistant", content: "I'm doing well!" },
				{ role: "user", content: "Can you help me?" },
			] as any

			// Mock condensation that doesn't reduce context
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					yield { type: "text" as const, text: "Summary" }
					yield {
						type: "usage" as const,
						inputTokens: 50,
						outputTokens: 10,
						totalCost: 0.0003,
					}
				},
			}

			vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream as any)

			// Task 1: Execute 3 attempts that don't reduce context
			vi.mocked(mockApiHandler.countTokens).mockResolvedValue(200)
			for (let i = 0; i < 3; i++) {
				await manager.condense(messages, mockApiHandler, {
					taskId: "task-1",
					prevContextTokens: 200,
				})
			}

			// Task 2: Execute 1 attempt that DOES reduce context
			vi.mocked(mockApiHandler.countTokens).mockResolvedValue(80)
			const result2 = await manager.condense(messages, mockApiHandler, {
				taskId: "task-2",
				prevContextTokens: 200,
			})

			// Task 2 should succeed (independent counter, first attempt, and context reduces)
			expect(result2.error).toBeUndefined()
			expect(result2.cost).toBeGreaterThan(0)

			// Reset mock for task-1 (no reduction)
			vi.mocked(mockApiHandler.countTokens).mockResolvedValue(200)

			// Task 1 should be blocked (4th attempt)
			const result1 = await manager.condense(messages, mockApiHandler, {
				taskId: "task-1",
				prevContextTokens: 200,
			})

			expect(result1.error).toBe("Loop guard: max 3 attempts reached")
		})
	})
})
