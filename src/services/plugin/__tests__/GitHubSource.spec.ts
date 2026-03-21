import { parsePluginSource, buildRawUrl, fetchFileFromGitHub, fetchPluginManifest } from "../GitHubSource"

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe("GitHubSource", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("parsePluginSource", () => {
		it("should parse owner/repo format", () => {
			const result = parsePluginSource("myowner/myrepo")
			expect(result).toEqual({
				owner: "myowner",
				repo: "myrepo",
				ref: "main",
			})
		})

		it("should parse owner/repo@ref format", () => {
			const result = parsePluginSource("myowner/myrepo@v1.0.0")
			expect(result).toEqual({
				owner: "myowner",
				repo: "myrepo",
				ref: "v1.0.0",
			})
		})

		it("should parse owner/repo@branch format", () => {
			const result = parsePluginSource("org/repo@develop")
			expect(result).toEqual({
				owner: "org",
				repo: "repo",
				ref: "develop",
			})
		})

		it("should default ref to main when @ is present but ref is empty", () => {
			const result = parsePluginSource("owner/repo@")
			expect(result).toEqual({
				owner: "owner",
				repo: "repo",
				ref: "main",
			})
		})

		it("should throw for invalid format - no slash", () => {
			expect(() => parsePluginSource("invalidformat")).toThrow("Invalid plugin source format")
		})

		it("should throw for invalid format - empty owner", () => {
			expect(() => parsePluginSource("/repo")).toThrow("Invalid plugin source format")
		})

		it("should throw for invalid format - empty repo", () => {
			expect(() => parsePluginSource("owner/")).toThrow("Invalid plugin source format")
		})

		it("should throw for invalid format - too many parts", () => {
			expect(() => parsePluginSource("a/b/c")).toThrow("Invalid plugin source format")
		})
	})

	describe("buildRawUrl", () => {
		it("should build correct raw URL", () => {
			const url = buildRawUrl({ owner: "owner", repo: "repo", ref: "main" }, "plugin.json")
			expect(url).toBe("https://raw.githubusercontent.com/owner/repo/main/plugin.json")
		})

		it("should handle nested paths", () => {
			const url = buildRawUrl({ owner: "o", repo: "r", ref: "v1" }, "commands/review.md")
			expect(url).toBe("https://raw.githubusercontent.com/o/r/v1/commands/review.md")
		})
	})

	describe("fetchFileFromGitHub", () => {
		it("should fetch file content", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				text: () => Promise.resolve("# Hello"),
			})

			const content = await fetchFileFromGitHub({ owner: "o", repo: "r", ref: "main" }, "README.md")
			expect(content).toBe("# Hello")
			expect(mockFetch).toHaveBeenCalledWith("https://raw.githubusercontent.com/o/r/main/README.md")
		})

		it("should throw on 404", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				statusText: "Not Found",
			})

			await expect(fetchFileFromGitHub({ owner: "o", repo: "r", ref: "main" }, "missing.txt")).rejects.toThrow(
				"File not found: missing.txt",
			)
		})

		it("should throw on other HTTP errors", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				statusText: "Internal Server Error",
			})

			await expect(fetchFileFromGitHub({ owner: "o", repo: "r", ref: "main" }, "file.txt")).rejects.toThrow(
				"Failed to fetch file.txt: HTTP 500 Internal Server Error",
			)
		})
	})

	describe("fetchPluginManifest", () => {
		it("should fetch and validate a valid manifest", async () => {
			const manifest = {
				name: "test-plugin",
				version: "1.0.0",
				description: "A test plugin",
				commands: [{ name: "review", file: "commands/review.md" }],
			}

			mockFetch.mockResolvedValueOnce({
				ok: true,
				text: () => Promise.resolve(JSON.stringify(manifest)),
			})

			const result = await fetchPluginManifest({ owner: "o", repo: "r", ref: "main" })
			expect(result.name).toBe("test-plugin")
			expect(result.version).toBe("1.0.0")
			expect(result.commands).toHaveLength(1)
			expect(result.commands![0].name).toBe("review")
		})

		it("should throw on invalid JSON", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				text: () => Promise.resolve("not valid json {{{"),
			})

			await expect(fetchPluginManifest({ owner: "o", repo: "r", ref: "main" })).rejects.toThrow("Invalid JSON")
		})

		it("should throw on invalid manifest schema", async () => {
			const invalidManifest = {
				// Missing required "name" field
				version: "1.0.0",
			}

			mockFetch.mockResolvedValueOnce({
				ok: true,
				text: () => Promise.resolve(JSON.stringify(invalidManifest)),
			})

			await expect(fetchPluginManifest({ owner: "o", repo: "r", ref: "main" })).rejects.toThrow(
				"Invalid plugin manifest",
			)
		})

		it("should throw on invalid plugin name format", async () => {
			const manifest = {
				name: "invalid name with spaces!",
				version: "1.0.0",
			}

			mockFetch.mockResolvedValueOnce({
				ok: true,
				text: () => Promise.resolve(JSON.stringify(manifest)),
			})

			await expect(fetchPluginManifest({ owner: "o", repo: "r", ref: "main" })).rejects.toThrow(
				"Invalid plugin manifest",
			)
		})

		it("should apply defaults for optional fields", async () => {
			const manifest = {
				name: "minimal-plugin",
			}

			mockFetch.mockResolvedValueOnce({
				ok: true,
				text: () => Promise.resolve(JSON.stringify(manifest)),
			})

			const result = await fetchPluginManifest({ owner: "o", repo: "r", ref: "main" })
			expect(result.name).toBe("minimal-plugin")
			expect(result.version).toBe("1.0.0")
			expect(result.commands).toEqual([])
			expect(result.modes).toEqual([])
			expect(result.skills).toEqual([])
		})
	})
})
