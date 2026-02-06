// npx vitest utils/__tests__/pathUtils.spec.ts

import * as path from "path"

import { normalizeToolPath, isPathOutsideWorkspace } from "../pathUtils"

// Mock vscode module
vi.mock("vscode", () => ({
	workspace: {
		workspaceFolders: [
			{
				uri: { fsPath: "/workspace/project" },
				name: "project",
				index: 0,
			},
		],
		asRelativePath: vi.fn().mockImplementation((pathOrUri: string, includeWorkspaceFolder?: boolean) => {
			// Simulate VS Code's asRelativePath behavior
			const wsPath = "/workspace/project"
			if (pathOrUri.startsWith(wsPath + "/") || pathOrUri.startsWith(wsPath + path.sep)) {
				return pathOrUri.slice(wsPath.length + 1)
			}
			// Return unchanged if outside workspace
			return pathOrUri
		}),
	},
}))

describe("pathUtils", () => {
	describe("normalizeToolPath", () => {
		const cwd = "/workspace/project"

		describe("valid paths", () => {
			it("should accept simple relative paths", () => {
				const result = normalizeToolPath("src/file.ts", cwd)
				expect(result.isValid).toBe(true)
				expect(result.relPath).toBe("src/file.ts")
				expect(result.error).toBeUndefined()
			})

			it("should accept nested relative paths", () => {
				const result = normalizeToolPath("src/components/Button.tsx", cwd)
				expect(result.isValid).toBe(true)
				expect(result.relPath).toBe("src/components/Button.tsx")
			})

			it("should accept paths with ./", () => {
				const result = normalizeToolPath("./src/file.ts", cwd)
				expect(result.isValid).toBe(true)
				expect(result.relPath).toBe("src/file.ts")
			})

			it("should normalize redundant path segments", () => {
				const result = normalizeToolPath("src/../src/file.ts", cwd)
				expect(result.isValid).toBe(true)
				expect(result.relPath).toBe("src/file.ts")
			})

			it("should accept absolute paths within workspace", () => {
				const result = normalizeToolPath("/workspace/project/src/file.ts", cwd)
				expect(result.isValid).toBe(true)
				expect(result.relPath).toBe("src/file.ts")
			})

			it("should accept file in root of workspace", () => {
				const result = normalizeToolPath("README.md", cwd)
				expect(result.isValid).toBe(true)
				expect(result.relPath).toBe("README.md")
			})
		})

		describe("invalid paths - directory traversal attacks", () => {
			it("should reject paths starting with ../", () => {
				const result = normalizeToolPath("../outside/file.ts", cwd)
				expect(result.isValid).toBe(false)
				expect(result.error).toContain("resolves outside the workspace")
			})

			it("should reject paths with multiple ../", () => {
				const result = normalizeToolPath("../../etc/passwd", cwd)
				expect(result.isValid).toBe(false)
				expect(result.error).toContain("resolves outside the workspace")
			})

			it("should reject paths that traverse then back in", () => {
				// src/../../outside resolves to ../outside
				const result = normalizeToolPath("src/../../outside/file.ts", cwd)
				expect(result.isValid).toBe(false)
				expect(result.error).toContain("resolves outside the workspace")
			})
		})

		describe("invalid paths - absolute paths outside workspace", () => {
			it("should reject absolute paths to root", () => {
				const result = normalizeToolPath("/plans", cwd)
				expect(result.isValid).toBe(false)
				expect(result.error).toContain("resolves outside the workspace")
			})

			it("should reject absolute paths to /etc", () => {
				const result = normalizeToolPath("/etc/passwd", cwd)
				expect(result.isValid).toBe(false)
				expect(result.error).toContain("resolves outside the workspace")
			})

			it("should reject absolute paths to sibling directories", () => {
				const result = normalizeToolPath("/workspace/other-project/file.ts", cwd)
				expect(result.isValid).toBe(false)
				expect(result.error).toContain("resolves outside the workspace")
			})

			it("should reject paths to home directory", () => {
				const result = normalizeToolPath("/home/user/.ssh/id_rsa", cwd)
				expect(result.isValid).toBe(false)
				expect(result.error).toContain("resolves outside the workspace")
			})
		})

		describe("edge cases", () => {
			it("should handle empty path segments", () => {
				const result = normalizeToolPath("src//file.ts", cwd)
				expect(result.isValid).toBe(true)
				// path.normalize handles this
				expect(result.relPath).toBe("src/file.ts")
			})

			it("should handle paths with only dots", () => {
				const result = normalizeToolPath(".", cwd)
				expect(result.isValid).toBe(true)
				expect(result.relPath).toBe(".")
			})

			it("should handle paths with spaces", () => {
				const result = normalizeToolPath("src/my file.ts", cwd)
				expect(result.isValid).toBe(true)
				expect(result.relPath).toBe("src/my file.ts")
			})

			it("should handle paths with special characters", () => {
				const result = normalizeToolPath("src/file-name_v2.test.ts", cwd)
				expect(result.isValid).toBe(true)
				expect(result.relPath).toBe("src/file-name_v2.test.ts")
			})
		})

		describe("the original issue #11208", () => {
			it("should reject /plans path that caused the EACCES error", () => {
				// This is the exact path from issue #11208 that caused:
				// EACCES: permission denied, mkdir '/plans'
				const result = normalizeToolPath("/plans", cwd)
				expect(result.isValid).toBe(false)
				expect(result.error).toContain("resolves outside the workspace")
			})

			it("should reject /plans/implementation.md", () => {
				const result = normalizeToolPath("/plans/implementation.md", cwd)
				expect(result.isValid).toBe(false)
				expect(result.error).toContain("resolves outside the workspace")
			})
		})
	})

	describe("isPathOutsideWorkspace", () => {
		it("should return false for paths inside workspace", () => {
			expect(isPathOutsideWorkspace("/workspace/project/src/file.ts")).toBe(false)
		})

		it("should return false for workspace root", () => {
			expect(isPathOutsideWorkspace("/workspace/project")).toBe(false)
		})

		it("should return true for paths outside workspace", () => {
			expect(isPathOutsideWorkspace("/other/path/file.ts")).toBe(true)
		})

		it("should return true for absolute paths to root", () => {
			expect(isPathOutsideWorkspace("/plans")).toBe(true)
		})

		it("should return true for sibling directories", () => {
			expect(isPathOutsideWorkspace("/workspace/other-project")).toBe(true)
		})
	})
})
