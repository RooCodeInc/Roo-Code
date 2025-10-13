/**
 * CospecMetadataManager 测试文件
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import * as fs from "fs/promises"
import * as path from "path"

// Mock path module
vi.mock("path", async (importOriginal) => {
	const actual = await importOriginal<typeof import("path")>()
	const mockBasename = vi.fn((filePath: string) => {
		// Extract filename from path, handling both / and \ separators
		const normalizedPath = filePath.replace(/\\/g, "/")
		const parts = normalizedPath.split("/")
		return parts[parts.length - 1]
	})
	const mockNormalize = vi.fn((filePath: string) => filePath.replace(/\\/g, "/"))
	const mockSep = "/"
	const mockJoin = vi.fn((...parts: string[]) => parts.join("/"))

	return {
		...actual,
		basename: mockBasename,
		normalize: mockNormalize,
		sep: mockSep,
		join: mockJoin,
		default: {
			...actual,
			basename: mockBasename,
			normalize: mockNormalize,
			sep: mockSep,
			join: mockJoin,
		},
	}
})

// Mock all dependencies to prevent actual file operations
vi.mock("proper-lockfile", () => ({
	lock: vi.fn().mockResolvedValue(() => Promise.resolve()),
	unlock: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("stream-json/Disassembler", () => ({
	default: {
		disassembler: vi.fn().mockReturnValue({
			pipe: vi.fn().mockReturnThis(),
			on: vi.fn().mockReturnThis(),
			write: vi.fn(),
			end: vi.fn(),
		}),
	},
}))

vi.mock("stream-json/Stringer", () => ({
	default: {
		stringer: vi.fn().mockReturnValue({
			pipe: vi.fn().mockReturnThis(),
			on: vi.fn().mockReturnThis(),
			write: vi.fn(),
			end: vi.fn(),
		}),
	},
}))

// Mock fs sync operations
vi.mock("fs", () => ({
	createWriteStream: vi.fn().mockReturnValue({
		write: vi.fn(),
		end: vi.fn(),
		on: vi.fn().mockReturnThis(),
	}),
}))

// Mock fs/promises
vi.mock("fs/promises")

// Mock safeWriteJson completely to avoid any file operations
const mockSafeWriteJson = vi.fn().mockResolvedValue(undefined)
vi.mock("../../../utils/safeWriteJson", () => ({
	safeWriteJson: mockSafeWriteJson,
}))

// Now import after mocking
import { CospecMetadataManager, CospecMetadata } from "../CospecMetadataManager"
import { isCoworkflowDocument } from "../commands"

describe("CospecMetadataManager", () => {
	const mockDirectoryPath = "/mock/cospec/directory"
	const mockFilePath = "/mock/cospec/directory/requirements.md"
	const mockMetadata: CospecMetadata = {
		design: {
			lastTaskId: "test-task-123",
			lastCheckpointId: "checkpoint-abc",
		},
		requirements: {
			lastTaskId: "test-task-456",
			lastCheckpointId: "checkpoint-def",
		},
		tasks: {
			lastTaskId: "test-task-789",
			lastCheckpointId: "checkpoint-ghi",
		},
	}

	beforeEach(() => {
		vi.clearAllMocks()
		// Mock fs.mkdir to prevent actual directory creation
		vi.mocked(fs.mkdir).mockResolvedValue(undefined)
	})

	describe("readMetadata", () => {
		it("应该成功读取元数据文件", async () => {
			const mockContent = JSON.stringify(mockMetadata)
			vi.mocked(fs.readFile).mockResolvedValue(mockContent)

			const result = await CospecMetadataManager.readMetadata(mockDirectoryPath)

			expect(result).toEqual(mockMetadata)
			expect(fs.readFile).toHaveBeenCalledWith(path.join(mockDirectoryPath, ".cometa.json"), "utf8")
		})
	})

	describe("isCospecFile", () => {
		it("应该正确识别 .cospec 文件", async () => {
			const testCases = [
				{ path: "/project/.cospec/requirements.md", expected: true },
				{ path: "/project/.cospec/subdir/design.md", expected: true },
				{ path: "C:\\project\\.cospec\\tasks.md", expected: true },
				{ path: "/project/src/main.ts", expected: false },
				{ path: "/project/docs/readme.md", expected: false },
			]

			// Import path to check mock values
			const pathModule = await import("path")

			// Test each case individually to see which one fails
			for (let i = 0; i < testCases.length; i++) {
				const { path: testPath, expected } = testCases[i]
				console.log(`\n=== Test case ${i + 1} ===`)
				console.log(`Input path: ${testPath}`)
				console.log(`Expected: ${expected}`)

				console.log(`path.basename('${testPath}') = ${pathModule.basename(testPath)}`)
				console.log(`path.normalize('${testPath}') = ${pathModule.normalize(testPath)}`)
				console.log(`path.sep = '${pathModule.sep}'`)

				const normalizedPath = pathModule.normalize(testPath)
				const pathParts = normalizedPath.split(pathModule.sep)
				console.log(`Path parts: ${JSON.stringify(pathParts)}`)
				const hasCospecDir = pathParts.includes(".cospec")
				console.log(`Has .cospec dir: ${hasCospecDir}`)

				const result = isCoworkflowDocument(testPath)
				console.log(`Actual result: ${result}`)

				if (result !== expected) {
					console.log(`❌ FAILED: Test case ${i + 1} failed`)
				} else {
					console.log(`✅ PASSED: Test case ${i + 1}`)
				}

				expect(result).toBe(expected)
			}
		})
	})

	describe("getMetadataOrDefault", () => {
		it("元数据存在时应该返回元数据", async () => {
			vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockMetadata))

			const result = await CospecMetadataManager.getMetadataOrDefault(mockDirectoryPath)

			expect(result).toEqual(mockMetadata)
		})

		it("元数据不存在时应该返回默认值", async () => {
			const error = new Error("File not found")
			;(error as any).code = "ENOENT"
			vi.mocked(fs.readFile).mockRejectedValue(error)

			const result = await CospecMetadataManager.getMetadataOrDefault(mockDirectoryPath)

			expect(result).toEqual({
				design: { lastTaskId: "", lastCheckpointId: "" },
				requirements: { lastTaskId: "", lastCheckpointId: "" },
				tasks: { lastTaskId: "", lastCheckpointId: "" },
			})
		})
	})
})
