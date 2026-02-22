import { login } from "../login.js"

import { loginWithOpenAiCodex } from "../openai-codex-auth.js"

vi.mock("../openai-codex-auth.js", () => ({
	loginWithOpenAiCodex: vi.fn(),
}))

describe("auth login provider routing", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.spyOn(console, "log").mockImplementation(() => {})
		vi.spyOn(console, "error").mockImplementation(() => {})
	})

	it("uses openai-codex auth flow when provider is openai-codex", async () => {
		vi.mocked(loginWithOpenAiCodex).mockResolvedValue({ success: true })

		const result = await login({
			provider: "openai-codex",
			workspace: "/tmp/workspace",
			extension: "/tmp/extension",
			verbose: true,
			timeout: 42,
		})

		expect(result).toEqual({ success: true })
		expect(loginWithOpenAiCodex).toHaveBeenCalledWith({
			workspace: "/tmp/workspace",
			extension: "/tmp/extension",
			debug: true,
			timeoutMs: 42,
		})
	})

	it("returns failed result when openai-codex auth flow fails", async () => {
		vi.mocked(loginWithOpenAiCodex).mockResolvedValue({ success: false, reason: "Timed out" })

		const result = await login({ provider: "openai-codex" })

		expect(result).toEqual({ success: false, error: "Timed out" })
	})

	it("rejects unsupported auth providers", async () => {
		const result = await login({ provider: "anthropic" })

		expect(result.success).toBe(false)
		if (!result.success) {
			expect(result.error).toContain("Unsupported auth provider")
		}
		expect(loginWithOpenAiCodex).not.toHaveBeenCalled()
	})
})
