import { BaseLanguageChunker } from "./base-chunker"
import { Chunk } from "../../interfaces/chunking"

/**
 * Rust language-specific chunker
 * Chunks code by function/struct/trait/impl definitions
 */
export class RustChunker extends BaseLanguageChunker {
	protected getSupportedLanguages(): string[] {
		return ["rust", "rs"]
	}

	protected getDefaultChunkSize(): number {
		return 1500
	}

	/**
	 * Extract chunks from Rust content
	 * Uses brace-based parsing with Rust-specific patterns
	 */
	override extractChunks(content: string, maxSize: number): Chunk[] {
		const chunks: Chunk[] = []
		const lines = content.split("\n")

		let currentChunkLines: string[] = []
		let currentChunkStart = 0
		let currentIdentifier: string | null = null
		let currentChunkType = "crate"
		let braceCount = 0
		let parenCount = 0
		let inBlock = false

		// Pattern to match Rust definitions
		const fnPattern = /^(pub\s+)?(async\s+)?fn\s+(\w+)/
		const structPattern = /^(pub\s+)?struct\s+(\w+)/
		const traitPattern = /^(pub\s+)?trait\s+(\w+)/
		const implPattern = /^(pub\s+)?impl\s+(?:(\w+)\s+)?(?:for\s+)?(\w+)?/
		const enumPattern = /^(pub\s+)?enum\s+(\w+)/
		const constPattern = /^(pub\s+)?const\s+(\w+)/
		const staticPattern = /^(pub\s+)?static\s+(mut\s+)?(\w+)/
		const modPattern = /^(pub\s+)?mod\s+(\w+)/

		// Track attribute macros
		let inAttributeMacro = false

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]
			const trimmedLine = line.trim()

			// Handle attribute macros like #[test], #[cfg(...)]
			if (trimmedLine.startsWith("#[")) {
				inAttributeMacro = true
			}
			if (inAttributeMacro) {
				if (trimmedLine.endsWith("]") && !trimmedLine.includes("(")) {
					inAttributeMacro = false
				}
				// Don't skip - attributes are part of the function
			}

			// Count braces and parentheses
			for (const char of line) {
				if (char === "{") braceCount++
				if (char === "}") braceCount--
				if (char === "(") parenCount++
				if (char === ")") parenCount--
			}

			// Check for top-level definitions
			const fnMatch = trimmedLine.match(fnPattern)
			const structMatch = trimmedLine.match(structPattern)
			const traitMatch = trimmedLine.match(traitPattern)
			const implMatch = trimmedLine.match(implPattern)
			const enumMatch = trimmedLine.match(enumPattern)
			const constMatch = trimmedLine.match(constPattern)
			const staticMatch = trimmedLine.match(staticPattern)
			const modMatch = trimmedLine.match(modPattern)

			if (fnMatch) {
				currentIdentifier = fnMatch[3]
				currentChunkType = "function"
				inBlock = true
			} else if (structMatch) {
				currentIdentifier = structMatch[2]
				currentChunkType = "struct"
				inBlock = true
			} else if (traitMatch) {
				currentIdentifier = traitMatch[2]
				currentChunkType = "trait"
				inBlock = true
			} else if (implMatch) {
				const implFor = implMatch[5]
				currentIdentifier = implFor || implMatch[2] || "impl"
				currentChunkType = "impl"
				inBlock = true
			} else if (enumMatch) {
				currentIdentifier = enumMatch[2]
				currentChunkType = "enum"
				inBlock = true
			} else if (constMatch) {
				currentIdentifier = constMatch[2]
				currentChunkType = "const"
			} else if (staticMatch) {
				currentIdentifier = staticMatch[3]
				currentChunkType = "static"
			} else if (modMatch) {
				currentIdentifier = modMatch[2]
				currentChunkType = "mod"
				inBlock = true
			}

			currentChunkLines.push(line)

			// Check if we're at the end of a block
			if (inBlock && braceCount === 0 && currentChunkLines.length > 0) {
				const chunkContent = currentChunkLines.join("\n")

				if (chunkContent.length > maxSize && currentChunkLines.length > 1) {
					this.splitLargeChunk(
						currentChunkLines,
						currentChunkStart,
						currentChunkType,
						currentIdentifier,
						"rust",
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
							"rust",
						),
					)
				}

				currentChunkLines = []
				currentChunkStart = i + 1
				currentIdentifier = null
				currentChunkType = "crate"
				inBlock = false
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
						"rust",
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
							"rust",
						),
					)
				}
			}
		}

		// If no chunks, create a single chunk
		if (chunks.length === 0 && content.length > 0) {
			chunks.push(this.createChunk(content, 1, lines.length, "crate", null, "rust"))
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
 * Singleton instance of RustChunker
 */
export const rustChunker = new RustChunker()
