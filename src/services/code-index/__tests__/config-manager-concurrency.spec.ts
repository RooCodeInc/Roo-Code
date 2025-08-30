import { describe, it, expect, beforeEach, vi } from "vitest"
import { CodeIndexConfigManager } from "../config-manager"
import { ContextProxy } from "../../../core/config/ContextProxy"
import { CODEBASE_INDEX_DEFAULTS } from "@roo-code/types"
import { PARSING_CONCURRENCY, MAX_PENDING_BATCHES, BATCH_PROCESSING_CONCURRENCY } from "../constants"

describe("CodeIndexConfigManager - Concurrency Settings", () => {
	let configManager: CodeIndexConfigManager
	let mockContextProxy: ContextProxy

	beforeEach(() => {
		mockContextProxy = {
			getGlobalState: vi.fn(),
			getSecret: vi.fn(),
			refreshSecrets: vi.fn().mockResolvedValue(undefined),
		} as any

		configManager = new CodeIndexConfigManager(mockContextProxy)
	})

	describe("Concurrency Configuration", () => {
		it("should use default values when no concurrency settings are configured", () => {
			// Setup mock to return empty config
			vi.mocked(mockContextProxy.getGlobalState).mockReturnValue({
				codebaseIndexEnabled: true,
				codebaseIndexQdrantUrl: "http://localhost:6333",
				codebaseIndexEmbedderProvider: "openai",
			})
			vi.mocked(mockContextProxy.getSecret).mockImplementation((key) => {
				if (key === "codeIndexOpenAiKey") return "test-key"
				return ""
			})

			const config = configManager.getConfig()

			expect(config.parsingConcurrency).toBe(PARSING_CONCURRENCY)
			expect(config.maxPendingBatches).toBe(MAX_PENDING_BATCHES)
			expect(config.batchProcessingConcurrency).toBe(BATCH_PROCESSING_CONCURRENCY)
		})

		it("should use configured values when concurrency settings are provided", async () => {
			// Setup mock to return custom concurrency config
			vi.mocked(mockContextProxy.getGlobalState).mockReturnValue({
				codebaseIndexEnabled: true,
				codebaseIndexQdrantUrl: "http://localhost:6333",
				codebaseIndexEmbedderProvider: "openai",
				codebaseIndexParsingConcurrency: 25,
				codebaseIndexMaxPendingBatches: 50,
				codebaseIndexBatchProcessingConcurrency: 15,
			})
			vi.mocked(mockContextProxy.getSecret).mockImplementation((key) => {
				if (key === "codeIndexOpenAiKey") return "test-key"
				return ""
			})

			// Load configuration to pick up the new values
			await configManager.loadConfiguration()
			const config = configManager.getConfig()

			expect(config.parsingConcurrency).toBe(25)
			expect(config.maxPendingBatches).toBe(50)
			expect(config.batchProcessingConcurrency).toBe(15)
		})

		it("should respect minimum and maximum bounds for concurrency settings", () => {
			// Test that values are within the defined bounds
			const minParsingConcurrency = CODEBASE_INDEX_DEFAULTS.MIN_PARSING_CONCURRENCY
			const maxParsingConcurrency = CODEBASE_INDEX_DEFAULTS.MAX_PARSING_CONCURRENCY
			const minMaxPendingBatches = CODEBASE_INDEX_DEFAULTS.MIN_MAX_PENDING_BATCHES
			const maxMaxPendingBatches = CODEBASE_INDEX_DEFAULTS.MAX_MAX_PENDING_BATCHES
			const minBatchProcessingConcurrency = CODEBASE_INDEX_DEFAULTS.MIN_BATCH_PROCESSING_CONCURRENCY
			const maxBatchProcessingConcurrency = CODEBASE_INDEX_DEFAULTS.MAX_BATCH_PROCESSING_CONCURRENCY

			// Verify bounds are reasonable
			expect(minParsingConcurrency).toBeGreaterThanOrEqual(1)
			expect(maxParsingConcurrency).toBeLessThanOrEqual(50)
			expect(minMaxPendingBatches).toBeGreaterThanOrEqual(1)
			expect(maxMaxPendingBatches).toBeLessThanOrEqual(100)
			expect(minBatchProcessingConcurrency).toBeGreaterThanOrEqual(1)
			expect(maxBatchProcessingConcurrency).toBeLessThanOrEqual(50)
		})

		it("should use getter methods to retrieve concurrency values", () => {
			// Setup mock to return custom concurrency config
			vi.mocked(mockContextProxy.getGlobalState).mockReturnValue({
				codebaseIndexEnabled: true,
				codebaseIndexQdrantUrl: "http://localhost:6333",
				codebaseIndexEmbedderProvider: "openai",
				codebaseIndexParsingConcurrency: 30,
				codebaseIndexMaxPendingBatches: 40,
				codebaseIndexBatchProcessingConcurrency: 20,
			})
			vi.mocked(mockContextProxy.getSecret).mockImplementation((key) => {
				if (key === "codeIndexOpenAiKey") return "test-key"
				return ""
			})

			// Force re-initialization with new config
			const newConfigManager = new CodeIndexConfigManager(mockContextProxy)

			expect(newConfigManager.currentParsingConcurrency).toBe(30)
			expect(newConfigManager.currentMaxPendingBatches).toBe(40)
			expect(newConfigManager.currentBatchProcessingConcurrency).toBe(20)
		})

		it("should not require restart when only concurrency settings change", async () => {
			// Setup initial config
			vi.mocked(mockContextProxy.getGlobalState).mockReturnValue({
				codebaseIndexEnabled: true,
				codebaseIndexQdrantUrl: "http://localhost:6333",
				codebaseIndexEmbedderProvider: "openai",
				codebaseIndexParsingConcurrency: 10,
			})
			vi.mocked(mockContextProxy.getSecret).mockImplementation((key) => {
				if (key === "codeIndexOpenAiKey") return "test-key"
				return ""
			})

			// Load initial configuration
			await configManager.loadConfiguration()

			// Change only concurrency settings
			vi.mocked(mockContextProxy.getGlobalState).mockReturnValue({
				codebaseIndexEnabled: true,
				codebaseIndexQdrantUrl: "http://localhost:6333",
				codebaseIndexEmbedderProvider: "openai",
				codebaseIndexParsingConcurrency: 20, // Changed
			})

			// Load new configuration
			const result = await configManager.loadConfiguration()

			// Concurrency changes alone should not require restart
			// (This might need adjustment based on actual implementation requirements)
			expect(result.requiresRestart).toBe(false)
		})
	})
})
