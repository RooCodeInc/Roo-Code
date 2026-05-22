// npx vitest run api/providers/utils/__tests__/undici-fetch.spec.ts

// Mock vscode before any imports that depend on it
vitest.mock("vscode", () => ({
	workspace: {
		getConfiguration: vitest.fn().mockReturnValue({
			get: vitest.fn(),
		}),
	},
}))

// Mock undici Agent
const mockAgent = { headersTimeout: 0, bodyTimeout: 0 }
vitest.mock("undici", () => ({
	Agent: vitest.fn().mockImplementation((opts) => {
		mockAgent.headersTimeout = opts.headersTimeout
		mockAgent.bodyTimeout = opts.bodyTimeout
		return mockAgent
	}),
	fetch: vitest.fn().mockResolvedValue(new Response("ok")),
}))

import { Agent, fetch as undiciFetch } from "undici"
import * as vscode from "vscode"

import { createFetchWithUndiciTimeout } from "../undici-fetch"

describe("createFetchWithUndiciTimeout", () => {
	let mockGetConfig: any

	beforeEach(() => {
		vitest.clearAllMocks()
		mockGetConfig = vitest.fn()
		;(vscode.workspace.getConfiguration as any).mockReturnValue({
			get: mockGetConfig,
		})
	})

	it("should create an Undici Agent with headersTimeout and bodyTimeout matching the configured timeout", () => {
		mockGetConfig.mockReturnValue(600) // 600 seconds

		createFetchWithUndiciTimeout()

		expect(Agent).toHaveBeenCalledWith({
			headersTimeout: 600000, // 600s in ms
			bodyTimeout: 600000,
		})
	})

	it("should set Agent timeouts to 0 (no timeout) when apiRequestTimeout is disabled", () => {
		mockGetConfig.mockReturnValue(0) // disabled

		createFetchWithUndiciTimeout()

		// getApiRequestTimeout returns undefined for 0/negative, and undici-fetch maps undefined to 0
		expect(Agent).toHaveBeenCalledWith({
			headersTimeout: 0,
			bodyTimeout: 0,
		})
	})

	it("should return a function with the same signature as fetch", () => {
		mockGetConfig.mockReturnValue(600)

		const fetchFn = createFetchWithUndiciTimeout()

		expect(typeof fetchFn).toBe("function")
	})

	it("should call undici fetch with the custom dispatcher when invoked", async () => {
		mockGetConfig.mockReturnValue(600)

		const fetchFn = createFetchWithUndiciTimeout()
		await fetchFn("https://example.com/api", { method: "POST" })

		expect(undiciFetch).toHaveBeenCalledWith(
			"https://example.com/api",
			expect.objectContaining({
				method: "POST",
				dispatcher: mockAgent,
			}),
		)
	})

	it("should use custom timeout values", () => {
		mockGetConfig.mockReturnValue(1200) // 20 minutes

		createFetchWithUndiciTimeout()

		expect(Agent).toHaveBeenCalledWith({
			headersTimeout: 1200000,
			bodyTimeout: 1200000,
		})
	})
})
