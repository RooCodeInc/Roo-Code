import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Mock util module before importing the module under test
vi.mock("util", () => ({
	promisify: vi.fn(() => vi.fn()),
}))

// Import after mocking
import * as codespaceUtils from "../codespaceUtils"
import { promisify } from "util"

describe("codespaceUtils", () => {
	let originalEnv: NodeJS.ProcessEnv
	let mockExecAsync: ReturnType<typeof vi.fn>

	beforeEach(() => {
		originalEnv = { ...process.env }
		vi.clearAllMocks()

		// Create a new mock for each test
		mockExecAsync = vi.fn()
		vi.mocked(promisify).mockReturnValue(mockExecAsync)
	})

	afterEach(() => {
		process.env = originalEnv
	})

	describe("isCodespacesEnvironment", () => {
		it("should return true when CODESPACES env var is 'true'", () => {
			process.env.CODESPACES = "true"
			expect(codespaceUtils.isCodespacesEnvironment()).toBe(true)
		})

		it("should return true when GITHUB_CODESPACE_TOKEN is defined", () => {
			process.env.GITHUB_CODESPACE_TOKEN = "some-token"
			expect(codespaceUtils.isCodespacesEnvironment()).toBe(true)
		})

		it("should return false when neither env var is set", () => {
			delete process.env.CODESPACES
			delete process.env.GITHUB_CODESPACE_TOKEN
			expect(codespaceUtils.isCodespacesEnvironment()).toBe(false)
		})
	})

	describe("isMissingDependencyError", () => {
		it("should detect libatk dependency errors", () => {
			const error = new Error(
				"error while loading shared libraries: libatk-1.0.so.0: cannot open shared object file",
			)
			expect(codespaceUtils.isMissingDependencyError(error)).toBe(true)
		})

		it("should detect Failed to launch browser errors", () => {
			const error = new Error("Failed to launch the browser process!")
			expect(codespaceUtils.isMissingDependencyError(error)).toBe(true)
		})

		it("should detect various missing library errors", () => {
			const libraries = [
				"libatk-bridge",
				"libatspi",
				"libcups",
				"libdbus",
				"libdrm",
				"libgbm",
				"libgtk",
				"libnspr",
				"libnss",
				"libx11-xcb",
				"libxcomposite",
				"libxdamage",
				"libxfixes",
				"libxkbcommon",
				"libxrandr",
			]

			libraries.forEach((lib) => {
				const error = new Error(`Missing ${lib} library`)
				expect(codespaceUtils.isMissingDependencyError(error)).toBe(true)
			})
		})

		it("should return false for non-dependency errors", () => {
			const error = new Error("Some other error")
			expect(codespaceUtils.isMissingDependencyError(error)).toBe(false)
		})

		it("should handle null/undefined errors gracefully", () => {
			expect(codespaceUtils.isMissingDependencyError(null)).toBe(false)
			expect(codespaceUtils.isMissingDependencyError(undefined)).toBe(false)
		})
	})

	describe("fixCodespaceDependencies", () => {
		it("should return false when not in Codespaces environment", async () => {
			delete process.env.CODESPACES
			delete process.env.GITHUB_CODESPACE_TOKEN

			const result = await codespaceUtils.fixCodespaceDependencies()
			expect(result).toBe(false)
		})

		it("should attempt to fix dependencies in Codespaces", async () => {
			process.env.CODESPACES = "true"

			mockExecAsync
				.mockResolvedValueOnce({ stdout: "", stderr: "" }) // apt --fix-broken install
				.mockResolvedValueOnce({ stdout: "/usr/bin/chromium-browser", stderr: "" }) // which chromium

			const result = await codespaceUtils.fixCodespaceDependencies()

			expect(result).toBe(true)
			expect(mockExecAsync).toHaveBeenCalledWith(
				"sudo apt --fix-broken install -y",
				expect.objectContaining({ timeout: 60000 }),
			)
		})

		it("should install chromium if not found", async () => {
			process.env.CODESPACES = "true"

			mockExecAsync
				.mockResolvedValueOnce({ stdout: "", stderr: "" }) // apt --fix-broken install
				.mockRejectedValueOnce(new Error("Command not found")) // which chromium (fails)
				.mockResolvedValueOnce({ stdout: "", stderr: "" }) // apt-get install chromium

			const result = await codespaceUtils.fixCodespaceDependencies()

			expect(result).toBe(true)
			expect(mockExecAsync).toHaveBeenCalledWith(
				"sudo apt-get update && sudo apt-get install -y chromium-browser",
				expect.objectContaining({ timeout: 120000 }),
			)
		})

		it("should handle errors gracefully", async () => {
			process.env.CODESPACES = "true"

			mockExecAsync.mockRejectedValue(new Error("Permission denied"))

			const result = await codespaceUtils.fixCodespaceDependencies()

			expect(result).toBe(false)
		})
	})
})
