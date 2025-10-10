import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { MemoryMonitor } from "../MemoryMonitor"
import type { ClineMessage } from "@roo-code/types"
import type { TelemetryService } from "@roo-code/telemetry"
import type { ImageManager } from "../../image-storage/ImageManager"

describe("MemoryMonitor", () => {
	let monitor: MemoryMonitor
	let mockTelemetryService: TelemetryService
	let mockImageManager: ImageManager
	let messages: ClineMessage[]
	let apiHistory: any[]

	beforeEach(() => {
		// Mock telemetry service
		mockTelemetryService = {
			captureMemoryUsage: vi.fn(),
			captureMemoryWarning: vi.fn(),
			captureImageCleanup: vi.fn(),
		} as any

		// Mock image manager
		mockImageManager = {
			getEstimatedMemoryUsage: vi.fn().mockReturnValue(10.5), // 10.5 MB
		} as any

		// Sample messages
		messages = [
			{
				ts: Date.now(),
				type: "say",
				say: "text",
				text: "Hello world",
			},
			{
				ts: Date.now() + 1000,
				type: "ask",
				ask: "command",
				text: "Run command",
			},
		] as ClineMessage[]

		// Sample API history
		apiHistory = [
			{
				role: "user",
				content: [{ type: "text", text: "User message" }],
			},
			{
				role: "assistant",
				content: [{ type: "text", text: "Assistant response" }],
			},
		]

		monitor = new MemoryMonitor(
			"test-task-id",
			mockTelemetryService,
			mockImageManager,
			() => messages,
			() => apiHistory,
		)
	})

	afterEach(() => {
		monitor.dispose()
		vi.clearAllMocks()
	})

	describe("getMemoryUsage", () => {
		it("should calculate memory usage correctly", () => {
			const usage = monitor.getMemoryUsage()

			expect(usage).toHaveProperty("messagesMemoryMB")
			expect(usage).toHaveProperty("imagesMemoryMB")
			expect(usage).toHaveProperty("apiHistoryMemoryMB")
			expect(usage).toHaveProperty("totalMemoryMB")

			// Images memory should come from ImageManager
			expect(usage.imagesMemoryMB).toBe(10.5)

			// Messages and API history should be estimated (may be 0 for very small data)
			expect(usage.messagesMemoryMB).toBeGreaterThanOrEqual(0)
			expect(usage.apiHistoryMemoryMB).toBeGreaterThanOrEqual(0)

			// Total should be sum of all components
			expect(usage.totalMemoryMB).toBe(usage.messagesMemoryMB + usage.imagesMemoryMB + usage.apiHistoryMemoryMB)
		})

		it("should return 0 for images when ImageManager returns 0", () => {
			mockImageManager.getEstimatedMemoryUsage = vi.fn().mockReturnValue(0)

			const usage = monitor.getMemoryUsage()

			expect(usage.imagesMemoryMB).toBe(0)
		})

		it("should handle empty messages and API history", () => {
			monitor = new MemoryMonitor(
				"test-task-id",
				mockTelemetryService,
				mockImageManager,
				() => [],
				() => [],
			)

			const usage = monitor.getMemoryUsage()

			expect(usage.messagesMemoryMB).toBeGreaterThanOrEqual(0)
			expect(usage.apiHistoryMemoryMB).toBeGreaterThanOrEqual(0)
		})
	})

	describe("start and stop", () => {
		it("should start monitoring and capture initial usage", () => {
			monitor.start()

			expect(mockTelemetryService.captureMemoryUsage).toHaveBeenCalledWith("test-task-id", expect.any(Object))
		})

		it("should not start monitoring twice", () => {
			monitor.start()
			vi.clearAllMocks()

			monitor.start() // Second call should be ignored

			expect(mockTelemetryService.captureMemoryUsage).not.toHaveBeenCalled()
		})

		it("should stop monitoring", () => {
			monitor.start()
			vi.clearAllMocks()

			monitor.stop()

			// Wait a bit to ensure no more calls are made
			return new Promise((resolve) => {
				setTimeout(() => {
					expect(mockTelemetryService.captureMemoryUsage).not.toHaveBeenCalled()
					resolve(undefined)
				}, 100)
			})
		})
	})

	describe("memory warnings", () => {
		it("should trigger warning when threshold exceeded", () => {
			// Create monitor with low thresholds
			monitor = new MemoryMonitor(
				"test-task-id",
				mockTelemetryService,
				mockImageManager,
				() => messages,
				() => apiHistory,
				{
					warningThresholdMB: 0.01, // Very low threshold
					criticalThresholdMB: 100,
					monitoringIntervalMs: 100,
				},
			)

			monitor.start()

			expect(mockTelemetryService.captureMemoryWarning).toHaveBeenCalledWith(
				"test-task-id",
				"warning",
				expect.any(Number),
				0.01,
			)
		})

		it("should trigger critical warning when critical threshold exceeded", () => {
			// Create monitor with very low critical threshold
			monitor = new MemoryMonitor(
				"test-task-id",
				mockTelemetryService,
				mockImageManager,
				() => messages,
				() => apiHistory,
				{
					warningThresholdMB: 0.005,
					criticalThresholdMB: 0.01, // Very low threshold
					monitoringIntervalMs: 100,
				},
			)

			monitor.start()

			expect(mockTelemetryService.captureMemoryWarning).toHaveBeenCalledWith(
				"test-task-id",
				"critical",
				expect.any(Number),
				0.01,
			)
		})

		it("should not trigger duplicate warnings for same level", () => {
			// Create monitor with low threshold
			monitor = new MemoryMonitor(
				"test-task-id",
				mockTelemetryService,
				mockImageManager,
				() => messages,
				() => apiHistory,
				{
					warningThresholdMB: 0.01,
					criticalThresholdMB: 100,
					monitoringIntervalMs: 50,
				},
			)

			monitor.start()

			// Wait for multiple monitoring cycles
			return new Promise((resolve) => {
				setTimeout(() => {
					// Should only trigger warning once despite multiple checks
					expect(mockTelemetryService.captureMemoryWarning).toHaveBeenCalledTimes(1)
					resolve(undefined)
				}, 200)
			})
		})
	})

	describe("periodic monitoring", () => {
		it("should check memory usage periodically", () => {
			monitor = new MemoryMonitor(
				"test-task-id",
				mockTelemetryService,
				mockImageManager,
				() => messages,
				() => apiHistory,
				{
					monitoringIntervalMs: 100, // Check every 100ms
				},
			)

			monitor.start()

			return new Promise((resolve) => {
				setTimeout(() => {
					// Should have been called multiple times (initial + periodic)
					expect(mockTelemetryService.captureMemoryUsage).toHaveBeenCalledTimes(3)
					resolve(undefined)
				}, 250)
			})
		})
	})

	describe("dispose", () => {
		it("should stop monitoring on dispose", () => {
			monitor.start()
			vi.clearAllMocks()

			monitor.dispose()

			return new Promise((resolve) => {
				setTimeout(() => {
					expect(mockTelemetryService.captureMemoryUsage).not.toHaveBeenCalled()
					resolve(undefined)
				}, 100)
			})
		})

		it("should be safe to call dispose multiple times", () => {
			monitor.start()
			monitor.dispose()

			expect(() => monitor.dispose()).not.toThrow()
		})
	})

	describe("memory estimation", () => {
		it("should estimate memory size accurately for objects", () => {
			const largeMessages: ClineMessage[] = Array.from({ length: 1000 }, (_, i) => ({
				ts: Date.now() + i,
				type: "say",
				say: "text",
				text: "A".repeat(1000), // 1000 characters per message
			})) as ClineMessage[]

			monitor = new MemoryMonitor(
				"test-task-id",
				mockTelemetryService,
				mockImageManager,
				() => largeMessages,
				() => [],
			)

			const usage = monitor.getMemoryUsage()

			// With 1000 messages of ~1000 chars each, should be at least 0.5 MB
			// (actual size depends on JSON serialization overhead)
			expect(usage.messagesMemoryMB).toBeGreaterThan(0.5)
		})

		it("should handle serialization errors gracefully", () => {
			// Create circular reference that will fail JSON.stringify
			const circular: any = { a: 1 }
			circular.self = circular

			monitor = new MemoryMonitor(
				"test-task-id",
				mockTelemetryService,
				mockImageManager,
				() => [circular] as any,
				() => [],
			)

			const usage = monitor.getMemoryUsage()

			// Should return 0 instead of throwing
			expect(usage.messagesMemoryMB).toBe(0)
		})
	})

	describe("configuration", () => {
		it("should use default configuration when not provided", () => {
			monitor = new MemoryMonitor(
				"test-task-id",
				mockTelemetryService,
				mockImageManager,
				() => messages,
				() => apiHistory,
			)

			// Start and check that it works with defaults
			monitor.start()

			expect(mockTelemetryService.captureMemoryUsage).toHaveBeenCalled()
		})

		it("should respect custom thresholds", () => {
			monitor = new MemoryMonitor(
				"test-task-id",
				mockTelemetryService,
				mockImageManager,
				() => messages,
				() => apiHistory,
				{
					warningThresholdMB: 200,
					criticalThresholdMB: 500,
				},
			)

			monitor.start()

			// With high thresholds, no warnings should be triggered
			expect(mockTelemetryService.captureMemoryWarning).not.toHaveBeenCalled()
		})
	})
})
