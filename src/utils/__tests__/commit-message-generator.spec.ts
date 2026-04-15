import { generateCommitMessageFromDiff, getGitDiff } from "../commit-message-generator"
import * as singleCompletionHandlerModule from "../single-completion-handler"
import type { ProviderSettings } from "@roo-code/types"

vi.mock("../single-completion-handler")

// Mock child_process.exec to simulate git commands
const mockExecImpl = vi.fn()

vi.mock("child_process", async (importOriginal) => {
	const actual = await importOriginal<typeof import("child_process")>()
	return {
		...actual,
		exec: (...args: any[]) => mockExecImpl(...args),
	}
})

vi.mock("util", async (importOriginal) => {
	const actual = await importOriginal<typeof import("util")>()
	return {
		...actual,
		promisify:
			(fn: any) =>
			(...args: any[]) =>
				new Promise((resolve, reject) => {
					fn(...args, (err: Error | null, result: any) => {
						if (err) {
							reject(err)
						} else {
							resolve(result)
						}
					})
				}),
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

		it("strips language-tagged markdown code blocks from the result", async () => {
			mockSingleCompletionHandler.mockResolvedValue("```text\nfix: resolve null check\n```")

			const result = await generateCommitMessageFromDiff(mockApiConfig, "some diff")

			expect(result).toBe("fix: resolve null check")
		})

		it("propagates errors from the completion handler", async () => {
			mockSingleCompletionHandler.mockRejectedValue(new Error("API Error"))

			await expect(generateCommitMessageFromDiff(mockApiConfig, "some diff")).rejects.toThrow("API Error")
		})
	})

	describe("getGitDiff", () => {
		it("returns staged diff when available", async () => {
			mockExecImpl.mockImplementation(
				(
					cmd: string,
					_opts: unknown,
					callback: (err: Error | null, result: { stdout: string; stderr: string }) => void,
				) => {
					if (cmd.includes("--cached")) {
						callback(null, { stdout: "staged changes", stderr: "" })
					} else {
						callback(null, { stdout: "unstaged changes", stderr: "" })
					}
				},
			)

			const result = await getGitDiff("/workspace")

			expect(result).toBe("staged changes")
			expect(mockExecImpl).toHaveBeenCalledWith(
				"git diff --cached --no-color",
				expect.objectContaining({ cwd: "/workspace" }),
				expect.any(Function),
			)
		})

		it("falls back to unstaged diff when nothing is staged", async () => {
			mockExecImpl.mockImplementation(
				(
					cmd: string,
					_opts: unknown,
					callback: (err: Error | null, result: { stdout: string; stderr: string }) => void,
				) => {
					if (cmd.includes("--cached")) {
						callback(null, { stdout: "", stderr: "" })
					} else {
						callback(null, { stdout: "unstaged changes", stderr: "" })
					}
				},
			)

			const result = await getGitDiff("/workspace")

			expect(result).toBe("unstaged changes")
		})

		it("throws an error when git command fails", async () => {
			mockExecImpl.mockImplementation(
				(
					_cmd: string,
					_opts: unknown,
					callback: (err: Error | null, result: { stdout: string; stderr: string }) => void,
				) => {
					callback(new Error("git not found"), { stdout: "", stderr: "" })
				},
			)

			await expect(getGitDiff("/workspace")).rejects.toThrow("Failed to get git diff")
		})
	})
})
