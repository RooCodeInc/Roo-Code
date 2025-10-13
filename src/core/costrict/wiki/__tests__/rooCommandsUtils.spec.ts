import { describe, it, expect, vi, beforeEach } from "vitest"
import * as path from "path"
import { isRooGlobalCommandsDirectory, handleRooCommandsApprovalSkip } from "../utils/rooCommandsUtils"

// Mock path module
vi.mock("path", async (importOriginal) => {
	const actual = await importOriginal<typeof import("path")>()
	return {
		...actual,
		resolve: vi.fn((...paths: string[]) => {
			// 如果只有一个路径参数，将其转换为绝对路径
			if (paths.length === 1) {
				const path = paths[0]
				// 如果是相对路径，转换为绝对路径
				if (path.startsWith("./") || path.startsWith("../") || !path.startsWith("/")) {
					return `/current/working/directory/${path.replace(/^\.\//, "")}`
				}
				return path
			}
			// 如果有多个路径参数，拼接它们
			return paths.join("/")
		}),
		sep: "/",
	}
})

// Mock constants module
vi.mock("../wiki-prompts/subtasks/constants", () => ({
	getGlobalCommandsDir: vi.fn(() => "/home/user/.roo/commands"),
}))

describe("rooCommandsUtils", () => {
	const mockGlobalCommandsDir = "/home/user/.roo/commands"

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("isRooGlobalCommandsDirectory", () => {
		it("应该返回 true 当路径是 .roo/commands 目录", () => {
			const result = isRooGlobalCommandsDirectory(mockGlobalCommandsDir)
			expect(result).toBe(true)
		})

		it("应该返回 true 当路径是 .roo/commands 的子目录", () => {
			const subDirPath = `${mockGlobalCommandsDir}/subdir`
			const result = isRooGlobalCommandsDirectory(subDirPath)
			expect(result).toBe(true)
		})

		it("应该返回 false 当路径不是 .roo/commands 目录或其子目录", () => {
			const otherPath = "/home/user/other/path"
			const result = isRooGlobalCommandsDirectory(otherPath)
			expect(result).toBe(false)
		})

		it("应该返回 false 当路径是 .roo/commands 的父目录", () => {
			const parentPath = "/home/user/.roo"
			const result = isRooGlobalCommandsDirectory(parentPath)
			expect(result).toBe(false)
		})

		it("应该正确处理路径分隔符", () => {
			// 测试不同路径分隔符的情况
			const subDirPath = `${mockGlobalCommandsDir}/subdir/nested`
			const result = isRooGlobalCommandsDirectory(subDirPath)
			expect(result).toBe(true)
		})
	})

	describe("handleRooCommandsApprovalSkip", () => {
		const mockFileResult = { status: "pending" }
		const mockRelPath = "test-file.md"
		const mockCline = { cwd: "/current/working/directory" }
		const mockUpdateFileResult = vi.fn()

		beforeEach(() => {
			mockUpdateFileResult.mockClear()
		})

		it("应该返回 true 并更新文件结果当文件在 .roo/commands 目录中且状态为 pending", () => {
			const fullPath = `${mockGlobalCommandsDir}/test-file.md`
			vi.mocked(path.resolve).mockReturnValue(fullPath)

			const result = handleRooCommandsApprovalSkip(
				mockFileResult,
				mockRelPath,
				mockCline,
				mockUpdateFileResult
			)

			expect(result).toBe(true)
			expect(mockUpdateFileResult).toHaveBeenCalledWith(mockRelPath, {
				status: "approved",
			})
		})

		it("应该返回 false 当文件状态不是 pending", () => {
			const nonPendingFileResult = { status: "approved" }
			const fullPath = `${mockGlobalCommandsDir}/test-file.md`
			vi.mocked(path.resolve).mockReturnValue(fullPath)

			const result = handleRooCommandsApprovalSkip(
				nonPendingFileResult,
				mockRelPath,
				mockCline,
				mockUpdateFileResult
			)

			expect(result).toBe(false)
			expect(mockUpdateFileResult).not.toHaveBeenCalled()
		})

		it("应该返回 false 当文件不在 .roo/commands 目录中", () => {
			const otherPath = "/home/user/other/path/test-file.md"
			vi.mocked(path.resolve).mockReturnValue(otherPath)

			const result = handleRooCommandsApprovalSkip(
				mockFileResult,
				mockRelPath,
				mockCline,
				mockUpdateFileResult
			)

			expect(result).toBe(false)
			expect(mockUpdateFileResult).not.toHaveBeenCalled()
		})

		it("应该正确处理路径解析", () => {
			const fullPath = `${mockGlobalCommandsDir}/test-file.md`
			vi.mocked(path.resolve).mockReturnValue(fullPath)

			handleRooCommandsApprovalSkip(
				mockFileResult,
				mockRelPath,
				mockCline,
				mockUpdateFileResult
			)

			expect(vi.mocked(path.resolve)).toHaveBeenCalledWith(mockCline.cwd, mockRelPath)
		})

		it("应该正确处理嵌套子目录的情况", () => {
			const nestedPath = `${mockGlobalCommandsDir}/subdir/nested/file.md`
			vi.mocked(path.resolve).mockReturnValue(nestedPath)

			const result = handleRooCommandsApprovalSkip(
				mockFileResult,
				mockRelPath,
				mockCline,
				mockUpdateFileResult
			)

			expect(result).toBe(true)
			expect(mockUpdateFileResult).toHaveBeenCalledWith(mockRelPath, {
				status: "approved",
			})
		})

		it("应该正确处理边界情况 - 路径完全匹配", () => {
			vi.mocked(path.resolve).mockReturnValue(mockGlobalCommandsDir)

			const result = handleRooCommandsApprovalSkip(
				mockFileResult,
				mockRelPath,
				mockCline,
				mockUpdateFileResult
			)

			expect(result).toBe(true)
			expect(mockUpdateFileResult).toHaveBeenCalledWith(mockRelPath, {
				status: "approved",
			})
		})
	})

	describe("边界情况测试", () => {
		it("isRooGlobalCommandsDirectory 应该处理空字符串路径", () => {
			const result = isRooGlobalCommandsDirectory("")
			expect(result).toBe(false)
		})

		it("isRooGlobalCommandsDirectory 应该处理相对路径", () => {
			const relativePath = "./some/relative/path"
			// 确保path.resolve mock正确处理相对路径
			vi.mocked(path.resolve).mockReturnValue("/current/working/directory/some/relative/path")
			const result = isRooGlobalCommandsDirectory(relativePath)
			expect(result).toBe(false)
		})

		it("handleRooCommandsApprovalSkip 应该处理 undefined 状态", () => {
			const undefinedStatusResult = { status: undefined }
			const result = handleRooCommandsApprovalSkip(
				undefinedStatusResult,
				"test-file.md",
				{ cwd: "/current/working/directory" },
				vi.fn()
			)

			expect(result).toBe(false)
		})

		it("handleRooCommandsApprovalSkip 应该处理 null 文件结果", () => {
			const result = handleRooCommandsApprovalSkip(
				null as any,
				"test-file.md",
				{ cwd: "/current/working/directory" },
				vi.fn()
			)

			expect(result).toBe(false)
		})
	})
})