import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest"
import { ClaudeCodeHandler } from "../claude-code"
import * as os from "os"
import * as path from "path"
import type { ApiHandlerOptions } from "../../../shared/api"

// Mock the fs module - matching the actual import style in claude-code.ts
vi.mock("fs", () => ({
	promises: {
		readFile: vi.fn(),
	},
}))

// Mock os module
vi.mock("os", () => ({
	homedir: vi.fn(() => "/home/user"),
	platform: vi.fn(() => "linux"),
}))

// Mock process.cwd
const originalCwd = process.cwd
beforeEach(() => {
	process.cwd = vi.fn(() => "/workspace")
	vi.clearAllMocks()
})

afterEach(() => {
	process.cwd = originalCwd
	vi.restoreAllMocks()
})

describe("ClaudeCodeHandler - Alternative Providers", () => {
	describe("readClaudeCodeConfig", () => {
		it("should read config from ~/.claude/settings.json first", async () => {
			const { promises: fs } = await import("fs")
			const mockConfig = {
				env: {
					ANTHROPIC_BASE_URL: "https://api.z.ai/v1",
					ANTHROPIC_MODEL: "glm-4.5",
				},
			}

			;(fs.readFile as Mock).mockImplementation(async (filePath: string) => {
				if (filePath === path.join("/home/user", ".claude", "settings.json")) {
					return JSON.stringify(mockConfig)
				}
				throw new Error("File not found")
			})

			const handler = new ClaudeCodeHandler({} as ApiHandlerOptions)
			// Access private method through any type assertion for testing
			const config = await (handler as any).readClaudeCodeConfig()

			expect(config).toEqual(mockConfig)
			expect(fs.readFile).toHaveBeenCalledWith(path.join("/home/user", ".claude", "settings.json"), "utf8")
		})

		it("should try multiple config locations in order", async () => {
			const { promises: fs } = await import("fs")
			;(fs.readFile as Mock).mockRejectedValue(new Error("File not found"))

			const handler = new ClaudeCodeHandler({} as ApiHandlerOptions)
			// Clear cached config to force fresh read
			;(handler as any).cachedConfig = null
			const config = await (handler as any).readClaudeCodeConfig()

			expect(config).toBeNull()
			// The constructor calls initializeModelDetection which also reads config,
			// so we expect 10 calls total (5 from constructor + 5 from our test)
			expect(fs.readFile).toHaveBeenCalledTimes(10)
		})

		it("should cache config after first read", async () => {
			const { promises: fs } = await import("fs")
			const mockConfig = { env: { ANTHROPIC_BASE_URL: "https://api.z.ai/v1" } }
			;(fs.readFile as Mock).mockImplementation(async (filePath: string) => {
				if (filePath === path.join("/home/user", ".claude", "settings.json")) {
					return JSON.stringify(mockConfig)
				}
				throw new Error("File not found")
			})

			const handler = new ClaudeCodeHandler({} as ApiHandlerOptions)
			// Clear any cached config first
			;(handler as any).cachedConfig = null
			const config1 = await (handler as any).readClaudeCodeConfig()
			const config2 = await (handler as any).readClaudeCodeConfig()

			expect(config1).toBe(config2) // Same reference, cached
			expect(config1).toEqual(mockConfig)
			// Called once from constructor's initializeModelDetection and once from our test
			expect(fs.readFile).toHaveBeenCalledTimes(2)
		})
	})

	describe("detectProviderFromConfig", () => {
		it("should detect Z.ai provider", async () => {
			const { promises: fs } = await import("fs")
			const mockConfig = {
				env: {
					ANTHROPIC_BASE_URL: "https://api.z.ai/v1",
				},
			}

			;(fs.readFile as Mock).mockImplementation(async () => JSON.stringify(mockConfig))

			const handler = new ClaudeCodeHandler({} as ApiHandlerOptions)
			// Clear cached config to force fresh read
			;(handler as any).cachedConfig = null
			const provider = await (handler as any).detectProviderFromConfig()

			expect(provider).toBeTruthy()
			expect(provider?.provider).toBe("zai")
			expect(provider?.models).toHaveProperty("glm-4.5")
			expect(provider?.models).toHaveProperty("glm-4.5-air")
			expect(provider?.models).toHaveProperty("glm-4.6")
		})

		it("should detect Qwen provider from Dashscope URL", async () => {
			const { promises: fs } = await import("fs")
			const mockConfig = {
				env: {
					ANTHROPIC_BASE_URL: "https://dashscope.aliyuncs.com/api/v1",
				},
			}

			;(fs.readFile as Mock).mockImplementation(async () => JSON.stringify(mockConfig))

			const handler = new ClaudeCodeHandler({} as ApiHandlerOptions)
			// Clear cached config to force fresh read
			;(handler as any).cachedConfig = null
			const provider = await (handler as any).detectProviderFromConfig()

			expect(provider).toBeTruthy()
			expect(provider?.provider).toBe("qwen-code")
			expect(provider?.models).toHaveProperty("qwen3-coder-plus")
			expect(provider?.models).toHaveProperty("qwen3-coder-flash")
		})

		it("should detect DeepSeek provider", async () => {
			const { promises: fs } = await import("fs")
			const mockConfig = {
				env: {
					ANTHROPIC_BASE_URL: "https://api.deepseek.com/v1",
				},
			}

			;(fs.readFile as Mock).mockImplementation(async () => JSON.stringify(mockConfig))

			const handler = new ClaudeCodeHandler({} as ApiHandlerOptions)
			// Clear cached config to force fresh read
			;(handler as any).cachedConfig = null
			const provider = await (handler as any).detectProviderFromConfig()

			expect(provider).toBeTruthy()
			expect(provider?.provider).toBe("deepseek")
			expect(provider?.models).toHaveProperty("deepseek-chat")
			expect(provider?.models).toHaveProperty("deepseek-reasoner")
		})

		it("should return null for standard Claude API", async () => {
			const { promises: fs } = await import("fs")
			const mockConfig = {
				env: {
					ANTHROPIC_BASE_URL: "https://api.anthropic.com/v1",
				},
			}

			;(fs.readFile as Mock).mockImplementation(async () => JSON.stringify(mockConfig))

			const handler = new ClaudeCodeHandler({} as ApiHandlerOptions)
			// Clear cached config to force fresh read
			;(handler as any).cachedConfig = null
			const provider = await (handler as any).detectProviderFromConfig()

			expect(provider).toBeNull()
		})

		it("should return null when no config exists", async () => {
			const { promises: fs } = await import("fs")
			;(fs.readFile as Mock).mockImplementation(async () => {
				throw new Error("File not found")
			})

			const handler = new ClaudeCodeHandler({} as ApiHandlerOptions)
			// Clear cached config to force fresh read
			;(handler as any).cachedConfig = null
			const provider = await (handler as any).detectProviderFromConfig()

			expect(provider).toBeNull()
		})
	})

	describe("getAvailableModels", () => {
		it("should return Z.ai models when Z.ai is configured", async () => {
			const { promises: fs } = await import("fs")
			const mockConfig = {
				env: {
					ANTHROPIC_BASE_URL: "https://api.z.ai/v1",
					ANTHROPIC_MODEL: "glm-4.5",
				},
			}

			;(fs.readFile as Mock).mockResolvedValue(JSON.stringify(mockConfig))

			const result = await ClaudeCodeHandler.getAvailableModels()

			expect(result).toBeTruthy()
			expect(result?.provider).toBe("zai")
			expect(result?.models).toHaveProperty("glm-4.5")
			expect(Object.keys(result?.models || {})).toContain("glm-4.5")
			expect(Object.keys(result?.models || {})).toContain("glm-4.5-air")
			expect(Object.keys(result?.models || {})).toContain("glm-4.6")
		})

		it("should return default Claude models when no alternative provider", async () => {
			const { promises: fs } = await import("fs")
			;(fs.readFile as Mock).mockRejectedValue(new Error("File not found"))

			const result = await ClaudeCodeHandler.getAvailableModels()

			expect(result).toBeTruthy()
			expect(result?.provider).toBe("claude-code")
			expect(result?.models).toHaveProperty("claude-sonnet-4-5")
			expect(result?.models).toHaveProperty("claude-opus-4-1-20250805")
		})

		it("should handle errors gracefully", async () => {
			const { promises: fs } = await import("fs")
			;(fs.readFile as Mock).mockRejectedValue(new Error("Permission denied"))

			const result = await ClaudeCodeHandler.getAvailableModels()

			expect(result).toBeTruthy()
			expect(result?.provider).toBe("claude-code")
			expect(result?.models).toBeDefined()
		})
	})

	describe("getModel", () => {
		it("should return cached model info for alternative provider", async () => {
			const { promises: fs } = await import("fs")
			const mockConfig = {
				env: {
					ANTHROPIC_BASE_URL: "https://api.z.ai/v1",
					ANTHROPIC_MODEL: "glm-4.5",
				},
			}

			;(fs.readFile as Mock).mockResolvedValue(JSON.stringify(mockConfig))

			const handler = new ClaudeCodeHandler({ apiModelId: "glm-4.5" } as ApiHandlerOptions)

			// Wait for initialization
			await new Promise((resolve) => setTimeout(resolve, 100))

			const model = handler.getModel()

			expect(model.id).toBe("glm-4.5")
			expect(model.info).toBeDefined()
			expect(model.info.maxTokens).toBeDefined()
		})

		it("should use default model when cache not ready", () => {
			const handler = new ClaudeCodeHandler({} as ApiHandlerOptions)
			const model = handler.getModel()

			expect(model.id).toBe("claude-sonnet-4-20250514")
			expect(model.info).toBeDefined()
		})

		it("should override maxTokens with configured value", async () => {
			const handler = new ClaudeCodeHandler({
				claudeCodeMaxOutputTokens: 32000,
			} as ApiHandlerOptions)

			// Wait for initialization
			await new Promise((resolve) => setTimeout(resolve, 100))

			const model = handler.getModel()

			expect(model.info.maxTokens).toBe(32000)
		})
	})

	describe("createMessage with alternative providers", () => {
		it("should pass environment variables to runClaudeCode for Z.ai", async () => {
			const { promises: fs } = await import("fs")
			const mockConfig = {
				env: {
					ANTHROPIC_BASE_URL: "https://api.z.ai/v1",
					ANTHROPIC_MODEL: "glm-4.5",
					ANTHROPIC_API_KEY: "test-key",
				},
			}

			;(fs.readFile as Mock).mockResolvedValue(JSON.stringify(mockConfig))

			// Mock runClaudeCode
			const runClaudeCodeModule = await import("../../../integrations/claude-code/run")
			vi.spyOn(runClaudeCodeModule, "runClaudeCode").mockImplementation(async function* () {
				yield { type: "usage", inputTokens: 100, outputTokens: 50, totalCost: 0.001 }
			} as any)

			const handler = new ClaudeCodeHandler({ apiModelId: "glm-4.5" } as ApiHandlerOptions)
			// Wait for initialization
			await new Promise((resolve) => setTimeout(resolve, 100))

			const messages = [{ role: "user" as const, content: "test" }]

			const generator = handler.createMessage("system prompt", messages)
			const results = []
			for await (const chunk of generator) {
				results.push(chunk)
			}

			expect(runClaudeCodeModule.runClaudeCode).toHaveBeenCalledWith(
				expect.objectContaining({
					envVars: mockConfig.env,
					modelId: "glm-4.5",
				}),
			)
		})

		it("should use standard Claude model ID when no alternative provider", async () => {
			const { promises: fs } = await import("fs")
			;(fs.readFile as Mock).mockRejectedValue(new Error("File not found"))

			// Mock runClaudeCode
			const runClaudeCodeModule = await import("../../../integrations/claude-code/run")
			vi.spyOn(runClaudeCodeModule, "runClaudeCode").mockImplementation(async function* () {
				yield { type: "usage", inputTokens: 100, outputTokens: 50, totalCost: 0.001 }
			} as any)

			const handler = new ClaudeCodeHandler({ apiModelId: "claude-sonnet-4-5" } as ApiHandlerOptions)
			// Wait for initialization to complete
			await new Promise((resolve) => setTimeout(resolve, 100))

			const messages = [{ role: "user" as const, content: "test" }]

			const generator = handler.createMessage("system prompt", messages)
			const results = []
			for await (const chunk of generator) {
				results.push(chunk)
			}

			// claude-sonnet-4-5 is a valid ClaudeCodeModelId, so it should be used as-is
			expect(runClaudeCodeModule.runClaudeCode).toHaveBeenCalledWith(
				expect.objectContaining({
					modelId: "claude-sonnet-4-5",
					envVars: {},
				}),
			)
		})
	})
})
