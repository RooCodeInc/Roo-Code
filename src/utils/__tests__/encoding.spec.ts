import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as jschardet from "jschardet"
import * as iconv from "iconv-lite"
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

// Mock dependencies
vi.mock("jschardet", () => ({
	detect: vi.fn(),
}))

vi.mock("iconv-lite", () => ({
	encodingExists: vi.fn(),
	decode: vi.fn(),
	encode: vi.fn(),
}))

vi.mock("isbinaryfile", () => ({
	isBinaryFile: vi.fn(),
}))

vi.mock("fs/promises", () => ({
	default: {
		readFile: vi.fn(),
		writeFile: vi.fn(),
	},
}))

vi.mock("path", () => ({
	default: {
		extname: vi.fn(),
	},
}))

const mockJschardet = vi.mocked(jschardet)
const mockIconv = vi.mocked(iconv)
const mockIsBinaryFile = vi.mocked(isBinaryFile)
const mockFs = vi.mocked(fs)
const mockPath = vi.mocked(path)

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
		it("should throw error for binary files", async () => {
			const buffer = Buffer.from("binary content")
			mockIsBinaryFile.mockResolvedValue(true)

			await expect(detectEncoding(buffer, ".exe")).rejects.toThrow("Cannot read text for file type: .exe")
		})

		it("should call isBinaryFile with buffer and buffer length", async () => {
			const buffer = Buffer.from("test content for binary check")
			mockJschardet.detect.mockReturnValue({
				encoding: "",
				confidence: 0,
			}) // No encoding detected
			mockIsBinaryFile.mockResolvedValue(false)

			await detectEncoding(buffer, ".txt")

			expect(mockIsBinaryFile).toHaveBeenCalledWith(buffer, buffer.length)
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

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
			const result = await detectEncoding(buffer, ".txt")

			expect(result).toBe("utf8")
			expect(consoleSpy).toHaveBeenCalledWith("No encoding detected, falling back to utf8")
		})

		it("should handle very small file (1 byte)", async () => {
			const buffer = Buffer.from("a")
			mockIsBinaryFile.mockResolvedValue(false)
			mockJschardet.detect.mockReturnValue({
				encoding: "",
				confidence: 0,
			})

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
			const result = await detectEncoding(buffer, ".txt")

			expect(result).toBe("utf8")
			expect(consoleSpy).toHaveBeenCalledWith("No encoding detected, falling back to utf8")
		})

		it("should handle very small file (2 bytes)", async () => {
			const buffer = Buffer.from("ab")
			mockIsBinaryFile.mockResolvedValue(false)
			mockJschardet.detect.mockReturnValue({
				encoding: "utf8",
				confidence: 0.3,
			})

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
			const result = await detectEncoding(buffer, ".txt")

			expect(result).toBe("utf8")
			expect(consoleSpy).toHaveBeenCalledWith(
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

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
			const result = await detectEncoding(buffer, ".txt")

			expect(result).toBe("utf8")
			expect(consoleSpy).toHaveBeenCalledWith(
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

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
			const result = await detectEncoding(buffer, ".txt")

			expect(result).toBe("utf8")
			expect(consoleSpy).toHaveBeenCalledWith("No encoding detected, falling back to utf8")
		})

		it("should fallback to utf8 for unsupported encodings", async () => {
			const buffer = Buffer.from("unsupported encoding content")
			mockIsBinaryFile.mockResolvedValue(false)
			mockJschardet.detect.mockReturnValue({
				encoding: "unsupported-encoding",
				confidence: 0.9,
			})
			mockIconv.encodingExists.mockReturnValue(false)

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
			const result = await detectEncoding(buffer, ".txt")

			expect(result).toBe("utf8")
			expect(consoleSpy).toHaveBeenCalledWith(
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

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
			await detectEncoding(buffer, ".txt")

			expect(consoleSpy).toHaveBeenCalledWith(
				"Unsupported encoding detected: unsupported-encoding, falling back to utf8",
			)
		})

		it("should handle isBinaryFile error gracefully", async () => {
			const buffer = Buffer.from("content")
			mockIsBinaryFile.mockRejectedValue(new Error("Detection failed"))

			const result = await detectEncoding(buffer, ".txt")
			expect(result).toBe("utf8") // Should fallback to utf8
		})

		describe("BOM (Byte Order Mark) preservation", () => {
			it("should preserve UTF-8 BOM in encoding detection", async () => {
				// UTF-8 BOM: 0xEF 0xBB 0xBF
				const bomBytes = Buffer.from([0xef, 0xbb, 0xbf])
				const contentBytes = Buffer.from("Hello, world!", "utf8")
				const bufferWithBOM = Buffer.concat([bomBytes, contentBytes])

				mockIsBinaryFile.mockResolvedValue(false)
				mockJschardet.detect.mockReturnValue({
					encoding: "utf8",
					confidence: 0.9,
				})

				const result = await detectEncoding(bufferWithBOM, ".txt")

				expect(result).toBe("utf8")
				expect(mockJschardet.detect).toHaveBeenCalledWith(bufferWithBOM)
				// Verify the BOM is included in the buffer passed to jschardet
				expect(mockJschardet.detect.mock.calls[0][0]).toEqual(bufferWithBOM)
			})

			it("should handle UTF-8 BOM with low confidence detection", async () => {
				const bomBytes = Buffer.from([0xef, 0xbb, 0xbf])
				const contentBytes = Buffer.from("Hello", "utf8")
				const bufferWithBOM = Buffer.concat([bomBytes, contentBytes])

				mockIsBinaryFile.mockResolvedValue(false)
				mockJschardet.detect.mockReturnValue({
					encoding: "utf8",
					confidence: 0.5, // Low confidence
				})

				const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
				const result = await detectEncoding(bufferWithBOM, ".txt")

				expect(result).toBe("utf8")
				expect(consoleSpy).toHaveBeenCalledWith(
					"Low confidence encoding detection: utf8 (confidence: 0.5), falling back to utf8",
				)
			})

			it("should handle UTF-8 BOM with empty content", async () => {
				// Only BOM, no content
				const bomOnlyBuffer = Buffer.from([0xef, 0xbb, 0xbf])

				mockIsBinaryFile.mockResolvedValue(false)
				mockJschardet.detect.mockReturnValue({
					encoding: "utf8",
					confidence: 0.9,
				})

				const result = await detectEncoding(bomOnlyBuffer, ".txt")

				expect(result).toBe("utf8")
				expect(mockJschardet.detect).toHaveBeenCalledWith(bomOnlyBuffer)
			})

			it("should preserve UTF-16 LE BOM in encoding detection", async () => {
				// UTF-16 LE BOM: 0xFF 0xFE
				const bomBytes = Buffer.from([0xff, 0xfe])
				const contentBytes = Buffer.from("Hello", "utf16le")
				const bufferWithBOM = Buffer.concat([bomBytes, contentBytes])

				mockIsBinaryFile.mockResolvedValue(false)
				mockJschardet.detect.mockReturnValue({
					encoding: "utf-16le",
					confidence: 0.9,
				})
				mockIconv.encodingExists.mockReturnValue(true)

				const result = await detectEncoding(bufferWithBOM, ".txt")

				expect(result).toBe("utf-16le")
				expect(mockJschardet.detect).toHaveBeenCalledWith(bufferWithBOM)
				expect(mockJschardet.detect.mock.calls[0][0]).toEqual(bufferWithBOM)
			})

			it("should preserve UTF-16 BE BOM in encoding detection", async () => {
				// UTF-16 BE BOM: 0xFE 0xFF
				const bomBytes = Buffer.from([0xfe, 0xff])
				// Create UTF-16 BE content manually since Node.js doesn't have utf16be encoding
				const contentBytes = Buffer.from([0x00, 0x48, 0x00, 0x65, 0x00, 0x6c, 0x00, 0x6c, 0x00, 0x6f]) // "Hello" in UTF-16 BE
				const bufferWithBOM = Buffer.concat([bomBytes, contentBytes])

				mockIsBinaryFile.mockResolvedValue(false)
				mockJschardet.detect.mockReturnValue({
					encoding: "utf-16be",
					confidence: 0.9,
				})
				mockIconv.encodingExists.mockReturnValue(true)

				const result = await detectEncoding(bufferWithBOM, ".txt")

				expect(result).toBe("utf-16be")
				expect(mockJschardet.detect).toHaveBeenCalledWith(bufferWithBOM)
				expect(mockJschardet.detect.mock.calls[0][0]).toEqual(bufferWithBOM)
			})

			it("should handle UTF-16 LE BOM with unsupported encoding fallback", async () => {
				const bomBytes = Buffer.from([0xff, 0xfe])
				const contentBytes = Buffer.from("Hello", "utf16le")
				const bufferWithBOM = Buffer.concat([bomBytes, contentBytes])

				mockIsBinaryFile.mockResolvedValue(false)
				mockJschardet.detect.mockReturnValue({
					encoding: "utf-16le",
					confidence: 0.9,
				})
				mockIconv.encodingExists.mockReturnValue(false) // Simulate unsupported encoding

				const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
				const result = await detectEncoding(bufferWithBOM, ".txt")

				expect(result).toBe("utf8")
				expect(consoleSpy).toHaveBeenCalledWith("Unsupported encoding detected: utf-16le, falling back to utf8")
			})

			it("should handle UTF-16 BE BOM with low confidence", async () => {
				const bomBytes = Buffer.from([0xfe, 0xff])
				const contentBytes = Buffer.from([0x00, 0x48, 0x00, 0x65, 0x00, 0x6c, 0x00, 0x6c, 0x00, 0x6f]) // "Hello" in UTF-16 BE
				const bufferWithBOM = Buffer.concat([bomBytes, contentBytes])

				mockIsBinaryFile.mockResolvedValue(false)
				mockJschardet.detect.mockReturnValue({
					encoding: "utf-16be",
					confidence: 0.4, // Low confidence
				})

				const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
				const result = await detectEncoding(bufferWithBOM, ".txt")

				expect(result).toBe("utf8")
				expect(consoleSpy).toHaveBeenCalledWith(
					"Low confidence encoding detection: utf-16be (confidence: 0.4), falling back to utf8",
				)
			})
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

			await writeFileWithEncodingPreservation(filePath, content)

			expect(mockFs.writeFile).toHaveBeenCalledWith(filePath, content, "utf8")
		})

		it("should convert and write content for non-utf8 encoding", async () => {
			const filePath = "/path/to/file.txt"
			const content = "new content"
			mockIsBinaryFile.mockResolvedValue(false)
			mockJschardet.detect.mockReturnValue({
				encoding: "gbk",
				confidence: 0.9,
			})

			await writeFileWithEncodingPreservation(filePath, content)

			expect(mockIconv.encode).toHaveBeenCalledWith(content, "gbk")
			expect(mockFs.writeFile).toHaveBeenCalledWith(filePath, Buffer.from("encoded content"))
		})

		it("should handle new file (utf8) correctly", async () => {
			const filePath = "/path/to/newfile.txt"
			const content = "new content"
			mockFs.readFile.mockRejectedValue(new Error("File not found"))

			await writeFileWithEncodingPreservation(filePath, content)

			expect(mockFs.writeFile).toHaveBeenCalledWith(filePath, content, "utf8")
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
				confidence: 0.9,
			})

			const result = await isBinaryFileWithEncodingDetection(filePath)

			expect(result).toBe(false)
			expect(mockFs.readFile).toHaveBeenCalledWith(filePath)
		})

		it("should return true for files that fail encoding detection and are binary", async () => {
			const filePath = "/path/to/file.exe"
			const buffer = Buffer.from("binary content")
			mockFs.readFile.mockResolvedValue(buffer)
			mockPath.extname.mockReturnValue(".exe")
			mockJschardet.detect.mockReturnValue({
				encoding: "",
				confidence: 0,
			})
			mockIsBinaryFile.mockResolvedValue(true)

			const result = await isBinaryFileWithEncodingDetection(filePath)

			expect(result).toBe(true)
		})

		it("should return false for file read errors", async () => {
			const filePath = "/path/to/nonexistent.txt"
			mockFs.readFile.mockRejectedValue(new Error("File not found"))

			const result = await isBinaryFileWithEncodingDetection(filePath)

			expect(result).toBe(false)
		})

		it("should return false when encoding detection succeeds even with low confidence", async () => {
			const filePath = "/path/to/file.txt"
			const buffer = Buffer.from("text content")
			mockFs.readFile.mockResolvedValue(buffer)
			mockPath.extname.mockReturnValue(".txt")
			mockJschardet.detect.mockReturnValue({
				encoding: "utf8",
				confidence: 0.3,
			})

			const result = await isBinaryFileWithEncodingDetection(filePath)

			expect(result).toBe(false)
		})

		it("should call isBinaryFile with buffer and buffer length when encoding detection fails", async () => {
			const filePath = "/path/to/file.bin"
			const buffer = Buffer.from("binary content for length test")
			mockFs.readFile.mockResolvedValue(buffer)
			mockPath.extname.mockReturnValue(".bin")
			mockJschardet.detect.mockReturnValue({
				encoding: "",
				confidence: 0,
			})
			mockIsBinaryFile.mockResolvedValue(true)

			await isBinaryFileWithEncodingDetection(filePath)

			expect(mockIsBinaryFile).toHaveBeenCalledWith(buffer, buffer.length)
		})
	})
})
