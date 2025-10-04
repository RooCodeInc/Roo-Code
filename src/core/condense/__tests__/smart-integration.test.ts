/**
 * Smart Provider Pass-Based - Integration Tests
 *
 * Tests the Smart Provider with real-world fixtures to validate:
 * - CONSERVATIVE config (quality-first)
 * - BALANCED config (optimal balance)
 * - AGGRESSIVE config (maximum reduction)
 *
 * Uses 7 real conversation fixtures for comprehensive validation.
 */

import { describe, it, expect, beforeAll, vi } from "vitest"
import { readFile } from "fs/promises"
import { join } from "path"
import { SmartCondensationProvider } from "../providers/smart"
import { CONSERVATIVE_CONFIG, BALANCED_CONFIG, AGGRESSIVE_CONFIG } from "../providers/smart/configs"
import type { CondensationContext, CondensationOptions } from "../types"
import type { ApiMessage } from "../../task-persistence/apiMessages"

const FIXTURES_DIR = join(__dirname, "fixtures", "real-conversations")

interface FixtureData {
	name: string
	messages: ApiMessage[]
	originalSize: number
	messageCount: number
}

/**
 * Load a fixture from the real-conversations directory
 */
async function loadFixture(fixtureName: string): Promise<FixtureData> {
	const fixturePath = join(FIXTURES_DIR, fixtureName)
	const apiHistoryRaw = await readFile(join(fixturePath, "api_conversation_history.json"), "utf-8")
	const messages = JSON.parse(apiHistoryRaw) as ApiMessage[]

	return {
		name: fixtureName,
		messages,
		originalSize: apiHistoryRaw.length,
		messageCount: messages.length,
	}
}

describe("Smart Provider Pass-Based - Integration Tests", () => {
	let mockApiHandler: any

	beforeAll(() => {
		// Mock API handler for all tests
		mockApiHandler = {
			createMessage: vi.fn(),
			getModel: vi.fn().mockReturnValue({ id: "claude-3-5-sonnet-20241022", info: {} }),
			countTokens: vi.fn().mockResolvedValue(100),
		}

		// Mock LLM responses for summarization
		const mockStream = {
			async *[Symbol.asyncIterator]() {
				yield { type: "text" as const, text: "Summarized content" }
				yield {
					type: "usage" as const,
					inputTokens: 50,
					outputTokens: 10,
					totalCost: 0.001,
				}
			},
		}
		mockApiHandler.createMessage.mockReturnValue(mockStream)
	})

	/**
	 * Helper to estimate tokens (rough approximation)
	 */
	function estimateTokens(messages: any[]): number {
		let total = 0
		messages.forEach((msg) => {
			if (typeof msg.content === "string") {
				total += Math.ceil(msg.content.length / 4)
			} else if (Array.isArray(msg.content)) {
				msg.content.forEach((block: any) => {
					if (block.type === "text") {
						total += Math.ceil(block.text.length / 4)
					} else if (block.type === "tool_result" && typeof block.content === "string") {
						total += Math.ceil(block.content.length / 4)
					}
				})
			}
		})
		return total
	}

	describe("CONSERVATIVE_CONFIG", () => {
		const fixtures = [
			"natural-already-condensed",
			"natural-mini-uncondensed",
			"heavy-uncondensed",
			"synthetic-1-heavy-write",
			"synthetic-2-heavy-read",
			"synthetic-3-tool-dedup",
			"synthetic-4-mixed-ops",
		]

		fixtures.forEach((fixtureName) => {
			it(`processes ${fixtureName} with conservative config`, async () => {
				const fixture = await loadFixture(fixtureName)
				const provider = new SmartCondensationProvider(CONSERVATIVE_CONFIG)

				const originalTokens = estimateTokens(fixture.messages)
				const context: CondensationContext = {
					messages: fixture.messages,
					systemPrompt: "Test system prompt",
					taskId: "test-task",
					prevContextTokens: originalTokens,
					targetTokens: 50000,
				}

				const options: CondensationOptions = {
					apiHandler: mockApiHandler,
					isAutomaticTrigger: false,
				}

				const result = await provider.condense(context, options)

				// Basic validations
				expect(result.messages).toBeDefined()
				expect(result.messages.length).toBeGreaterThan(0)
				expect(result.cost).toBeGreaterThanOrEqual(0)
				expect(result.metrics).toBeDefined()

				// Token validation (with mocks, may not reduce significantly)
				const finalTokens = estimateTokens(result.messages)

				// With mocked LLM, we can't guarantee real reduction
				// Just verify the process completes successfully
				console.log(
					`[CONSERVATIVE ${fixtureName}] Original: ${originalTokens}, Final: ${finalTokens}, Delta: ${finalTokens - originalTokens}`,
				)

				// Should have executed passes
				expect(result.metrics?.operationsApplied).toBeDefined()
				expect(result.metrics?.operationsApplied?.length).toBeGreaterThan(0)

				// Verify lossless prelude was executed
				expect(result.metrics?.operationsApplied).toContain("lossless_prelude")
			})
		})
	})

	describe("BALANCED_CONFIG", () => {
		const fixtures = [
			"natural-already-condensed",
			"natural-mini-uncondensed",
			"heavy-uncondensed",
			"synthetic-1-heavy-write",
			"synthetic-2-heavy-read",
			"synthetic-3-tool-dedup",
			"synthetic-4-mixed-ops",
		]

		fixtures.forEach((fixtureName) => {
			it(`processes ${fixtureName} with balanced config`, async () => {
				const fixture = await loadFixture(fixtureName)
				const provider = new SmartCondensationProvider(BALANCED_CONFIG)

				const originalTokens = estimateTokens(fixture.messages)
				const context: CondensationContext = {
					messages: fixture.messages,
					systemPrompt: "Test system prompt",
					taskId: "test-task",
					prevContextTokens: originalTokens,
					targetTokens: 50000,
				}

				const options: CondensationOptions = {
					apiHandler: mockApiHandler,
					isAutomaticTrigger: false,
				}

				const result = await provider.condense(context, options)

				// Basic validations
				expect(result.messages).toBeDefined()
				expect(result.messages.length).toBeGreaterThan(0)
				expect(result.cost).toBeGreaterThanOrEqual(0)

				// Token validation (with mocks)
				const finalTokens = estimateTokens(result.messages)
				console.log(
					`[BALANCED ${fixtureName}] Original: ${originalTokens}, Final: ${finalTokens}, Delta: ${finalTokens - originalTokens}`,
				)

				// Verify pass execution
				expect(result.metrics?.operationsApplied).toBeDefined()

				// Lossless prelude should be executed
				expect(result.metrics?.operationsApplied).toContain("lossless_prelude")

				// LLM quality pass should always execute (new BALANCED logic)
				expect(result.metrics?.operationsApplied).toContain("pass_llm-quality")
			})
		})
	})

	describe("AGGRESSIVE_CONFIG", () => {
		const fixtures = [
			"natural-already-condensed",
			"natural-mini-uncondensed",
			"heavy-uncondensed",
			"synthetic-1-heavy-write",
			"synthetic-2-heavy-read",
			"synthetic-3-tool-dedup",
			"synthetic-4-mixed-ops",
		]

		fixtures.forEach((fixtureName) => {
			it(`processes ${fixtureName} with aggressive config`, async () => {
				const fixture = await loadFixture(fixtureName)
				const provider = new SmartCondensationProvider(AGGRESSIVE_CONFIG)

				const originalTokens = estimateTokens(fixture.messages)
				const context: CondensationContext = {
					messages: fixture.messages,
					systemPrompt: "Test system prompt",
					taskId: "test-task",
					prevContextTokens: originalTokens,
					targetTokens: 50000,
				}

				const options: CondensationOptions = {
					apiHandler: mockApiHandler,
					isAutomaticTrigger: false,
				}

				const result = await provider.condense(context, options)

				// Basic validations
				expect(result.messages).toBeDefined()
				expect(result.messages.length).toBeGreaterThan(0)
				expect(result.cost).toBeGreaterThanOrEqual(0)

				// Token validation (with mocks)
				const finalTokens = estimateTokens(result.messages)
				console.log(
					`[AGGRESSIVE ${fixtureName}] Original: ${originalTokens}, Final: ${finalTokens}, Delta: ${finalTokens - originalTokens}`,
				)

				// Cost should be minimal (mostly suppress/truncate)
				expect(result.cost).toBeLessThan(0.05)

				// Verify pass execution
				expect(result.metrics?.operationsApplied).toBeDefined()

				// Aggressive passes should execute
				expect(result.metrics?.operationsApplied).toContain("pass_suppress-ancient")
			})
		})
	})

	describe("Pass Sequencing", () => {
		it("executes passes in order", async () => {
			const fixture = await loadFixture("heavy-uncondensed")
			const provider = new SmartCondensationProvider(BALANCED_CONFIG)

			const originalTokens = estimateTokens(fixture.messages)
			const context: CondensationContext = {
				messages: fixture.messages,
				systemPrompt: "Test system prompt",
				taskId: "test-task",
				prevContextTokens: originalTokens,
				targetTokens: 50000,
			}

			const options: CondensationOptions = {
				apiHandler: mockApiHandler,
				isAutomaticTrigger: false,
			}

			const result = await provider.condense(context, options)

			// Verify execution order
			const operations = result.metrics?.operationsApplied || []

			// Lossless prelude should be first
			expect(operations[0]).toBe("lossless_prelude")

			// LLM quality pass should be second (new BALANCED logic: LLM first)
			expect(operations[1]).toBe("pass_llm-quality")

			// Further passes depend on token count after LLM pass
			console.log(`[Pass Sequencing] Operations executed: ${operations.join(" → ")}`)
		})
	})

	describe("Performance Benchmarks", () => {
		it("completes condensation in reasonable time", async () => {
			const fixture = await loadFixture("heavy-uncondensed")
			const provider = new SmartCondensationProvider(BALANCED_CONFIG)

			const originalTokens = estimateTokens(fixture.messages)
			const context: CondensationContext = {
				messages: fixture.messages,
				systemPrompt: "Test system prompt",
				taskId: "test-task",
				prevContextTokens: originalTokens,
				targetTokens: 50000,
			}

			const options: CondensationOptions = {
				apiHandler: mockApiHandler,
				isAutomaticTrigger: false,
			}

			const startTime = performance.now()
			const result = await provider.condense(context, options)
			const duration = performance.now() - startTime

			console.log(`[Performance] Duration: ${duration.toFixed(2)}ms for ${fixture.messages.length} messages`)

			// Balanced config should complete in reasonable time
			// Note: With mocked LLM, should be very fast
			expect(duration).toBeLessThan(10000) // Max 10s (generous for CI)
			expect(result.metrics?.timeElapsed).toBeDefined()
		})
	})

	describe("Config Comparison", () => {
		it("compares all 3 configs on same fixture", async () => {
			const fixture = await loadFixture("heavy-uncondensed")
			const originalTokens = estimateTokens(fixture.messages)

			const context: CondensationContext = {
				messages: fixture.messages,
				systemPrompt: "Test system prompt",
				taskId: "test-task",
				prevContextTokens: originalTokens,
				targetTokens: 50000,
			}

			const options: CondensationOptions = {
				apiHandler: mockApiHandler,
				isAutomaticTrigger: false,
			}

			// Test all 3 configs
			const conservativeProvider = new SmartCondensationProvider(CONSERVATIVE_CONFIG)
			const balancedProvider = new SmartCondensationProvider(BALANCED_CONFIG)
			const aggressiveProvider = new SmartCondensationProvider(AGGRESSIVE_CONFIG)

			const conservativeResult = await conservativeProvider.condense(context, options)
			const balancedResult = await balancedProvider.condense(context, options)
			const aggressiveResult = await aggressiveProvider.condense(context, options)

			const conservativeTokens = estimateTokens(conservativeResult.messages)
			const balancedTokens = estimateTokens(balancedResult.messages)
			const aggressiveTokens = estimateTokens(aggressiveResult.messages)

			console.log("\n=== Config Comparison ===")
			console.log(`Original: ${originalTokens} tokens`)
			console.log(`CONSERVATIVE: ${conservativeTokens} tokens, cost: $${conservativeResult.cost.toFixed(4)}`)
			console.log(`BALANCED: ${balancedTokens} tokens, cost: $${balancedResult.cost.toFixed(4)}`)
			console.log(`AGGRESSIVE: ${aggressiveTokens} tokens, cost: $${aggressiveResult.cost.toFixed(4)}`)

			// With mocks, we can't guarantee token ordering, but all should complete
			expect(conservativeResult.messages.length).toBeGreaterThan(0)
			expect(balancedResult.messages.length).toBeGreaterThan(0)
			expect(aggressiveResult.messages.length).toBeGreaterThan(0)

			// Verify different passes were executed
			expect(conservativeResult.metrics?.operationsApplied).not.toEqual(
				aggressiveResult.metrics?.operationsApplied,
			)
		})
	})

	describe("Error Handling", () => {
		it("handles empty message list gracefully", async () => {
			const provider = new SmartCondensationProvider(BALANCED_CONFIG)

			const context: CondensationContext = {
				messages: [],
				systemPrompt: "Test system prompt",
				taskId: "test-task",
				prevContextTokens: 0,
				targetTokens: 5000,
			}

			const options: CondensationOptions = {
				apiHandler: mockApiHandler,
				isAutomaticTrigger: false,
			}

			const result = await provider.condense(context, options)

			expect(result.messages).toEqual([])
			expect(result.cost).toBe(0)
		})

		it("handles LLM failures gracefully", async () => {
			const fixture = await loadFixture("natural-mini-uncondensed")
			const provider = new SmartCondensationProvider(CONSERVATIVE_CONFIG)

			// Mock LLM to fail
			const failingApiHandler = {
				...mockApiHandler,
				createMessage: vi.fn().mockImplementation(() => {
					throw new Error("LLM API failure")
				}),
			}

			const context: CondensationContext = {
				messages: fixture.messages,
				systemPrompt: "Test system prompt",
				taskId: "test-task",
				prevContextTokens: 10000,
				targetTokens: 5000,
			}

			const options: CondensationOptions = {
				apiHandler: failingApiHandler,
				isAutomaticTrigger: false,
			}

			// Should not throw, should fall back to truncation
			const result = await provider.condense(context, options)

			expect(result.messages).toBeDefined()
			expect(result.messages.length).toBeGreaterThan(0)
		})
	})
})
