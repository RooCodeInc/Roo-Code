// npx vitest utils/__tests__/pathUtils.spec.ts

import * as path from "path"

import { normalizeToolPath, isPathOutsideWorkspace } from "../pathUtils"

// Use platform-native absolute paths for cross-platform compatibility.
// On Unix: /workspace/project, on Windows: C:\workspace\project (or similar)
const WORKSPACE_ROOT = path.resolve("/workspace/project")

// Mock vscode module
vi.mock("vscode", () => ({
	workspace: {
		workspaceFolders: [
			{
				uri: { fsPath: path.resolve("/workspace/project") },
				name: "project",
				index: 0,
			},
		],
		asRelativePath: vi.fn().mockImplementation((pathOrUri: string, _includeWorkspaceFolder?: boolean) => {
			// Simulate VS Code's asRelativePath behavior
			const wsPath = path.resolve("/workspace/project")
			const normalized = path.normalize(pathOrUri)
			if (normalized.startsWith(wsPath + path.sep)) {
				return normalized.slice(wsPath.length + 1)
			}
			if (normalized === wsPath) {
				return normalized
			}
			// Return unchanged if outside workspace
			return pathOrUri
		}),
	},
}))

describe("pathUtils", () => {
	describe("normalizeToolPath", () => {
		const cwd = WORKSPACE_ROOT

		describe("valid paths", () => {
			it("should accept simple relative paths", () => {
				const result = normalizeToolPath("src/file.ts", cwd)
				expect(result.isValid).toBe(true)
				expect(result.relPath).toBe(path.normalize("src/file.ts"))
				expect(result.error).toBeUndefined()
			})

			it("should accept nested relative paths", () => {
				const result = normalizeToolPath("src/components/Button.tsx", cwd)
				expect(result.isValid).toBe(true)
				expect(result.relPath).toBe(path.normalize("src/components/Button.tsx"))
			})

			it("should accept paths with ./", () => {
				const result = normalizeToolPath("./src/file.ts", cwd)
				expect(result.isValid).toBe(true)
				expect(result.relPath).toBe(path.normalize("src/file.ts"))
			})

			it("should normalize redundant path segments", () => {
				const result = normalizeToolPath("src/../src/file.ts", cwd)
				expect(result.isValid).toBe(true)
				expect(result.relPath).toBe(path.normalize("src/file.ts"))
			})

			it("should accept absolute paths within workspace", () => {
				const absPath = path.join(WORKSPACE_ROOT, "src", "file.ts")
				const result = normalizeToolPath(absPath, cwd)
				expect(result.isValid).toBe(true)
				expect(result.relPath).toBe(path.normalize("src/file.ts"))
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
			it("should reject absolute paths to root-level directory", () => {
				// Use a platform-native absolute path outside workspace
				const outsidePath = path.resolve("/plans")
				const result = normalizeToolPath(outsidePath, cwd)
				expect(result.isValid).toBe(false)
				expect(result.error).toContain("resolves outside the workspace")
			})

			it("should reject absolute paths to system directories", () => {
				const outsidePath = path.resolve("/etc/passwd")
				const result = normalizeToolPath(outsidePath, cwd)
				expect(result.isValid).toBe(false)
				expect(result.error).toContain("resolves outside the workspace")
			})

			it("should reject absolute paths to sibling directories", () => {
				const siblingPath = path.resolve("/workspace/other-project/file.ts")
				const result = normalizeToolPath(siblingPath, cwd)
				expect(result.isValid).toBe(false)
				expect(result.error).toContain("resolves outside the workspace")
			})

			it("should reject paths to home directory", () => {
				const homePath = path.resolve("/home/user/.ssh/id_rsa")
				const result = normalizeToolPath(homePath, cwd)
				expect(result.isValid).toBe(false)
				expect(result.error).toContain("resolves outside the workspace")
			})
		})

		describe("edge cases", () => {
			it("should handle empty path segments", () => {
				const result = normalizeToolPath("src//file.ts", cwd)
				expect(result.isValid).toBe(true)
				// path.normalize handles this
				expect(result.relPath).toBe(path.normalize("src/file.ts"))
			})

			it("should handle paths with only dots", () => {
				const result = normalizeToolPath(".", cwd)
				expect(result.isValid).toBe(true)
				expect(result.relPath).toBe(".")
			})

			it("should handle paths with spaces", () => {
				const result = normalizeToolPath("src/my file.ts", cwd)
				expect(result.isValid).toBe(true)
				expect(result.relPath).toBe(path.normalize("src/my file.ts"))
			})

			it("should handle paths with special characters", () => {
				const result = normalizeToolPath("src/file-name_v2.test.ts", cwd)
				expect(result.isValid).toBe(true)
				expect(result.relPath).toBe(path.normalize("src/file-name_v2.test.ts"))
			})
		})

		describe("the original issue #11208", () => {
			it("should reject /plans path that caused the EACCES error", () => {
				// This is the exact path from issue #11208 that caused:
				// EACCES: permission denied, mkdir '/plans'
				// On Windows, "/plans" is NOT absolute (no drive letter), so we
				// test with a platform-native absolute path instead.
				const plansPath = path.resolve("/plans")
				const result = normalizeToolPath(plansPath, cwd)
				expect(result.isValid).toBe(false)
				expect(result.error).toContain("resolves outside the workspace")
			})

			it("should reject /plans/implementation.md", () => {
				const plansPath = path.resolve("/plans/implementation.md")
				const result = normalizeToolPath(plansPath, cwd)
				expect(result.isValid).toBe(false)
				expect(result.error).toContain("resolves outside the workspace")
			})
		})
	})

	describe("isPathOutsideWorkspace", () => {
		it("should return false for paths inside workspace", () => {
			const insidePath = path.join(WORKSPACE_ROOT, "src", "file.ts")
			expect(isPathOutsideWorkspace(insidePath)).toBe(false)
		})

		it("should return false for workspace root", () => {
			expect(isPathOutsideWorkspace(WORKSPACE_ROOT)).toBe(false)
		})

		it("should return true for paths outside workspace", () => {
			const outsidePath = path.resolve("/other/path/file.ts")
			expect(isPathOutsideWorkspace(outsidePath)).toBe(true)
		})

		it("should return true for absolute paths to root", () => {
			const rootPath = path.resolve("/plans")
			expect(isPathOutsideWorkspace(rootPath)).toBe(true)
		})

		it("should return true for sibling directories", () => {
			const siblingPath = path.resolve("/workspace/other-project")
			expect(isPathOutsideWorkspace(siblingPath)).toBe(true)
		})
	})
})
