import * as jschardet from "jschardet"
import * as iconv from "iconv-lite"
import { isBinaryFile } from "isbinaryfile"
import fs from "fs/promises"
import path from "path"
import { createLogger } from "./logger"

// Common binary file extension list
export const BINARY_EXTENSIONS = new Set([
	// Executable files
	".exe",
	".dll",
	".so",
	".dylib",
	".a",
	".lib",
	".o",
	".obj",
	// Compressed files
	".zip",
	".rar",
	".7z",
	".tar",
	".gz",
	".bz2",
	".xz",
	".z",
	// Image files
	".jpg",
	".jpeg",
	".png",
	".gif",
	".bmp",
	".tiff",
	".webp",
	".ico",
	".svg",
	// Audio and video files
	".mp3",
	".mp4",
	".avi",
	".mov",
	"wmv",
	".flv",
	".mkv",
	".wav",
	".flac",
	// Document files
	".doc",
	".xls",
	".ppt",
	".pptx",
	// Other binary files
	".bin",
	".dat",
	".iso",
	".dmg",
	".pkg",
	".deb",
	".rpm",
	".msi",
	// Font files
	".ttf",
	".otf",
	".woff",
	".woff2",
	".eot",
	// Database files
	".db",
	".sqlite",
	".mdb",
	".accdb",
	// Certificate and key files
	".p12",
	".pfx",
	".crt",
	".cer",
	".key",
	".pem",
	// System files
	".sys",
	".drv",
	".efi",
	".rom",
	".bin",
	// Game files
	".sav",
	".rom",
	".iso",
	".n64",
	".z64",
	".v64",
])

// Common binary file magic numbers
export const BINARY_MAGIC_NUMBERS = [
	// ELF files
	{ magic: Buffer.from([0x7f, 0x45, 0x4c, 0x46]), description: "ELF executable" },
	// PE files (Windows EXE/DLL)
	{ magic: Buffer.from([0x4d, 0x5a]), description: "PE executable" },
	// ZIP files
	{ magic: Buffer.from([0x50, 0x4b, 0x03, 0x04]), description: "ZIP archive" },
	{ magic: Buffer.from([0x50, 0x4b, 0x05, 0x06]), description: "ZIP archive (empty)" },
	{ magic: Buffer.from([0x50, 0x4b, 0x07, 0x08]), description: "ZIP archive (spanned)" },
	// RAR files
	{ magic: Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00]), description: "RAR archive" },
	{ magic: Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01, 0x00]), description: "RAR5 archive" },
	// 7z files
	{ magic: Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]), description: "7z archive" },
	// PNG files
	{ magic: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), description: "PNG image" },
	// JPEG files
	{ magic: Buffer.from([0xff, 0xd8, 0xff]), description: "JPEG image" },
	// GIF files
	{ magic: Buffer.from([0x47, 0x49, 0x46, 0x38]), description: "GIF image" },
	// Mach-O files (macOS)
	{ magic: Buffer.from([0xfe, 0xed, 0xfa, 0xce]), description: "Mach-O executable (32-bit)" },
	{ magic: Buffer.from([0xfe, 0xed, 0xfa, 0xcf]), description: "Mach-O executable (64-bit)" },
	{ magic: Buffer.from([0xce, 0xfa, 0xed, 0xfe]), description: "Mach-O executable (32-bit reverse)" },
	{ magic: Buffer.from([0xcf, 0xfa, 0xed, 0xfe]), description: "Mach-O executable (64-bit reverse)" },
]

/**
 * Detect the encoding of a file buffer
 * @param fileBuffer The file buffer
 * @param fileExtension Optional file extension
 * @returns The detected encoding
 */
export async function detectEncoding(fileBuffer: Buffer, fileExtension?: string, filePath?: string): Promise<string> {
	// 1. First check if it's a known binary file extension
	if (fileExtension && BINARY_EXTENSIONS.has(fileExtension)) {
		throw new Error(`Cannot read text for file type: ${fileExtension}`)
	}

	// 2. Perform encoding detection
	const detected = jschardet.detect(fileBuffer.subarray(0, 8192))
	let encoding: string
	let originalEncoding: string | undefined

	if (typeof detected === "string") {
		encoding = detected
		originalEncoding = detected
	} else if (detected && detected.encoding) {
		originalEncoding = detected.encoding
		// Increase confidence threshold from 0.7 to 0.9
		if (detected.confidence < 0.7) {
			createLogger().warn(
				`Low confidence encoding detection: ${originalEncoding} (confidence: ${detected.confidence}), falling back to utf8`,
			)
			encoding = "utf8"
		} else {
			encoding = detected.encoding
		}
	} else {
		// 3. Only check if it's a binary file when encoding detection fails
		if (fileExtension) {
			const isBinary = await isBinaryFile(fileBuffer).catch(() => false)
			if (isBinary) {
				throw new Error(`Cannot read text for file type: ${fileExtension}`)
			}
		}
		createLogger().warn(`No encoding detected, falling back to utf8`)
		encoding = "utf8"
	}

	if (encoding === "ascii") {
		return "utf8"
	}

	// 4. Verify if the encoding is supported by iconv-lite
	if (!iconv.encodingExists(encoding)) {
		createLogger().warn(
			`Unsupported encoding detected: ${encoding}${originalEncoding && originalEncoding !== encoding ? ` (originally detected as: ${originalEncoding})` : ""}, falling back to utf8`,
		)
		encoding = "utf8"
	}

	return encoding
}

/**
 * Read file with automatic encoding detection
 * @param filePath Path to the file
 * @returns File content as string
 */
export async function readFileWithEncodingDetection(filePath: string): Promise<string> {
	const buffer = await fs.readFile(filePath)
	const fileExtension = path.extname(filePath).toLowerCase()

	const encoding = await detectEncoding(buffer, fileExtension, filePath)
	return iconv.decode(buffer, encoding)
}

/**
 * Detect the encoding of an existing file
 * @param filePath Path to the file
 * @returns Detected encoding, returns 'utf8' if file does not exist
 */
export async function detectFileEncoding(filePath: string): Promise<string> {
	try {
		const buffer = await fs.readFile(filePath)
		const fileExtension = path.extname(filePath).toLowerCase()
		return await detectEncoding(buffer, fileExtension, filePath)
	} catch (error) {
		// File does not exist or cannot be read, default to UTF-8
		return "utf8"
	}
}

/**
 * Improved smart binary file detection
 * @param filePath File path
 * @returns Promise<boolean> true if file is binary, false if it's a text file
 */
export async function isBinaryFileWithEncodingDetection(filePath: string): Promise<boolean> {
	try {
		const fileExtension = path.extname(filePath).toLowerCase()
		// 1. First check file extension
		if (BINARY_EXTENSIONS.has(fileExtension)) {
			return true
		}

		// 2. Read file content
		const fileBuffer = await fs.readFile(filePath)

		// 3. Check file header magic numbers
		for (const { magic } of BINARY_MAGIC_NUMBERS) {
			if (fileBuffer.length >= magic.length && fileBuffer.subarray(0, magic.length).equals(magic)) {
				return true
			}
		}
		// Try to detect encoding first
		try {
			await detectEncoding(fileBuffer, fileExtension, filePath)
			// If detectEncoding succeeds, it's a text file
			return false
		} catch (error) {
			// If detectEncoding fails, check if it's actually a binary file
			return await isBinaryFile(fileBuffer).catch(() => false)
		}
	} catch (error) {
		// File read error, assume it's binary
		return true
	}
}

/**
 * Write file using the same encoding as the original file
 * If the file is new, use UTF-8 encoding
 * @param filePath Path to the file
 * @param content Content to write (UTF-8 string)
 * @returns Promise<void>
 */
export async function writeFileWithEncodingPreservation(filePath: string, content: string): Promise<void> {
	// Detect original file encoding
	let finalEncoding = (await detectFileEncoding(filePath)) as BufferEncoding

	// If original file is UTF-8 or does not exist, write directly
	if (!finalEncoding || ["utf-8", "utf8", "ascii"].includes(finalEncoding.toLocaleLowerCase())) {
		finalEncoding = "utf8"
		await retry(() => safeWriteFile(filePath, content, finalEncoding))
	} else {
		// Convert UTF-8 content to original file encoding
		const encodedBuffer = iconv.encode(content, finalEncoding)
		await retry(() => safeWriteFile(filePath, encodedBuffer))
	}

	createLogger().info(`[write] ${filePath} encoding with ${finalEncoding}`)
}

async function safeWriteFile(filePath: string, data: Buffer | string, encoding?: BufferEncoding) {
	const handle = await fs.open(filePath, "w")
	try {
		await handle.writeFile(data, encoding)
		await handle.sync()
	} finally {
		await handle.close()
	}
}

async function retry<T>(fn: () => Promise<T>, retries = 3, delay = 100): Promise<T> {
	for (let i = 0; i < retries; i++) {
		try {
			return await fn()
		} catch (err: any) {
			if (["EBUSY", "EPERM", "EACCES"].includes(err.code)) {
				if (i === retries - 1) throw err
				await new Promise((r) => setTimeout(r, delay * (i + 1)))
			} else {
				throw err
			}
		}
	}
	throw new Error("unreachable")
}
