import { describe, it, expect, vi, beforeEach } from "vitest"
import { OpenAiCodexOAuthManager } from "../oauth"

describe("OpenAiCodexOAuthManager profile scoping", () => {
	let manager: OpenAiCodexOAuthManager
	let mockSecrets: Map<string, string>
	let mockContext: any

	beforeEach(() => {
		mockSecrets = new Map()
		mockContext = {
			secrets: {
				get: vi.fn(async (key: string) => mockSecrets.get(key)),
				store: vi.fn(async (key: string, value: string) => {
					mockSecrets.set(key, value)
				}),
				delete: vi.fn(async (key: string) => {
					mockSecrets.delete(key)
				}),
			},
		}
		manager = new OpenAiCodexOAuthManager()
		manager.initialize(mockContext)
	})

	it("should use different storage keys for different profiles", async () => {
		const creds1 = {
			type: "openai-codex" as const,
			access_token: "token1",
			refresh_token: "refresh1",
			expires: Date.now() + 3600000,
			email: "user1@example.com",
		}
		const creds2 = {
			type: "openai-codex" as const,
			access_token: "token2",
			refresh_token: "refresh2",
			expires: Date.now() + 3600000,
			email: "user2@example.com",
		}

		await manager.saveCredentials(creds1, "profile1")
		await manager.saveCredentials(creds2, "profile2")

		const loaded1 = await manager.loadCredentials("profile1")
		const loaded2 = await manager.loadCredentials("profile2")

		expect(loaded1?.email).toBe("user1@example.com")
		expect(loaded2?.email).toBe("user2@example.com")
		expect(mockSecrets.has("openai-codex-oauth-credentials-profile1")).toBe(true)
		expect(mockSecrets.has("openai-codex-oauth-credentials-profile2")).toBe(true)
	})

	it("should fall back to default key when no profileId is provided", async () => {
		const creds = {
			type: "openai-codex" as const,
			access_token: "default-token",
			refresh_token: "default-refresh",
			expires: Date.now() + 3600000,
			email: "default@example.com",
		}

		await manager.saveCredentials(creds)
		expect(mockSecrets.has("openai-codex-oauth-credentials")).toBe(true)

		const loaded = await manager.loadCredentials()
		expect(loaded?.email).toBe("default@example.com")
	})

	it("should clear credentials only for the specified profile", async () => {
		const creds = {
			type: "openai-codex" as const,
			access_token: "token",
			refresh_token: "refresh",
			expires: Date.now() + 3600000,
		}

		await manager.saveCredentials(creds, "profile1")
		await manager.saveCredentials(creds, "profile2")

		await manager.clearCredentials("profile1")

		expect(await manager.getCredentials("profile1")).toBeNull()
		expect(await manager.loadCredentials("profile2")).not.toBeNull()
	})
})
