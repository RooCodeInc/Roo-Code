import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { getClerkBaseUrl, getRooCodeApiUrl, PRODUCTION_CLERK_BASE_URL, PRODUCTION_ROO_CODE_API_URL } from "../config.js"

describe("config", () => {
	let originalEnv: NodeJS.ProcessEnv

	beforeEach(() => {
		// Save original environment
		originalEnv = { ...process.env }
	})

	afterEach(() => {
		// Restore original environment
		process.env = originalEnv
		vi.clearAllMocks()
	})

	describe("getClerkBaseUrl", () => {
		it("should return production URL when environment variable is not set", () => {
			delete process.env.CLERK_BASE_URL
			expect(getClerkBaseUrl()).toBe(PRODUCTION_CLERK_BASE_URL)
		})

		it("should return valid custom URL from environment variable", () => {
			process.env.CLERK_BASE_URL = "https://custom.clerk.com"
			expect(getClerkBaseUrl()).toBe("https://custom.clerk.com")
		})

		it("should sanitize corrupted URL with proxy prefix (NekoBox issue)", () => {
			// This is the exact issue reported: proxy adds its address before the actual URL
			process.env.CLERK_BASE_URL = "http://127.0.0.1:2080clerk.roocode.com:443"
			expect(getClerkBaseUrl()).toBe("https://clerk.roocode.com")
		})

		it("should sanitize corrupted URL with different proxy address", () => {
			process.env.CLERK_BASE_URL = "http://192.168.1.1:8080clerk.roocode.com:443"
			expect(getClerkBaseUrl()).toBe("https://clerk.roocode.com")
		})

		it("should preserve path in corrupted URL", () => {
			process.env.CLERK_BASE_URL = "http://127.0.0.1:2080clerk.roocode.com:443/api/v1"
			expect(getClerkBaseUrl()).toBe("https://clerk.roocode.com/api/v1")
		})

		it("should handle URL with clerk.roocode.com embedded anywhere", () => {
			process.env.CLERK_BASE_URL = "garbage-text-clerk.roocode.com"
			expect(getClerkBaseUrl()).toBe("https://clerk.roocode.com")
		})

		it("should return fallback for completely invalid URL", () => {
			process.env.CLERK_BASE_URL = "not-a-url-at-all"
			expect(getClerkBaseUrl()).toBe(PRODUCTION_CLERK_BASE_URL)
		})

		it("should handle empty string", () => {
			process.env.CLERK_BASE_URL = ""
			expect(getClerkBaseUrl()).toBe(PRODUCTION_CLERK_BASE_URL)
		})

		it("should preserve valid dev URL", () => {
			process.env.CLERK_BASE_URL = "https://dev.clerk.roocode.com"
			expect(getClerkBaseUrl()).toBe("https://dev.clerk.roocode.com")
		})
	})

	describe("getRooCodeApiUrl", () => {
		it("should return production URL when environment variable is not set", () => {
			delete process.env.ROO_CODE_API_URL
			expect(getRooCodeApiUrl()).toBe(PRODUCTION_ROO_CODE_API_URL)
		})

		it("should return valid custom URL from environment variable", () => {
			process.env.ROO_CODE_API_URL = "https://custom.api.com"
			expect(getRooCodeApiUrl()).toBe("https://custom.api.com")
		})

		it("should sanitize corrupted URL with proxy prefix (NekoBox issue)", () => {
			// This is the exact issue reported: proxy adds its address before the actual URL
			process.env.ROO_CODE_API_URL = "http://127.0.0.1:2080app.roocode.com:443"
			expect(getRooCodeApiUrl()).toBe("https://app.roocode.com")
		})

		it("should sanitize corrupted URL with different proxy address", () => {
			process.env.ROO_CODE_API_URL = "http://192.168.1.1:8080app.roocode.com:443"
			expect(getRooCodeApiUrl()).toBe("https://app.roocode.com")
		})

		it("should preserve path in corrupted URL", () => {
			process.env.ROO_CODE_API_URL = "http://127.0.0.1:2080app.roocode.com:443/api/v1"
			expect(getRooCodeApiUrl()).toBe("https://app.roocode.com/api/v1")
		})

		it("should handle URL with app.roocode.com embedded anywhere", () => {
			process.env.ROO_CODE_API_URL = "garbage-text-app.roocode.com"
			expect(getRooCodeApiUrl()).toBe("https://app.roocode.com")
		})

		it("should handle api.roocode.com domain", () => {
			process.env.ROO_CODE_API_URL = "http://127.0.0.1:2080api.roocode.com:443"
			expect(getRooCodeApiUrl()).toBe("https://api.roocode.com")
		})

		it("should return fallback for completely invalid URL", () => {
			process.env.ROO_CODE_API_URL = "not-a-url-at-all"
			expect(getRooCodeApiUrl()).toBe(PRODUCTION_ROO_CODE_API_URL)
		})

		it("should handle empty string", () => {
			process.env.ROO_CODE_API_URL = ""
			expect(getRooCodeApiUrl()).toBe(PRODUCTION_ROO_CODE_API_URL)
		})

		it("should preserve valid dev URL", () => {
			process.env.ROO_CODE_API_URL = "https://dev.app.roocode.com"
			expect(getRooCodeApiUrl()).toBe("https://dev.app.roocode.com")
		})

		it("should handle localhost URLs correctly", () => {
			process.env.ROO_CODE_API_URL = "http://localhost:3000"
			expect(getRooCodeApiUrl()).toBe("http://localhost:3000")
		})

		it("should handle local IP without proxy corruption", () => {
			// User reported their local endpoint also gets corrupted
			process.env.ROO_CODE_API_URL = "http://192.168.1.102:8000"
			expect(getRooCodeApiUrl()).toBe("http://192.168.1.102:8000")
		})

		it("should fix corrupted local IP with proxy prefix", () => {
			// Simulating what might happen if proxy corrupts local IP
			process.env.ROO_CODE_API_URL = "http://127.0.0.1:2080192.168.1.102:8000"
			// Since this doesn't contain a known domain, it should fall back
			expect(getRooCodeApiUrl()).toBe(PRODUCTION_ROO_CODE_API_URL)
		})
	})

	describe("URL sanitization edge cases", () => {
		it("should handle HTTP vs HTTPS detection based on port", () => {
			// Port 443 should imply HTTPS
			process.env.CLERK_BASE_URL = "proxygarbage-clerk.roocode.com:443"
			expect(getClerkBaseUrl()).toBe("https://clerk.roocode.com")

			// No port 443 but fallback uses https
			process.env.CLERK_BASE_URL = "proxygarbage-clerk.roocode.com"
			expect(getClerkBaseUrl()).toBe("https://clerk.roocode.com")
		})

		it("should handle multiple corruptions in the same URL", () => {
			// Multiple instances of corruption
			process.env.CLERK_BASE_URL = "http://127.0.0.1:2080http://proxy:8888clerk.roocode.com:443"
			expect(getClerkBaseUrl()).toBe("https://clerk.roocode.com")
		})

		it("should not be fooled by domain-like strings in paths", () => {
			// Valid URL that happens to contain the domain string elsewhere
			process.env.CLERK_BASE_URL = "https://valid.com/path/clerk.roocode.com/test"
			expect(getClerkBaseUrl()).toBe("https://valid.com/path/clerk.roocode.com/test")
		})

		it("should handle undefined environment variables", () => {
			process.env.CLERK_BASE_URL = undefined
			expect(getClerkBaseUrl()).toBe(PRODUCTION_CLERK_BASE_URL)

			process.env.ROO_CODE_API_URL = undefined
			expect(getRooCodeApiUrl()).toBe(PRODUCTION_ROO_CODE_API_URL)
		})

		it("should handle URLs with query parameters", () => {
			process.env.CLERK_BASE_URL = "http://127.0.0.1:2080clerk.roocode.com:443?param=value"
			expect(getClerkBaseUrl()).toBe("https://clerk.roocode.com?param=value")
		})

		it("should handle URLs with fragments", () => {
			process.env.CLERK_BASE_URL = "http://127.0.0.1:2080clerk.roocode.com:443#fragment"
			expect(getClerkBaseUrl()).toBe("https://clerk.roocode.com#fragment")
		})
	})
})
