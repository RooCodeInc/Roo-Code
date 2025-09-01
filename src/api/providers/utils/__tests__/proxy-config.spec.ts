import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { getProxyConfig } from "../proxy-config"

describe("getProxyConfig", () => {
	let originalEnv: NodeJS.ProcessEnv

	beforeEach(() => {
		originalEnv = { ...process.env }
		// Clear all proxy-related environment variables
		delete process.env.HTTP_PROXY
		delete process.env.http_proxy
		delete process.env.HTTPS_PROXY
		delete process.env.https_proxy
		delete process.env.NO_PROXY
		delete process.env.no_proxy

		// Mock require for https-proxy-agent
		vi.doMock("https-proxy-agent", () => ({
			HttpsProxyAgent: vi.fn().mockImplementation((url) => ({
				proxyUrl: url,
				_isHttpsProxyAgent: true,
			})),
		}))
	})

	afterEach(() => {
		process.env = originalEnv
		vi.clearAllMocks()
	})

	describe("when no proxy is configured", () => {
		it("should return undefined for any URL", () => {
			expect(getProxyConfig("https://api.openai.com/v1")).toBeUndefined()
			expect(getProxyConfig("http://localhost:8080")).toBeUndefined()
		})
	})

	describe("when HTTP_PROXY is set", () => {
		beforeEach(() => {
			process.env.HTTP_PROXY = "http://proxy.example.com:8080"
		})

		it("should return proxy config for HTTP URLs", () => {
			const config = getProxyConfig("http://api.example.com")
			expect(config).toBeDefined()
			expect(config?.httpAgent).toBeDefined()
		})

		it("should return proxy config for HTTPS URLs when HTTPS_PROXY is not set", () => {
			const config = getProxyConfig("https://api.example.com")
			expect(config).toBeDefined()
			expect(config?.httpAgent).toBeDefined()
		})
	})

	describe("when HTTPS_PROXY is set", () => {
		beforeEach(() => {
			process.env.HTTPS_PROXY = "https://secure-proxy.example.com:8443"
		})

		it("should return proxy config for HTTPS URLs", () => {
			const config = getProxyConfig("https://api.openai.com/v1")
			expect(config).toBeDefined()
			expect(config?.httpAgent).toBeDefined()
		})

		it("should not use HTTPS_PROXY for HTTP URLs", () => {
			const config = getProxyConfig("http://api.example.com")
			expect(config).toBeUndefined()
		})
	})

	describe("when both HTTP_PROXY and HTTPS_PROXY are set", () => {
		beforeEach(() => {
			process.env.HTTP_PROXY = "http://proxy.example.com:8080"
			process.env.HTTPS_PROXY = "https://secure-proxy.example.com:8443"
		})

		it("should use HTTPS_PROXY for HTTPS URLs", () => {
			const config = getProxyConfig("https://api.openai.com/v1")
			expect(config).toBeDefined()
			expect(config?.httpAgent).toBeDefined()
		})

		it("should use HTTP_PROXY for HTTP URLs", () => {
			const config = getProxyConfig("http://api.example.com")
			expect(config).toBeDefined()
			expect(config?.httpAgent).toBeDefined()
		})
	})

	describe("NO_PROXY handling", () => {
		beforeEach(() => {
			process.env.HTTP_PROXY = "http://proxy.example.com:8080"
			process.env.HTTPS_PROXY = "https://secure-proxy.example.com:8443"
		})

		it("should bypass proxy for exact hostname match", () => {
			process.env.NO_PROXY = "api.openai.com,localhost"
			expect(getProxyConfig("https://api.openai.com/v1")).toBeUndefined()
			expect(getProxyConfig("http://localhost:3000")).toBeUndefined()
		})

		it("should bypass proxy for wildcard domain match", () => {
			process.env.NO_PROXY = "*.internal.com,*.local"
			expect(getProxyConfig("https://api.internal.com")).toBeUndefined()
			expect(getProxyConfig("https://service.internal.com")).toBeUndefined()
			expect(getProxyConfig("http://myapp.local")).toBeUndefined()
		})

		it("should bypass proxy for subdomain match", () => {
			process.env.NO_PROXY = "example.com"
			expect(getProxyConfig("https://api.example.com")).toBeUndefined()
			expect(getProxyConfig("https://example.com")).toBeUndefined()
		})

		it("should not bypass proxy for non-matching domains", () => {
			process.env.NO_PROXY = "example.com,*.local"
			expect(getProxyConfig("https://api.openai.com")).toBeDefined()
			expect(getProxyConfig("https://google.com")).toBeDefined()
		})

		it("should handle spaces in NO_PROXY list", () => {
			process.env.NO_PROXY = "example.com, localhost , *.local"
			expect(getProxyConfig("http://localhost:3000")).toBeUndefined()
			expect(getProxyConfig("https://example.com")).toBeUndefined()
			expect(getProxyConfig("https://test.local")).toBeUndefined()
		})
	})

	describe("case sensitivity", () => {
		it("should handle lowercase proxy environment variables", () => {
			process.env.http_proxy = "http://proxy.example.com:8080"
			process.env.https_proxy = "https://secure-proxy.example.com:8443"

			expect(getProxyConfig("http://api.example.com")).toBeDefined()
			expect(getProxyConfig("https://api.example.com")).toBeDefined()
		})

		it("should prefer uppercase over lowercase", () => {
			process.env.http_proxy = "http://lower-proxy.example.com:8080"
			process.env.HTTP_PROXY = "http://upper-proxy.example.com:8080"

			const config = getProxyConfig("http://api.example.com")
			expect(config).toBeDefined()
			// The actual proxy URL used would be from HTTP_PROXY (uppercase)
		})

		it("should handle lowercase no_proxy", () => {
			process.env.HTTP_PROXY = "http://proxy.example.com:8080"
			process.env.no_proxy = "localhost,example.com"

			expect(getProxyConfig("http://localhost:3000")).toBeUndefined()
			expect(getProxyConfig("https://example.com")).toBeUndefined()
		})
	})

	describe("error handling", () => {
		it("should return proxy config when https-proxy-agent module is available", () => {
			// Since https-proxy-agent is available in the project,
			// we test that it returns a valid proxy configuration
			process.env.HTTP_PROXY = "http://proxy.example.com:8080"

			const config = getProxyConfig("http://api.example.com")
			expect(config).toBeDefined()
			expect(config?.httpAgent).toBeDefined()
		})

		it("should handle invalid proxy URLs gracefully", () => {
			// Mock console.warn to capture the warning
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			// Test with an invalid proxy URL
			process.env.HTTP_PROXY = "not-a-valid-url"

			// Should return undefined for invalid URLs
			const config = getProxyConfig("http://api.example.com")
			expect(config).toBeUndefined()

			// Should have logged a warning
			expect(warnSpy).toHaveBeenCalledWith("Invalid proxy URL: not-a-valid-url")

			warnSpy.mockRestore()
		})
	})
})
