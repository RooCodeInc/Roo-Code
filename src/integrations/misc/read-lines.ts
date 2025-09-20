/**
 * credits @BorisChumichev
 *
 * https://github.com/BorisChumichev/node-nthline
 *
 * This module extend functionality of reading lines from a file
 * Now you can read a range of lines from a file
 */
import { createReadStream } from "fs"

const outOfRangeError = (filepath: string, n: number) => {
	return new RangeError(`Line with index ${n} does not exist in '${filepath}'. Note that line indexing is zero-based`)
}

/**
 * Reads a range of lines from a file.
 *
 * @param filepath - Path to the file to read
 * @param endLine - Optional. The line number to stop reading at (inclusive). If undefined, reads to the end of file.
 * @param startLine - Optional. The line number to start reading from (inclusive). If undefined, starts from line 0.
 * @returns Promise resolving to a string containing the read lines joined with newlines
 * @throws {RangeError} If line numbers are invalid or out of range
 */
export function readLines(filepath: string, endLine?: number, startLine?: number): Promise<string> {
	return new Promise((resolve, reject) => {
		// Reject if startLine is defined but not a number
		if (startLine !== undefined && typeof startLine !== "number") {
			return reject(new RangeError(`Invalid startLine: ${startLine}. Line numbers must be numbers.`))
		}

		// Force startLine to be an integer and clamp to 0 if negative
		if (startLine !== undefined) {
			startLine = Math.max(0, Math.floor(startLine))
		}

		// Reject if endLine is defined but not a number
		if (endLine !== undefined && typeof endLine !== "number") {
			return reject(new RangeError(`Invalid endLine: ${endLine}. Line numbers must be numbers.`))
		}

		// Force endLine to be an integer
		if (endLine !== undefined) {
			endLine = Math.floor(endLine)
		}

		const effectiveStartLine = startLine === undefined ? 0 : startLine

		// Check startLine and endLine relationship
		if (endLine !== undefined && effectiveStartLine > endLine) {
			return reject(
				new RangeError(`startLine (${effectiveStartLine}) must be less than or equal to endLine (${endLine})`),
			)
		}

		// Set up stream with UTF-8 encoding
		const input = createReadStream(filepath, { encoding: "utf8" })
		let buffer = ""
		let lineCount = 0
		let result = ""

		// Handle errors
		input.on("error", (error: any) => {
			// If it's an encoding error, try to handle it gracefully
			if (
				error.code === "ERR_INVALID_ARG_TYPE" ||
				error.code === "ERR_ENCODING_INVALID_ENCODED_DATA" ||
				error.message?.includes("encoding") ||
				error.message?.includes("Invalid") ||
				error.errno === -92
			) {
				// EILSEQ error code for invalid byte sequence

				// Create a new stream without encoding to read as buffer
				const bufferInput = createReadStream(filepath)
				let bufferData = Buffer.alloc(0)

				bufferInput.on("error", reject)

				bufferInput.on("data", (chunk) => {
					bufferData = Buffer.concat([bufferData, chunk as Buffer])
				})

				bufferInput.on("end", () => {
					// Convert buffer to string with UTF-8, replacing invalid sequences
					const content = bufferData.toString("utf8")
					const lines = content.split("\n")

					// Apply line range filtering
					const effectiveEndLine =
						endLine === undefined ? lines.length - 1 : Math.min(endLine, lines.length - 1)

					if (effectiveStartLine >= lines.length) {
						reject(outOfRangeError(filepath, effectiveStartLine))
					} else {
						const selectedLines = lines.slice(effectiveStartLine, effectiveEndLine + 1)
						// Join with newlines, but don't add trailing newline if original didn't have one
						const hasTrailingNewline = content.endsWith("\n")
						let resultText = selectedLines.join("\n")
						if (hasTrailingNewline || effectiveEndLine < lines.length - 1) {
							resultText += "\n"
						}
						resolve(resultText)
					}
				})
			} else {
				reject(error)
			}
		})

		// Process data chunks directly
		input.on("data", (chunk) => {
			// Chunk is already a string due to encoding option
			buffer += chunk as string

			let pos = 0
			let nextNewline = buffer.indexOf("\n", pos)

			// Process complete lines in the buffer
			while (nextNewline !== -1) {
				// If we're in the target range, add this line to the result
				if (lineCount >= effectiveStartLine && (endLine === undefined || lineCount <= endLine)) {
					result += buffer.substring(pos, nextNewline + 1) // Include the newline
				}

				// Move position and increment line counter
				pos = nextNewline + 1
				lineCount++

				// If we've reached the end line, we can stop
				if (endLine !== undefined && lineCount > endLine) {
					input.destroy()
					resolve(result)
					return
				}

				// Find next newline
				nextNewline = buffer.indexOf("\n", pos)
			}

			// Trim buffer - keep only the incomplete line
			buffer = buffer.substring(pos)
		})

		// Handle end of file
		input.on("end", () => {
			// Process any remaining data in buffer (last line without newline)
			if (buffer.length > 0) {
				if (lineCount >= effectiveStartLine && (endLine === undefined || lineCount <= endLine)) {
					result += buffer
				}
				lineCount++
			}

			// Check if we found any lines in the requested range
			if (lineCount <= effectiveStartLine) {
				reject(outOfRangeError(filepath, effectiveStartLine))
			} else {
				resolve(result)
			}
		})
	})
}
