import { BaseLanguageChunker } from "./base-chunker"
import { Chunk } from "../../interfaces/chunking"

/**
 * Generic language chunker for unsupported languages
 * Falls back to line-based chunking with statement detection
 */
export class GenericChunker extends BaseLanguageChunker {
	protected getSupportedLanguages(): string[] {
		// Supports all languages not handled by specific chunkers
		return []
	}

	protected getDefaultChunkSize(): number {
		return 1500
	}

	/**
	 * Extract chunks from generic content
	 * Uses line-based chunking with basic statement detection
	 */
	override extractChunks(content: string, maxSize: number): Chunk[] {
		const chunks: Chunk[] = []
		const lines = content.split("\n")

		let currentChunkLines: string[] = []
		let currentChunkStart = 0
		let currentIdentifier: string | null = null
		let currentChunkType = "file"
		let braceCount = 0
		let parenCount = 0

		// Detect various declaration patterns
		const declarationPatterns = [
			/^(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
			/^(?:export\s+)?(?:async\s+)?const\s+(\w+)\s*=/,
			/^(?:export\s+)?(?:async\s+)?let\s+(\w+)/,
			/^(?:export\s+)?(?:async\s+)?var\s+(\w+)/,
			/^(?:export\s+)?class\s+(\w+)/,
			/^(?:export\s+)?interface\s+(\w+)/,
			/^(?:export\s+)?type\s+(\w+)/,
			/^def\s+(\w+)/,
			/^fn\s+(\w+)/,
			/^func\s+(\w+)/,
			/^pub\s+(?:fn|func|def|struct|trait|impl|mod)\s+(\w+)/,
		]

		// Track block structures
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]
			const trimmedLine = line.trim()

			// Skip empty lines and comments
			if (
				trimmedLine.length === 0 ||
				trimmedLine.startsWith("#") ||
				trimmedLine.startsWith("//") ||
				trimmedLine.startsWith("/*")
			) {
				currentChunkLines.push(line)
				continue
			}

			// Count structural characters
			for (const char of line) {
				if (char === "{") braceCount++
				if (char === "}") braceCount--
				if (char === "(") parenCount++
				if (char === ")") parenCount--
			}

			// Check for declarations
			for (const pattern of declarationPatterns) {
				const match = trimmedLine.match(pattern)
				if (match) {
					currentIdentifier = match[1]
					break
				}
			}

			currentChunkLines.push(line)

			// Split at natural boundaries
			const isEndOfBlock = braceCount === 0 && parenCount === 0
			const isEndOfStatement = trimmedLine.endsWith(";") || trimmedLine.endsWith("{") || trimmedLine.endsWith("}")

			if ((isEndOfBlock || isEndOfStatement) && currentChunkLines.length > 0) {
				const chunkContent = currentChunkLines.join("\n")

				if (chunkContent.length > maxSize && currentChunkLines.length > 1) {
					this.splitLargeChunk(
						currentChunkLines,
						currentChunkStart,
						currentChunkType,
						currentIdentifier,
						"generic",
						maxSize,
						chunks,
					)
				} else if (chunkContent.length >= 50) {
					chunks.push(
						this.createChunk(
							chunkContent,
							currentChunkStart + 1,
							currentChunkStart + currentChunkLines.length,
							currentChunkType,
							currentIdentifier,
							"generic",
						),
					)
				}

				currentChunkLines = []
				currentChunkStart = i + 1
				currentIdentifier = null
				currentChunkType = "fragment"
			}
		}

		// Add remaining chunk
		if (currentChunkLines.length > 0) {
			const chunkContent = currentChunkLines.join("\n")
			if (chunkContent.length >= 50) {
				if (chunkContent.length > maxSize && currentChunkLines.length > 1) {
					this.splitLargeChunk(
						currentChunkLines,
						currentChunkStart,
						currentChunkType,
						currentIdentifier,
						"generic",
						maxSize,
						chunks,
					)
				} else {
					chunks.push(
						this.createChunk(
							chunkContent,
							currentChunkStart + 1,
							currentChunkStart + currentChunkLines.length,
							currentChunkType,
							currentIdentifier,
							"generic",
						),
					)
				}
			}
		}

		// If no chunks, create a single chunk
		if (chunks.length === 0 && content.length > 0) {
			chunks.push(this.createChunk(content, 1, lines.length, "file", null, "generic"))
		}

		return chunks
	}

	/**
	 * Split a large chunk into smaller pieces
	 */
	private splitLargeChunk(
		lines: string[],
		startLine: number,
		chunkType: string,
		identifier: string | null,
		language: string,
		maxSize: number,
		chunks: Chunk[],
	): void {
		const minChunkSize = 200
		let currentLines: string[] = []
		let chunkStartLine = 0

		for (let i = 0; i < lines.length; i++) {
			currentLines.push(lines[i])

			const chunkContent = currentLines.join("\n")

			if (chunkContent.length > maxSize && currentLines.length > 1) {
				let splitIndex = currentLines.length - 1
				for (let j = currentLines.length - 2; j >= 0; j--) {
					const testChunk = currentLines.slice(0, j + 1).join("\n")
					if (testChunk.length >= minChunkSize && testChunk.length <= maxSize) {
						splitIndex = j
						break
					}
				}

				const splitContent = currentLines.slice(0, splitIndex + 1).join("\n")
				chunks.push(
					this.createChunk(
						splitContent,
						startLine + chunkStartLine + 1,
						startLine + chunkStartLine + splitIndex + 1,
						chunkType,
						identifier,
						language,
					),
				)

				currentLines = currentLines.slice(splitIndex + 1)
				chunkStartLine = splitIndex + 1
			}
		}

		if (currentLines.length > 0) {
			const chunkContent = currentLines.join("\n")
			if (chunkContent.length >= minChunkSize) {
				chunks.push(
					this.createChunk(
						chunkContent,
						startLine + chunkStartLine + 1,
						startLine + chunkStartLine + currentLines.length,
						chunkType,
						identifier,
						language,
					),
				)
			}
		}
	}
}

/**
 * Singleton instance of GenericChunker
 */
export const genericChunker = new GenericChunker()
