import { describe, it, expect, vi, beforeEach } from "vitest"
import axios from "axios"

import { getOllamaModels, parseOllamaModel, discoverOllamaModelsWithSorting } from "../ollama"
import ollamaModelsData from "./fixtures/ollama-model-details.json"

// Mock axios
vi.mock("axios")
const mockedAxios = axios as any

describe("Ollama Fetcher", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("parseOllamaModel", () => {
		it("should correctly parse Ollama model info", () => {
			const modelData = ollamaModelsData["qwen3-2to16:latest"]
			const parsedModel = parseOllamaModel(modelData, undefined)

			expect(parsedModel).toEqual({
				maxTokens: 40960,
				contextWindow: 40960,
				supportsImages: false,
				supportsPromptCache: true,
				supportsNativeTools: true,
				inputPrice: 0,
				outputPrice: 0,
				cacheWritesPrice: 0,
				cacheReadsPrice: 0,
				description: "Family: qwen3, Context: 40960, Size: 32.8B",
				family: "qwen3",
				quantizationLevel: "Q4_K_M",
				size: undefined,
			})
		})

		it("should handle models with null families field", () => {
			const modelDataWithNullFamilies = {
				...ollamaModelsData["qwen3-2to16:latest"],
				details: {
					...ollamaModelsData["qwen3-2to16:latest"].details,
					families: null,
				},
			}

			const parsedModel = parseOllamaModel(modelDataWithNullFamilies as any, undefined)

			expect(parsedModel).toEqual({
				maxTokens: 40960,
				contextWindow: 40960,
				supportsImages: false,
				supportsPromptCache: true,
				supportsNativeTools: true,
				inputPrice: 0,
				outputPrice: 0,
				cacheWritesPrice: 0,
				cacheReadsPrice: 0,
				description: "Family: qwen3, Context: 40960, Size: 32.8B",
				family: "qwen3",
				quantizationLevel: "Q4_K_M",
				size: undefined,
			})
		})

		it("should return model info when capabilities does not include 'tools'", () => {
			const modelDataWithoutTools = {
				...ollamaModelsData["qwen3-2to16:latest"],
				capabilities: ["completion"], // No "tools" capability
			}

			const parsedModel = parseOllamaModel(modelDataWithoutTools as any, undefined)

			// Models without tools capability are still returned, but with supportsNativeTools: false
			expect(parsedModel).not.toBeNull()
			expect(parsedModel!.supportsNativeTools).toBe(false)
		})

		it("should return model info when capabilities includes 'tools'", () => {
			const modelDataWithTools = {
				...ollamaModelsData["qwen3-2to16:latest"],
				capabilities: ["completion", "tools"], // Has "tools" capability
			}

			const parsedModel = parseOllamaModel(modelDataWithTools as any, undefined)

			expect(parsedModel).not.toBeNull()
			expect(parsedModel!.supportsNativeTools).toBe(true)
		})

		it("should return model info when capabilities is undefined (no tool support)", () => {
			const modelDataWithoutCapabilities = {
				...ollamaModelsData["qwen3-2to16:latest"],
				capabilities: undefined, // No capabilities array
			}

			const parsedModel = parseOllamaModel(modelDataWithoutCapabilities as any, undefined)

			// Models without explicit tools capability are still returned, but with supportsNativeTools: false
			expect(parsedModel).not.toBeNull()
			expect(parsedModel!.supportsNativeTools).toBe(false)
		})

		it("should return model info when model has vision but no tools capability", () => {
			const modelDataWithVision = {
				...ollamaModelsData["qwen3-2to16:latest"],
				capabilities: ["completion", "vision"],
			}

			const parsedModel = parseOllamaModel(modelDataWithVision as any, undefined)

			// Models with vision but no tools are still returned, with supportsImages: true and supportsNativeTools: false
			expect(parsedModel).not.toBeNull()
			expect(parsedModel!.supportsImages).toBe(true)
			expect(parsedModel!.supportsNativeTools).toBe(false)
		})

		it("should return model with both vision and tools when both capabilities present", () => {
			const modelDataWithBoth = {
				...ollamaModelsData["qwen3-2to16:latest"],
				capabilities: ["completion", "vision", "tools"],
			}

			const parsedModel = parseOllamaModel(modelDataWithBoth as any, undefined)

			expect(parsedModel).not.toBeNull()
			expect(parsedModel!.supportsImages).toBe(true)
			expect(parsedModel!.supportsNativeTools).toBe(true)
		})

		it("should handle null model_info gracefully", () => {
			const modelDataWithNullModelInfo = {
				...ollamaModelsData["qwen3-2to16:latest"],
				model_info: null,
			}

			const parsedModel = parseOllamaModel(modelDataWithNullModelInfo as any, undefined)

			expect(parsedModel).not.toBeNull()
			expect(parsedModel!.contextWindow).toBeDefined()
		})

		it("should handle undefined model_info gracefully", () => {
			const modelDataWithUndefinedModelInfo = {
				...ollamaModelsData["qwen3-2to16:latest"],
				model_info: undefined,
			}

			const parsedModel = parseOllamaModel(modelDataWithUndefinedModelInfo as any, undefined)

			expect(parsedModel).not.toBeNull()
			expect(parsedModel!.contextWindow).toBeDefined()
		})

		it("should handle empty model_info object gracefully", () => {
			const modelDataWithEmptyModelInfo = {
				...ollamaModelsData["qwen3-2to16:latest"],
				model_info: {},
			}

			const parsedModel = parseOllamaModel(modelDataWithEmptyModelInfo as any, undefined)

			expect(parsedModel).not.toBeNull()
			expect(parsedModel!.contextWindow).toBeDefined()
		})
	})

	describe("getOllamaModels", () => {
		beforeEach(() => {
			vi.clearAllMocks()
		})

		it("should fetch model list from /api/tags and include models with tools capability", async () => {
			const baseUrl = "http://localhost:11434"
			const modelName = "devstral2to16:latest"

			const mockApiTagsResponse = {
				models: [
					{
						name: modelName,
						model: modelName,
						modified_at: "2025-06-03T09:23:22.610222878-04:00",
						size: 14333928010,
						digest: "6a5f0c01d2c96c687d79e32fdd25b87087feb376bf9838f854d10be8cf3c10a5",
						details: {
							family: "llama",
							families: ["llama"],
							format: "gguf",
							parameter_size: "23.6B",
							parent_model: "",
							quantization_level: "Q4_K_M",
						},
					},
				],
			}
			const mockApiShowResponse = {
				license: "Mock License",
				modelfile: "FROM /path/to/blob\nTEMPLATE {{ .Prompt }}",
				parameters: "num_ctx 4096\nstop_token <eos>",
				template: "{{ .System }}USER: {{ .Prompt }}ASSISTANT:",
				modified_at: "2025-06-03T09:23:22.610222878-04:00",
				details: {
					parent_model: "",
					format: "gguf",
					family: "llama",
					families: ["llama"],
					parameter_size: "23.6B",
					quantization_level: "Q4_K_M",
				},
				model_info: {
					"ollama.context_length": 4096,
					"some.other.info": "value",
				},
				capabilities: ["completion", "tools"], // Has tools capability
			}

			const mockAxiosInstance = {
				interceptors: {
					request: { use: vi.fn() },
					response: { use: vi.fn() },
				},
				get: vi.fn().mockResolvedValue({ data: mockApiTagsResponse }),
				post: vi.fn().mockResolvedValue({ data: mockApiShowResponse }),
			}

			vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any)

			const result = await getOllamaModels(baseUrl)

			expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1)
			expect(mockAxiosInstance.get).toHaveBeenCalledWith("/api/tags")

			expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1)
			expect(mockAxiosInstance.post).toHaveBeenCalledWith("/api/show", { model: modelName })

			expect(typeof result).toBe("object")
			expect(result).not.toBeInstanceOf(Array)
			expect(Object.keys(result).length).toBe(1)
			expect(result[modelName]).toBeDefined()

			// The size comes from the model in the tags response, not from parseOllamaModel call
			const expectedParsedDetails = parseOllamaModel(mockApiShowResponse as any, 14333928010)
			expect(result[modelName]).toEqual(expectedParsedDetails)
		})

		it("should filter out models without tools capability", async () => {
			const baseUrl = "http://localhost:11434"
			const modelName = "no-tools-model:latest"

			const mockApiTagsResponse = {
				models: [
					{
						name: modelName,
						model: modelName,
						modified_at: "2025-06-03T09:23:22.610222878-04:00",
						size: 14333928010,
						digest: "6a5f0c01d2c96c687d79e32fdd25b87087feb376bf9838f854d10be8cf3c10a5",
						details: {
							family: "llama",
							families: ["llama"],
							format: "gguf",
							parameter_size: "23.6B",
							parent_model: "",
							quantization_level: "Q4_K_M",
						},
					},
				],
			}
			const mockApiShowResponse = {
				license: "Mock License",
				modelfile: "FROM /path/to/blob\nTEMPLATE {{ .Prompt }}",
				parameters: "num_ctx 4096\nstop_token <eos>",
				template: "{{ .System }}USER: {{ .Prompt }}ASSISTANT:",
				modified_at: "2025-06-03T09:23:22.610222878-04:00",
				details: {
					parent_model: "",
					format: "gguf",
					family: "llama",
					families: ["llama"],
					parameter_size: "23.6B",
					quantization_level: "Q4_K_M",
				},
				model_info: {
					"ollama.context_length": 4096,
					"some.other.info": "value",
				},
				capabilities: ["completion"], // No tools capability
			}

			const mockAxiosInstance = {
				interceptors: {
					request: { use: vi.fn() },
					response: { use: vi.fn() },
				},
				get: vi.fn().mockResolvedValue({ data: mockApiTagsResponse }),
				post: vi.fn().mockResolvedValue({ data: mockApiShowResponse }),
			}

			vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any)

			const result = await getOllamaModels(baseUrl)

			// Model without tools capability should be filtered out
			expect(Object.keys(result).length).toBe(0)
			expect(result[modelName]).toBeUndefined()
		})

		it("should return an empty list if the initial /api/tags call fails", async () => {
			const baseUrl = "http://localhost:11434"
			const mockAxiosInstance = {
				interceptors: {
					request: { use: vi.fn() },
					response: { use: vi.fn() },
				},
				get: vi.fn().mockRejectedValue(new Error("Network error")),
				post: vi.fn(),
			}

			vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any)
			const consoleInfoSpy = vi.spyOn(console, "error").mockImplementation(() => {}) // Spy and suppress output

			const result = await getOllamaModels(baseUrl)

			expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1)
			expect(mockAxiosInstance.get).toHaveBeenCalledWith("/api/tags")
			expect(mockAxiosInstance.post).not.toHaveBeenCalled()
			expect(result).toEqual({})
		})

		it("should log an info message and return an empty object on ECONNREFUSED", async () => {
			const baseUrl = "http://localhost:11434"
			const consoleInfoSpy = vi.spyOn(console, "warn").mockImplementation(() => {}) // Spy and suppress output

			const econnrefusedError = new Error("Connection refused") as any
			econnrefusedError.code = "ECONNREFUSED"

			const mockAxiosInstance = {
				interceptors: {
					request: { use: vi.fn() },
					response: { use: vi.fn() },
				},
				get: vi.fn().mockRejectedValue(econnrefusedError),
				post: vi.fn(),
			}

			vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any)

			const result = await getOllamaModels(baseUrl)

			expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1)
			expect(mockAxiosInstance.get).toHaveBeenCalledWith("/api/tags")
			expect(mockAxiosInstance.post).not.toHaveBeenCalled()
			expect(consoleInfoSpy).toHaveBeenCalledWith(`Failed connecting to Ollama at ${baseUrl}`)
			expect(result).toEqual({})

			consoleInfoSpy.mockRestore() // Restore original console.info
		})

		it("should handle models with null families field in API response", async () => {
			const baseUrl = "http://localhost:11434"
			const modelName = "test-model:latest"

			const mockApiTagsResponse = {
				models: [
					{
						name: modelName,
						model: modelName,
						modified_at: "2025-06-03T09:23:22.610222878-04:00",
						size: 14333928010,
						digest: "6a5f0c01d2c96c687d79e32fdd25b87087feb376bf9838f854d10be8cf3c10a5",
						details: {
							family: "llama",
							families: null, // This is the case we're testing
							format: "gguf",
							parameter_size: "23.6B",
							parent_model: "",
							quantization_level: "Q4_K_M",
						},
					},
				],
			}
			const mockApiShowResponse = {
				license: "Mock License",
				modelfile: "FROM /path/to/blob\nTEMPLATE {{ .Prompt }}",
				parameters: "num_ctx 4096\nstop_token <eos>",
				template: "{{ .System }}USER: {{ .Prompt }}ASSISTANT:",
				modified_at: "2025-06-03T09:23:22.610222878-04:00",
				details: {
					parent_model: "",
					format: "gguf",
					family: "llama",
					families: null, // This is the case we're testing
					parameter_size: "23.6B",
					quantization_level: "Q4_K_M",
				},
				model_info: {
					"ollama.context_length": 4096,
					"some.other.info": "value",
				},
				capabilities: ["completion", "tools"], // Has tools capability
			}

			const mockAxiosInstance = {
				interceptors: {
					request: { use: vi.fn() },
					response: { use: vi.fn() },
				},
				get: vi.fn().mockResolvedValue({ data: mockApiTagsResponse }),
				post: vi.fn().mockResolvedValue({ data: mockApiShowResponse }),
			}

			vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any)

			const result = await getOllamaModels(baseUrl)

			expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1)
			expect(mockAxiosInstance.get).toHaveBeenCalledWith("/api/tags")

			expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1)
			expect(mockAxiosInstance.post).toHaveBeenCalledWith("/api/show", { model: modelName })

			expect(typeof result).toBe("object")
			expect(result).not.toBeInstanceOf(Array)
			expect(Object.keys(result).length).toBe(1)
			expect(result[modelName]).toBeDefined()

			// Verify the model was parsed correctly despite null families
			expect(result[modelName].description).toBe("Family: llama, Context: 4096, Size: 23.6B")
		})

		it("should include Authorization header when API key is provided", async () => {
			const baseUrl = "http://localhost:11434"
			const apiKey = "test-api-key-123"
			const modelName = "test-model:latest"

			const mockApiTagsResponse = {
				models: [
					{
						name: modelName,
						model: modelName,
						modified_at: "2025-06-03T09:23:22.610222878-04:00",
						size: 14333928010,
						digest: "6a5f0c01d2c96c687d79e32fdd25b87087feb376bf9838f854d10be8cf3c10a5",
						details: {
							family: "llama",
							families: ["llama"],
							format: "gguf",
							parameter_size: "23.6B",
							parent_model: "",
							quantization_level: "Q4_K_M",
						},
					},
				],
			}
			const mockApiShowResponse = {
				license: "Mock License",
				modelfile: "FROM /path/to/blob\nTEMPLATE {{ .Prompt }}",
				parameters: "num_ctx 4096\nstop_token <eos>",
				template: "{{ .System }}USER: {{ .Prompt }}ASSISTANT:",
				modified_at: "2025-06-03T09:23:22.610222878-04:00",
				details: {
					parent_model: "",
					format: "gguf",
					family: "llama",
					families: ["llama"],
					parameter_size: "23.6B",
					quantization_level: "Q4_K_M",
				},
				model_info: {
					"ollama.context_length": 4096,
					"some.other.info": "value",
				},
				capabilities: ["completion", "tools"], // Has tools capability
			}

			const mockAxiosInstance = {
				interceptors: {
					request: { use: vi.fn() },
					response: { use: vi.fn() },
				},
				get: vi.fn().mockResolvedValue({ data: mockApiTagsResponse }),
				post: vi.fn().mockResolvedValue({ data: mockApiShowResponse }),
			}

			vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any)

			const result = await getOllamaModels(baseUrl, apiKey)

			expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1)
			expect(mockAxiosInstance.get).toHaveBeenCalledWith("/api/tags")

			expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1)
			expect(mockAxiosInstance.post).toHaveBeenCalledWith("/api/show", { model: modelName })

			expect(typeof result).toBe("object")
			expect(result).not.toBeInstanceOf(Array)
			expect(Object.keys(result).length).toBe(1)
			expect(result[modelName]).toBeDefined()
		})

		it("should use custom timeout configuration for model discovery", async () => {
			const baseUrl = "http://localhost:11434"
			const customTimeout = 15000
			const modelName = "test-model:latest"

			const mockApiTagsResponse = {
				models: [
					{
						name: modelName,
						model: modelName,
						modified_at: "2025-06-03T09:23:22.610222878-04:00",
						size: 14333928010,
						digest: "6a5f0c01d2c96c687d79e32fdd25b87087feb376bf9838f854d10be8cf3c10a5",
						details: {
							family: "llama",
							families: ["llama"],
							format: "gguf",
							parameter_size: "23.6B",
							parent_model: "",
							quantization_level: "Q4_K_M",
						},
					},
				],
			}
			const mockApiShowResponse = {
				license: "Mock License",
				modelfile: "FROM /path/to/blob\nTEMPLATE {{ .Prompt }}",
				parameters: "num_ctx 4096\nstop_token <eos>",
				template: "{{ .System }}USER: {{ .Prompt }}ASSISTANT:",
				modified_at: "2025-06-03T09:23:22.610222878-04:00",
				details: {
					parent_model: "",
					format: "gguf",
					family: "llama",
					families: ["llama"],
					parameter_size: "23.6B",
					quantization_level: "Q4_K_M",
				},
				model_info: {
					"ollama.context_length": 4096,
					"some.other.info": "value",
				},
				capabilities: ["completion", "tools"],
			}

			const mockAxiosInstance = {
				interceptors: {
					request: { use: vi.fn() },
					response: { use: vi.fn() },
				},
				get: vi.fn().mockResolvedValue({ data: mockApiTagsResponse }),
				post: vi.fn().mockResolvedValue({ data: mockApiShowResponse }),
			}

			vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any)

			const result = await getOllamaModels(baseUrl, undefined, {
				modelDiscoveryTimeout: customTimeout,
			})

			// Verify axios.create was called with the custom timeout
			expect(axios.create).toHaveBeenCalledWith(
				expect.objectContaining({
					timeout: customTimeout,
				}),
			)

			expect(Object.keys(result).length).toBe(1)
			expect(result[modelName]).toBeDefined()
		})

		it("should handle timeout errors during model discovery", async () => {
			const baseUrl = "http://localhost:11434"

			const timeoutError = new Error("Request timed out") as any
			timeoutError.code = "ETIMEDOUT"

			const mockAxiosInstance = {
				interceptors: {
					request: { use: vi.fn() },
					response: { use: vi.fn() },
				},
				get: vi.fn().mockRejectedValue(timeoutError),
				post: vi.fn(),
			}

			vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any)
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			const result = await getOllamaModels(baseUrl)

			expect(Object.keys(result).length).toBe(0)
			expect(consoleWarnSpy).toHaveBeenCalledWith(`Ollama request timed out at ${baseUrl}`)

			consoleWarnSpy.mockRestore()
		})
	})

	describe("discoverOllamaModelsWithSorting", () => {
		beforeEach(() => {
			vi.clearAllMocks()
		})

		it("should handle models with null model_info gracefully", async () => {
			const baseUrl = "http://localhost:11434"

			const mockApiTagsResponse = {
				models: [
					{
						name: "test-model:latest",
						model: "test-model:latest",
						size: 1000000,
						details: {
							family: "test",
							parameter_size: "1B",
						},
					},
				],
			}

			const mockApiShowResponse = {
				details: {
					family: "test",
					parameter_size: "1B",
				},
				model_info: null,
				capabilities: ["completion", "tools"],
			}

			const mockAxiosInstance = {
				interceptors: {
					request: { use: vi.fn() },
					response: { use: vi.fn() },
				},
				get: vi.fn().mockResolvedValue({ data: mockApiTagsResponse }),
				post: vi.fn().mockResolvedValue({ data: mockApiShowResponse }),
			}

			vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any)

			const result = await discoverOllamaModelsWithSorting(baseUrl)

			expect(result.modelsWithTools.length).toBe(1)
			expect(result.modelsWithTools[0].name).toBe("test-model:latest")
			expect(result.modelsWithTools[0].contextWindow).toBeDefined()
		})

		it("should handle models with undefined model_info gracefully", async () => {
			const baseUrl = "http://localhost:11434"

			const mockApiTagsResponse = {
				models: [
					{
						name: "test-model:latest",
						model: "test-model:latest",
						size: 1000000,
						details: {
							family: "test",
							parameter_size: "1B",
						},
					},
				],
			}

			const mockApiShowResponse = {
				details: {
					family: "test",
					parameter_size: "1B",
				},
				model_info: undefined,
				capabilities: ["completion", "tools"],
			}

			const mockAxiosInstance = {
				interceptors: {
					request: { use: vi.fn() },
					response: { use: vi.fn() },
				},
				get: vi.fn().mockResolvedValue({ data: mockApiTagsResponse }),
				post: vi.fn().mockResolvedValue({ data: mockApiShowResponse }),
			}

			vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any)

			const result = await discoverOllamaModelsWithSorting(baseUrl)

			expect(result.modelsWithTools.length).toBe(1)
			expect(result.modelsWithTools[0].name).toBe("test-model:latest")
			expect(result.modelsWithTools[0].contextWindow).toBeDefined()
		})

		it("should handle models with empty model_info object gracefully", async () => {
			const baseUrl = "http://localhost:11434"

			const mockApiTagsResponse = {
				models: [
					{
						name: "test-model:latest",
						model: "test-model:latest",
						size: 1000000,
						details: {
							family: "test",
							parameter_size: "1B",
						},
					},
				],
			}

			const mockApiShowResponse = {
				details: {
					family: "test",
					parameter_size: "1B",
				},
				model_info: {},
				capabilities: ["completion", "tools"],
			}

			const mockAxiosInstance = {
				interceptors: {
					request: { use: vi.fn() },
					response: { use: vi.fn() },
				},
				get: vi.fn().mockResolvedValue({ data: mockApiTagsResponse }),
				post: vi.fn().mockResolvedValue({ data: mockApiShowResponse }),
			}

			vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any)

			const result = await discoverOllamaModelsWithSorting(baseUrl)

			expect(result.modelsWithTools.length).toBe(1)
			expect(result.modelsWithTools[0].name).toBe("test-model:latest")
			expect(result.modelsWithTools[0].contextWindow).toBeDefined()
		})

		it("should sort models correctly into tools and non-tools groups", async () => {
			const baseUrl = "http://localhost:11434"

			const mockApiTagsResponse = {
				models: [
					{
						name: "model-with-tools:latest",
						model: "model-with-tools:latest",
						size: 1000000,
						details: {
							family: "test",
							parameter_size: "1B",
						},
					},
					{
						name: "model-without-tools:latest",
						model: "model-without-tools:latest",
						size: 2000000,
						details: {
							family: "test",
							parameter_size: "2B",
						},
					},
				],
			}

			const mockAxiosInstance = {
				interceptors: {
					request: { use: vi.fn() },
					response: { use: vi.fn() },
				},
				get: vi.fn().mockResolvedValue({ data: mockApiTagsResponse }),
				post: vi
					.fn()
					.mockResolvedValueOnce({
						data: {
							details: { family: "test", parameter_size: "1B" },
							model_info: { "ollama.context_length": 4096 },
							capabilities: ["completion", "tools"],
						},
					})
					.mockResolvedValueOnce({
						data: {
							details: { family: "test", parameter_size: "2B" },
							model_info: { "ollama.context_length": 2048 },
							capabilities: ["completion"],
						},
					}),
			}

			vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any)

			const result = await discoverOllamaModelsWithSorting(baseUrl)

			expect(result.totalCount).toBe(2)
			expect(result.modelsWithTools.length).toBe(1)
			expect(result.modelsWithTools[0].name).toBe("model-with-tools:latest")
			expect(result.modelsWithoutTools.length).toBe(1)
			expect(result.modelsWithoutTools[0]).toBe("model-without-tools:latest")
			// Verify totalCount matches the sum of both groups
			expect(result.totalCount).toBe(result.modelsWithTools.length + result.modelsWithoutTools.length)
		})

		it("should handle partial failures gracefully - some models succeed, others fail", async () => {
			const baseUrl = "http://localhost:11434"

			const mockApiTagsResponse = {
				models: [
					{
						name: "successful-model:latest",
						model: "successful-model:latest",
						size: 1000000,
						details: {
							family: "test",
							parameter_size: "1B",
						},
					},
					{
						name: "failing-model:latest",
						model: "failing-model:latest",
						size: 2000000,
						details: {
							family: "test",
							parameter_size: "2B",
						},
					},
					{
						name: "another-successful-model:latest",
						model: "another-successful-model:latest",
						size: 3000000,
						details: {
							family: "test",
							parameter_size: "3B",
						},
					},
				],
			}

			const mockAxiosInstance = {
				interceptors: {
					request: { use: vi.fn() },
					response: { use: vi.fn() },
				},
				get: vi.fn().mockResolvedValue({ data: mockApiTagsResponse }),
				post: vi
					.fn()
					.mockResolvedValueOnce({
						data: {
							details: { family: "test", parameter_size: "1B" },
							model_info: { "ollama.context_length": 4096 },
							capabilities: ["completion", "tools"],
						},
					})
					.mockRejectedValueOnce(new Error("Failed to fetch model details"))
					.mockResolvedValueOnce({
						data: {
							details: { family: "test", parameter_size: "3B" },
							model_info: { "ollama.context_length": 2048 },
							capabilities: ["completion"],
						},
					}),
			}

			vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any)

			const result = await discoverOllamaModelsWithSorting(baseUrl)

			// Should have 1 model with tools (successful-model)
			expect(result.modelsWithTools.length).toBe(1)
			expect(result.modelsWithTools[0].name).toBe("successful-model:latest")
			// Should have 1 model without tools (another-successful-model)
			expect(result.modelsWithoutTools.length).toBe(1)
			expect(result.modelsWithoutTools[0]).toBe("another-successful-model:latest")
			// Total count should still be 3 (all models from /api/tags)
			expect(result.totalCount).toBe(3)
			// Failing model should be skipped (not in either group)
		})

		it("should handle models with both tools and vision capabilities", async () => {
			const baseUrl = "http://localhost:11434"

			const mockApiTagsResponse = {
				models: [
					{
						name: "vision-tools-model:latest",
						model: "vision-tools-model:latest",
						size: 1000000,
						details: {
							family: "test",
							parameter_size: "1B",
						},
					},
				],
			}

			const mockApiShowResponse = {
				details: {
					family: "test",
					parameter_size: "1B",
				},
				model_info: {
					"ollama.context_length": 4096,
				},
				capabilities: ["completion", "tools", "vision"], // Both tools and vision
			}

			const mockAxiosInstance = {
				interceptors: {
					request: { use: vi.fn() },
					response: { use: vi.fn() },
				},
				get: vi.fn().mockResolvedValue({ data: mockApiTagsResponse }),
				post: vi.fn().mockResolvedValue({ data: mockApiShowResponse }),
			}

			vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any)

			const result = await discoverOllamaModelsWithSorting(baseUrl)

			expect(result.modelsWithTools.length).toBe(1)
			expect(result.modelsWithTools[0].name).toBe("vision-tools-model:latest")
			expect(result.modelsWithTools[0].supportsImages).toBe(true) // Should have vision support
			expect(result.modelsWithTools[0].modelInfo.supportsImages).toBe(true)
			expect(result.modelsWithTools[0].modelInfo.supportsNativeTools).toBe(true)
		})

		it("should handle timeout errors gracefully", async () => {
			const baseUrl = "http://localhost:11434"

			const timeoutError = new Error("Request timed out") as any
			timeoutError.code = "ETIMEDOUT"

			const mockAxiosInstance = {
				interceptors: {
					request: { use: vi.fn() },
					response: { use: vi.fn() },
				},
				get: vi.fn().mockRejectedValue(timeoutError),
				post: vi.fn(),
			}

			vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any)
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			const result = await discoverOllamaModelsWithSorting(baseUrl)

			expect(result.modelsWithTools.length).toBe(0)
			expect(result.modelsWithoutTools.length).toBe(0)
			expect(result.totalCount).toBe(0)
			expect(consoleWarnSpy).toHaveBeenCalledWith(`Ollama request timed out at ${baseUrl}`)

			consoleWarnSpy.mockRestore()
		})

		it("should handle ECONNABORTED timeout errors", async () => {
			const baseUrl = "http://localhost:11434"

			const abortError = new Error("Request aborted") as any
			abortError.code = "ECONNABORTED"

			const mockAxiosInstance = {
				interceptors: {
					request: { use: vi.fn() },
					response: { use: vi.fn() },
				},
				get: vi.fn().mockRejectedValue(abortError),
				post: vi.fn(),
			}

			vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any)
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			const result = await discoverOllamaModelsWithSorting(baseUrl)

			expect(result.modelsWithTools.length).toBe(0)
			expect(result.modelsWithoutTools.length).toBe(0)
			expect(result.totalCount).toBe(0)
			expect(consoleWarnSpy).toHaveBeenCalledWith(`Ollama request timed out at ${baseUrl}`)

			consoleWarnSpy.mockRestore()
		})

		it("should use custom timeout configuration", async () => {
			const baseUrl = "http://localhost:11434"
			const customTimeout = 5000

			const mockApiTagsResponse = {
				models: [
					{
						name: "test-model:latest",
						model: "test-model:latest",
						size: 1000000,
						details: {
							family: "test",
							parameter_size: "1B",
						},
					},
				],
			}

			const mockApiShowResponse = {
				details: {
					family: "test",
					parameter_size: "1B",
				},
				model_info: { "ollama.context_length": 4096 },
				capabilities: ["completion", "tools"],
			}

			const mockAxiosInstance = {
				interceptors: {
					request: { use: vi.fn() },
					response: { use: vi.fn() },
				},
				get: vi.fn().mockResolvedValue({ data: mockApiTagsResponse }),
				post: vi.fn().mockResolvedValue({ data: mockApiShowResponse }),
			}

			vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any)

			const result = await discoverOllamaModelsWithSorting(baseUrl, undefined, {
				modelDiscoveryTimeout: customTimeout,
			})

			// Verify axios.create was called with the custom timeout
			expect(axios.create).toHaveBeenCalledWith(
				expect.objectContaining({
					timeout: customTimeout,
				}),
			)

			expect(result.modelsWithTools.length).toBe(1)
		})

		it("should handle timeout on individual /api/show calls", async () => {
			const baseUrl = "http://localhost:11434"

			const mockApiTagsResponse = {
				models: [
					{
						name: "fast-model:latest",
						model: "fast-model:latest",
						size: 1000000,
						details: {
							family: "test",
							parameter_size: "1B",
						},
					},
					{
						name: "slow-model:latest",
						model: "slow-model:latest",
						size: 2000000,
						details: {
							family: "test",
							parameter_size: "2B",
						},
					},
				],
			}

			const timeoutError = new Error("Request timed out") as any
			timeoutError.code = "ETIMEDOUT"

			const mockAxiosInstance = {
				interceptors: {
					request: { use: vi.fn() },
					response: { use: vi.fn() },
				},
				get: vi.fn().mockResolvedValue({ data: mockApiTagsResponse }),
				post: vi
					.fn()
					.mockResolvedValueOnce({
						data: {
							details: { family: "test", parameter_size: "1B" },
							model_info: { "ollama.context_length": 4096 },
							capabilities: ["completion", "tools"],
						},
					})
					.mockRejectedValueOnce(timeoutError),
			}

			vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any)

			const result = await discoverOllamaModelsWithSorting(baseUrl)

			// Should have 1 model with tools (fast-model succeeded)
			expect(result.modelsWithTools.length).toBe(1)
			expect(result.modelsWithTools[0].name).toBe("fast-model:latest")
			// Slow model should be skipped (timeout on /api/show)
			expect(result.modelsWithoutTools.length).toBe(0)
			// Total count should still be 2 (all models from /api/tags)
			expect(result.totalCount).toBe(2)
		})
	})
})
