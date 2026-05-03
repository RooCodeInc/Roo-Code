import { requestFimCompletion, type FimRequestOptions } from "../FimApiClient"

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

describe("FimApiClient", () => {
	beforeEach(() => {
		mockFetch.mockReset()
	})

	describe("requestFimCompletion", () => {
		const baseOptions: FimRequestOptions = {
			provider: "openai-compatible",
			baseUrl: "http://localhost:1234",
			apiKey: "test-key",
			modelId: "deepseek-coder",
			prefix: "function hello() {",
			suffix: "}",
			maxTokens: 128,
		}

		it("should make a request to the correct OpenAI-compatible endpoint", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					choices: [{ text: '\n  console.log("hello");\n' }],
				}),
			})

			await requestFimCompletion(baseOptions)

			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost:1234/v1/completions",
				expect.objectContaining({
					method: "POST",
					headers: expect.objectContaining({
						"Content-Type": "application/json",
						Authorization: "Bearer test-key",
					}),
				}),
			)
		})

		it("should use the Ollama endpoint for Ollama provider", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					response: '\n  console.log("hello");\n',
				}),
			})

			await requestFimCompletion({
				...baseOptions,
				provider: "ollama",
				baseUrl: "http://localhost:11434",
			})

			expect(mockFetch).toHaveBeenCalledWith("http://localhost:11434/api/generate", expect.anything())
		})

		it("should use the Mistral FIM endpoint for Mistral provider", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					choices: [{ text: "completion" }],
				}),
			})

			await requestFimCompletion({
				...baseOptions,
				provider: "mistral",
				baseUrl: "https://api.mistral.ai",
			})

			expect(mockFetch).toHaveBeenCalledWith("https://api.mistral.ai/v1/fim/completions", expect.anything())
		})

		it("should extract completion text from OpenAI-compatible response", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					choices: [{ text: "  return 42;" }],
				}),
			})

			const result = await requestFimCompletion(baseOptions)
			expect(result.completion).toBe("  return 42;")
		})

		it("should extract completion text from Ollama response", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					response: "  return 42;",
				}),
			})

			const result = await requestFimCompletion({
				...baseOptions,
				provider: "ollama",
				baseUrl: "http://localhost:11434",
			})
			expect(result.completion).toBe("  return 42;")
		})

		it("should return empty string for empty choices", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					choices: [],
				}),
			})

			const result = await requestFimCompletion(baseOptions)
			expect(result.completion).toBe("")
		})

		it("should throw an error for non-OK responses", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 401,
				text: async () => "Unauthorized",
			})

			await expect(requestFimCompletion(baseOptions)).rejects.toThrow(
				"FIM API request failed (401): Unauthorized",
			)
		})

		it("should not include Authorization header when no API key is provided", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					choices: [{ text: "test" }],
				}),
			})

			await requestFimCompletion({
				...baseOptions,
				apiKey: undefined,
			})

			const callArgs = mockFetch.mock.calls[0]
			const headers = callArgs[1].headers
			expect(headers).not.toHaveProperty("Authorization")
		})

		it("should normalize base URL by removing trailing slashes", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					choices: [{ text: "test" }],
				}),
			})

			await requestFimCompletion({
				...baseOptions,
				baseUrl: "http://localhost:1234///",
			})

			expect(mockFetch).toHaveBeenCalledWith("http://localhost:1234/v1/completions", expect.anything())
		})

		it("should pass the abort signal to fetch", async () => {
			const controller = new AbortController()
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					choices: [{ text: "test" }],
				}),
			})

			await requestFimCompletion({
				...baseOptions,
				signal: controller.signal,
			})

			expect(mockFetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					signal: controller.signal,
				}),
			)
		})

		it("should include FIM tokens in the prompt for openai-compatible provider", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					choices: [{ text: "test" }],
				}),
			})

			await requestFimCompletion(baseOptions)

			const callArgs = mockFetch.mock.calls[0]
			const body = JSON.parse(callArgs[1].body)
			// DeepSeek model should use DeepSeek FIM tokens
			expect(body.prompt).toContain("<|fim▁begin|>")
			expect(body.prompt).toContain("<|fim▁hole|>")
			expect(body.prompt).toContain("<|fim▁end|>")
		})

		it("should use native prefix/suffix for Ollama provider", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					response: "test",
				}),
			})

			await requestFimCompletion({
				...baseOptions,
				provider: "ollama",
				baseUrl: "http://localhost:11434",
			})

			const callArgs = mockFetch.mock.calls[0]
			const body = JSON.parse(callArgs[1].body)
			expect(body.prompt).toBe("function hello() {")
			expect(body.suffix).toBe("}")
		})
	})
})
