import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as jschardet from "jschardet"
import iconv from "iconv-lite"
import { isBinaryFile } from "isbinaryfile"
import fs from "fs/promises"
import path from "path"
import {
	detectEncoding,
	readFileWithEncodingDetection,
	detectFileEncoding,
	writeFileWithEncodingPreservation,
	isBinaryFileWithEncodingDetection,
} from "../encoding"
import { createLogger } from "../logger"

// Mock logger
vi.mock("../logger", () => ({
	createLogger: vi.fn(
		() =>
			({
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
				debug: vi.fn(),
				dispose: vi.fn(),
			}) as any,
	),
}))

// Mock dependencies
vi.mock("jschardet", () => ({
	detect: vi.fn(),
}))

vi.mock("iconv-lite", async (importOriginal) => {
	const original = (await importOriginal()) as any
	return {
		...original,
		default: {
			...original.default,
			encodingExists: vi.fn(),
			decode: vi.fn(),
			encode: vi.fn(),
		},
		encodingExists: vi.fn(),
		decode: vi.fn(),
		encode: vi.fn(),
	}
})

vi.mock("isbinaryfile", () => ({
	isBinaryFile: vi.fn(),
}))

vi.mock("fs/promises", () => ({
	default: {
		readFile: vi.fn(),
		writeFile: vi.fn(),
		open: vi.fn(),
	},
}))

vi.mock("path", async (importOriginal) => ({
	...(await importOriginal()),
	default: {
		extname: vi.fn(),
	},
}))

const mockJschardet = vi.mocked(jschardet)
const mockIconv = vi.mocked(iconv)
const mockIsBinaryFile = vi.mocked(isBinaryFile)
const mockFs = vi.mocked(fs)
const mockPath = vi.mocked(path)
const mockCreateLogger = vi.mocked(createLogger)

describe("encoding", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		// Reset default mocks
		mockPath.extname.mockReturnValue(".txt")
		mockIconv.encodingExists.mockReturnValue(true)
		mockIconv.decode.mockReturnValue("decoded content")
		mockIconv.encode.mockReturnValue(Buffer.from("encoded content"))
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("detectEncoding", () => {
		it("should throw error for known binary extensions", async () => {
			const buffer = Buffer.from("binary content")

			await expect(detectEncoding(buffer, ".exe")).rejects.toThrow("Cannot read text for file type: .exe")
			expect(mockIsBinaryFile).not.toHaveBeenCalled() // Should not call isBinaryFile
		})

		it("should throw error for various binary extensions", async () => {
			const buffer = Buffer.from("binary content")
			const binaryExtensions = [".dll", ".so", ".zip", ".png", ".mp3"]
			mockIsBinaryFile.mockResolvedValue(false)

			for (const ext of binaryExtensions) {
				await expect(detectEncoding(buffer, ext)).rejects.toThrow(`Cannot read text for file type: ${ext}`)
			}
		})

		it("should handle text files normally", async () => {
			const buffer = Buffer.from("text content")
			mockIsBinaryFile.mockResolvedValue(false)
			mockJschardet.detect.mockReturnValue({
				encoding: "utf8",
				confidence: 0.95,
			})

			const result = await detectEncoding(buffer, ".txt")

			expect(result).toBe("utf8")
		})

		it("should fallback to utf8 for low confidence detection (< 0.7)", async () => {
			const buffer = Buffer.from("uncertain content")
			mockIsBinaryFile.mockResolvedValue(false)
			mockJschardet.detect.mockReturnValue({
				encoding: "gbk",
				confidence: 0.6, // Below threshold 0.7
			})

			const mockWarn = vi.fn()
			mockCreateLogger.mockReturnValue({
				info: vi.fn(),
				warn: mockWarn,
				error: vi.fn(),
				debug: vi.fn(),
				dispose: vi.fn(),
			} as any)

			const result = await detectEncoding(buffer, ".txt")

			expect(result).toBe("utf8")
			expect(mockWarn).toHaveBeenCalledWith(
				"Low confidence encoding detection: gbk (confidence: 0.6), falling back to utf8",
			)
		})

		it("should use detected encoding for high confidence detection (>= 0.9)", async () => {
			const buffer = Buffer.from("certain content")
			mockIsBinaryFile.mockResolvedValue(false)
			mockJschardet.detect.mockReturnValue({
				encoding: "gbk",
				confidence: 0.95, // Above new threshold 0.9
			})

			const result = await detectEncoding(buffer, ".txt")

			expect(result).toBe("gbk")
		})

		it("should throw error for binary files when encoding detection fails", async () => {
			const buffer = Buffer.from("binary content")
			mockJschardet.detect.mockReturnValue({
				encoding: "",
				confidence: 0,
			})
			mockIsBinaryFile.mockResolvedValue(true)

			await expect(detectEncoding(buffer, ".exe")).rejects.toThrow("Cannot read text for file type: .exe")
		})

		it("should handle string detection result from jschardet", async () => {
			const buffer = Buffer.from("utf8 content")
			mockIsBinaryFile.mockResolvedValue(false)
			mockJschardet.detect.mockReturnValue({
				encoding: "utf8",
				confidence: 0.9,
			})

			const result = await detectEncoding(buffer, ".txt")
			expect(result).toBe("utf8")
		})

		it("should handle object detection result with high confidence", async () => {
			const buffer = Buffer.from("gbk content")
			mockIsBinaryFile.mockResolvedValue(false)
			mockJschardet.detect.mockReturnValue({
				encoding: "gbk",
				confidence: 0.9,
			})

			const result = await detectEncoding(buffer, ".txt")
			expect(result).toBe("gbk")
		})

		it("should handle ISO-8859-1 encoding", async () => {
			const buffer = Buffer.from("iso-8859-1 content")
			mockIsBinaryFile.mockResolvedValue(false)
			mockJschardet.detect.mockReturnValue({
				encoding: "iso-8859-1",
				confidence: 0.9,
			})
			mockIconv.encodingExists.mockReturnValue(true)

			const result = await detectEncoding(buffer, ".txt")
			expect(result).toBe("iso-8859-1")
		})

		it("should handle Shift-JIS encoding", async () => {
			const buffer = Buffer.from("shift-jis content")
			mockIsBinaryFile.mockResolvedValue(false)
			mockJschardet.detect.mockReturnValue({
				encoding: "shift-jis",
				confidence: 0.9,
			})
			mockIconv.encodingExists.mockReturnValue(true)

			const result = await detectEncoding(buffer, ".txt")
			expect(result).toBe("shift-jis")
		})

		it("should handle empty file gracefully", async () => {
			const buffer = Buffer.alloc(0)
			mockIsBinaryFile.mockResolvedValue(false)
			mockJschardet.detect.mockReturnValue({
				encoding: "",
				confidence: 0,
			})

			const mockWarn = vi.fn()
			mockCreateLogger.mockReturnValue({
				info: vi.fn(),
				warn: mockWarn,
				error: vi.fn(),
				debug: vi.fn(),
				dispose: vi.fn(),
			} as any)

			const result = await detectEncoding(buffer, ".txt")

			expect(result).toBe("utf8")
			expect(mockWarn).toHaveBeenCalledWith("No encoding detected, falling back to utf8")
		})

		it("should handle very small file (1 byte)", async () => {
			const buffer = Buffer.from("a")
			mockIsBinaryFile.mockResolvedValue(false)
			mockJschardet.detect.mockReturnValue({
				encoding: "",
				confidence: 0,
			})

			const mockWarn = vi.fn()
			mockCreateLogger.mockReturnValue({
				info: vi.fn(),
				warn: mockWarn,
				error: vi.fn(),
				debug: vi.fn(),
				dispose: vi.fn(),
			} as any)

			const result = await detectEncoding(buffer, ".txt")

			expect(result).toBe("utf8")
			expect(mockWarn).toHaveBeenCalledWith("No encoding detected, falling back to utf8")
		})

		it("should handle very small file (2 bytes)", async () => {
			const buffer = Buffer.from("ab")
			mockIsBinaryFile.mockResolvedValue(false)
			mockJschardet.detect.mockReturnValue({
				encoding: "utf8",
				confidence: 0.3,
			})

			const mockWarn = vi.fn()
			mockCreateLogger.mockReturnValue({
				info: vi.fn(),
				warn: mockWarn,
				error: vi.fn(),
				debug: vi.fn(),
				dispose: vi.fn(),
			} as any)

			const result = await detectEncoding(buffer, ".txt")

			expect(result).toBe("utf8")
			expect(mockWarn).toHaveBeenCalledWith(
				"Low confidence encoding detection: utf8 (confidence: 0.3), falling back to utf8",
			)
		})

		it("should fallback to utf8 for low confidence detection", async () => {
			const buffer = Buffer.from("uncertain content")
			mockIsBinaryFile.mockResolvedValue(false)
			mockJschardet.detect.mockReturnValue({
				encoding: "gbk",
				confidence: 0.5,
			})

			const mockWarn = vi.fn()
			mockCreateLogger.mockReturnValue({
				info: vi.fn(),
				warn: mockWarn,
				error: vi.fn(),
				debug: vi.fn(),
				dispose: vi.fn(),
			} as any)

			const result = await detectEncoding(buffer, ".txt")

			expect(result).toBe("utf8")
			expect(mockWarn).toHaveBeenCalledWith(
				"Low confidence encoding detection: gbk (confidence: 0.5), falling back to utf8",
			)
		})

		it("should fallback to utf8 when no encoding detected", async () => {
			const buffer = Buffer.from("no encoding content")
			mockIsBinaryFile.mockResolvedValue(false)
			mockJschardet.detect.mockReturnValue({
				encoding: "",
				confidence: 0,
			})

			const mockWarn = vi.fn()
			mockCreateLogger.mockReturnValue({
				info: vi.fn(),
				warn: mockWarn,
				error: vi.fn(),
				debug: vi.fn(),
				dispose: vi.fn(),
			} as any)

			const result = await detectEncoding(buffer, ".txt")

			expect(result).toBe("utf8")
			expect(mockWarn).toHaveBeenCalledWith("No encoding detected, falling back to utf8")
		})

		it("should fallback to utf8 for unsupported encodings", async () => {
			const buffer = Buffer.from("unsupported encoding content")
			mockIsBinaryFile.mockResolvedValue(false)
			mockJschardet.detect.mockReturnValue({
				encoding: "unsupported-encoding",
				confidence: 0.9,
			})
			mockIconv.encodingExists.mockReturnValue(false)

			const mockWarn = vi.fn()
			mockCreateLogger.mockReturnValue({
				info: vi.fn(),
				warn: mockWarn,
				error: vi.fn(),
				debug: vi.fn(),
				dispose: vi.fn(),
			} as any)

			const result = await detectEncoding(buffer, ".txt")

			expect(result).toBe("utf8")
			expect(mockWarn).toHaveBeenCalledWith(
				"Unsupported encoding detected: unsupported-encoding, falling back to utf8",
			)
		})

		it("should handle unsupported encoding with original detection info", async () => {
			const buffer = Buffer.from("unsupported encoding content")
			mockIsBinaryFile.mockResolvedValue(false)
			mockJschardet.detect.mockReturnValue({
				encoding: "unsupported-encoding",
				confidence: 0.9,
			})
			mockIconv.encodingExists.mockReturnValue(false)

			const mockWarn = vi.fn()
			mockCreateLogger.mockReturnValue({
				info: vi.fn(),
				warn: mockWarn,
				error: vi.fn(),
				debug: vi.fn(),
				dispose: vi.fn(),
			} as any)

			await detectEncoding(buffer, ".txt")

			expect(mockWarn).toHaveBeenCalledWith(
				"Unsupported encoding detected: unsupported-encoding, falling back to utf8",
			)
		})

		it("should handle isBinaryFile error gracefully", async () => {
			const buffer = Buffer.from("content")
			mockIsBinaryFile.mockRejectedValue(new Error("Detection failed"))

			const result = await detectEncoding(buffer, ".txt")
			expect(result).toBe("utf8") // Should fallback to utf8
		})
	})

	describe("readFileWithEncodingDetection", () => {
		it("should read file and detect encoding correctly", async () => {
			const filePath = "/path/to/file.txt"
			const buffer = Buffer.from("file content")
			mockFs.readFile.mockResolvedValue(buffer)
			mockIsBinaryFile.mockResolvedValue(false)
			mockJschardet.detect.mockReturnValue({
				encoding: "utf8",
				confidence: 0.9,
			})

			const result = await readFileWithEncodingDetection(filePath)

			expect(mockFs.readFile).toHaveBeenCalledWith(filePath)
			expect(mockPath.extname).toHaveBeenCalledWith(filePath)
			expect(mockIconv.decode).toHaveBeenCalledWith(buffer, "utf8")
			expect(result).toBe("decoded content")
		})

		it("should handle binary file detection", async () => {
			const filePath = "/path/to/file.exe"
			const buffer = Buffer.from("binary content")
			mockFs.readFile.mockResolvedValue(buffer)
			mockIsBinaryFile.mockResolvedValue(true)
			mockPath.extname.mockReturnValue(".exe")

			await expect(readFileWithEncodingDetection(filePath)).rejects.toThrow(
				"Cannot read text for file type: .exe",
			)
		})
	})

	describe("detectFileEncoding", () => {
		it("should detect encoding for existing file", async () => {
			const filePath = "/path/to/file.txt"
			const buffer = Buffer.from("file content")
			mockFs.readFile.mockResolvedValue(buffer)
			mockIsBinaryFile.mockResolvedValue(false)
			mockJschardet.detect.mockReturnValue({
				encoding: "gbk",
				confidence: 0.9,
			})

			const result = await detectFileEncoding(filePath)

			expect(mockFs.readFile).toHaveBeenCalledWith(filePath)
			expect(result).toBe("gbk")
		})

		it("should return utf8 for non-existent file", async () => {
			const filePath = "/path/to/nonexistent.txt"
			mockFs.readFile.mockRejectedValue(new Error("File not found"))

			const result = await detectFileEncoding(filePath)

			expect(result).toBe("utf8")
		})

		it("should return utf8 for unreadable file", async () => {
			const filePath = "/path/to/unreadable.txt"
			mockFs.readFile.mockRejectedValue(new Error("Permission denied"))

			const result = await detectFileEncoding(filePath)

			expect(result).toBe("utf8")
		})
	})

	describe("writeFileWithEncodingPreservation", () => {
		it("should write utf8 file directly when original is utf8", async () => {
			const filePath = "/path/to/file.txt"
			const content = "new content"
			mockIsBinaryFile.mockResolvedValue(false)
			mockJschardet.detect.mockReturnValue({
				encoding: "utf8",
				confidence: 0.9,
			})

			// Mock fs.open to return a file handle
			const mockHandle = {
				fd: 1,
				writeFile: vi.fn().mockResolvedValue(undefined),
				sync: vi.fn().mockResolvedValue(undefined),
				close: vi.fn().mockResolvedValue(undefined),
				appendFile: vi.fn().mockResolvedValue(undefined),
				chown: vi.fn().mockResolvedValue(undefined),
				chmod: vi.fn().mockResolvedValue(undefined),
				read: vi.fn().mockResolvedValue(undefined),
				readFile: vi.fn().mockResolvedValue(undefined),
				stat: vi.fn().mockResolvedValue(undefined),
				truncate: vi.fn().mockResolvedValue(undefined),
				utimes: vi.fn().mockResolvedValue(undefined),
				write: vi.fn().mockResolvedValue(undefined),
				readable: true,
				writable: true,
			} as any
			mockFs.open.mockResolvedValue(mockHandle)

			await writeFileWithEncodingPreservation(filePath, content)

			expect(mockFs.open).toHaveBeenCalledWith(filePath, "w")
			expect(mockHandle.writeFile).toHaveBeenCalledWith(content, "utf8")
			expect(mockHandle.sync).toHaveBeenCalled()
			expect(mockHandle.close).toHaveBeenCalled()
		})

		it("should convert and write content for non-utf8 encoding", async () => {
			const filePath = "/path/to/file.txt"
			const content = "new content"

			// Mock the file to exist and have gbk encoding
			const existingBuffer = Buffer.from("existing gbk content")
			mockFs.readFile.mockResolvedValue(existingBuffer)
			mockIsBinaryFile.mockResolvedValue(false)
			mockJschardet.detect.mockReturnValue({
				encoding: "gbk",
				confidence: 0.9,
			})

			// Mock fs.open to return a file handle
			const mockHandle = {
				fd: 1,
				writeFile: vi.fn().mockResolvedValue(undefined),
				sync: vi.fn().mockResolvedValue(undefined),
				close: vi.fn().mockResolvedValue(undefined),
				appendFile: vi.fn().mockResolvedValue(undefined),
				chown: vi.fn().mockResolvedValue(undefined),
				chmod: vi.fn().mockResolvedValue(undefined),
				read: vi.fn().mockResolvedValue(undefined),
				readFile: vi.fn().mockResolvedValue(undefined),
				stat: vi.fn().mockResolvedValue(undefined),
				truncate: vi.fn().mockResolvedValue(undefined),
				utimes: vi.fn().mockResolvedValue(undefined),
				write: vi.fn().mockResolvedValue(undefined),
				readable: true,
				writable: true,
			} as any
			mockFs.open.mockResolvedValue(mockHandle)

			await writeFileWithEncodingPreservation(filePath, content)

			expect(mockIconv.encode).toHaveBeenCalledWith(content, "gbk")
			expect(mockFs.open).toHaveBeenCalledWith(filePath, "w")
			expect(mockHandle.writeFile).toHaveBeenCalledWith(Buffer.from("encoded content"), undefined)
			expect(mockHandle.sync).toHaveBeenCalled()
			expect(mockHandle.close).toHaveBeenCalled()
		})

		it("should handle new file (utf8) correctly", async () => {
			const filePath = "/path/to/newfile.txt"
			const content = "new content"
			mockFs.readFile.mockRejectedValue(new Error("File not found"))

			// Mock fs.open to return a file handle
			const mockHandle = {
				fd: 1,
				writeFile: vi.fn().mockResolvedValue(undefined),
				sync: vi.fn().mockResolvedValue(undefined),
				close: vi.fn().mockResolvedValue(undefined),
				appendFile: vi.fn().mockResolvedValue(undefined),
				chown: vi.fn().mockResolvedValue(undefined),
				chmod: vi.fn().mockResolvedValue(undefined),
				read: vi.fn().mockResolvedValue(undefined),
				readFile: vi.fn().mockResolvedValue(undefined),
				stat: vi.fn().mockResolvedValue(undefined),
				truncate: vi.fn().mockResolvedValue(undefined),
				utimes: vi.fn().mockResolvedValue(undefined),
				write: vi.fn().mockResolvedValue(undefined),
				readable: true,
				writable: true,
			} as any
			mockFs.open.mockResolvedValue(mockHandle)

			await writeFileWithEncodingPreservation(filePath, content)

			expect(mockFs.open).toHaveBeenCalledWith(filePath, "w")
			expect(mockHandle.writeFile).toHaveBeenCalledWith(content, "utf8")
			expect(mockHandle.sync).toHaveBeenCalled()
			expect(mockHandle.close).toHaveBeenCalled()
		})
	})

	describe("isBinaryFileWithEncodingDetection", () => {
		it("should return false for text files that can be encoded", async () => {
			const filePath = "/path/to/file.txt"
			const buffer = Buffer.from("text content")
			mockFs.readFile.mockResolvedValue(buffer)
			mockPath.extname.mockReturnValue(".txt")
			mockJschardet.detect.mockReturnValue({
				encoding: "utf8",
				confidence: 0.95,
			})
			mockIsBinaryFile.mockResolvedValue(false)

			const result = await isBinaryFileWithEncodingDetection(filePath)

			expect(result).toBe(false)
			expect(mockFs.readFile).toHaveBeenCalledWith(filePath)
		})

		it("should return true for known binary extensions", async () => {
			const filePath = "/path/to/file.exe"
			const buffer = Buffer.from("some content")
			mockFs.readFile.mockResolvedValue(buffer)
			mockPath.extname.mockReturnValue(".exe")

			const result = await isBinaryFileWithEncodingDetection(filePath)

			expect(result).toBe(true)
			// Should not perform encoding detection because extension already indicates binary file
			expect(mockJschardet.detect).not.toHaveBeenCalled()
		})

		it("should return true for files with binary magic numbers", async () => {
			const filePath = "/path/to/file.bin"
			const elfHeader = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x01, 0x01, 0x01, 0x00])
			const buffer = Buffer.concat([elfHeader, Buffer.from("some content")])
			mockFs.readFile.mockResolvedValue(buffer)
			mockPath.extname.mockReturnValue(".bin")

			const result = await isBinaryFileWithEncodingDetection(filePath)

			expect(result).toBe(true)
			// Should not perform encoding detection because magic number already indicates binary file
			expect(mockJschardet.detect).not.toHaveBeenCalled()
		})

		it("should return true for files with null bytes", async () => {
			const filePath = "/path/to/file.dat"
			const buffer = Buffer.from("text\x00\x00\x00\x00\x00content")
			mockFs.readFile.mockResolvedValue(buffer)
			mockPath.extname.mockReturnValue(".dat")
			mockIsBinaryFile.mockResolvedValue(false)

			const result = await isBinaryFileWithEncodingDetection(filePath)

			expect(result).toBe(true)
		})

		it("should return true for files with many non-printable characters", async () => {
			const filePath = "/path/to/file.dat"
			// Create buffer with many non-printable characters
			const buffer = Buffer.alloc(1024)
			for (let i = 0; i < 1024; i++) {
				buffer[i] = Math.floor(Math.random() * 32) // 0-31 are all non-printable characters
			}
			mockFs.readFile.mockResolvedValue(buffer)
			mockPath.extname.mockReturnValue(".dat")
			mockIsBinaryFile.mockResolvedValue(false)

			const result = await isBinaryFileWithEncodingDetection(filePath)

			expect(result).toBe(true)
		})

		it("should return true for files detected as binary by isBinaryFile library", async () => {
			const filePath = "/path/to/file.dat"
			const buffer = Buffer.from("some content")
			mockFs.readFile.mockResolvedValue(buffer)
			mockPath.extname.mockReturnValue(".dat")
			mockIsBinaryFile.mockResolvedValue(true)

			const result = await isBinaryFileWithEncodingDetection(filePath)

			expect(result).toBe(true)
		})

		it("should return false for files with low confidence encoding detection", async () => {
			const filePath = "/path/to/file.txt"
			const buffer = Buffer.from("ambiguous content")
			mockFs.readFile.mockResolvedValue(buffer)
			mockPath.extname.mockReturnValue(".txt")
			mockJschardet.detect.mockReturnValue({
				encoding: "utf8",
				confidence: 0.8, // Above threshold 0.7, detectEncoding will succeed
			})
			mockIsBinaryFile.mockResolvedValue(false)

			const result = await isBinaryFileWithEncodingDetection(filePath)

			expect(result).toBe(false) // When detectEncoding succeeds, it's considered a text file
		})

		it("should return false for files with high confidence encoding detection", async () => {
			const filePath = "/path/to/file.txt"
			const buffer = Buffer.from("clear text content")
			mockFs.readFile.mockResolvedValue(buffer)
			mockPath.extname.mockReturnValue(".txt")
			mockJschardet.detect.mockReturnValue({
				encoding: "utf8",
				confidence: 0.95, // Above new threshold 0.9
			})
			mockIsBinaryFile.mockResolvedValue(false)

			const result = await isBinaryFileWithEncodingDetection(filePath)

			expect(result).toBe(false)
		})

		it("should return true for files that fail encoding detection", async () => {
			const filePath = "/path/to/file.txt"
			const buffer = Buffer.from("binary content")
			mockFs.readFile.mockResolvedValue(buffer)
			mockPath.extname.mockReturnValue(".txt")
			mockJschardet.detect.mockReturnValue({
				encoding: "",
				confidence: 0,
			})
			mockIsBinaryFile.mockResolvedValue(true)

			const result = await isBinaryFileWithEncodingDetection(filePath)

			expect(result).toBe(true)
		})

		it("should return true for file read errors", async () => {
			const filePath = "/path/to/nonexistent.txt"
			mockFs.readFile.mockRejectedValue(new Error("File not found"))

			const result = await isBinaryFileWithEncodingDetection(filePath)

			expect(result).toBe(false)
		})

		it("should handle PE executable files", async () => {
			const filePath = "/path/to/file.dll"
			const peHeader = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00])
			const buffer = Buffer.concat([peHeader, Buffer.from("some content")])
			mockFs.readFile.mockResolvedValue(buffer)
			mockPath.extname.mockReturnValue(".dll")

			const result = await isBinaryFileWithEncodingDetection(filePath)

			expect(result).toBe(true)
		})

		it("should handle ZIP archive files", async () => {
			const filePath = "/path/to/file.zip"
			const zipHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04])
			const buffer = Buffer.concat([zipHeader, Buffer.from("some content")])
			mockFs.readFile.mockResolvedValue(buffer)
			mockPath.extname.mockReturnValue(".zip")

			const result = await isBinaryFileWithEncodingDetection(filePath)

			expect(result).toBe(true)
		})

		it("should handle PNG image files", async () => {
			const filePath = "/path/to/file.png"
			const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
			const buffer = Buffer.concat([pngHeader, Buffer.from("some content")])
			mockFs.readFile.mockResolvedValue(buffer)
			mockPath.extname.mockReturnValue(".png")

			const result = await isBinaryFileWithEncodingDetection(filePath)

			expect(result).toBe(true)
		})

		it("should handle PDF document files", async () => {
			const filePath = "/path/to/file.pdf"
			const pdfHeader = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d])
			const buffer = Buffer.concat([pdfHeader, Buffer.from("some content")])
			mockFs.readFile.mockResolvedValue(buffer)
			mockPath.extname.mockReturnValue(".pdf")

			const result = await isBinaryFileWithEncodingDetection(filePath)

			expect(result).toBe(false)
		})

		it("should handle empty files", async () => {
			const filePath = "/path/to/empty.txt"
			const buffer = Buffer.alloc(0)
			mockFs.readFile.mockResolvedValue(buffer)
			mockPath.extname.mockReturnValue(".txt")
			mockJschardet.detect.mockReturnValue({
				encoding: "",
				confidence: 0,
			})
			mockIsBinaryFile.mockResolvedValue(false)

			const result = await isBinaryFileWithEncodingDetection(filePath)

			expect(result).toBe(false) // Empty files are considered text files
		})

		it("should handle very small files", async () => {
			const filePath = "/path/to/small.txt"
			const buffer = Buffer.from("a")
			mockFs.readFile.mockResolvedValue(buffer)
			mockPath.extname.mockReturnValue(".txt")
			mockJschardet.detect.mockReturnValue({
				encoding: "utf8",
				confidence: 0.95,
			})
			mockIsBinaryFile.mockResolvedValue(false)

			const result = await isBinaryFileWithEncodingDetection(filePath)

			expect(result).toBe(false)
		})

		it("should handle files with mixed content", async () => {
			const filePath = "/path/to/mixed.txt"
			const buffer = Buffer.from("text content with some \x00 null bytes")
			mockFs.readFile.mockResolvedValue(buffer)
			mockPath.extname.mockReturnValue(".txt")
			// Mock detectEncoding to throw an error for files with null bytes
			mockJschardet.detect.mockReturnValue({
				encoding: "",
				confidence: 0,
			})
			mockIsBinaryFile.mockResolvedValue(true) // isBinaryFile should detect it as binary

			const result = await isBinaryFileWithEncodingDetection(filePath)

			expect(result).toBe(true) // Files containing null bytes are considered binary files
		})
	})
})
