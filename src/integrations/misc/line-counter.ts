import fs, { createReadStream } from "fs"
import { createInterface } from "readline"
import * as NativeFileProcessor from "../../../native/bindings/file-processor"

/**
 * Minimum file size (in bytes) to use native Rust module for line counting
 * Below this threshold, JavaScript is faster due to FFI overhead
 * Based on performance testing: Rust wins at 1MB+ for CPU-intensive operations
 */
const NATIVE_LINE_COUNT_THRESHOLD_BYTES = 1 * 1024 * 1024 // 1MB

/**
 * Efficiently counts lines in a file using streams without loading the entire file into memory
 * Uses Rust native module for significant performance improvement on large files (6-10x faster)
 *
 * @param filePath - Path to the file to count lines in
 * @returns A promise that resolves to the number of lines in the file
 */
export async function countFileLines(filePath: string): Promise<number> {
	// Check if file exists and get file size
	let fileSize: number
	try {
		const stats = await fs.promises.stat(filePath)
		fileSize = stats.size
	} catch (error) {
		throw new Error(`File not found: ${filePath}`)
	}

	// Smart selection: Use Rust for large files (>1MB), JavaScript for small files
	// Reason: FFI overhead is negligible for CPU-intensive line counting on large files
	const useNative = NativeFileProcessor.isNativeAvailable() && fileSize >= NATIVE_LINE_COUNT_THRESHOLD_BYTES

	if (useNative) {
		try {
			return await NativeFileProcessor.countLines(filePath)
		} catch (error) {
			// Fall back to JavaScript implementation on error
			console.warn("[countFileLines] Native module failed, falling back to JS:", error)
		}
	}

	// Fallback: JavaScript implementation using streams (for small files or when native unavailable)
	return new Promise((resolve, reject) => {
		let lineCount = 0

		const readStream = createReadStream(filePath)
		const rl = createInterface({
			input: readStream,
			crlfDelay: Infinity,
		})

		rl.on("line", () => {
			lineCount++
		})

		rl.on("close", () => {
			resolve(lineCount)
		})

		rl.on("error", (err) => {
			reject(err)
		})

		readStream.on("error", (err) => {
			reject(err)
		})
	})
}
