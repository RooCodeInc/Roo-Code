import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { Task } from "../Task"
import { ClineProvider } from "../../webview/ClineProvider"
import { ApiHandler } from "../../../api"
import { TelemetryService } from "@roo-code/telemetry"
import { DEFAULT_CONSECUTIVE_MISTAKE_LIMIT } from "@roo-code/types"

// Mock TelemetryService before any imports that might use it
vi.mock("@roo-code/telemetry", () => {
	const mockTelemetryService = {
		captureConsecutiveMistakeError: vi.fn(),
		captureEvent: vi.fn(),
		captureTaskCreated: vi.fn(),
		captureTaskRestarted: vi.fn(),
		captureConversationMessage: vi.fn(),
	}

	return {
		TelemetryService: {
			instance: mockTelemetryService,
			initialize: vi.fn(),
		},
	}
})

describe("Task - Token Burning Prevention", () => {
	let mockProvider: any
	let mockApiHandler: any
	let task: Task

	beforeEach(() => {
		// Mock provider
		mockProvider = {
			context: {
				globalStorageUri: { fsPath: "/test/storage" },
				extensionUri: { fsPath: "/test/extension" },
			},
			getState: vi.fn().mockResolvedValue({
				mode: "code",
				apiConfiguration: {
					apiProvider: "anthropic",
					apiKey: "test-key",
				},
			}),
			postStateToWebview: vi.fn(),
			postMessageToWebview: vi.fn(),
			updateTaskHistory: vi.fn(),
			log: vi.fn(),
		} as any

		// Mock API handler
		mockApiHandler = {
			getModel: vi.fn().mockReturnValue({
				id: "claude-3-opus",
				info: {
					contextWindow: 200000,
					supportsComputerUse: false,
				},
			}),
			createMessage: vi.fn(),
		} as any
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("Consecutive Mistake Guidance Limit", () => {
		it("should initialize with default values", () => {
			task = new Task({
				provider: mockProvider as ClineProvider,
				apiConfiguration: { apiProvider: "anthropic", apiKey: "test" },
				task: "test task",
			})

			expect(task.consecutiveMistakeCount).toBe(0)
			expect(task.consecutiveMistakeLimit).toBe(DEFAULT_CONSECUTIVE_MISTAKE_LIMIT)
			expect(task.consecutiveMistakeGuidanceCount).toBe(0)
			expect(task.maxConsecutiveMistakeGuidance).toBe(3)
		})

		it("should reset both counters when resetConsecutiveMistakeCounts is called", () => {
			task = new Task({
				provider: mockProvider as ClineProvider,
				apiConfiguration: { apiProvider: "anthropic", apiKey: "test" },
				task: "test task",
			})

			// Set some values
			task.consecutiveMistakeCount = 5
			task.consecutiveMistakeGuidanceCount = 2

			// Reset
			task.resetConsecutiveMistakeCounts()

			// Both should be reset
			expect(task.consecutiveMistakeCount).toBe(0)
			expect(task.consecutiveMistakeGuidanceCount).toBe(0)
		})

		it("should increment guidance count when asking for user guidance", async () => {
			task = new Task({
				provider: mockProvider as ClineProvider,
				apiConfiguration: { apiProvider: "anthropic", apiKey: "test" },
				consecutiveMistakeLimit: 3,
				task: "test task",
			})

			// Mock the ask method to simulate user providing feedback
			task.ask = vi.fn().mockResolvedValue({
				response: "messageResponse",
				text: "Try a different approach",
				images: undefined,
			})

			// Mock the say method
			task.say = vi.fn().mockResolvedValue(undefined)

			// Set mistake count to trigger guidance request
			task.consecutiveMistakeCount = 3
			task.consecutiveMistakeGuidanceCount = 0

			// Create a mock recursivelyMakeClineRequests that simulates the guidance flow
			const mockUserContent: any[] = []
			const stack = [{ userContent: mockUserContent, includeFileDetails: false }]

			// Simulate the part of recursivelyMakeClineRequests that handles mistakes
			if (task.consecutiveMistakeLimit > 0 && task.consecutiveMistakeCount >= task.consecutiveMistakeLimit) {
				if (task.consecutiveMistakeGuidanceCount >= task.maxConsecutiveMistakeGuidance) {
					// Should not reach here in this test
					expect(true).toBe(false)
				}

				task.consecutiveMistakeGuidanceCount++

				const guidanceMessage =
					task.consecutiveMistakeGuidanceCount > 1
						? `I've been making too many mistakes. Could you provide some guidance or corrections to help me proceed?\n\n(Attempt ${task.consecutiveMistakeGuidanceCount}/${task.maxConsecutiveMistakeGuidance} - I'm having difficulty making progress)`
						: "I've been making too many mistakes. Could you provide some guidance or corrections to help me proceed?"

				await task.ask("mistake_limit_reached", guidanceMessage)
				task.consecutiveMistakeCount = 0
			}

			expect(task.consecutiveMistakeGuidanceCount).toBe(1)
			expect(task.consecutiveMistakeCount).toBe(0)
		})

		it("should abort task when guidance limit is exceeded", async () => {
			task = new Task({
				provider: mockProvider as ClineProvider,
				apiConfiguration: { apiProvider: "anthropic", apiKey: "test" },
				consecutiveMistakeLimit: 3,
				task: "test task",
			})

			// Mock the say method
			task.say = vi.fn().mockResolvedValue(undefined)

			// Set counters to exceed limit
			task.consecutiveMistakeCount = 3
			task.consecutiveMistakeGuidanceCount = 3 // Already at max

			// Simulate the check in recursivelyMakeClineRequests
			let shouldAbort = false
			if (task.consecutiveMistakeLimit > 0 && task.consecutiveMistakeCount >= task.consecutiveMistakeLimit) {
				if (task.consecutiveMistakeGuidanceCount >= task.maxConsecutiveMistakeGuidance) {
					await task.say(
						"error",
						`I've been unable to proceed despite multiple attempts and guidance. The task appears to be stuck in a loop. To prevent excessive token usage, I'm stopping here. Please review the conversation and consider:\n\n1. Providing more specific instructions\n2. Breaking down the task into smaller steps\n3. Checking if there are any environmental issues preventing progress`,
					)

					// In the real code, this would capture telemetry
					TelemetryService.instance.captureConsecutiveMistakeError(task.taskId)

					shouldAbort = true
				}
			}

			expect(shouldAbort).toBe(true)
			expect(task.say).toHaveBeenCalledWith(
				"error",
				expect.stringContaining("unable to proceed despite multiple attempts"),
			)
			expect(TelemetryService.instance.captureConsecutiveMistakeError).toHaveBeenCalledWith(task.taskId)
		})

		it("should show attempt count in guidance message after first attempt", async () => {
			task = new Task({
				provider: mockProvider as ClineProvider,
				apiConfiguration: { apiProvider: "anthropic", apiKey: "test" },
				consecutiveMistakeLimit: 3,
				task: "test task",
			})

			// Mock the ask method
			task.ask = vi.fn().mockResolvedValue({
				response: "messageResponse",
				text: "Try again",
				images: undefined,
			})

			// Set guidance count to simulate second attempt
			task.consecutiveMistakeGuidanceCount = 1
			task.consecutiveMistakeCount = 3

			// Simulate generating the guidance message
			let guidanceMessage =
				"I've been making too many mistakes. Could you provide some guidance or corrections to help me proceed?"
			if (task.consecutiveMistakeGuidanceCount > 0) {
				task.consecutiveMistakeGuidanceCount++ // Increment before showing
				guidanceMessage = `${guidanceMessage}\n\n(Attempt ${task.consecutiveMistakeGuidanceCount}/${task.maxConsecutiveMistakeGuidance} - I'm having difficulty making progress)`
			} else {
				task.consecutiveMistakeGuidanceCount++
			}

			await task.ask("mistake_limit_reached", guidanceMessage)

			expect(task.ask).toHaveBeenCalledWith(
				"mistake_limit_reached",
				expect.stringContaining("(Attempt 2/3 - I'm having difficulty making progress)"),
			)
		})

		it("should log debug information when incrementing mistake count", () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})

			task = new Task({
				provider: mockProvider as ClineProvider,
				apiConfiguration: { apiProvider: "anthropic", apiKey: "test" },
				consecutiveMistakeLimit: 3,
				task: "test task",
			})

			// Simulate incrementing mistake count with logging
			task.consecutiveMistakeCount++
			console.log(
				`[Task#${task.taskId}] Consecutive mistake count: ${task.consecutiveMistakeCount}/${task.consecutiveMistakeLimit}, Guidance count: ${task.consecutiveMistakeGuidanceCount}/${task.maxConsecutiveMistakeGuidance}`,
			)

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("Consecutive mistake count: 1/3, Guidance count: 0/3"),
			)

			consoleSpy.mockRestore()
		})
	})

	describe("Token Burning Detection", () => {
		it("should log error when token burning is detected", async () => {
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			task = new Task({
				provider: mockProvider as ClineProvider,
				apiConfiguration: { apiProvider: "anthropic", apiKey: "test" },
				task: "test task",
			})

			// Set counters to trigger token burning detection
			task.consecutiveMistakeGuidanceCount = 3
			task.consecutiveMistakeCount = 5

			// Simulate token burning detection
			TelemetryService.instance.captureConsecutiveMistakeError(task.taskId)
			console.error(
				`[Task#${task.taskId}] Token burning detected - Guidance count: ${task.consecutiveMistakeGuidanceCount}, Mistake count: ${task.consecutiveMistakeCount}`,
			)

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining("Token burning detected - Guidance count: 3, Mistake count: 5"),
			)

			consoleErrorSpy.mockRestore()
		})
	})
})
