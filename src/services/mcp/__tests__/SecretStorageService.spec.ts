import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("vscode", () => ({}))

import { SecretStorageService, StoredMcpOAuthData } from "../SecretStorageService"

function createMockContext() {
	const store = new Map<string, string>()
	// Listeners registered via onDidChange; keyed by arbitrary id for disposal.
	const listeners = new Map<number, (e: { key: string }) => void>()
	let nextId = 0

	const secrets = {
		get: vi.fn(async (key: string) => store.get(key)),
		store: vi.fn(async (key: string, value: string) => {
			store.set(key, value)
		}),
		delete: vi.fn(async (key: string) => {
			store.delete(key)
		}),
		onDidChange: vi.fn((handler: (e: { key: string }) => void) => {
			const id = nextId++
			listeners.set(id, handler)
			return { dispose: () => listeners.delete(id) }
		}),
		/** Test helper: simulate a storage change event. */
		_emit: (key: string) => {
			for (const handler of listeners.values()) handler({ key })
		},
	}

	return { secrets } as any
}

describe("SecretStorageService", () => {
	let service: SecretStorageService
	let context: ReturnType<typeof createMockContext>

	beforeEach(() => {
		context = createMockContext()
		service = new SecretStorageService(context)
	})

	describe("getOAuthData", () => {
		it("should return undefined when no data stored", async () => {
			const result = await service.getOAuthData("https://example.com/mcp")
			expect(result).toBeUndefined()
		})

		it("should return stored data", async () => {
			const data: StoredMcpOAuthData = {
				tokens: { access_token: "tok", token_type: "Bearer" },
				expires_at: Date.now() + 3600_000,
			}
			await service.saveOAuthData("https://example.com/mcp", data)

			const result = await service.getOAuthData("https://example.com/mcp")
			expect(result).toEqual(data)
		})

		it("should return undefined for malformed JSON", async () => {
			// Manually store garbage via the underlying mock
			context.secrets.store("mcp.oauth.example.com.mcp.data", "not-json")

			const result = await service.getOAuthData("https://example.com/mcp")
			expect(result).toBeUndefined()
		})
	})

	describe("saveOAuthData", () => {
		it("should persist data under host and path-based key", async () => {
			const data: StoredMcpOAuthData = {
				tokens: { access_token: "abc", token_type: "Bearer" },
				expires_at: 12345,
			}
			await service.saveOAuthData("https://example.com/mcp", data)

			expect(context.secrets.store).toHaveBeenCalledWith("mcp.oauth.example.com.mcp.data", JSON.stringify(data))
		})

		it("should handle root path correctly", async () => {
			const data: StoredMcpOAuthData = {
				tokens: { access_token: "abc", token_type: "Bearer" },
				expires_at: 12345,
			}
			await service.saveOAuthData("https://example.com/", data)

			expect(context.secrets.store).toHaveBeenCalledWith("mcp.oauth.example.com.data", JSON.stringify(data))
		})
	})

	describe("deleteOAuthData", () => {
		it("should delete stored data", async () => {
			const data: StoredMcpOAuthData = {
				tokens: { access_token: "tok", token_type: "Bearer" },
				expires_at: Date.now() + 3600_000,
			}
			await service.saveOAuthData("https://example.com/mcp", data)

			await service.deleteOAuthData("https://example.com/mcp")

			expect(context.secrets.delete).toHaveBeenCalledWith("mcp.oauth.example.com.mcp.data")
			const result = await service.getOAuthData("https://example.com/mcp")
			expect(result).toBeUndefined()
		})

		describe("onDidChange", () => {
			it("should call the callback when the key for the given URL changes", () => {
				const cb = vi.fn()
				service.onDidChange("https://example.com/mcp", cb)

				context.secrets._emit("mcp.oauth.example.com.mcp.data")

				expect(cb).toHaveBeenCalledTimes(1)
			})

			it("should not call the callback for a different URL's key", () => {
				const cb = vi.fn()
				service.onDidChange("https://example.com/mcp", cb)

				context.secrets._emit("mcp.oauth.other.com.mcp.data")

				expect(cb).not.toHaveBeenCalled()
			})

			it("should stop calling the callback after the returned dispose function is called", () => {
				const cb = vi.fn()
				const unsubscribe = service.onDidChange("https://example.com/mcp", cb)

				unsubscribe()
				context.secrets._emit("mcp.oauth.example.com.mcp.data")

				expect(cb).not.toHaveBeenCalled()
			})
		})
	})

	describe("key isolation", () => {
		it("should isolate data by host", async () => {
			const data1: StoredMcpOAuthData = {
				tokens: { access_token: "a", token_type: "Bearer" },
				expires_at: 1,
			}
			const data2: StoredMcpOAuthData = {
				tokens: { access_token: "b", token_type: "Bearer" },
				expires_at: 2,
			}
			await service.saveOAuthData("https://host1.com/mcp", data1)
			await service.saveOAuthData("https://host2.com/mcp", data2)

			expect((await service.getOAuthData("https://host1.com/mcp"))?.tokens.access_token).toBe("a")
			expect((await service.getOAuthData("https://host2.com/mcp"))?.tokens.access_token).toBe("b")
		})

		it("should isolate data by path on the same host", async () => {
			const data1: StoredMcpOAuthData = {
				tokens: { access_token: "path1", token_type: "Bearer" },
				expires_at: 1,
			}
			const data2: StoredMcpOAuthData = {
				tokens: { access_token: "path2", token_type: "Bearer" },
				expires_at: 2,
			}
			await service.saveOAuthData("https://example.com/service1", data1)
			await service.saveOAuthData("https://example.com/service2", data2)

			expect((await service.getOAuthData("https://example.com/service1"))?.tokens.access_token).toBe("path1")
			expect((await service.getOAuthData("https://example.com/service2"))?.tokens.access_token).toBe("path2")
		})
	})
})
