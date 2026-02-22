import { status } from "../status.js"

import { loadCredentials, loadToken } from "@/lib/storage/index.js"

import { statusOpenAiCodex } from "../openai-codex-auth.js"

vi.mock("@/lib/storage/index.js", () => ({
	loadToken: vi.fn(),
	loadCredentials: vi.fn(),
	getCredentialsPath: vi.fn(() => "/tmp/credentials.json"),
}))

vi.mock("@/lib/auth/index.js", () => ({
	isTokenExpired: vi.fn(() => false),
	isTokenValid: vi.fn(() => true),
	getTokenExpirationDate: vi.fn(() => null),
}))

vi.mock("../openai-codex-auth.js", () => ({
	statusOpenAiCodex: vi.fn(),
}))

describe("auth status provider routing", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.spyOn(console, "log").mockImplementation(() => {})
		vi.spyOn(console, "error").mockImplementation(() => {})
	})

	it("keeps roo status behavior by default", async () => {
		vi.mocked(loadToken).mockResolvedValue("roo-token")
		vi.mocked(loadCredentials).mockResolvedValue(null)

		const result = await status()

		expect(result.authenticated).toBe(true)
		expect(statusOpenAiCodex).not.toHaveBeenCalled()
	})

	it("uses openai-codex status flow when provider is openai-codex", async () => {
		vi.mocked(statusOpenAiCodex).mockResolvedValue({ authenticated: true })

		const result = await status({ provider: "openai-codex" })

		expect(result).toEqual({ authenticated: true })
		expect(statusOpenAiCodex).toHaveBeenCalledWith({
			workspace: undefined,
			extension: undefined,
			debug: false,
		})
	})

	it("returns not authenticated when openai-codex status is unauthenticated", async () => {
		vi.mocked(statusOpenAiCodex).mockResolvedValue({ authenticated: false })

		const result = await status({ provider: "openai-codex" })

		expect(result).toEqual({ authenticated: false })
	})

	it("rejects unsupported auth providers", async () => {
		const result = await status({ provider: "anthropic" })

		expect(result).toEqual({ authenticated: false })
		expect(statusOpenAiCodex).not.toHaveBeenCalled()
	})
})
