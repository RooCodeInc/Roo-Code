/**
 * Smart Provider Pass-Based - Unit Tests
 *
 * Tests the pass-based Smart Provider architecture validating:
 * - Message decomposition/recomposition
 * - 4 operations per content type (keep, suppress, truncate, summarize)
 * - Pass execution strategies (selection, modes, conditions)
 * - 3 predefined configurations
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { SmartCondensationProvider } from "../providers/smart"
import { CONSERVATIVE_CONFIG, BALANCED_CONFIG, AGGRESSIVE_CONFIG } from "../providers/smart/configs"
import type { CondensationContext, CondensationOptions } from "../types"
import type { ApiMessage } from "../../task-persistence/apiMessages"

describe("Smart Provider Pass-Based - Unit Tests", () => {
	let provider: SmartCondensationProvider
	let mockApiHandler: any
	let mockContext: CondensationContext
	let mockOptions: CondensationOptions

	beforeEach(() => {
		provider = new SmartCondensationProvider()

		// Mock API handler for summarization tests
		mockApiHandler = {
			createMessage: vi.fn(),
			getModel: vi.fn().mockReturnValue({ id: "claude-3-5-sonnet-20241022", info: {} }),
			countTokens: vi.fn().mockResolvedValue(100),
		}

		mockContext = {
			messages: [],
			systemPrompt: "Test system prompt",
			taskId: "test-task-123",
			prevContextTokens: 10000,
			targetTokens: 5000,
		}

		mockOptions = {
			apiHandler: mockApiHandler,
			isAutomaticTrigger: false,
		}
	})

	describe("Message Decomposition/Recomposition", () => {
		it("decomposes simple text message correctly", () => {
			const message: ApiMessage = {
				ts: Date.now(),
				role: "user",
				content: "Hello world",
			}

			// Access decomposition via condense which uses it internally
			const decomposed = (provider as any).decomposeMessage(message, 0)

			expect(decomposed.messageText).toBe("Hello world")
			expect(decomposed.toolParameters).toBeNull()
			expect(decomposed.toolResults).toBeNull()
		})

		it("decomposes message with tool_use blocks", () => {
			const message: ApiMessage = {
				ts: Date.now(),
				role: "assistant",
				content: [
					{ type: "text", text: "Let me help" },
					{
						type: "tool_use",
						id: "tool_123",
						name: "read_file",
						input: { path: "test.ts" },
					},
				],
			}

			const decomposed = (provider as any).decomposeMessage(message, 0)

			expect(decomposed.messageText).toBe("Let me help")
			expect(decomposed.toolParameters).toHaveLength(1)
			expect(decomposed.toolParameters[0].name).toBe("read_file")
			expect(decomposed.toolResults).toBeNull()
		})

		it("decomposes message with tool_result blocks", () => {
			const message: ApiMessage = {
				ts: Date.now(),
				role: "user",
				content: [
					{
						type: "tool_result",
						tool_use_id: "tool_123",
						content: "File content here",
					},
				],
			}

			const decomposed = (provider as any).decomposeMessage(message, 0)

			expect(decomposed.messageText).toBeNull()
			expect(decomposed.toolParameters).toBeNull()
			expect(decomposed.toolResults).toHaveLength(1)
			expect(decomposed.toolResults[0].content).toBe("File content here")
		})

		it("recomposes message correctly after decomposition", () => {
			const original: ApiMessage = {
				ts: Date.now(),
				role: "assistant",
				content: [
					{ type: "text", text: "Processing file" },
					{
						type: "tool_use",
						id: "tool_456",
						name: "write_file",
						input: { path: "output.txt", content: "data" },
					},
				],
			}

			// Decompose
			const decomposed = (provider as any).decomposeMessage(original, 0)

			// Recompose
			const recomposed = (provider as any).recomposeMessage(
				original,
				decomposed.messageText,
				decomposed.toolParameters,
				decomposed.toolResults,
			)

			expect(recomposed.role).toBe(original.role)
			expect(Array.isArray(recomposed.content)).toBe(true)
			const content = recomposed.content as any[]
			expect(content).toHaveLength(2)
			expect(content[0].type).toBe("text")
			expect(content[1].type).toBe("tool_use")
		})
	})

	describe("Operations - KEEP", () => {
		it("keeps content unchanged", async () => {
			const content = "Original content to keep"
			const operation = { operation: "keep" as const }

			const result = await (provider as any).applyOperation(
				content,
				operation,
				"messageText",
				mockContext,
				mockOptions,
			)

			expect(result.content).toBe(content)
			expect(result.cost).toBe(0)
		})
	})

	describe("Operations - SUPPRESS", () => {
		it("suppresses messageText with marker", async () => {
			const content = "Some text to suppress"
			const operation = { operation: "suppress" as const }

			const result = await (provider as any).applyOperation(
				content,
				operation,
				"messageText",
				mockContext,
				mockOptions,
			)

			expect(result.content).toBe("[Content suppressed]")
			expect(result.cost).toBe(0)
		})

		it("suppresses toolParameters with marker", async () => {
			const content = [{ id: "tool1", name: "test", input: {} }]
			const operation = { operation: "suppress" as const }

			const result = await (provider as any).applyOperation(
				content,
				operation,
				"toolParameters",
				mockContext,
				mockOptions,
			)

			// SUPPRESS now returns array format for toolParameters
			expect(Array.isArray(result.content)).toBe(true)
			expect(result.content[0].input.note).toBe("[Tool parameters suppressed]")
			expect(result.cost).toBe(0)
		})

		it("suppresses toolResults with marker", async () => {
			const content = [{ tool_use_id: "tool1", content: "result" }]
			const operation = { operation: "suppress" as const }

			const result = await (provider as any).applyOperation(
				content,
				operation,
				"toolResults",
				mockContext,
				mockOptions,
			)

			// SUPPRESS now returns array format for toolResults
			expect(Array.isArray(result.content)).toBe(true)
			expect(result.content[0].content).toBe("[Tool results suppressed]")
			expect(result.cost).toBe(0)
		})
	})

	describe("Operations - TRUNCATE", () => {
		it("truncates long text to maxChars", async () => {
			const longText = "a".repeat(1000)
			const operation = {
				operation: "truncate" as const,
				params: { maxChars: 100, addEllipsis: true },
			}

			const result = await (provider as any).applyOperation(
				longText,
				operation,
				"messageText",
				mockContext,
				mockOptions,
			)

			expect(result.content).toHaveLength(103) // 100 + '...'
			expect(result.content).toContain("...")
			expect(result.cost).toBe(0)
		})

		it("truncates multi-line text to maxLines", async () => {
			const lines = Array(50).fill("line").join("\n")
			const operation = {
				operation: "truncate" as const,
				params: { maxLines: 5, addEllipsis: true },
			}

			const result = await (provider as any).applyOperation(
				lines,
				operation,
				"messageText",
				mockContext,
				mockOptions,
			)

			const resultLines = (result.content as string).split("\n")
			expect(resultLines.length).toBeLessThanOrEqual(6) // 5 lines + ellipsis
			expect(result.content).toContain("...")
			expect(result.cost).toBe(0)
		})

		it("does not truncate if under threshold", async () => {
			const shortText = "Short"
			const operation = {
				operation: "truncate" as const,
				params: { maxChars: 100 },
			}

			const result = await (provider as any).applyOperation(
				shortText,
				operation,
				"messageText",
				mockContext,
				mockOptions,
			)

			expect(result.content).toBe(shortText)
			expect(result.cost).toBe(0)
		})
	})

	describe("Operations - SUMMARIZE", () => {
		it("summarizes content via LLM", async () => {
			const content = "Very long content that needs summarization ".repeat(20)
			const operation = {
				operation: "summarize" as const,
				params: {
					apiProfile: "gpt-4o-mini",
					maxTokens: 100,
				},
			}

			// Mock LLM response
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

			const result = await (provider as any).applyOperation(
				content,
				operation,
				"messageText",
				mockContext,
				mockOptions,
			)

			expect(result.content).toBe("Summarized content")
			expect(result.cost).toBeGreaterThan(0)
			expect(mockApiHandler.createMessage).toHaveBeenCalled()
		})

		it("falls back to truncation on LLM error", async () => {
			const content = "Content to summarize"
			const operation = {
				operation: "summarize" as const,
				params: {},
			}

			// Mock LLM error
			mockApiHandler.createMessage.mockImplementation(() => {
				throw new Error("LLM error")
			})

			const result = await (provider as any).applyOperation(
				content,
				operation,
				"messageText",
				mockContext,
				mockOptions,
			)

			// Should fall back to truncation
			expect(result.content).toBeDefined()
			expect(result.cost).toBe(0)
		})
	})

	describe("Pass Selection Strategies", () => {
		it("preserve_recent selects correct messages", () => {
			const messages: ApiMessage[] = Array(20)
				.fill(null)
				.map((_, i) => ({
					ts: Date.now() + i,
					role: i % 2 === 0 ? "user" : "assistant",
					content: `Message ${i}`,
				}))

			const strategy = { type: "preserve_recent" as const, keepRecentCount: 5 }

			const result = (provider as any).applySelection(strategy, messages)

			expect(result.preservedMessages).toHaveLength(5)
			expect(result.selectedMessages).toHaveLength(15)
			// Check that preserved are the last 5
			expect(result.preservedMessages[4].content).toBe("Message 19")
		})

		it("preserve_percent selects correct messages", () => {
			const messages: ApiMessage[] = Array(100)
				.fill(null)
				.map((_, i) => ({
					ts: Date.now() + i,
					role: i % 2 === 0 ? "user" : "assistant",
					content: `Message ${i}`,
				}))

			const strategy = { type: "preserve_percent" as const, keepPercentage: 30 }

			const result = (provider as any).applySelection(strategy, messages)

			expect(result.preservedMessages).toHaveLength(30)
			expect(result.selectedMessages).toHaveLength(70)
		})
	})

	describe("Pass Execution - Batch Mode", () => {
		it("executes batch pass with summarization", async () => {
			const messages: ApiMessage[] = Array(10)
				.fill(null)
				.map((_, i) => ({
					ts: Date.now() + i,
					role: i % 2 === 0 ? "user" : "assistant",
					content: `Message ${i}`,
				}))

			const pass = {
				id: "batch-test",
				name: "Batch Test",
				description: "Test batch mode",
				selection: { type: "preserve_recent" as const, keepRecentCount: 3 },
				mode: "batch" as const,
				batchConfig: {
					operation: "summarize" as const,
					summarizationConfig: {
						apiProfile: "gpt-4o-mini",
						keepFirst: 1,
						keepLast: 2,
					},
				},
				execution: { type: "always" as const },
			}

			// Mock Native Provider response
			const mockNativeResult = {
				messages: [{ ts: Date.now(), role: "assistant", content: "Summary" }],
				cost: 0.02,
				newContextTokens: 100,
			}

			vi.spyOn(provider as any, "nativeProvider", "get").mockReturnValue({
				condense: vi.fn().mockResolvedValue(mockNativeResult),
			})

			const result = await (provider as any).executeBatchPass(pass, messages, mockContext, mockOptions)

			expect(result.messages).toBeDefined()
			expect(result.cost).toBeGreaterThan(0)
		})
	})

	describe("Execution Conditions", () => {
		it("always executes pass with type=always", async () => {
			const messages: ApiMessage[] = [{ ts: Date.now(), role: "user", content: "Test" }]

			const pass = {
				id: "always-test",
				execution: { type: "always" as const },
			}

			const shouldExecute = await (provider as any).shouldExecutePass(pass, messages, mockContext)

			expect(shouldExecute).toBe(true)
		})

		it("conditionally executes pass based on tokens", async () => {
			const messages: ApiMessage[] = Array(100)
				.fill(null)
				.map((_, i) => ({
					ts: Date.now() + i,
					role: "user",
					content: "x".repeat(500), // ~500 tokens each
				}))

			const passWithHighThreshold = {
				id: "conditional-high",
				execution: {
					type: "conditional" as const,
					condition: { tokenThreshold: 60000 },
				},
			}

			const passWithLowThreshold = {
				id: "conditional-low",
				execution: {
					type: "conditional" as const,
					condition: { tokenThreshold: 1000 },
				},
			}

			const shouldExecuteHigh = await (provider as any).shouldExecutePass(
				passWithHighThreshold,
				messages,
				mockContext,
			)
			const shouldExecuteLow = await (provider as any).shouldExecutePass(
				passWithLowThreshold,
				messages,
				mockContext,
			)

			// With ~50K tokens, high threshold should fail, low should pass
			expect(shouldExecuteHigh).toBe(false)
			expect(shouldExecuteLow).toBe(true)
		})
	})

	describe("Lossless Prelude", () => {
		it("executes lossless prelude when enabled", async () => {
			const config = {
				losslessPrelude: {
					enabled: true,
					operations: {
						deduplicateFileReads: true,
						consolidateToolResults: true,
						removeObsoleteState: true,
					},
				},
				passes: [],
			}

			const providerWithPrelude = new SmartCondensationProvider(config)
			const messages: ApiMessage[] = [{ ts: Date.now(), role: "user", content: "Test message" }]

			mockContext.messages = messages

			const result = await providerWithPrelude.condense(mockContext, mockOptions)

			// Check that lossless_prelude is in operations
			expect(result.metrics?.operationsApplied).toContain("lossless_prelude")
		})

		it("skips lossless prelude when disabled", async () => {
			const config = {
				losslessPrelude: { enabled: false },
				passes: [],
			}

			const providerWithoutPrelude = new SmartCondensationProvider(config)
			const messages: ApiMessage[] = [{ ts: Date.now(), role: "user", content: "Test message" }]

			mockContext.messages = messages

			const result = await providerWithoutPrelude.condense(mockContext, mockOptions)

			// Check that lossless_prelude is NOT in operations
			expect(result.metrics?.operationsApplied).not.toContain("lossless_prelude")
		})
	})

	describe("Early Exit", () => {
		it("stops execution when target tokens reached", async () => {
			const config = {
				losslessPrelude: { enabled: false },
				passes: [
					{
						id: "pass1",
						name: "Pass 1",
						description: "First pass",
						selection: { type: "preserve_recent" as const, keepRecentCount: 50 },
						mode: "individual" as const,
						individualConfig: {
							defaults: {
								messageText: { operation: "keep" as const },
								toolParameters: { operation: "suppress" as const },
								toolResults: { operation: "suppress" as const },
							},
						},
						execution: { type: "always" as const },
					},
					{
						id: "pass2",
						name: "Pass 2",
						description: "Second pass - should not execute",
						selection: { type: "preserve_recent" as const, keepRecentCount: 40 },
						mode: "individual" as const,
						individualConfig: {
							defaults: {
								messageText: { operation: "keep" as const },
								toolParameters: { operation: "suppress" as const },
								toolResults: { operation: "suppress" as const },
							},
						},
						execution: { type: "always" as const },
					},
				],
			}

			const providerWithEarlyExit = new SmartCondensationProvider(config)

			// Small message set that will be under target after pass1
			const messages: ApiMessage[] = [
				{ ts: Date.now(), role: "user", content: "Short" },
				{ ts: Date.now() + 1, role: "assistant", content: "Response" },
			]

			mockContext.messages = messages
			mockContext.targetTokens = 1000 // High target

			const result = await providerWithEarlyExit.condense(mockContext, mockOptions)

			// Only pass1 should execute, not pass2
			expect(result.metrics?.operationsApplied).toContain("pass_pass1")
			expect(result.metrics?.operationsApplied).not.toContain("pass_pass2")
		})
	})

	describe("Predefined Configurations", () => {
		it("CONSERVATIVE_CONFIG is valid", () => {
			expect(CONSERVATIVE_CONFIG.passes.length).toBeGreaterThan(0)
			expect(CONSERVATIVE_CONFIG.losslessPrelude?.enabled).toBe(true)

			// Check structure
			const firstPass = CONSERVATIVE_CONFIG.passes[0]
			expect(firstPass.id).toBeDefined()
			expect(firstPass.mode).toBeDefined()
		})

		it("BALANCED_CONFIG is valid", () => {
			expect(BALANCED_CONFIG.passes.length).toBeGreaterThan(0)
			expect(BALANCED_CONFIG.losslessPrelude?.enabled).toBe(true)

			// Balanced should have LLM quality as first pass (quality-first strategy)
			const firstPass = BALANCED_CONFIG.passes[0]
			expect(firstPass.id).toBe("llm-quality")
		})

		it("AGGRESSIVE_CONFIG is valid", () => {
			expect(AGGRESSIVE_CONFIG.passes.length).toBeGreaterThan(0)
			expect(AGGRESSIVE_CONFIG.losslessPrelude?.enabled).toBe(true)

			// Aggressive should prioritize suppression
			const firstPass = AGGRESSIVE_CONFIG.passes[0]
			expect(firstPass.id).toBe("suppress-ancient")
		})
	})

	describe("Message-Level Thresholds (Phase 4.5)", () => {
		it("applies operation only to content exceeding threshold", async () => {
			const config = {
				passes: [
					{
						id: "threshold-test",
						name: "Threshold Test",
						selection: { type: "preserve_recent" as const, keepRecentCount: 0 },
						mode: "individual" as const,
						individualConfig: {
							defaults: {
								messageText: { operation: "keep" as const },
								toolParameters: { operation: "keep" as const },
								toolResults: { operation: "suppress" as const },
							},
							messageTokenThresholds: {
								toolResults: 500, // Only suppress if >500 tokens
							},
						},
						execution: { type: "always" as const },
					},
				],
			}

			const providerWithThresholds = new SmartCondensationProvider(config)

			// Create messages with different sizes
			const messages: ApiMessage[] = [
				{
					ts: Date.now(),
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "small_result",
							content: "A".repeat(400), // ~100 tokens (< 500 threshold)
						},
					],
				},
				{
					ts: Date.now() + 1,
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "large_result",
							content: "B".repeat(3000), // ~750 tokens (> 500 threshold)
						},
					],
				},
			]

			mockContext.messages = messages
			const result = await providerWithThresholds.condense(mockContext, mockOptions)

			// Small result: KEEP (below threshold)
			const firstMsg = result.messages[0].content as any[]
			expect(firstMsg[0].content).toBe("A".repeat(400))

			// Large result: SUPPRESS (above threshold)
			const secondMsg = result.messages[1].content as any[]
			expect(secondMsg[0].content).toContain("[Tool results suppressed]")
		})

		it("handles absence of thresholds (always process)", async () => {
			const config = {
				passes: [
					{
						id: "no-threshold-test",
						name: "No Threshold Test",
						selection: { type: "preserve_recent" as const, keepRecentCount: 0 },
						mode: "individual" as const,
						individualConfig: {
							defaults: {
								messageText: { operation: "keep" as const },
								toolParameters: { operation: "keep" as const },
								toolResults: { operation: "suppress" as const },
							},
							// No messageTokenThresholds defined
						},
						execution: { type: "always" as const },
					},
				],
			}

			const providerNoThresholds = new SmartCondensationProvider(config)

			const messages: ApiMessage[] = [
				{
					ts: Date.now(),
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "tiny_result",
							content: "Small", // Very small, but should still be suppressed
						},
					],
				},
			]

			mockContext.messages = messages
			const result = await providerNoThresholds.condense(mockContext, mockOptions)

			// Without threshold, operation applied regardless of size
			const msg = result.messages[0].content as any[]
			expect(msg[0].content).toContain("[Tool results suppressed]")
		})

		it("validates BALANCED config has realistic thresholds", () => {
			const llmQualityPass = BALANCED_CONFIG.passes.find((p) => p.id === "llm-quality")
			expect(llmQualityPass).toBeDefined()
			expect(llmQualityPass?.individualConfig?.messageTokenThresholds).toBeDefined()
			expect(llmQualityPass?.individualConfig?.messageTokenThresholds?.toolResults).toBe(1000)
		})

		it("validates CONSERVATIVE config has quality-first thresholds", () => {
			const qualityPass = CONSERVATIVE_CONFIG.passes.find((p) => p.id === "pass-1-quality")
			expect(qualityPass).toBeDefined()
			expect(qualityPass?.individualConfig?.messageTokenThresholds).toBeDefined()
			expect(qualityPass?.individualConfig?.messageTokenThresholds?.toolResults).toBe(2000)
		})

		it("validates AGGRESSIVE config has aggressive thresholds", () => {
			const suppressPass = AGGRESSIVE_CONFIG.passes.find((p) => p.id === "suppress-ancient")
			expect(suppressPass).toBeDefined()
			expect(suppressPass?.individualConfig?.messageTokenThresholds).toBeDefined()
			expect(suppressPass?.individualConfig?.messageTokenThresholds?.toolParameters).toBe(300)
			expect(suppressPass?.individualConfig?.messageTokenThresholds?.toolResults).toBe(300)
		})
	})
})
