// npx vitest utils/__tests__/path.spec.ts

import os from "os"
import * as path from "path"

import { arePathsEqual, getReadablePath, getWorkspacePath, isUrl, sanitizeFilePath, validateFilePath } from "../path"

// Mock modules

vi.mock("vscode", () => ({
	window: {
		activeTextEditor: {
			document: {
				uri: { fsPath: "/test/workspaceFolder/file.ts" },
			},
		},
	},
	workspace: {
		workspaceFolders: [
			{
				uri: { fsPath: "/test/workspace" },
				name: "test",
				index: 0,
			},
		],
		getWorkspaceFolder: vi.fn().mockReturnValue({
			uri: {
				fsPath: "/test/workspaceFolder",
			},
		}),
	},
}))
describe("Path Utilities", () => {
	const originalPlatform = process.platform
	// Helper to mock VS Code configuration

	afterEach(() => {
		Object.defineProperty(process, "platform", {
			value: originalPlatform,
		})
	})

	describe("String.prototype.toPosix", () => {
		it("should convert backslashes to forward slashes", () => {
			const windowsPath = "C:\\Users\\test\\file.txt"
			expect(windowsPath.toPosix()).toBe("C:/Users/test/file.txt")
		})

		it("should not modify paths with forward slashes", () => {
			const unixPath = "/home/user/file.txt"
			expect(unixPath.toPosix()).toBe("/home/user/file.txt")
		})

		it("should preserve extended-length Windows paths", () => {
			const extendedPath = "\\\\?\\C:\\Very\\Long\\Path"
			expect(extendedPath.toPosix()).toBe("\\\\?\\C:\\Very\\Long\\Path")
		})
	})
	describe("getWorkspacePath", () => {
		it("should return the current workspace path", () => {
			const workspacePath = "/Users/test/project"
			expect(getWorkspacePath(workspacePath)).toBe("/Users/test/project")
		})

		it("should return undefined when outside a workspace", () => {})
	})
	describe("arePathsEqual", () => {
		describe("on Windows", () => {
			beforeEach(() => {
				Object.defineProperty(process, "platform", {
					value: "win32",
				})
			})

			it("should compare paths case-insensitively", () => {
				expect(arePathsEqual("C:\\Users\\Test", "c:\\users\\test")).toBe(true)
			})

			it("should handle different path separators", () => {
				// Convert both paths to use forward slashes after normalization
				const path1 = path.normalize("C:\\Users\\Test").replace(/\\/g, "/")
				const path2 = path.normalize("C:/Users/Test").replace(/\\/g, "/")
				expect(arePathsEqual(path1, path2)).toBe(true)
			})

			it("should normalize paths with ../", () => {
				// Convert both paths to use forward slashes after normalization
				const path1 = path.normalize("C:\\Users\\Test\\..\\Test").replace(/\\/g, "/")
				const path2 = path.normalize("C:\\Users\\Test").replace(/\\/g, "/")
				expect(arePathsEqual(path1, path2)).toBe(true)
			})
		})

		describe("on POSIX", () => {
			beforeEach(() => {
				Object.defineProperty(process, "platform", {
					value: "darwin",
				})
			})

			it("should compare paths case-sensitively", () => {
				expect(arePathsEqual("/Users/Test", "/Users/test")).toBe(false)
			})

			it("should normalize paths", () => {
				expect(arePathsEqual("/Users/./Test", "/Users/Test")).toBe(true)
			})

			it("should handle trailing slashes", () => {
				expect(arePathsEqual("/Users/Test/", "/Users/Test")).toBe(true)
			})
		})

		describe("edge cases", () => {
			it("should handle undefined paths", () => {
				expect(arePathsEqual(undefined, undefined)).toBe(true)
				expect(arePathsEqual("/test", undefined)).toBe(false)
				expect(arePathsEqual(undefined, "/test")).toBe(false)
			})

			it("should handle root paths with trailing slashes", () => {
				expect(arePathsEqual("/", "/")).toBe(true)
				expect(arePathsEqual("C:\\", "C:\\")).toBe(true)
			})
		})

		describe("isUrl", () => {
			it("should detect HTTP URLs", () => {
				expect(isUrl("http://example.com")).toBe(true)
				expect(isUrl("https://example.com")).toBe(true)
				expect(isUrl("https://www.google.com/search?q=package.json")).toBe(true)
			})

			it("should detect other protocol URLs", () => {
				expect(isUrl("ftp://example.com")).toBe(true)
				expect(isUrl("file://localhost/path")).toBe(true)
				expect(isUrl("ssh://git@github.com")).toBe(true)
				expect(isUrl("ws://localhost:8080")).toBe(true)
				expect(isUrl("wss://secure.example.com")).toBe(true)
			})

			it("should not detect regular file paths as URLs", () => {
				expect(isUrl("package.json")).toBe(false)
				expect(isUrl("/usr/local/bin")).toBe(false)
				expect(isUrl("C:\\Windows\\System32")).toBe(false)
				expect(isUrl("./src/index.ts")).toBe(false)
				expect(isUrl("../parent/file.txt")).toBe(false)
			})

			it("should handle edge cases", () => {
				expect(isUrl("")).toBe(false)
				expect(isUrl(null as any)).toBe(false)
				expect(isUrl(undefined as any)).toBe(false)
				expect(isUrl(123 as any)).toBe(false)
			})

			it("should be case-insensitive for protocols", () => {
				expect(isUrl("HTTP://example.com")).toBe(true)
				expect(isUrl("HTTPS://example.com")).toBe(true)
				expect(isUrl("FTP://example.com")).toBe(true)
			})
		})

		describe("sanitizeFilePath", () => {
			it("should return null for complete URLs", () => {
				expect(sanitizeFilePath("https://www.google.com/search?q=package.json")).toBe(null)
				expect(sanitizeFilePath("http://example.com/file.txt")).toBe(null)
				expect(sanitizeFilePath("ftp://server.com/path")).toBe(null)
			})

			it("should extract file path from concatenated URL and path", () => {
				expect(sanitizeFilePath("package.json\nhttps://google.com")).toBe("package.json")
				expect(sanitizeFilePath("src/file.ts https://example.com")).toBe("src/file.ts")
				// Note: The comma case returns with the comma because it's checking if there's a URL after it
				expect(sanitizeFilePath("./config.json,https://api.example.com")).toBe("./config.json")
				expect(sanitizeFilePath("test.txt;https://example.com")).toBe("test.txt")
			})

			it("should handle paths with URLs concatenated without separators", () => {
				expect(sanitizeFilePath("package.jsonhttps://google.com")).toBe("package.json")
				expect(sanitizeFilePath("src/file.tshttps://example.com/api")).toBe("src/file.ts")
				expect(sanitizeFilePath("config.yamlftp://server.com")).toBe("config.yaml")
			})

			it("should return the original path if no URL is present", () => {
				expect(sanitizeFilePath("package.json")).toBe("package.json")
				expect(sanitizeFilePath("/usr/local/bin/app")).toBe("/usr/local/bin/app")
				expect(sanitizeFilePath("C:\\Windows\\System32\\cmd.exe")).toBe("C:\\Windows\\System32\\cmd.exe")
			})

			it("should trim whitespace", () => {
				expect(sanitizeFilePath("  package.json  ")).toBe("package.json")
				expect(sanitizeFilePath("\t./src/index.ts\n")).toBe("./src/index.ts")
			})

			it("should handle edge cases", () => {
				expect(sanitizeFilePath("")).toBe(null)
				expect(sanitizeFilePath(null as any)).toBe(null)
				expect(sanitizeFilePath(undefined as any)).toBe(null)
				expect(sanitizeFilePath(123 as any)).toBe(null)
			})

			it("should handle Windows paths with URLs", () => {
				// The trailing backslash is removed as it's considered a separator before the URL
				expect(
					sanitizeFilePath(
						"d:\\01_Proyectos\\SUPER-ADMIN\\package.json\\https:\\www.google.com\\search?q=package.json",
					),
				).toBe("d:\\01_Proyectos\\SUPER-ADMIN\\package.json")
				expect(sanitizeFilePath("C:\\Users\\test\\file.txt https://example.com")).toBe(
					"C:\\Users\\test\\file.txt",
				)
			})
		})

		describe("validateFilePath", () => {
			it("should validate normal file paths", () => {
				expect(validateFilePath("package.json")).toEqual({ isValid: true })
				expect(validateFilePath("./src/index.ts")).toEqual({ isValid: true })
				expect(validateFilePath("/usr/local/bin/app")).toEqual({ isValid: true })
				expect(validateFilePath("C:\\Windows\\System32\\cmd.exe")).toEqual({ isValid: true })
			})

			it("should reject complete URLs", () => {
				const result = validateFilePath("https://www.google.com/search?q=package.json")
				expect(result.isValid).toBe(false)
				expect(result.error).toContain("appears to be a URL")
			})

			it("should reject paths with URL components and suggest sanitized version", () => {
				const result = validateFilePath("package.json https://google.com")
				expect(result.isValid).toBe(false)
				expect(result.error).toContain("contains URL components")
				expect(result.error).toContain("package.json")
			})

			it("should reject paths with concatenated URLs", () => {
				const result = validateFilePath("package.jsonhttps://google.com")
				expect(result.isValid).toBe(false)
				expect(result.error).toContain("contains URL components")
				expect(result.error).toContain("package.json")
			})

			it("should handle empty or invalid inputs", () => {
				expect(validateFilePath("").isValid).toBe(false)
				expect(validateFilePath("").error).toContain("empty or invalid")

				expect(validateFilePath(null as any).isValid).toBe(false)
				expect(validateFilePath(undefined as any).isValid).toBe(false)
				expect(validateFilePath(123 as any).isValid).toBe(false)
			})

			it("should handle the exact issue case from bug report", () => {
				const bugPath =
					"d:\\01_Proyectos\\...\\SUPER-ADMIN\\package.json\\https:\\www.google.com\\search?q=package.json"
				const result = validateFilePath(bugPath)
				expect(result.isValid).toBe(false)
				expect(result.error).toContain("contains URL components")
			})

			it("should accept paths with spaces", () => {
				expect(validateFilePath("my folder/my file.txt")).toEqual({ isValid: true })
				expect(validateFilePath("C:\\Program Files\\app.exe")).toEqual({ isValid: true })
			})

			it("should accept paths with special characters", () => {
				expect(validateFilePath("file-name_123.test.ts")).toEqual({ isValid: true })
				expect(validateFilePath("@types/node/index.d.ts")).toEqual({ isValid: true })
				expect(validateFilePath("file[1].txt")).toEqual({ isValid: true })
			})
		})
	})

	describe("getReadablePath", () => {
		const homeDir = os.homedir()
		const desktop = path.join(homeDir, "Desktop")
		const cwd = process.platform === "win32" ? "C:\\Users\\test\\project" : "/Users/test/project"

		it("should return basename when path equals cwd", () => {
			expect(getReadablePath(cwd, cwd)).toBe("project")
		})

		it("should return relative path when inside cwd", () => {
			const filePath =
				process.platform === "win32"
					? "C:\\Users\\test\\project\\src\\file.txt"
					: "/Users/test/project/src/file.txt"
			expect(getReadablePath(cwd, filePath)).toBe("src/file.txt")
		})

		it("should return absolute path when outside cwd", () => {
			const filePath =
				process.platform === "win32" ? "C:\\Users\\test\\other\\file.txt" : "/Users/test/other/file.txt"
			expect(getReadablePath(cwd, filePath)).toBe(filePath.toPosix())
		})

		it("should handle Desktop as cwd", () => {
			const filePath = path.join(desktop, "file.txt")
			expect(getReadablePath(desktop, filePath)).toBe(filePath.toPosix())
		})

		it("should handle undefined relative path", () => {
			expect(getReadablePath(cwd)).toBe("project")
		})

		it("should handle parent directory traversal", () => {
			const filePath =
				process.platform === "win32" ? "C:\\Users\\test\\other\\file.txt" : "/Users/test/other/file.txt"
			expect(getReadablePath(cwd, filePath)).toBe(filePath.toPosix())
		})

		it("should normalize paths with redundant segments", () => {
			const filePath =
				process.platform === "win32"
					? "C:\\Users\\test\\project\\src\\file.txt"
					: "/Users/test/project/./src/../src/file.txt"
			expect(getReadablePath(cwd, filePath)).toBe("src/file.txt")
		})
	})
})
