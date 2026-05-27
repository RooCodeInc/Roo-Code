import { describe, it, expect, vi, beforeEach } from "vitest"
import { startCallbackServer, stopCallbackServer } from "../callbackServer"
import * as http from "http"

vi.mock("http", () => ({
	createServer: vi.fn(),
}))

describe("startCallbackServer", () => {
	beforeEach(() => {
		vi.restoreAllMocks()
		delete process.env.MCP_OAUTH_TEST_MODE
	})

	it("should start server and resolve with callback result", async () => {
		const mockServer = {
			listen: vi.fn((port, host, callback) => {
				callback()
				return mockServer
			}),
			address: vi.fn(() => ({ port: 3000 })),
			on: vi.fn(),
			close: vi.fn(),
		}

		;(http.createServer as any).mockReturnValue(mockServer)

		const promise = startCallbackServer()
		const { server, port, result } = await promise

		expect(port).toBe(3000)
		expect(server).toBe(mockServer)

		// Simulate callback request
		const requestCall = mockServer.on.mock.calls.find((call) => call[0] === "request")
		const requestHandler = requestCall ? requestCall[1] : vi.fn()
		const mockReq = {
			url: "/callback?code=test-code&state=test-state",
			method: "GET",
		}
		const mockRes = {
			writeHead: vi.fn(),
			end: vi.fn(),
			on: vi.fn((event, cb) => {
				if (event === "finish") setImmediate(cb)
			}),
		}

		requestHandler(mockReq, mockRes)

		const callbackResult = await result
		expect(callbackResult.code).toBe("test-code")
		expect(callbackResult.state).toBe("test-state")
	})

	it("should reject invalid state", async () => {
		const mockServer = {
			listen: vi.fn((port, host, callback) => {
				callback()
				return mockServer
			}),
			address: vi.fn(() => ({ port: 3000 })),
			on: vi.fn(),
			close: vi.fn(),
		}

		;(http.createServer as any).mockReturnValue(mockServer)

		const promise = startCallbackServer(undefined, "expected-state")
		const { result } = await promise

		// Simulate callback request with wrong state
		const requestCall = mockServer.on.mock.calls.find((call) => call[0] === "request")
		const requestHandler = requestCall ? requestCall[1] : vi.fn()
		const mockReq = {
			url: "/callback?code=test-code&state=wrong-state",
			method: "GET",
		}
		const mockRes = {
			writeHead: vi.fn(),
			end: vi.fn(),
			on: vi.fn((event, cb) => {
				if (event === "finish") setImmediate(cb)
			}),
		}

		requestHandler(mockReq, mockRes)

		await expect(result).rejects.toThrow("Invalid state parameter")
	})
})

describe("stopCallbackServer", () => {
	it("should close the server", async () => {
		const mockServer = {
			close: vi.fn((callback) => callback()),
		}

		await stopCallbackServer(mockServer as any, () => {})
		expect(mockServer.close).toHaveBeenCalled()
	})

	it("should call the cancel function before closing", async () => {
		const mockServer = { close: vi.fn((callback) => callback()) }
		const cancel = vi.fn()

		await stopCallbackServer(mockServer as any, cancel)
		expect(cancel).toHaveBeenCalledTimes(1)
		expect(mockServer.close).toHaveBeenCalled()
	})
})

describe("startCallbackServer in test mode", () => {
	it("should resolve immediately with mock auth code when MCP_OAUTH_TEST_MODE is set", async () => {
		process.env.MCP_OAUTH_TEST_MODE = "true"
		try {
			const { port, result, cancel } = await startCallbackServer(undefined, "test-state")
			expect(port).toBe(3000)
			expect(typeof cancel).toBe("function")
			const callbackResult = await result
			expect(callbackResult.code).toBe("test-auth-code")
			expect(callbackResult.state).toBe("test-state")
		} finally {
			delete process.env.MCP_OAUTH_TEST_MODE
		}
	})
})
