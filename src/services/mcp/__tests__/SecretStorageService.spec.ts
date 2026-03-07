import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("vscode", () => ({}))

import { SecretStorageService, StoredMcpOAuthData } from "../SecretStorageService"

function createMockContext() {
	const store = new Map<string, string>()
	return {
		secrets: {
			get: vi.fn(async (key: string) => store.get(key)),
			store: vi.fn(async (key: string, value: string) => {
				store.set(key, value)
			}),
			delete: vi.fn(async (key: string) => {
				store.delete(key)
			}),
		},
	} as any
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
			context.secrets.store("mcp.oauth.example.com.data", "not-json")

			const result = await service.getOAuthData("https://example.com/mcp")
			expect(result).toBeUndefined()
		})
	})

	describe("saveOAuthData", () => {
		it("should persist data under host-based key", async () => {
			const data: StoredMcpOAuthData = {
				tokens: { access_token: "abc", token_type: "Bearer" },
				expires_at: 12345,
			}
			await service.saveOAuthData("https://example.com/mcp", data)

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

			expect(context.secrets.delete).toHaveBeenCalledWith("mcp.oauth.example.com.data")
			const result = await service.getOAuthData("https://example.com/mcp")
			expect(result).toBeUndefined()
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
	})
})
