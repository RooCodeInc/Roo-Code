import * as vscode from "vscode"
import * as fs from "fs/promises"
import * as iconv from "iconv-lite"
import {
	getFileEncoding,
	normalizeEncoding,
	isEncodingSupported,
	readFileWithEncoding,
	writeFileWithEncoding,
} from "../fileEncoding"

// Mock vscode module
vi.mock("vscode", () => ({
	workspace: {
		getConfiguration: vi.fn(),
	},
	Uri: {
		file: vi.fn((path: string) => ({ fsPath: path })),
	},
}))

// Mock fs/promises module
vi.mock("fs/promises", () => ({
	default: {
		readFile: vi.fn(),
		writeFile: vi.fn(),
	},
	readFile: vi.fn(),
	writeFile: vi.fn(),
}))

// Mock iconv-lite module
vi.mock("iconv-lite", () => ({
	default: {
		encodingExists: vi.fn(),
		decode: vi.fn(),
		encode: vi.fn(),
	},
	encodingExists: vi.fn(),
	decode: vi.fn(),
	encode: vi.fn(),
}))

describe("fileEncoding", () => {
	const mockedVscode = vi.mocked(vscode)
	const mockedFs = vi.mocked(fs)
	const mockedIconv = vi.mocked(iconv)

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("getFileEncoding", () => {
		it("should return the configured encoding from VSCode settings", () => {
			const mockConfig = {
				get: vi.fn().mockReturnValue("cp852"),
			}
			mockedVscode.workspace.getConfiguration = vi.fn().mockReturnValue(mockConfig)

			const encoding = getFileEncoding("/path/to/file.txt")

			expect(mockedVscode.Uri.file).toHaveBeenCalledWith("/path/to/file.txt")
			expect(mockedVscode.workspace.getConfiguration).toHaveBeenCalledWith("files", {
				fsPath: "/path/to/file.txt",
			})
			expect(mockConfig.get).toHaveBeenCalledWith("encoding", "utf8")
			expect(encoding).toBe("cp852")
		})

		it("should return utf8 as default if no encoding is configured", () => {
			const mockConfig = {
				get: vi.fn().mockReturnValue("utf8"),
			}
			mockedVscode.workspace.getConfiguration = vi.fn().mockReturnValue(mockConfig)

			const encoding = getFileEncoding("/path/to/file.txt")

			expect(encoding).toBe("utf8")
		})
	})

	describe("normalizeEncoding", () => {
		it("should normalize utf-8 to utf8", () => {
			expect(normalizeEncoding("utf-8")).toBe("utf8")
			expect(normalizeEncoding("UTF-8")).toBe("utf8")
		})

		it("should normalize windows code pages", () => {
			expect(normalizeEncoding("windows1252")).toBe("windows1252")
			expect(normalizeEncoding("windows-1252")).toBe("windows1252")
		})

		it("should normalize DOS code pages", () => {
			expect(normalizeEncoding("cp852")).toBe("cp852")
			expect(normalizeEncoding("CP852")).toBe("cp852")
		})

		it("should normalize ISO encodings", () => {
			expect(normalizeEncoding("iso88591")).toBe("iso88591")
			expect(normalizeEncoding("iso-8859-1")).toBe("iso88591")
		})

		it("should return the original encoding if not in the map", () => {
			expect(normalizeEncoding("unknown-encoding")).toBe("unknown-encoding")
		})
	})

	describe("isEncodingSupported", () => {
		it("should return true for supported encodings", () => {
			mockedIconv.encodingExists = vi.fn().mockReturnValue(true)

			expect(isEncodingSupported("utf8")).toBe(true)
			expect(mockedIconv.encodingExists).toHaveBeenCalledWith("utf8")
		})

		it("should return false for unsupported encodings", () => {
			mockedIconv.encodingExists = vi.fn().mockReturnValue(false)

			expect(isEncodingSupported("unknown")).toBe(false)
			expect(mockedIconv.encodingExists).toHaveBeenCalledWith("unknown")
		})
	})

	describe("readFileWithEncoding", () => {
		beforeEach(() => {
			const mockConfig = {
				get: vi.fn().mockReturnValue("utf8"),
			}
			mockedVscode.workspace.getConfiguration = vi.fn().mockReturnValue(mockConfig)
		})

		it("should read file with UTF-8 encoding directly", async () => {
			const mockBuffer = Buffer.from("Hello World", "utf8")
			mockedFs.readFile = vi.fn().mockResolvedValue(mockBuffer)

			const result = await readFileWithEncoding("/path/to/file.txt")

			expect(result.content).toBe("Hello World")
			expect(result.encoding).toBe("utf8")
			expect(result.usedFallback).toBe(false)
		})

		it("should read file with CP852 encoding", async () => {
			const mockConfig = {
				get: vi.fn().mockReturnValue("cp852"),
			}
			mockedVscode.workspace.getConfiguration = vi.fn().mockReturnValue(mockConfig)

			const mockBuffer = Buffer.from([0x8d, 0x8f, 0xa7]) // Some CP852 bytes
			mockedFs.readFile = vi.fn().mockResolvedValue(mockBuffer)
			mockedIconv.encodingExists = vi.fn().mockReturnValue(true)
			mockedIconv.decode = vi.fn().mockReturnValue("čćž")

			const result = await readFileWithEncoding("/path/to/file.txt")

			expect(mockedIconv.decode).toHaveBeenCalledWith(mockBuffer, "cp852")
			expect(result.content).toBe("čćž")
			expect(result.encoding).toBe("cp852")
			expect(result.usedFallback).toBe(false)
		})

		it("should fall back to UTF-8 if encoding is not supported", async () => {
			const mockConfig = {
				get: vi.fn().mockReturnValue("unsupported-encoding"),
			}
			mockedVscode.workspace.getConfiguration = vi.fn().mockReturnValue(mockConfig)

			const mockBuffer = Buffer.from("Hello World", "utf8")
			mockedFs.readFile = vi.fn().mockResolvedValue(mockBuffer)
			mockedIconv.encodingExists = vi.fn().mockReturnValue(false)

			const result = await readFileWithEncoding("/path/to/file.txt")

			expect(result.content).toBe("Hello World")
			expect(result.encoding).toBe("unsupported-encoding")
			expect(result.usedFallback).toBe(true)
		})

		it("should fall back to UTF-8 if decoding fails", async () => {
			const mockConfig = {
				get: vi.fn().mockReturnValue("cp852"),
			}
			mockedVscode.workspace.getConfiguration = vi.fn().mockReturnValue(mockConfig)

			const mockBuffer = Buffer.from("Hello World", "utf8")
			mockedFs.readFile = vi.fn().mockResolvedValue(mockBuffer)
			mockedIconv.encodingExists = vi.fn().mockReturnValue(true)
			mockedIconv.decode = vi.fn().mockImplementation(() => {
				throw new Error("Decoding failed")
			})

			const result = await readFileWithEncoding("/path/to/file.txt")

			expect(result.content).toBe("Hello World")
			expect(result.encoding).toBe("cp852")
			expect(result.usedFallback).toBe(true)
		})
	})

	describe("writeFileWithEncoding", () => {
		beforeEach(() => {
			const mockConfig = {
				get: vi.fn().mockReturnValue("utf8"),
			}
			mockedVscode.workspace.getConfiguration = vi.fn().mockReturnValue(mockConfig)
		})

		it("should write file with UTF-8 encoding directly", async () => {
			mockedFs.writeFile = vi.fn().mockResolvedValue(undefined)

			const result = await writeFileWithEncoding("/path/to/file.txt", "Hello World")

			expect(mockedFs.writeFile).toHaveBeenCalledWith("/path/to/file.txt", "Hello World", "utf8")
			expect(result.encoding).toBe("utf8")
			expect(result.usedFallback).toBe(false)
		})

		it("should write file with CP852 encoding", async () => {
			const mockConfig = {
				get: vi.fn().mockReturnValue("cp852"),
			}
			mockedVscode.workspace.getConfiguration = vi.fn().mockReturnValue(mockConfig)

			const mockBuffer = Buffer.from([0x8d, 0x8f, 0xa7])
			mockedIconv.encodingExists = vi.fn().mockReturnValue(true)
			mockedIconv.encode = vi.fn().mockReturnValue(mockBuffer)
			mockedFs.writeFile = vi.fn().mockResolvedValue(undefined)

			const result = await writeFileWithEncoding("/path/to/file.txt", "čćž")

			expect(mockedIconv.encode).toHaveBeenCalledWith("čćž", "cp852")
			expect(mockedFs.writeFile).toHaveBeenCalledWith("/path/to/file.txt", mockBuffer)
			expect(result.encoding).toBe("cp852")
			expect(result.usedFallback).toBe(false)
		})

		it("should fall back to UTF-8 if encoding is not supported", async () => {
			const mockConfig = {
				get: vi.fn().mockReturnValue("unsupported-encoding"),
			}
			mockedVscode.workspace.getConfiguration = vi.fn().mockReturnValue(mockConfig)

			mockedIconv.encodingExists = vi.fn().mockReturnValue(false)
			mockedFs.writeFile = vi.fn().mockResolvedValue(undefined)

			const result = await writeFileWithEncoding("/path/to/file.txt", "Hello World")

			expect(mockedFs.writeFile).toHaveBeenCalledWith("/path/to/file.txt", "Hello World", "utf8")
			expect(result.encoding).toBe("unsupported-encoding")
			expect(result.usedFallback).toBe(true)
		})

		it("should fall back to UTF-8 if encoding fails", async () => {
			const mockConfig = {
				get: vi.fn().mockReturnValue("cp852"),
			}
			mockedVscode.workspace.getConfiguration = vi.fn().mockReturnValue(mockConfig)

			mockedIconv.encodingExists = vi.fn().mockReturnValue(true)
			mockedIconv.encode = vi.fn().mockImplementation(() => {
				throw new Error("Encoding failed")
			})
			mockedFs.writeFile = vi.fn().mockResolvedValue(undefined)

			const result = await writeFileWithEncoding("/path/to/file.txt", "Hello World")

			expect(mockedFs.writeFile).toHaveBeenCalledWith("/path/to/file.txt", "Hello World", "utf8")
			expect(result.encoding).toBe("cp852")
			expect(result.usedFallback).toBe(true)
		})
	})
})
