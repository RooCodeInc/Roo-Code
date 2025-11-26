import { describe, it, expect, vi, beforeEach } from "vitest"
import { BaseOpenAiCompatibleProvider } from "../base-openai-compatible-provider"
import type { ApiHandlerOptions } from "../../../shared/api"
import type { ModelInfo } from "@roo-code/types"

// Mock OpenAI client
vi.mock("openai", () => {
	return {
		default: vi.fn().mockImplementation(() => ({
			chat: {
				completions: {
					create: vi.fn(),
				},
			},
		})),
	}
})

// Mock i18n
vi.mock("../../../i18n/setup", () => ({
	default: {
		t: (key: string) => {
			const translations: Record<string, string> = {
				"common:errors.api.dnsResolutionFailed":
					"Cannot resolve hostname. This usually means you need to connect to your corporate VPN to access internal services. If you're using an internal API endpoint, please verify your VPN connection is active.",
				"common:errors.api.connectionRefused":
					"Service refused connection. The API endpoint is reachable but not accepting connections. Please verify the service is running and the port is correct.",
				"common:errors.api.connectionTimeout":
					"Request timed out. The API endpoint may be unreachable or experiencing issues. If using an internal service, verify your VPN connection is stable.",
			}
			return translations[key] || key
		},
	},
}))

// Concrete implementation for testing
class TestOpenAiProvider extends BaseOpenAiCompatibleProvider<"test-model"> {
	constructor(options: ApiHandlerOptions) {
		const providerModels: Record<"test-model", ModelInfo> = {
			"test-model": {
				maxTokens: 100000,
				contextWindow: 128000,
				supportsImages: true,
				supportsPromptCache: false,
				inputPrice: 0.0,
				outputPrice: 0.0,
			},
		}

		super({
			...options,
			providerName: "TestProvider",
			baseURL: "https://api.test.com",
			defaultProviderModelId: "test-model",
			providerModels,
		})
	}

	getModel() {
		return {
			id: this.options.apiModelId || this.defaultProviderModelId,
			info: this.providerModels[this.defaultProviderModelId],
		}
	}
}

describe("BaseOpenAiCompatibleProvider - Error Handling Integration", () => {
	let provider: TestOpenAiProvider
	let mockCreate: any

	beforeEach(() => {
		vi.clearAllMocks()

		const options: ApiHandlerOptions = {
			apiKey: "test-key",
			apiModelId: "test-model",
		}

		provider = new TestOpenAiProvider(options)
		mockCreate = (provider as any).client.chat.completions.create
	})

	describe("Stream creation errors", () => {
		it("should handle DNS resolution failures during stream creation", async () => {
			const dnsError = new Error("getaddrinfo ENOTFOUND mskongai.use.ucdp.net")
			mockCreate.mockRejectedValue(dnsError)

			await expect(async () => {
				const stream = provider.createMessage("system prompt", [
					{ role: "user", content: "test message" },
				])
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				for await (const _ of stream) {
					// consume stream
				}
			}).rejects.toThrow("TestProvider connection error:")
			await expect(async () => {
				const stream = provider.createMessage("system prompt", [
					{ role: "user", content: "test message" },
				])
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				for await (const _ of stream) {
					// consume stream
				}
			}).rejects.toThrow("Cannot resolve hostname")
		})

		it("should handle connection refused during stream creation", async () => {
			const refusedError = new Error("connect ECONNREFUSED 127.0.0.1:11434")
			mockCreate.mockRejectedValue(refusedError)

			await expect(async () => {
				const stream = provider.createMessage("system prompt", [
					{ role: "user", content: "test message" },
				])
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				for await (const _ of stream) {
					// consume stream
				}
			}).rejects.toThrow("Service refused connection")
		})

		it("should handle timeout during stream creation", async () => {
			const timeoutError = new Error("connect ETIMEDOUT")
			mockCreate.mockRejectedValue(timeoutError)

			await expect(async () => {
				const stream = provider.createMessage("system prompt", [
					{ role: "user", content: "test message" },
				])
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				for await (const _ of stream) {
					// consume stream
				}
			}).rejects.toThrow("Request timed out")
			await expect(async () => {
				const stream = provider.createMessage("system prompt", [
					{ role: "user", content: "test message" },
				])
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				for await (const _ of stream) {
					// consume stream
				}
			}).rejects.toThrow("VPN connection is stable")
		})
	})

	describe("Stream iteration errors", () => {
		it("should handle errors thrown during stream iteration", async () => {
			// Mock stream that throws error during iteration
			const mockStream = {
				[Symbol.asyncIterator]: async function* () {
					yield {
						choices: [{ delta: { content: "partial response" } }],
					}
					throw new Error("getaddrinfo ENOTFOUND internal.api.com")
				},
			}

			mockCreate.mockResolvedValue(mockStream)

			await expect(async () => {
				const stream = provider.createMessage("system prompt", [
					{ role: "user", content: "test message" },
				])
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				for await (const _ of stream) {
					// consume stream
				}
			}).rejects.toThrow("Cannot resolve hostname")
		})

		it("should handle connection reset during stream iteration", async () => {
			const mockStream = {
				[Symbol.asyncIterator]: async function* () {
					yield {
						choices: [{ delta: { content: "partial" } }],
					}
					const error = new Error("socket hang up")
					;(error as any).code = "ECONNRESET"
					throw error
				},
			}

			mockCreate.mockResolvedValue(mockStream)

			await expect(async () => {
				const stream = provider.createMessage("system prompt", [
					{ role: "user", content: "test message" },
				])
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				for await (const _ of stream) {
					// consume stream
				}
			}).rejects.toThrow("Connection error")
		})
	})

	describe("Error message format", () => {
		it("should prefix errors with provider name", async () => {
			const error = new Error("Some API error")
			mockCreate.mockRejectedValue(error)

			await expect(async () => {
				const stream = provider.createMessage("system prompt", [
					{ role: "user", content: "test message" },
				])
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				for await (const _ of stream) {
					// consume stream
				}
			}).rejects.toThrow("TestProvider completion error: Some API error")
		})

		it("should preserve original error details in console", async () => {
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
			const error = new Error("Test error")
			mockCreate.mockRejectedValue(error)

			try {
				const stream = provider.createMessage("system prompt", [
					{ role: "user", content: "test message" },
				])
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				for await (const _ of stream) {
					// consume stream
				}
			} catch {
				// Expected to throw
			}

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"[TestProvider] API error:",
				expect.objectContaining({
					message: "Test error",
					name: "Error",
				}),
			)

			consoleErrorSpy.mockRestore()
		})
	})

	describe("Different providers", () => {
		it("should work with different provider names", async () => {
			class CustomProvider extends BaseOpenAiCompatibleProvider<"custom-model"> {
				constructor(options: ApiHandlerOptions) {
					super({
						...options,
						providerName: "CustomAI",
						baseURL: "https://api.custom.com",
						defaultProviderModelId: "custom-model",
						providerModels: {
							"custom-model": {
								maxTokens: 100000,
								contextWindow: 128000,
								supportsImages: false,
								supportsPromptCache: false,
								inputPrice: 0.0,
								outputPrice: 0.0,
							},
						},
					})
				}

				getModel() {
					return {
						id: "custom-model",
						info: this.providerModels["custom-model"],
					}
				}
			}

			const customProvider = new CustomProvider({ apiKey: "test", apiModelId: "custom-model" })
			const mockCustomCreate = (customProvider as any).client.chat.completions.create

			const error = new Error("ENOTFOUND")
			mockCustomCreate.mockRejectedValue(error)

			await expect(async () => {
				const stream = customProvider.createMessage("system prompt", [
					{ role: "user", content: "test" },
				])
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				for await (const _ of stream) {
					// consume stream
				}
			}).rejects.toThrow("CustomAI connection error:")
		})
	})

	describe("Real-world scenarios", () => {
		it("should handle Kong AI Gateway VPN scenario", async () => {
			const kongError = new Error("getaddrinfo ENOTFOUND mskongai.use.ucdp.net")
			mockCreate.mockRejectedValue(kongError)

			let caughtError: Error | undefined

			try {
				const stream = provider.createMessage("You are a helpful assistant", [
					{ role: "user", content: "Hello" },
				])
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				for await (const _ of stream) {
					// consume stream
				}
			} catch (error) {
				caughtError = error as Error
			}

			expect(caughtError).toBeDefined()
			expect(caughtError?.message).toContain("Cannot resolve hostname")
			expect(caughtError?.message).toContain("corporate VPN")
			expect(caughtError?.message).toContain("internal services")
		})

		it("should handle Ollama not running scenario", async () => {
			const ollamaError = new Error("connect ECONNREFUSED 127.0.0.1:11434")
			mockCreate.mockRejectedValue(ollamaError)

			let caughtError: Error | undefined

			try {
				const stream = provider.createMessage("You are a helpful assistant", [
					{ role: "user", content: "Hello" },
				])
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				for await (const _ of stream) {
					// consume stream
				}
			} catch (error) {
				caughtError = error as Error
			}

			expect(caughtError).toBeDefined()
			expect(caughtError?.message).toContain("Service refused connection")
			expect(caughtError?.message).toContain("verify the service is running")
		})

		it("should handle network timeout during long-running request", async () => {
			const timeoutError = new Error("Request timeout after 30 seconds")
			mockCreate.mockRejectedValue(timeoutError)

			let caughtError: Error | undefined

			try {
				const stream = provider.createMessage("You are a helpful assistant", [
					{ role: "user", content: "Generate a very long response" },
				])
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				for await (const _ of stream) {
					// consume stream
				}
			} catch (error) {
				caughtError = error as Error
			}

			expect(caughtError).toBeDefined()
			expect(caughtError?.message).toContain("timed out")
		})
	})
})
