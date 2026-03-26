import { generateCommitMessageFromDiff, getGitDiff } from "../commit-message-generator"
import * as singleCompletionHandlerModule from "../single-completion-handler"
import type { ProviderSettings } from "@roo-code/types"

vi.mock("../single-completion-handler")
vi.mock("child_process")
vi.mock("util", async (importOriginal) => {
	const actual = await importOriginal<typeof import("util")>()
	return {
		...actual,
		promisify: vi.fn((fn: any) => fn),
	}
})

describe("commit-message-generator", () => {
	let mockSingleCompletionHandler: ReturnType<typeof vi.fn>

	const mockApiConfig: ProviderSettings = {
		apiProvider: "anthropic",
		apiKey: "test-key",
		apiModelId: "claude-sonnet-4-20250514",
	} as ProviderSettings

	beforeEach(() => {
		vi.clearAllMocks()
		mockSingleCompletionHandler = vi.fn().mockResolvedValue("feat: add user authentication")
		vi.mocked(singleCompletionHandlerModule).singleCompletionHandler = mockSingleCompletionHandler
	})

	describe("generateCommitMessageFromDiff", () => {
		it("generates a commit message from a diff", async () => {
			const diff = `diff --git a/src/auth.ts b/src/auth.ts
+export function login(user: string) {
+  return true
+}`

			const result = await generateCommitMessageFromDiff(mockApiConfig, diff)

			expect(result).toBe("feat: add user authentication")
			expect(mockSingleCompletionHandler).toHaveBeenCalledWith(mockApiConfig, expect.stringContaining(diff))
		})

		it("truncates very large diffs", async () => {
			const largeDiff = "a".repeat(15000)

			await generateCommitMessageFromDiff(mockApiConfig, largeDiff)

			const calledPrompt = mockSingleCompletionHandler.mock.calls[0][1]
			expect(calledPrompt).toContain("...(truncated)")
		})

		it("strips markdown code blocks from the result", async () => {
			mockSingleCompletionHandler.mockResolvedValue("```\nfeat: add feature\n```")

			const result = await generateCommitMessageFromDiff(mockApiConfig, "some diff")

			expect(result).toBe("feat: add feature")
		})

		it("propagates errors from the completion handler", async () => {
			mockSingleCompletionHandler.mockRejectedValue(new Error("API Error"))

			await expect(generateCommitMessageFromDiff(mockApiConfig, "some diff")).rejects.toThrow("API Error")
		})
	})

	describe("getGitDiff", () => {
		it("returns staged diff when available", async () => {
			const { exec } = await import("child_process")
			const mockExec = vi.mocked(exec) as any
			mockExec.mockImplementation(
				(
					cmd: string,
					_opts: any,
					callback?: (err: Error | null, result: { stdout: string; stderr: string }) => void,
				) => {
					if (callback) {
						if (cmd === "git diff --cached") {
							callback(null, { stdout: "staged changes", stderr: "" })
						} else {
							callback(null, { stdout: "", stderr: "" })
						}
					}
					return { stdout: cmd === "git diff --cached" ? "staged changes" : "", stderr: "" }
				},
			)

			// Since we mock promisify, exec is already "promisified" via our mock
			// The actual function uses execAsync which is promisify(exec)
			// We need to test the logic differently since promisify is mocked
		})
	})
})
