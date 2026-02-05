import { BaseLanguageChunker } from "./base-chunker"
import { Chunk } from "../../interfaces/chunking"

/**
 * Go language-specific chunker
 * Chunks code by function/method/type definitions
 */
export class GoChunker extends BaseLanguageChunker {
	protected getSupportedLanguages(): string[] {
		return ["go"]
	}

	protected getDefaultChunkSize(): number {
		return 1500
	}

	/**
	 * Extract chunks from Go content
	 * Uses brace-based parsing similar to Java but Go-specific patterns
	 */
	override extractChunks(content: string, maxSize: number): Chunk[] {
		const chunks: Chunk[] = []
		const lines = content.split("\n")

		let currentChunkLines: string[] = []
		let currentChunkStart = 0
		let currentIdentifier: string | null = null
		let currentChunkType = "package"
		let braceCount = 0
		let parenCount = 0
		let inFunctionOrType = false

		// Pattern to match function/method/type/interface definitions
		const funcPattern = /^func\s+(\([^)]*\)\s*)?(\w+)\(/
		const typeAliasPattern = /^type\s+(\w+)\s+/
		const typeInterfacePattern = /^type\s+(\w+)\s+interface\s+\{/
		const typeStructPattern = /^type\s+(\w+)\s+struct\s+\{/
		const constPattern = /^const\s+(\w+)/
		const varPattern = /^var\s+(\w+)/
		const importBlockPattern = /^import\s+\(/

		// Track import blocks
		let inImportBlock = false

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]
			const trimmedLine = line.trim()

			// Handle import blocks
			if (importBlockPattern.test(trimmedLine)) {
				inImportBlock = true
			}
			if (inImportBlock) {
				if (trimmedLine === ")") {
					inImportBlock = false
				}
				continue // Skip import lines
			}

			// Count braces and parentheses
			for (const char of line) {
				if (char === "{") braceCount++
				if (char === "}") braceCount--
				if (char === "(") parenCount++
				if (char === ")") parenCount--
			}

			// Check for top-level definitions
			const funcMatch = trimmedLine.match(funcPattern)
			const typeAliasMatch = trimmedLine.match(typeAliasPattern)
			const typeInterfaceMatch = trimmedLine.match(typeInterfacePattern)
			const typeStructMatch = trimmedLine.match(typeStructPattern)
			const constMatch = trimmedLine.match(constPattern)
			const varMatch = trimmedLine.match(varPattern)

			if (funcMatch) {
				// Extract function/method name
				const funcNameMatch = trimmedLine.match(/func\s+(?:\([^)]*\)\s*)?(\w+)/)
				if (funcNameMatch) {
					currentIdentifier = funcNameMatch[1]
				}
				currentChunkType = "function"
				inFunctionOrType = true
			} else if (typeInterfaceMatch) {
				currentIdentifier = typeInterfaceMatch[1]
				currentChunkType = "interface"
				inFunctionOrType = true
			} else if (typeStructMatch) {
				currentIdentifier = typeStructMatch[1]
				currentChunkType = "struct"
				inFunctionOrType = true
			} else if (typeAliasMatch && !typeInterfaceMatch && !typeStructMatch) {
				currentIdentifier = typeAliasMatch[1]
				currentChunkType = "type"
			} else if (constMatch) {
				currentIdentifier = constMatch[1]
				currentChunkType = "const"
			} else if (varMatch) {
				currentIdentifier = varMatch[1]
				currentChunkType = "var"
			}

			currentChunkLines.push(line)

			// Check if we're at the end of a function/type block
			if (inFunctionOrType && braceCount === 0 && parenCount === 0 && currentChunkLines.length > 0) {
				const chunkContent = currentChunkLines.join("\n")

				if (chunkContent.length > maxSize && currentChunkLines.length > 1) {
					this.splitLargeChunk(
						currentChunkLines,
						currentChunkStart,
						currentChunkType,
						currentIdentifier,
						"go",
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
							"go",
						),
					)
				}

				currentChunkLines = []
				currentChunkStart = i + 1
				currentIdentifier = null
				currentChunkType = "package"
				inFunctionOrType = false
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
						"go",
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
							"go",
						),
					)
				}
			}
		}

		// If no chunks, create a single chunk
		if (chunks.length === 0 && content.length > 0) {
			chunks.push(this.createChunk(content, 1, lines.length, "package", null, "go"))
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
 * Singleton instance of GoChunker
 */
export const goChunker = new GoChunker()
