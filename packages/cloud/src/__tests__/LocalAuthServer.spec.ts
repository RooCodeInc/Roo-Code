import http from "http"

import { LocalAuthServer } from "../LocalAuthServer.js"

describe("LocalAuthServer", () => {
	let server: LocalAuthServer

	beforeEach(() => {
		server = new LocalAuthServer()
	})

	afterEach(() => {
		server.stop()
	})

	describe("start", () => {
		it("should start and listen on a random port", async () => {
			const port = await server.start()
			expect(port).toBeGreaterThan(0)
			expect(port).toBeLessThan(65536)
		})

		it("should return a valid redirect URL after starting", async () => {
			await server.start()
			const url = server.getRedirectUrl()
			expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
		})
	})

	describe("getRedirectUrl", () => {
		it("should throw if server is not started", () => {
			expect(() => server.getRedirectUrl()).toThrow("Server not started")
		})
	})

	describe("waitForCallback", () => {
		it("should resolve with auth result when callback is received", async () => {
			const port = await server.start()
			const callbackPromise = server.waitForCallback(5000)

			// Simulate the browser redirect by making an HTTP request
			const response = await makeRequest(
				`http://127.0.0.1:${port}/auth/clerk/callback?code=test-code&state=test-state&organizationId=org-123&provider_model=xai/grok`,
			)

			expect(response.statusCode).toBe(200)
			expect(response.body).toContain("Authentication Successful")

			const result = await callbackPromise
			expect(result).toEqual({
				code: "test-code",
				state: "test-state",
				organizationId: "org-123",
				providerModel: "xai/grok",
			})
		})

		it("should handle null organizationId when value is 'null'", async () => {
			const port = await server.start()
			const callbackPromise = server.waitForCallback(5000)

			await makeRequest(
				`http://127.0.0.1:${port}/auth/clerk/callback?code=test-code&state=test-state&organizationId=null`,
			)

			const result = await callbackPromise
			expect(result.organizationId).toBeNull()
			expect(result.providerModel).toBeNull()
		})

		it("should handle missing optional parameters", async () => {
			const port = await server.start()
			const callbackPromise = server.waitForCallback(5000)

			await makeRequest(`http://127.0.0.1:${port}/auth/clerk/callback?code=test-code&state=test-state`)

			const result = await callbackPromise
			expect(result.organizationId).toBeNull()
			expect(result.providerModel).toBeNull()
		})

		it("should reject when code is missing", async () => {
			const port = await server.start()
			const callbackPromise = server.waitForCallback(5000)

			// Make the request and await the rejection concurrently
			const [, result] = await Promise.allSettled([
				makeRequest(`http://127.0.0.1:${port}/auth/clerk/callback?state=test-state`),
				callbackPromise,
			])

			expect(result.status).toBe("rejected")
			expect((result as PromiseRejectedResult).reason.message).toBe("Missing code or state in callback")
		})

		it("should reject when state is missing", async () => {
			const port = await server.start()
			const callbackPromise = server.waitForCallback(5000)

			// Make the request and await the rejection concurrently
			const [, result] = await Promise.allSettled([
				makeRequest(`http://127.0.0.1:${port}/auth/clerk/callback?code=test-code`),
				callbackPromise,
			])

			expect(result.status).toBe("rejected")
			expect((result as PromiseRejectedResult).reason.message).toBe("Missing code or state in callback")
		})

		it("should return 404 for non-callback paths", async () => {
			const port = await server.start()
			server.waitForCallback(5000).catch(() => {}) // Ignore rejection from timeout

			const response = await makeRequest(`http://127.0.0.1:${port}/other-path`)
			expect(response.statusCode).toBe(404)
		})

		it("should reject on timeout", async () => {
			await server.start()
			const callbackPromise = server.waitForCallback(100) // Very short timeout

			await expect(callbackPromise).rejects.toThrow("Authentication timed out waiting for callback")
		})

		it("should reject if server is not started", async () => {
			await expect(server.waitForCallback()).rejects.toThrow("Server not started")
		})
	})

	describe("stop", () => {
		it("should stop the server cleanly", async () => {
			const port = await server.start()
			server.stop()

			// Trying to connect should fail
			await expect(makeRequest(`http://127.0.0.1:${port}/auth/clerk/callback?code=x&state=y`)).rejects.toThrow()
		})

		it("should be safe to call multiple times", () => {
			expect(() => {
				server.stop()
				server.stop()
			}).not.toThrow()
		})
	})
})

/**
 * Helper to make an HTTP GET request and return the response.
 */
function makeRequest(url: string): Promise<{ statusCode: number; body: string }> {
	return new Promise((resolve, reject) => {
		const req = http.get(url, (res) => {
			let body = ""
			res.on("data", (chunk) => (body += chunk))
			res.on("end", () => resolve({ statusCode: res.statusCode || 0, body }))
		})

		req.on("error", reject)
		req.setTimeout(3000, () => {
			req.destroy(new Error("Request timed out"))
		})
	})
}
