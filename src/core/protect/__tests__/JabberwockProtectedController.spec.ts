import path from "path"
import { JabberwockProtectedController } from "../JabberwockProtectedController"

describe("JabberwockProtectedController", () => {
	const TEST_CWD = "/test/workspace"
	let controller: JabberwockProtectedController

	beforeEach(() => {
		controller = new JabberwockProtectedController(TEST_CWD)
	})

	describe("isWriteProtected", () => {
		it("should protect .jabberwockignore file", () => {
			expect(controller.isWriteProtected(".jabberwockignore")).toBe(true)
		})

		it("should protect files in .jabberwock directory", () => {
			expect(controller.isWriteProtected(".jabberwock/config.json")).toBe(true)
			expect(controller.isWriteProtected(".jabberwock/settings/user.json")).toBe(true)
			expect(controller.isWriteProtected(".jabberwock/modes/custom.json")).toBe(true)
		})

		it("should protect .jabberwockprotected file", () => {
			expect(controller.isWriteProtected(".jabberwockprotected")).toBe(true)
		})

		it("should protect .jabberwockmodes files", () => {
			expect(controller.isWriteProtected(".jabberwockmodes")).toBe(true)
		})

		it("should protect .jabberwockrules* files", () => {
			expect(controller.isWriteProtected(".jabberwockrules")).toBe(true)
			expect(controller.isWriteProtected(".jabberwockrules.md")).toBe(true)
		})

		it("should protect .clinerules* files", () => {
			expect(controller.isWriteProtected(".clinerules")).toBe(true)
			expect(controller.isWriteProtected(".clinerules.md")).toBe(true)
		})

		it("should protect files in .vscode directory", () => {
			expect(controller.isWriteProtected(".vscode/settings.json")).toBe(true)
			expect(controller.isWriteProtected(".vscode/launch.json")).toBe(true)
			expect(controller.isWriteProtected(".vscode/tasks.json")).toBe(true)
		})

		it("should protect .code-workspace files", () => {
			expect(controller.isWriteProtected("myproject.code-workspace")).toBe(true)
			expect(controller.isWriteProtected("pentest.code-workspace")).toBe(true)
			expect(controller.isWriteProtected(".code-workspace")).toBe(true)
			expect(controller.isWriteProtected("folder/workspace.code-workspace")).toBe(true)
		})

		it("should protect AGENTS.md file", () => {
			expect(controller.isWriteProtected("AGENTS.md")).toBe(true)
		})

		it("should protect AGENT.md file", () => {
			expect(controller.isWriteProtected("AGENT.md")).toBe(true)
		})

		it("should not protect other files starting with .jabberwock", () => {
			expect(controller.isWriteProtected(".jabberwocksettings")).toBe(false)
			expect(controller.isWriteProtected(".jabberwockconfig")).toBe(false)
		})

		it("should not protect regular files", () => {
			expect(controller.isWriteProtected("src/index.ts")).toBe(false)
			expect(controller.isWriteProtected("package.json")).toBe(false)
			expect(controller.isWriteProtected("README.md")).toBe(false)
		})

		it("should not protect files that contain 'jabberwock' but don't start with .jabberwock", () => {
			expect(controller.isWriteProtected("src/jabberwock-utils.ts")).toBe(false)
			expect(controller.isWriteProtected("config/jabberwock.config.js")).toBe(false)
		})

		it("should handle nested paths correctly", () => {
			expect(controller.isWriteProtected(".jabberwock/config.json")).toBe(true) // .jabberwock/** matches at root
			expect(controller.isWriteProtected("nested/.jabberwockignore")).toBe(true) // .jabberwockignore matches anywhere by default
			expect(controller.isWriteProtected("nested/.jabberwockmodes")).toBe(true) // .jabberwockmodes matches anywhere by default
			expect(controller.isWriteProtected("nested/.jabberwockrules.md")).toBe(true) // .jabberwockrules* matches anywhere by default
		})

		it("should handle absolute paths by converting to relative", () => {
			const absolutePath = path.join(TEST_CWD, ".jabberwockignore")
			expect(controller.isWriteProtected(absolutePath)).toBe(true)
		})

		it("should handle paths with different separators", () => {
			expect(controller.isWriteProtected(".jabberwock\\config.json")).toBe(true)
			expect(controller.isWriteProtected(".jabberwock/config.json")).toBe(true)
		})

		it("should not throw for absolute paths outside cwd", () => {
			expect(controller.isWriteProtected("/tmp/comment-2-pr63.json")).toBe(false)
			expect(controller.isWriteProtected("/etc/passwd")).toBe(false)
		})
	})

	describe("getProtectedFiles", () => {
		it("should return set of protected files from a list", () => {
			const files = ["src/index.ts", ".jabberwockignore", "package.json", ".jabberwock/config.json", "README.md"]

			const protectedFiles = controller.getProtectedFiles(files)

			expect(protectedFiles).toEqual(new Set([".jabberwockignore", ".jabberwock/config.json"]))
		})

		it("should return empty set when no files are protected", () => {
			const files = ["src/index.ts", "package.json", "README.md"]

			const protectedFiles = controller.getProtectedFiles(files)

			expect(protectedFiles).toEqual(new Set())
		})
	})

	describe("annotatePathsWithProtection", () => {
		it("should annotate paths with protection status", () => {
			const files = ["src/index.ts", ".jabberwockignore", ".jabberwock/config.json", "package.json"]

			const annotated = controller.annotatePathsWithProtection(files)

			expect(annotated).toEqual([
				{ path: "src/index.ts", isProtected: false },
				{ path: ".jabberwockignore", isProtected: true },
				{ path: ".jabberwock/config.json", isProtected: true },
				{ path: "package.json", isProtected: false },
			])
		})
	})

	describe("getProtectionMessage", () => {
		it("should return appropriate protection message", () => {
			const message = controller.getProtectionMessage()
			expect(message).toBe("This is a Jabberwock configuration file and requires approval for modifications")
		})
	})

	describe("getInstructions", () => {
		it("should return formatted instructions about protected files", () => {
			const instructions = controller.getInstructions()

			expect(instructions).toContain("# Protected Files")
			expect(instructions).toContain("write-protected")
			expect(instructions).toContain(".jabberwockignore")
			expect(instructions).toContain(".jabberwock/**")
			expect(instructions).toContain("\u{1F6E1}") // Shield symbol
		})
	})

	describe("getProtectedPatterns", () => {
		it("should return the list of protected patterns", () => {
			const patterns = JabberwockProtectedController.getProtectedPatterns()

			expect(patterns).toEqual([
				".jabberwockignore",
				".jabberwockmodes",
				".jabberwockrules*",
				".clinerules*",
				".jabberwock/**",
				".vscode/**",
				"*.code-workspace",
				".jabberwockprotected",
				"AGENTS.md",
				"AGENT.md",
			])
		})
	})
})
