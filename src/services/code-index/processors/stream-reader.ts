import * as fs from "fs"
import * as readline from "readline"
import { createHash } from "crypto"
import { MAX_FILE_SIZE_BYTES } from "../constants"

export interface StreamReadResult {
	hash: string
	lines: string[]
	truncated: boolean
	totalSize: number
}

/**
 * Reads a file using streaming to avoid loading entire file into memory.
 * For very large files, returns a truncated version for processing.
 */
export async function streamReadFile(
	filePath: string,
	maxLinesPerChunk: number = 10000,
	maxMemoryMB: number = 50,
): Promise<StreamReadResult> {
	const maxBytes = maxMemoryMB * 1024 * 1024
	const lines: string[] = []
	let totalSize = 0
	let truncated = false
	let currentMemoryUsage = 0

	const hash = createHash("sha256")
	const fileStream = fs.createReadStream(filePath, { encoding: "utf8" })
	const rl = readline.createInterface({
		input: fileStream,
		crlfDelay: Infinity,
	})

	return new Promise((resolve, reject) => {
		rl.on("line", (line) => {
			// Update hash with full line content
			hash.update(line + "\n")
			totalSize += line.length + 1

			// Only store line if within memory limits
			if (!truncated && currentMemoryUsage < maxBytes) {
				lines.push(line)
				currentMemoryUsage += line.length + 1

				// Check if we should truncate
				if (lines.length >= maxLinesPerChunk || currentMemoryUsage >= maxBytes) {
					truncated = totalSize > currentMemoryUsage
				}
			}
		})

		rl.on("close", () => {
			resolve({
				hash: hash.digest("hex"),
				lines,
				truncated,
				totalSize,
			})
		})

		rl.on("error", reject)
		fileStream.on("error", reject)
	})
}

/**
 * Process a large file in chunks without loading it entirely into memory
 */
export async function* streamProcessFile(
	filePath: string,
	chunkSizeLines: number = 5000,
): AsyncGenerator<{ lines: string[]; startLine: number; endLine: number }> {
	const fileStream = fs.createReadStream(filePath, { encoding: "utf8" })
	const rl = readline.createInterface({
		input: fileStream,
		crlfDelay: Infinity,
	})

	let lines: string[] = []
	let currentLine = 0
	let chunkStartLine = 1

	for await (const line of rl) {
		currentLine++
		lines.push(line)

		if (lines.length >= chunkSizeLines) {
			yield {
				lines: [...lines],
				startLine: chunkStartLine,
				endLine: currentLine,
			}
			lines = []
			chunkStartLine = currentLine + 1
		}
	}

	// Yield remaining lines if any
	if (lines.length > 0) {
		yield {
			lines,
			startLine: chunkStartLine,
			endLine: currentLine,
		}
	}
}
