// npx vitest run src/api/providers/__tests__/sapaicore.spec.ts

import { SapAiCoreHandler } from "../sapaicore"
import type { ApiHandlerOptions } from "../../../shared/api.js"
import axios from "axios"

vitest.mock("axios", () => ({
	default: {
		post: vitest.fn(),
		get: vitest.fn(),
	},
}))

// Mock Gemini utility functions
vitest.mock("../sapaicore.js", async (importOriginal) => {
	const original = (await importOriginal()) as any
	return {
		...original,
		processGeminiStreamChunk: vitest.fn().mockImplementation((data: any) => {
			// Simple mock implementation
			const result: any = {}
			if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
				result.text = data.candidates[0].content.parts[0].text
			}
			if (data.usageMetadata) {
				result.usageMetadata = data.usageMetadata
			}
			return result
		}),
		prepareGeminiRequestPayload: vitest.fn().mockReturnValue({
			messages: [],
			generationConfig: { maxOutputTokens: 8192 },
		}),
	}
})

describe("SapAiCoreHandler", () => {
	const mockOptions: ApiHandlerOptions = {
		apiModelId: "anthropic--claude-3.5-sonnet",
		sapAiCoreClientId: "test-client-id",
		sapAiCoreClientSecret: "test-client-secret",
		sapAiCoreTokenUrl: "https://test.sapaicore.ai/oauth/token",
		sapAiCoreBaseUrl: "https://test.sapaicore.ai",
		sapAiResourceGroup: "test-group",
	}

	let handler: SapAiCoreHandler

	beforeEach(() => {
		handler = new SapAiCoreHandler(mockOptions)
		vitest.clearAllMocks()
	})

	describe("constructor", () => {
		it("should create handler with valid options", () => {
			expect(handler).toBeInstanceOf(SapAiCoreHandler)
		})

		it("should get model info correctly", () => {
			const model = handler.getModel()
			expect(model.id).toBe("anthropic--claude-3.5-sonnet")
			expect(model.info).toBeDefined()
		})
	})

	describe("createMessage", () => {
		it("should handle successful streaming response", async () => {
			// Mock successful auth
			vi.mocked(axios.post).mockResolvedValueOnce({
				data: { access_token: "test-access-token", expires_in: 3600 },
				status: 200,
			})

			// Mock deployments response with correct deployment structure
			vi.mocked(axios.get).mockResolvedValueOnce({
				data: {
					resources: [
						{
							id: "test-deployment-123",
							targetStatus: "RUNNING",
							details: {
								resources: {
									backend_details: {
										model: {
											name: "anthropic--claude-3.5-sonnet",
											version: "1.0",
										},
									},
								},
							},
						},
					],
				},
			})

			// Mock streaming response - should be an async iterable
			const mockStreamData = [
				'data: {"type": "message_start", "message": {"usage": {"input_tokens": 10, "output_tokens": 5}}}\n\n',
				'data: {"type": "content_block_start", "content_block": {"type": "text", "text": "Hello"}}\n\n',
				'data: {"type": "content_block_delta", "delta": {"type": "text_delta", "text": " world"}}\n\n',
				'data: {"type": "message_delta", "delta": {"stop_reason": "end_turn", "usage": {"output_tokens": 15}}}\n\n',
				"data: [DONE]\n\n",
			]

			const mockStream = {
				async *[Symbol.asyncIterator]() {
					for (const chunk of mockStreamData) {
						yield chunk
					}
				},
			}

			vi.mocked(axios.post).mockResolvedValueOnce({
				data: mockStream,
			})

			const stream = handler.createMessage("You are a helpful assistant", [{ role: "user", content: "Hello" }])

			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks.length).toBeGreaterThan(0)
			expect(chunks.some((chunk) => chunk.type === "text")).toBe(true)
		})
	})

	describe("completePrompt", () => {
		it("should complete a simple prompt", async () => {
			// Mock successful auth
			vi.mocked(axios.post).mockResolvedValueOnce({
				data: { access_token: "test-access-token", expires_in: 3600 },
				status: 200,
			})

			// Mock deployments response with correct deployment structure
			vi.mocked(axios.get).mockResolvedValueOnce({
				data: {
					resources: [
						{
							id: "test-deployment-123",
							targetStatus: "RUNNING",
							details: {
								resources: {
									backend_details: {
										model: {
											name: "anthropic--claude-3.5-sonnet",
											version: "1.0",
										},
									},
								},
							},
						},
					],
				},
			})

			// Mock streaming response - should be an async iterable
			const mockStreamData = [
				'data: {"type": "message_start", "message": {"usage": {"input_tokens": 10, "output_tokens": 5}}}\n\n',
				'data: {"type": "content_block_start", "content_block": {"type": "text", "text": "Test response"}}\n\n',
				'data: {"type": "message_delta", "delta": {"stop_reason": "end_turn", "usage": {"output_tokens": 15}}}\n\n',
				"data: [DONE]\n\n",
			]

			const mockStream = {
				async *[Symbol.asyncIterator]() {
					for (const chunk of mockStreamData) {
						yield chunk
					}
				},
			}

			vi.mocked(axios.post).mockResolvedValueOnce({
				data: mockStream,
			})

			const result = await handler.completePrompt("Hello")
			expect(typeof result).toBe("string")
			expect(result).toContain("Test response")
		})
	})

	describe("Authentication and Token Management", () => {
		it("should handle authentication failures", async () => {
			// Mock auth failure
			vi.mocked(axios.post).mockRejectedValueOnce({
				response: {
					status: 401,
					data: { error: "unauthorized", error_description: "Invalid client credentials" },
				},
			})

			await expect(handler.createMessage("system", [{ role: "user", content: "test" }]).next()).rejects.toThrow()
		})

		it("should handle token refresh when token expires", async () => {
			// Mock first auth call
			vi.mocked(axios.post).mockResolvedValueOnce({
				data: { access_token: "expired-token", expires_in: -1 }, // Already expired
				status: 200,
			})

			// Mock second auth call (refresh)
			vi.mocked(axios.post).mockResolvedValueOnce({
				data: { access_token: "new-token", expires_in: 3600 },
				status: 200,
			})

			// Mock deployments response
			vi.mocked(axios.get).mockResolvedValueOnce({
				data: {
					resources: [
						{
							id: "test-deployment-123",
							targetStatus: "RUNNING",
							details: {
								resources: {
									backend_details: {
										model: {
											name: "anthropic--claude-3.5-sonnet",
											version: "1.0",
										},
									},
								},
							},
						},
					],
				},
			})

			const mockStream = {
				async *[Symbol.asyncIterator]() {
					yield 'data: {"type": "content_block_start", "content_block": {"type": "text", "text": "response"}}\n\n'
				},
			}

			vi.mocked(axios.post).mockResolvedValueOnce({
				data: mockStream,
			})

			const stream = handler.createMessage("system", [{ role: "user", content: "test" }])
			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
				break // Just test one chunk
			}

			// Verify we made 2 auth calls (initial + refresh)
			expect(vi.mocked(axios.post)).toHaveBeenCalledTimes(3) // 2 auth + 1 inference
		})

		it("should handle expired token mid-stream scenario", async () => {
			// Mock successful initial auth
			vi.mocked(axios.post).mockResolvedValueOnce({
				data: { access_token: "valid-token", expires_in: 3600 },
				status: 200,
			})

			// Mock deployments response
			vi.mocked(axios.get).mockResolvedValueOnce({
				data: {
					resources: [
						{
							id: "test-deployment-123",
							targetStatus: "RUNNING",
							details: {
								resources: {
									backend_details: {
										model: {
											name: "anthropic--claude-3.5-sonnet",
											version: "1.0",
										},
									},
								},
							},
						},
					],
				},
			})

			// Mock inference call that fails with 401 (expired token)
			vi.mocked(axios.post).mockRejectedValueOnce({
				response: {
					status: 401,
					data: { error: "unauthorized", error_description: "Access token expired" },
				},
			})

			const stream = handler.createMessage("system", [{ role: "user", content: "test" }])

			await expect(stream.next()).rejects.toThrow()
		})

		it("should handle invalid token format in response", async () => {
			// Mock auth with invalid response format
			vi.mocked(axios.post).mockResolvedValueOnce({
				data: { invalid_response: "missing access_token" },
				status: 200,
			})

			await expect(handler.createMessage("system", [{ role: "user", content: "test" }]).next()).rejects.toThrow()
		})
	})

	describe("Network Errors and Timeouts", () => {
		it("should handle network timeout during authentication", async () => {
			// Mock network timeout
			vi.mocked(axios.post).mockRejectedValueOnce({
				code: "ECONNABORTED",
				message: "timeout of 5000ms exceeded",
				request: {},
			})

			await expect(handler.createMessage("system", [{ role: "user", content: "test" }]).next()).rejects.toThrow(
				"timeout of 5000ms exceeded",
			)
		})

		it("should handle network timeout during inference", async () => {
			// Mock successful auth
			vi.mocked(axios.post).mockResolvedValueOnce({
				data: { access_token: "test-token", expires_in: 3600 },
				status: 200,
			})

			// Mock deployments response
			vi.mocked(axios.get).mockResolvedValueOnce({
				data: {
					resources: [
						{
							id: "test-deployment-123",
							targetStatus: "RUNNING",
							details: {
								resources: {
									backend_details: {
										model: {
											name: "anthropic--claude-3.5-sonnet",
											version: "1.0",
										},
									},
								},
							},
						},
					],
				},
			})

			// Mock timeout during inference
			vi.mocked(axios.post).mockRejectedValueOnce({
				code: "ECONNABORTED",
				message: "timeout of 30000ms exceeded",
				request: {},
			})

			await expect(handler.createMessage("system", [{ role: "user", content: "test" }]).next()).rejects.toThrow(
				"No response received from server",
			)
		})

		it("should handle connection refused errors", async () => {
			// Mock connection refused
			vi.mocked(axios.post).mockRejectedValueOnce({
				code: "ECONNREFUSED",
				message: "connect ECONNREFUSED 127.0.0.1:443",
				request: {},
			})

			await expect(handler.createMessage("system", [{ role: "user", content: "test" }]).next()).rejects.toThrow(
				"connect ECONNREFUSED 127.0.0.1:443",
			)
		})

		it("should handle DNS resolution failures", async () => {
			// Mock DNS failure
			vi.mocked(axios.post).mockRejectedValueOnce({
				code: "ENOTFOUND",
				message: "getaddrinfo ENOTFOUND invalid-domain.com",
				request: {},
			})

			await expect(handler.createMessage("system", [{ role: "user", content: "test" }]).next()).rejects.toThrow(
				"getaddrinfo ENOTFOUND invalid-domain.com",
			)
		})

		it("should handle SSL/TLS certificate errors", async () => {
			// Mock SSL error
			vi.mocked(axios.post).mockRejectedValueOnce({
				code: "CERT_UNTRUSTED",
				message: "certificate not trusted",
				request: {},
			})

			await expect(handler.createMessage("system", [{ role: "user", content: "test" }]).next()).rejects.toThrow(
				"certificate not trusted",
			)
		})
	})

	describe("Invalid Deployment Responses", () => {
		it("should handle empty deployments list", async () => {
			// Mock successful auth
			vi.mocked(axios.post).mockResolvedValueOnce({
				data: { access_token: "test-token", expires_in: 3600 },
				status: 200,
			})

			// Mock empty deployments response
			vi.mocked(axios.get).mockResolvedValueOnce({
				data: { resources: [] },
			})

			await expect(handler.createMessage("system", [{ role: "user", content: "test" }]).next()).rejects.toThrow(
				"No running deployment found for model",
			)
		})

		it("should handle deployments with no RUNNING status", async () => {
			// Mock successful auth
			vi.mocked(axios.post).mockResolvedValueOnce({
				data: { access_token: "test-token", expires_in: 3600 },
				status: 200,
			})

			// Mock deployments with stopped/error status
			vi.mocked(axios.get).mockResolvedValueOnce({
				data: {
					resources: [
						{
							id: "test-deployment-123",
							targetStatus: "STOPPED",
							details: {
								resources: {
									backend_details: {
										model: {
											name: "anthropic--claude-3.5-sonnet",
											version: "1.0",
										},
									},
								},
							},
						},
					],
				},
			})

			await expect(handler.createMessage("system", [{ role: "user", content: "test" }]).next()).rejects.toThrow(
				"No running deployment found for model",
			)
		})

		it("should handle malformed deployment response structure", async () => {
			// Mock successful auth
			vi.mocked(axios.post).mockResolvedValueOnce({
				data: { access_token: "test-token", expires_in: 3600 },
				status: 200,
			})

			// Mock malformed deployments response
			vi.mocked(axios.get).mockResolvedValueOnce({
				data: {
					resources: [
						{
							id: "test-deployment-123",
							targetStatus: "RUNNING",
							// Missing details.resources.backend_details.model
							details: {
								invalid_structure: true,
							},
						},
					],
				},
			})

			await expect(handler.createMessage("system", [{ role: "user", content: "test" }]).next()).rejects.toThrow(
				"No running deployment found for model",
			)
		})

		it("should handle deployments API returning 404", async () => {
			const handler = new SapAiCoreHandler(mockOptions)

			// Mock successful auth
			vi.mocked(axios.post).mockResolvedValueOnce({
				data: { access_token: "test-token", expires_in: 3600 },
				status: 200,
			})

			// Mock 404 error for deployments API
			vi.mocked(axios.get).mockRejectedValueOnce({
				response: {
					status: 404,
					data: "Deployments endpoint not found",
				},
			})

			await expect(handler.createMessage("system", [{ role: "user", content: "test" }]).next()).rejects.toThrow(
				"Failed to fetch deployments",
			)
		})

		it("should handle deployments API returning 500", async () => {
			// Mock successful auth
			vi.mocked(axios.post).mockResolvedValueOnce({
				data: { access_token: "test-token", expires_in: 3600 },
				status: 200,
			})

			// Mock 500 error for deployments API
			vi.mocked(axios.get).mockRejectedValueOnce({
				response: {
					status: 500,
					data: "Internal server error",
				},
			})

			await expect(handler.createMessage("system", [{ role: "user", content: "test" }]).next()).rejects.toThrow(
				"Failed to fetch deployments",
			)
		})
	})

	describe("Different Model Types", () => {
		describe("OpenAI GPT Models", () => {
			const gptOptions: ApiHandlerOptions = {
				...mockOptions,
				apiModelId: "gpt-4o",
			}

			it("should handle GPT-4o streaming correctly", async () => {
				const gptHandler = new SapAiCoreHandler(gptOptions)

				// Mock successful auth
				vi.mocked(axios.post).mockResolvedValueOnce({
					data: { access_token: "test-token", expires_in: 3600 },
					status: 200,
				})

				// Mock deployments response
				vi.mocked(axios.get).mockResolvedValueOnce({
					data: {
						resources: [
							{
								id: "gpt-deployment-123",
								targetStatus: "RUNNING",
								details: {
									resources: {
										backend_details: {
											model: {
												name: "gpt-4o",
												version: "1.0",
											},
										},
									},
								},
							},
						],
					},
				})

				// Mock GPT streaming response
				const mockGptStream = {
					async *[Symbol.asyncIterator]() {
						yield 'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'
						yield 'data: {"choices":[{"delta":{"content":" world"}}]}\n\n'
						yield 'data: {"usage":{"prompt_tokens":10,"completion_tokens":5}}\n\n'
						yield "data: [DONE]\n\n"
					},
				}

				vi.mocked(axios.post).mockResolvedValueOnce({
					data: mockGptStream,
				})

				const stream = gptHandler.createMessage("system", [{ role: "user", content: "test" }])
				const chunks = []
				for await (const chunk of stream) {
					chunks.push(chunk)
				}

				expect(chunks.some((chunk) => chunk.type === "text" && chunk.text === "Hello")).toBe(true)
				expect(chunks.some((chunk) => chunk.type === "text" && chunk.text === " world")).toBe(true)
				expect(chunks.some((chunk) => chunk.type === "usage")).toBe(true)
			})

			it("should handle O1 reasoning models without temperature/max_tokens", async () => {
				const o1Handler = new SapAiCoreHandler({ ...mockOptions, apiModelId: "o1" })

				// Mock successful auth
				vi.mocked(axios.post).mockResolvedValueOnce({
					data: { access_token: "test-token", expires_in: 3600 },
					status: 200,
				})

				// Mock deployments response
				vi.mocked(axios.get).mockResolvedValueOnce({
					data: {
						resources: [
							{
								id: "o1-deployment-123",
								targetStatus: "RUNNING",
								details: {
									resources: {
										backend_details: {
											model: {
												name: "o1",
												version: "1.0",
											},
										},
									},
								},
							},
						],
					},
				})

				const mockO1Stream = {
					async *[Symbol.asyncIterator]() {
						yield 'data: {"choices":[{"delta":{"content":"Reasoning response"}}]}\n\n'
						yield "data: [DONE]\n\n"
					},
				}

				vi.mocked(axios.post).mockResolvedValueOnce({
					data: mockO1Stream,
				})

				const stream = o1Handler.createMessage("system", [{ role: "user", content: "test" }])
				const chunks = []
				for await (const chunk of stream) {
					chunks.push(chunk)
				}

				expect(chunks.some((chunk) => chunk.type === "text")).toBe(true)
			})

			it("should handle O3-mini non-streaming response", async () => {
				const o3Handler = new SapAiCoreHandler({ ...mockOptions, apiModelId: "o3-mini" })

				// Mock successful auth
				vi.mocked(axios.post).mockResolvedValueOnce({
					data: { access_token: "test-token", expires_in: 3600 },
					status: 200,
				})

				// Mock deployments response
				vi.mocked(axios.get).mockResolvedValueOnce({
					data: {
						resources: [
							{
								id: "o3-deployment-123",
								targetStatus: "RUNNING",
								details: {
									resources: {
										backend_details: {
											model: {
												name: "o3-mini",
												version: "1.0",
											},
										},
									},
								},
							},
						],
					},
				})

				// Mock non-streaming response for O3-mini (single call, not stream)
				vi.mocked(axios.post)
					.mockResolvedValueOnce({
						data: { access_token: "test-token", expires_in: 3600 },
						status: 200,
					}) // auth call
					.mockResolvedValueOnce({
						data: {
							choices: [
								{
									message: {
										content: "O3-mini response",
									},
								},
							],
							usage: {
								prompt_tokens: 10,
								completion_tokens: 5,
							},
						},
					}) // inference call

				const stream = o3Handler.createMessage("system", [{ role: "user", content: "test" }])
				const chunks = []
				for await (const chunk of stream) {
					chunks.push(chunk)
				}

				expect(chunks.some((chunk) => chunk.type === "text" && chunk.text === "O3-mini response")).toBe(true)
				expect(chunks.some((chunk) => chunk.type === "usage")).toBe(true)
			})
		})

		describe("Gemini Models", () => {
			const geminiOptions: ApiHandlerOptions = {
				...mockOptions,
				apiModelId: "gemini-2.5-flash",
			}

			it("should handle Gemini streaming with reasoning", async () => {
				const geminiHandler = new SapAiCoreHandler(geminiOptions)

				// Mock successful auth
				vi.mocked(axios.post).mockResolvedValueOnce({
					data: { access_token: "test-token", expires_in: 3600 },
					status: 200,
				})

				// Mock deployments response
				vi.mocked(axios.get).mockResolvedValueOnce({
					data: {
						resources: [
							{
								id: "gemini-deployment-123",
								targetStatus: "RUNNING",
								details: {
									resources: {
										backend_details: {
											model: {
												name: "gemini-2.5-flash",
												version: "1.0",
											},
										},
									},
								},
							},
						],
					},
				})

				// Mock Gemini streaming response
				const mockGeminiStream = {
					async *[Symbol.asyncIterator]() {
						yield 'data: {"candidates":[{"content":{"parts":[{"text":"Response text"}]}}]}\n\n'
						yield 'data: {"usageMetadata":{"promptTokenCount":10,"candidatesTokenCount":5}}\n\n'
					},
				}

				vi.mocked(axios.post).mockResolvedValueOnce({
					data: mockGeminiStream,
				})

				const stream = geminiHandler.createMessage("system", [{ role: "user", content: "test" }])
				const chunks = []
				for await (const chunk of stream) {
					chunks.push(chunk)
				}

				expect(chunks.length).toBeGreaterThan(0)
			})
		})

		describe("Claude Models with Caching", () => {
			const claudeOptions: ApiHandlerOptions = {
				...mockOptions,
				apiModelId: "anthropic--claude-4-sonnet",
			}

			it("should handle Claude 4 with caching support", async () => {
				const claudeHandler = new SapAiCoreHandler(claudeOptions)

				// Mock successful auth
				vi.mocked(axios.post).mockResolvedValueOnce({
					data: { access_token: "test-token", expires_in: 3600 },
					status: 200,
				})

				// Mock deployments response
				vi.mocked(axios.get).mockResolvedValueOnce({
					data: {
						resources: [
							{
								id: "claude-deployment-123",
								targetStatus: "RUNNING",
								details: {
									resources: {
										backend_details: {
											model: {
												name: "anthropic--claude-4-sonnet",
												version: "1.0",
											},
										},
									},
								},
							},
						],
					},
				})

				// Mock Claude 4 streaming response with caching metadata
				const mockClaude4Stream = {
					async *[Symbol.asyncIterator]() {
						yield 'data: {"metadata":{"usage":{"inputTokens":10,"outputTokens":5,"cacheReadInputTokens":2}}}\n\n'
						yield 'data: {"contentBlockDelta":{"delta":{"text":"Cached response"}}}\n\n'
					},
				}

				vi.mocked(axios.post).mockResolvedValueOnce({
					data: mockClaude4Stream,
				})

				const stream = claudeHandler.createMessage("system", [{ role: "user", content: "test" }])
				const chunks = []
				for await (const chunk of stream) {
					chunks.push(chunk)
				}

				expect(chunks.some((chunk) => chunk.type === "text")).toBe(true)
				expect(chunks.some((chunk) => chunk.type === "usage")).toBe(true)
			})
		})

		it("should handle unsupported model types", async () => {
			const unsupportedHandler = new SapAiCoreHandler({
				...mockOptions,
				apiModelId: "completely-unsupported-model-xyz" as any,
			})

			// Clear all mocks first
			vitest.clearAllMocks()

			// Mock successful auth
			vi.mocked(axios.post).mockResolvedValueOnce({
				data: { access_token: "test-token", expires_in: 3600 },
				status: 200,
			})

			// Mock deployments response with the matching unsupported model
			vi.mocked(axios.get).mockResolvedValueOnce({
				data: {
					resources: [
						{
							id: "unsupported-deployment-123",
							targetStatus: "RUNNING",
							details: {
								resources: {
									backend_details: {
										model: {
											name: "completely-unsupported-model-xyz",
											version: "1.0",
										},
									},
								},
							},
						},
					],
				},
			})

			await expect(
				unsupportedHandler.createMessage("system", [{ role: "user", content: "test" }]).next(),
			).rejects.toThrow("Unsupported model")
		})

		it("should handle no matching deployment for model", async () => {
			const noDeploymentHandler = new SapAiCoreHandler({ ...mockOptions, apiModelId: "gpt-4" })

			// Mock successful auth
			vi.mocked(axios.post).mockResolvedValueOnce({
				data: { access_token: "test-token", expires_in: 3600 },
				status: 200,
			})

			// Mock deployments response with a different model (so it doesn't find a deployment)
			vi.mocked(axios.get).mockResolvedValueOnce({
				data: {
					resources: [
						{
							id: "different-deployment-123",
							targetStatus: "RUNNING",
							details: {
								resources: {
									backend_details: {
										model: {
											name: "gpt-4o",
											version: "1.0",
										},
									},
								},
							},
						},
					],
				},
			})

			await expect(
				noDeploymentHandler.createMessage("system", [{ role: "user", content: "test" }]).next(),
			).rejects.toThrow("No running deployment found for model")
		})
	})

	describe("Error Handling and Resilience", () => {
		it("should handle authentication failures", async () => {
			// Mock auth failure
			vi.mocked(axios.post).mockRejectedValueOnce({
				response: {
					status: 401,
					data: { error: "unauthorized", error_description: "Invalid client credentials" },
				},
			})

			await expect(handler.createMessage("system", [{ role: "user", content: "test" }]).next()).rejects.toThrow()
		})

		it("should handle network timeout during authentication", async () => {
			// Mock network timeout
			vi.mocked(axios.post).mockRejectedValueOnce({
				code: "ECONNABORTED",
				message: "timeout of 5000ms exceeded",
				request: {},
			})

			await expect(handler.createMessage("system", [{ role: "user", content: "test" }]).next()).rejects.toThrow(
				"timeout of 5000ms exceeded",
			)
		})

		it("should handle empty deployments list", async () => {
			// Mock successful auth
			vi.mocked(axios.post).mockResolvedValueOnce({
				data: { access_token: "test-token", expires_in: 3600 },
				status: 200,
			})

			// Mock empty deployments response
			vi.mocked(axios.get).mockResolvedValueOnce({
				data: { resources: [] },
			})

			await expect(handler.createMessage("system", [{ role: "user", content: "test" }]).next()).rejects.toThrow(
				"No running deployment found for model",
			)
		})

		it("should handle deployments API returning 404", async () => {
			const handler = new SapAiCoreHandler(mockOptions)

			// Mock successful auth
			vi.mocked(axios.post).mockResolvedValueOnce({
				data: { access_token: "test-token", expires_in: 3600 },
				status: 200,
			})

			// Mock 404 error for deployments API
			vi.mocked(axios.get).mockRejectedValueOnce({
				response: {
					status: 404,
					data: "Deployments endpoint not found",
				},
			})

			await expect(handler.createMessage("system", [{ role: "user", content: "test" }]).next()).rejects.toThrow(
				"No running deployment found for model",
			)
		})
	})

	describe("HTTPS Security Validation", () => {
		it("should reject non-HTTPS token URLs", async () => {
			const insecureHandler = new SapAiCoreHandler({
				...mockOptions,
				sapAiCoreTokenUrl: "http://insecure.example.com/oauth/token",
			})

			await expect(
				insecureHandler.createMessage("system", [{ role: "user", content: "test" }]).next(),
			).rejects.toThrow("SAP AI Core Token URL must use HTTPS for security")
		})

		it("should reject non-HTTPS base URLs", async () => {
			const insecureHandler = new SapAiCoreHandler({
				...mockOptions,
				sapAiCoreBaseUrl: "http://insecure.example.com",
			})

			await expect(
				insecureHandler.createMessage("system", [{ role: "user", content: "test" }]).next(),
			).rejects.toThrow("SAP AI Core Base URL must use HTTPS for security")
		})
	})
})
