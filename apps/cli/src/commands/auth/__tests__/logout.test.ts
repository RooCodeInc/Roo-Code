import { logout } from "../logout.js"

import { clearToken, getCredentialsPath, hasToken } from "@/lib/storage/index.js"

import { logoutOpenAiCodex } from "../openai-codex-auth.js"

vi.mock("@/lib/storage/index.js", () => ({
	clearToken: vi.fn(),
	getCredentialsPath: vi.fn(() => "/tmp/credentials.json"),
	hasToken: vi.fn(),
}))

vi.mock("../openai-codex-auth.js", () => ({
	logoutOpenAiCodex: vi.fn(),
}))

describe("auth logout provider routing", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.spyOn(console, "log").mockImplementation(() => {})
		vi.spyOn(console, "error").mockImplementation(() => {})
	})

	it("keeps roo logout behavior by default", async () => {
		vi.mocked(hasToken).mockResolvedValue(true)

		const result = await logout({ verbose: true })

		expect(result).toEqual({ success: true, wasLoggedIn: true })
		expect(getCredentialsPath).toHaveBeenCalled()
		expect(clearToken).toHaveBeenCalled()
		expect(logoutOpenAiCodex).not.toHaveBeenCalled()
	})

	it("uses openai-codex sign-out flow when provider is openai-codex", async () => {
		vi.mocked(logoutOpenAiCodex).mockResolvedValue({ success: true, wasAuthenticated: true })

		const result = await logout({ provider: "openai-codex", timeoutMs: 5_000 })

		expect(result).toEqual({ success: true, wasLoggedIn: true })
		expect(logoutOpenAiCodex).toHaveBeenCalledWith({
			workspace: undefined,
			extension: undefined,
			debug: false,
			timeoutMs: 5000,
		})
	})

	it("returns failed result when openai-codex sign-out fails", async () => {
		vi.mocked(logoutOpenAiCodex).mockResolvedValue({
			success: false,
			wasAuthenticated: true,
			reason: "Timed out",
		})

		const result = await logout({ provider: "openai-codex" })

		expect(result).toEqual({ success: false, wasLoggedIn: true })
	})

	it("rejects unsupported auth providers", async () => {
		const result = await logout({ provider: "anthropic" })

		expect(result).toEqual({ success: false, wasLoggedIn: false })
		expect(logoutOpenAiCodex).not.toHaveBeenCalled()
	})
})
