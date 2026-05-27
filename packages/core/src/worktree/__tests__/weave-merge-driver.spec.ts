import * as fs from "fs/promises"
import * as os from "os"
import * as path from "path"

import { WeaveMergeDriverService, WEAVE_SUPPORTED_EXTENSIONS, buildGitattributesLines } from "../weave-merge-driver.js"

// Helper to run git commands in a directory using execFile for proper argument handling
import { execFileSync } from "child_process"

function execGit(cwd: string, args: string[]): void {
	execFileSync("git", args, { cwd, stdio: "pipe" })
}

describe("WeaveMergeDriverService", () => {
	let service: WeaveMergeDriverService
	let tempDir: string

	beforeEach(async () => {
		service = new WeaveMergeDriverService()
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "weave-test-"))
	})

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true })
	})

	describe("buildGitattributesLines", () => {
		it("should build gitattributes lines for default extensions", () => {
			const lines = buildGitattributesLines()
			expect(lines.length).toBe(WEAVE_SUPPORTED_EXTENSIONS.length)
			expect(lines[0]).toBe("*.py merge=weave")
			expect(lines[1]).toBe("*.js merge=weave")
			expect(lines[2]).toBe("*.jsx merge=weave")
			expect(lines[3]).toBe("*.ts merge=weave")
		})

		it("should build gitattributes lines for custom extensions", () => {
			const lines = buildGitattributesLines(["*.py", "*.rs"])
			expect(lines).toEqual(["*.py merge=weave", "*.rs merge=weave"])
		})
	})

	describe("WEAVE_SUPPORTED_EXTENSIONS", () => {
		it("should include common language extensions", () => {
			expect(WEAVE_SUPPORTED_EXTENSIONS).toContain("*.py")
			expect(WEAVE_SUPPORTED_EXTENSIONS).toContain("*.js")
			expect(WEAVE_SUPPORTED_EXTENSIONS).toContain("*.ts")
			expect(WEAVE_SUPPORTED_EXTENSIONS).toContain("*.tsx")
			expect(WEAVE_SUPPORTED_EXTENSIONS).toContain("*.rs")
			expect(WEAVE_SUPPORTED_EXTENSIONS).toContain("*.go")
			expect(WEAVE_SUPPORTED_EXTENSIONS).toContain("*.java")
		})
	})

	describe("isInstalled", () => {
		it("should return a boolean", async () => {
			const result = await service.isInstalled()
			expect(typeof result).toBe("boolean")
		})
	})

	describe("getVersion", () => {
		it("should return undefined when weave is not installed", async () => {
			// Override PATH to ensure weave isn't found
			const originalPath = process.env.PATH
			process.env.PATH = ""
			try {
				const version = await service.getVersion()
				expect(version).toBeUndefined()
			} finally {
				process.env.PATH = originalPath
			}
		})
	})

	describe("isConfiguredInGitConfig", () => {
		it("should return false for a repo without weave config", async () => {
			execGit(tempDir, ["init"])
			execGit(tempDir, ["config", "user.email", "test@test.com"])
			execGit(tempDir, ["config", "user.name", "Test"])

			const result = await service.isConfiguredInGitConfig(tempDir)
			expect(result).toBe(false)
		})

		it("should return true when weave merge driver is configured", async () => {
			execGit(tempDir, ["init"])
			execGit(tempDir, ["config", "user.email", "test@test.com"])
			execGit(tempDir, ["config", "user.name", "Test"])
			execGit(tempDir, ["config", "--local", "merge.weave.driver", "weave merge %O %A %B %P"])

			const result = await service.isConfiguredInGitConfig(tempDir)
			expect(result).toBe(true)
		})

		it("should return false for a non-git directory", async () => {
			const result = await service.isConfiguredInGitConfig(tempDir)
			expect(result).toBe(false)
		})
	})

	describe("isConfiguredInGitattributes", () => {
		it("should return false when .gitattributes does not exist", async () => {
			execGit(tempDir, ["init"])

			const result = await service.isConfiguredInGitattributes(tempDir)
			expect(result).toBe(false)
		})

		it("should return false when .gitattributes exists but has no weave entries", async () => {
			execGit(tempDir, ["init"])
			await fs.writeFile(path.join(tempDir, ".gitattributes"), "*.txt text\n")

			const result = await service.isConfiguredInGitattributes(tempDir)
			expect(result).toBe(false)
		})

		it("should return true when .gitattributes contains weave entries", async () => {
			execGit(tempDir, ["init"])
			await fs.writeFile(path.join(tempDir, ".gitattributes"), "*.py merge=weave\n*.ts merge=weave\n")

			const result = await service.isConfiguredInGitattributes(tempDir)
			expect(result).toBe(true)
		})
	})

	describe("getStatus", () => {
		it("should return full status for an unconfigured repo", async () => {
			execGit(tempDir, ["init"])

			const status = await service.getStatus(tempDir)
			expect(status.isConfiguredInGitConfig).toBe(false)
			expect(status.isConfiguredInGitattributes).toBe(false)
			expect(status.isFullyConfigured).toBe(false)
			expect(typeof status.isInstalled).toBe("boolean")
		})

		it("should report isFullyConfigured when both config and gitattributes are set", async () => {
			execGit(tempDir, ["init"])
			execGit(tempDir, ["config", "--local", "merge.weave.driver", "weave merge %O %A %B %P"])
			execGit(tempDir, ["config", "--local", "merge.weave.name", "Weave semantic merge driver"])
			await fs.writeFile(path.join(tempDir, ".gitattributes"), "*.ts merge=weave\n")

			const status = await service.getStatus(tempDir)
			expect(status.isConfiguredInGitConfig).toBe(true)
			expect(status.isConfiguredInGitattributes).toBe(true)
			expect(status.isFullyConfigured).toBe(true)
		})
	})

	describe("configureGitConfig", () => {
		it("should add merge.weave entries to local git config", async () => {
			execGit(tempDir, ["init"])
			execGit(tempDir, ["config", "user.email", "test@test.com"])
			execGit(tempDir, ["config", "user.name", "Test"])

			await service.configureGitConfig(tempDir)

			const result = await service.isConfiguredInGitConfig(tempDir)
			expect(result).toBe(true)
		})
	})

	describe("configureGitattributes", () => {
		it("should create .gitattributes when it does not exist", async () => {
			execGit(tempDir, ["init"])

			const added = await service.configureGitattributes(tempDir, ["*.py", "*.ts"])
			expect(added).toEqual(["*.py", "*.ts"])

			const content = await fs.readFile(path.join(tempDir, ".gitattributes"), "utf-8")
			expect(content).toContain("*.py merge=weave")
			expect(content).toContain("*.ts merge=weave")
			expect(content).toContain("# Weave semantic merge driver")
		})

		it("should append to existing .gitattributes", async () => {
			execGit(tempDir, ["init"])
			await fs.writeFile(path.join(tempDir, ".gitattributes"), "*.txt text\n")

			const added = await service.configureGitattributes(tempDir, ["*.py"])
			expect(added).toEqual(["*.py"])

			const content = await fs.readFile(path.join(tempDir, ".gitattributes"), "utf-8")
			expect(content).toContain("*.txt text")
			expect(content).toContain("*.py merge=weave")
		})

		it("should not duplicate existing weave entries", async () => {
			execGit(tempDir, ["init"])
			await fs.writeFile(path.join(tempDir, ".gitattributes"), "*.py merge=weave\n")

			const added = await service.configureGitattributes(tempDir, ["*.py", "*.ts"])
			expect(added).toEqual(["*.ts"])

			const content = await fs.readFile(path.join(tempDir, ".gitattributes"), "utf-8")
			// Should only have one *.py line
			const pyMatches = content.match(/\*\.py merge=weave/g)
			expect(pyMatches?.length).toBe(1)
		})

		it("should return empty array when all entries already exist", async () => {
			execGit(tempDir, ["init"])
			await fs.writeFile(path.join(tempDir, ".gitattributes"), "*.py merge=weave\n*.ts merge=weave\n")

			const added = await service.configureGitattributes(tempDir, ["*.py", "*.ts"])
			expect(added).toEqual([])
		})

		it("should throw for non-git directory", async () => {
			await expect(service.configureGitattributes(tempDir)).rejects.toThrow("Not a git repository")
		})
	})

	describe("configure", () => {
		it("should return failure when weave is not installed", async () => {
			execGit(tempDir, ["init"])

			// Override PATH to ensure weave isn't found
			const originalPath = process.env.PATH
			process.env.PATH = ""
			try {
				const result = await service.configure(tempDir)
				expect(result.success).toBe(false)
				expect(result.message).toContain("weave is not installed")
				expect(result.addedExtensions).toEqual([])
			} finally {
				process.env.PATH = originalPath
			}
		})
	})

	describe("unconfigure", () => {
		it("should remove weave config and gitattributes entries", async () => {
			execGit(tempDir, ["init"])
			execGit(tempDir, ["config", "--local", "merge.weave.driver", "weave merge %O %A %B %P"])
			execGit(tempDir, ["config", "--local", "merge.weave.name", "Weave semantic merge driver"])
			await fs.writeFile(
				path.join(tempDir, ".gitattributes"),
				"*.txt text\n# Weave semantic merge driver\n*.py merge=weave\n*.ts merge=weave\n",
			)

			const result = await service.unconfigure(tempDir)
			expect(result.success).toBe(true)

			// Check git config was removed
			const isConfigured = await service.isConfiguredInGitConfig(tempDir)
			expect(isConfigured).toBe(false)

			// Check gitattributes was cleaned
			const content = await fs.readFile(path.join(tempDir, ".gitattributes"), "utf-8")
			expect(content).toContain("*.txt text")
			expect(content).not.toContain("merge=weave")
			expect(content).not.toContain("# Weave semantic merge driver")
		})

		it("should succeed even when no weave config exists", async () => {
			execGit(tempDir, ["init"])

			const result = await service.unconfigure(tempDir)
			expect(result.success).toBe(true)
		})
	})
})
