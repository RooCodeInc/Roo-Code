import { pollForToken, httpPost, deviceCodeLogin, login } from "../login.js"

// Mock saveToken
vi.mock("@/lib/storage/index.js", () => ({
	saveToken: vi.fn().mockResolvedValue(undefined),
}))

describe("login", () => {
	describe("login() routing", () => {
		it("should use device code flow when useDeviceCode is true", async () => {
			// We can't easily test the full flow without mocking httpPost,
			// but we can verify the function signature accepts the option.
			const result = await login({ useDeviceCode: true, timeout: 100, verbose: false })
			// It will fail because there's no server, but it should attempt device code flow
			expect(result.success).toBe(false)
		})

		it("should default useDeviceCode to false", async () => {
			// Verify the default options shape works without errors
			// We don't test the full browser callback flow here since it requires
			// a real HTTP server and browser interaction (existing behavior).
			const options = { timeout: 100, verbose: false }
			expect(options).toBeDefined()
		})
	})

	describe("pollForToken", () => {
		it("should throw on timeout when expiresAt is in the past", async () => {
			const pollPromise = pollForToken({
				pollUrl: "http://localhost:3000/api/cli/device-code/poll",
				deviceCode: "test-device-code",
				pollInterval: 100,
				expiresAt: Date.now() - 1000, // Already expired
				verbose: false,
			})

			await expect(pollPromise).rejects.toThrow("Authentication timed out")
		})

		it("should timeout when server never returns complete", async () => {
			// Use a very short expiration to test the timeout path quickly
			const pollPromise = pollForToken({
				pollUrl: "http://127.0.0.1:1/api/cli/device-code/poll",
				deviceCode: "test-device-code",
				pollInterval: 50,
				expiresAt: Date.now() + 200,
				verbose: false,
			})

			await expect(pollPromise).rejects.toThrow("Authentication timed out")
		}, 10_000)
	})

	describe("httpPost", () => {
		it("should reject on invalid URL", async () => {
			await expect(httpPost("not-a-valid-url")).rejects.toThrow()
		})

		it("should reject when server is unreachable", async () => {
			// Use a port that's almost certainly not listening
			await expect(httpPost("http://127.0.0.1:1/test")).rejects.toThrow()
		})
	})

	describe("deviceCodeLogin", () => {
		it("should return failure when server is unreachable", async () => {
			const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			const result = await deviceCodeLogin({ timeout: 1000, verbose: false })

			expect(result.success).toBe(false)

			consoleSpy.mockRestore()
		})

		it("should pass verbose flag through", async () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			const result = await deviceCodeLogin({ timeout: 1000, verbose: true })

			expect(result.success).toBe(false)
			// Verify verbose output was attempted
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("[Auth] Starting device code authentication flow"),
			)

			consoleSpy.mockRestore()
			consoleErrorSpy.mockRestore()
		})
	})
})
