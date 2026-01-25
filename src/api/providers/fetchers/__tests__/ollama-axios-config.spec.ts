import { describe, it, expect, vi, beforeEach } from "vitest"
import axios from "axios"
import { createOllamaAxiosInstance } from "../ollama"
import type { AxiosInstance, AxiosError } from "axios"

vi.mock("axios")

const mockAxiosInstance = {
	interceptors: {
		request: { use: vi.fn() },
		response: { use: vi.fn() },
	},
	get: vi.fn(),
	post: vi.fn(),
} as unknown as AxiosInstance

describe("createOllamaAxiosInstance", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(axios.create).mockReturnValue(mockAxiosInstance)
	})

	it("should create instance with default configuration", () => {
		const instance = createOllamaAxiosInstance()
		expect(instance).toBeDefined()
		expect(axios.create).toHaveBeenCalledWith(
			expect.objectContaining({
				baseURL: "http://localhost:11434",
				timeout: 3600000,
			}),
		)
	})

	it("should create instance with custom baseUrl", () => {
		createOllamaAxiosInstance({ baseUrl: "http://custom:11434" })
		expect(axios.create).toHaveBeenCalledWith(
			expect.objectContaining({
				baseURL: "http://custom:11434",
			}),
		)
	})

	it("should include Authorization header when apiKey provided", () => {
		createOllamaAxiosInstance({ apiKey: "test-key" })
		expect(axios.create).toHaveBeenCalledWith(
			expect.objectContaining({
				headers: {
					Authorization: "Bearer test-key",
				},
			}),
		)
	})

	it("should not include Authorization header when apiKey not provided", () => {
		createOllamaAxiosInstance()
		expect(axios.create).toHaveBeenCalledWith(
			expect.objectContaining({
				headers: {},
			}),
		)
	})

	it("should set up retry interceptor when retries > 0", () => {
		createOllamaAxiosInstance({ retries: 2, retryDelay: 1000 })
		expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled()
	})

	it("should not set up retry interceptor when retries = 0", () => {
		createOllamaAxiosInstance({ retries: 0 })
		expect(mockAxiosInstance.interceptors.response.use).not.toHaveBeenCalled()
	})

	it("should set up logging interceptor when enableLogging is true", () => {
		createOllamaAxiosInstance({ enableLogging: true })
		expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled()
		expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled()
	})

	it("should not set up logging interceptor when enableLogging is false", () => {
		createOllamaAxiosInstance({ enableLogging: false })
		expect(mockAxiosInstance.interceptors.request.use).not.toHaveBeenCalled()
	})

	it("should use custom timeout", () => {
		createOllamaAxiosInstance({ timeout: 5000 })
		expect(axios.create).toHaveBeenCalledWith(
			expect.objectContaining({
				timeout: 5000,
			}),
		)
	})

	it("should set timeout error message", () => {
		createOllamaAxiosInstance({ timeout: 10000 })
		expect(axios.create).toHaveBeenCalledWith(
			expect.objectContaining({
				timeoutErrorMessage: "Ollama request timed out after 10000ms",
			}),
		)
	})
})
