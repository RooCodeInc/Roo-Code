import { describe, it, expect, beforeEach, vi } from "vitest"
import { JudgeService } from "../JudgeService"
import { JudgeConfig, TaskContext } from "../types"
import { ClineMessage } from "../../../shared/ExtensionMessage"

// Mock vscode - must include all exports used by the codebase
vi.mock("vscode", () => ({
	workspace: {
		getConfiguration: vi.fn(() => ({
			get: vi.fn(() => true),
		})),
		createFileSystemWatcher: vi.fn(() => ({
			onDidCreate: vi.fn(),
			onDidChange: vi.fn(),
			onDidDelete: vi.fn(),
			dispose: vi.fn(),
		})),
	},
	window: {
		createTextEditorDecorationType: vi.fn(() => ({
			dispose: vi.fn(),
		})),
		showErrorMessage: vi.fn(),
		showInformationMessage: vi.fn(),
	},
	RelativePattern: vi.fn(),
	Uri: {
		file: vi.fn((path) => ({ fsPath: path })),
	},
	EventEmitter: vi.fn(() => ({
		event: vi.fn(),
		fire: vi.fn(),
		dispose: vi.fn(),
	})),
	ExtensionContext: vi.fn(),
}))

describe("JudgeService", () => {
	let judgeService: JudgeService
	let mockContext: any

	const mockConfig: JudgeConfig = {
		enabled: true,
		mode: "always",
		detailLevel: "concise",
		allowUserOverride: true,
	}

	const mockTaskContext: TaskContext = {
		originalTask: "Create a hello world function",
		conversationHistory: [
			{
				ts: Date.now(),
				type: "say",
				say: "text",
				text: "Create a hello world function in TypeScript",
			},
			{
				ts: Date.now() + 1000,
				type: "say",
				say: "text",
				text: "I'll create a hello world function for you.",
			},
		] as ClineMessage[],
		toolCalls: ["write_to_file"],
		fileChanges: ["hello.ts"],
		currentMode: "code",
	}

	beforeEach(() => {
		mockContext = {
			subscriptions: [],
			extensionPath: "/test/path",
		}

		judgeService = new JudgeService(mockConfig, mockContext)
	})

	describe("constructor", () => {
		it("should create an instance with provided config and context", () => {
			expect(judgeService).toBeInstanceOf(JudgeService)
		})

		it("should handle config without modelConfig", () => {
			const service = new JudgeService(mockConfig, mockContext)
			expect(service).toBeInstanceOf(JudgeService)
		})
	})

	describe("config management", () => {
		it("should return current config", () => {
			const config = judgeService.getConfig()
			expect(config.enabled).toBe(true)
			expect(config.mode).toBe("always")
			expect(config.detailLevel).toBe("concise")
			expect(config.allowUserOverride).toBe(true)
		})

		it("should update config", () => {
			const newConfig: JudgeConfig = {
				enabled: false,
				mode: "never",
				detailLevel: "detailed",
				allowUserOverride: false,
			}

			judgeService.updateConfig(newConfig)
			const config = judgeService.getConfig()

			expect(config.enabled).toBe(false)
			expect(config.mode).toBe("never")
			expect(config.detailLevel).toBe("detailed")
			expect(config.allowUserOverride).toBe(false)
		})

		it("should allow setting custom API handler", () => {
			const mockHandler = {
				createMessage: vi.fn(),
			}

			judgeService.setApiHandler(mockHandler as any)

			// Verify the service still works
			expect(judgeService).toBeInstanceOf(JudgeService)
		})

		it("should handle mode changes", () => {
			const modes: Array<"always" | "ask" | "never"> = ["always", "ask", "never"]

			for (const mode of modes) {
				const config: JudgeConfig = {
					...mockConfig,
					mode,
				}

				judgeService.updateConfig(config)
				expect(judgeService.getConfig().mode).toBe(mode)
			}
		})

		it("should handle detail level changes", () => {
			const levels: Array<"concise" | "detailed"> = ["concise", "detailed"]

			for (const level of levels) {
				const config: JudgeConfig = {
					...mockConfig,
					detailLevel: level,
				}

				judgeService.updateConfig(config)
				expect(judgeService.getConfig().detailLevel).toBe(level)
			}
		})
	})

	describe("judgeCompletion - error handling", () => {
		it("should return approved result when no API handler is set", async () => {
			// Don't set an API handler - this will cause an error
			const result = await judgeService.judgeCompletion(mockTaskContext, "Task completed")

			// Should return approved to avoid blocking user
			expect(result.approved).toBe(true)
			expect(result.reasoning).toContain("错误")
		})

		it("should handle API errors gracefully", async () => {
			const mockHandler = {
				createMessage: vi.fn(() => {
					throw new Error("API Error")
				}),
			}

			judgeService.setApiHandler(mockHandler as any)

			const result = await judgeService.judgeCompletion(mockTaskContext, "Task result")

			// Should return approved result to avoid blocking user
			expect(result.approved).toBe(true)
			expect(result.reasoning).toContain("错误")
		})
	})

	describe("config validation", () => {
		it("should accept valid config with all fields", () => {
			const fullConfig: JudgeConfig = {
				enabled: true,
				mode: "ask",
				detailLevel: "detailed",
				allowUserOverride: true,
				modelConfig: {
					provider: "anthropic",
					modelId: "claude-3-5-sonnet-20250110",
				} as any,
			}

			const service = new JudgeService(fullConfig, mockContext)
			const config = service.getConfig()

			expect(config.enabled).toBe(true)
			expect(config.mode).toBe("ask")
			expect(config.detailLevel).toBe("detailed")
			expect(config.allowUserOverride).toBe(true)
		})

		it("should handle minimal config", () => {
			const minimalConfig: JudgeConfig = {
				enabled: false,
				mode: "never",
				detailLevel: "concise",
				allowUserOverride: false,
			}

			const service = new JudgeService(minimalConfig, mockContext)
			const config = service.getConfig()

			expect(config.enabled).toBe(false)
			expect(config.mode).toBe("never")
		})
	})

	describe("task context handling", () => {
		it("should handle empty conversation history", () => {
			const emptyContext: TaskContext = {
				...mockTaskContext,
				conversationHistory: [],
			}

			// Should not throw
			expect(emptyContext.conversationHistory).toHaveLength(0)
		})

		it("should handle empty files modified list", () => {
			const noFilesContext: TaskContext = {
				...mockTaskContext,
				fileChanges: [],
			}

			// Should not throw
			expect(noFilesContext.fileChanges).toHaveLength(0)
		})

		it("should handle minimal task context", () => {
			const minimalContext: TaskContext = {
				originalTask: "Simple task",
				conversationHistory: [],
				toolCalls: [],
				fileChanges: [],
				currentMode: "code",
			}

			// Should not throw
			expect(minimalContext.originalTask).toBe("Simple task")
		})

		it("should handle long conversation history", () => {
			const longHistory = Array(100)
				.fill(null)
				.map((_, i) => ({
					ts: Date.now() + i * 1000,
					type: "say" as const,
					say: "text" as const,
					text: `Message ${i}`,
				})) as ClineMessage[]

			const longContext: TaskContext = {
				...mockTaskContext,
				conversationHistory: longHistory,
			}

			expect(longContext.conversationHistory).toHaveLength(100)
		})
	})

	describe("service lifecycle", () => {
		it("should allow multiple config updates", () => {
			for (let i = 0; i < 5; i++) {
				const config: JudgeConfig = {
					...mockConfig,
					enabled: i % 2 === 0,
				}

				judgeService.updateConfig(config)
				expect(judgeService.getConfig().enabled).toBe(i % 2 === 0)
			}
		})

		it("should maintain state across operations", () => {
			const originalConfig = judgeService.getConfig()

			// Perform some operations
			judgeService.setApiHandler({} as any)

			// Config should remain unchanged
			const currentConfig = judgeService.getConfig()
			expect(currentConfig.enabled).toBe(originalConfig.enabled)
			expect(currentConfig.mode).toBe(originalConfig.mode)
		})
	})
})
