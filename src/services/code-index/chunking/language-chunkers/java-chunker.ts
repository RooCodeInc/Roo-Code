import { BaseLanguageChunker } from "./base-chunker"
import { Chunk } from "../../interfaces/chunking"

/**
 * Java language-specific chunker
 * Chunks code by class/method/interface definitions
 */
export class JavaChunker extends BaseLanguageChunker {
	protected getSupportedLanguages(): string[] {
		return ["java"]
	}

	protected getDefaultChunkSize(): number {
		return 2000
	}

	/**
	 * Extract chunks from Java content
	 * Uses brace-based parsing to identify code blocks
	 */
	override extractChunks(content: string, maxSize: number): Chunk[] {
		const chunks: Chunk[] = []
		const lines = content.split("\n")

		let currentChunkLines: string[] = []
		let currentChunkStart = 0
		let currentIdentifier: string | null = null
		let currentChunkType = "file"
		let braceCount = 0
		let inClassOrInterface = false

		// Pattern to match class/interface/enum definitions
		const classPattern = /^(public\s+)?(abstract\s+)?(final\s+)?class\s+(\w+)/
		const interfacePattern = /^(public\s+)?interface\s+(\w+)/
		const enumPattern = /^(public\s+)?enum\s+(\w+)/
		const methodPattern =
			/^\s*(public|private|protected|static)?\s*(final\s+)?(abstract\s+)?(static\s+)?\s*(\w+)\s+\w+\s*\([^)]*\)\s*(throws\s+[\w,\s]+)?\s*\{/
		const mainMethodPattern = /^\s*public\s+static\s+void\s+main\s*\([^)]*\)\s*\{/

		// Pattern for top-level declarations
		const packagePattern = /^package\s+[\w.]+;/
		const importPattern = /^import\s+[\w.]+;/

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]
			const trimmedLine = line.trim()

			// Skip package and import statements for chunk content
			const isPackageOrImport = packagePattern.test(trimmedLine) || importPattern.test(trimmedLine)

			// Count braces
			for (const char of line) {
				if (char === "{") braceCount++
				if (char === "}") braceCount--
			}

			// Check for class/interface/enum definitions
			const classMatch = trimmedLine.match(classPattern)
			const interfaceMatch = trimmedLine.match(interfacePattern)
			const enumMatch = trimmedLine.match(enumPattern)

			if (classMatch) {
				currentIdentifier = classMatch[4]
				currentChunkType = "class"
				inClassOrInterface = true
			} else if (interfaceMatch) {
				currentIdentifier = interfaceMatch[2]
				currentChunkType = "interface"
				inClassOrInterface = true
			} else if (enumMatch) {
				currentIdentifier = enumMatch[2]
				currentChunkType = "enum"
				inClassOrInterface = true
			}

			// Check for method definitions
			const methodMatch = trimmedLine.match(methodPattern)
			const mainMatch = trimmedLine.match(mainMethodPattern)

			if ((methodMatch || mainMatch) && inClassOrInterface) {
				const methodNameMatch = trimmedLine.match(/\s+(\w+)\s*\(/)
				if (methodNameMatch) {
					currentIdentifier = methodNameMatch[1]
				}
				currentChunkType = "method"
			}

			if (!isPackageOrImport) {
				currentChunkLines.push(line)
			}

			// Check if we've reached the end of a class/interface/enum
			if (inClassOrInterface && braceCount === 0 && currentChunkLines.length > 0) {
				const chunkContent = currentChunkLines.join("\n")

				if (chunkContent.length > maxSize && currentChunkLines.length > 1) {
					// Split large chunks
					this.splitLargeChunk(
						currentChunkLines,
						currentChunkStart,
						currentChunkType,
						currentIdentifier,
						"java",
						maxSize,
						chunks,
					)
				} else if (chunkContent.length >= 100) {
					chunks.push(
						this.createChunk(
							chunkContent,
							currentChunkStart + 1,
							currentChunkStart + currentChunkLines.length,
							currentChunkType,
							currentIdentifier,
							"java",
						),
					)
				}

				currentChunkLines = []
				currentChunkStart = i + 1
				currentIdentifier = null
				currentChunkType = "file"
				inClassOrInterface = false
			}
		}

		// Add the remaining chunk
		if (currentChunkLines.length > 0) {
			const chunkContent = currentChunkLines.join("\n")
			if (chunkContent.length >= 100) {
				if (chunkContent.length > maxSize && currentChunkLines.length > 1) {
					this.splitLargeChunk(
						currentChunkLines,
						currentChunkStart,
						currentChunkType,
						currentIdentifier,
						"java",
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
							"java",
						),
					)
				}
			}
		}

		// If no chunks were created (file is small), create a single chunk
		if (chunks.length === 0 && content.length > 0) {
			chunks.push(this.createChunk(content, 1, lines.length, "file", null, "java"))
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
				// Find a good split point
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

		// Add remaining lines
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
 * Singleton instance of JavaChunker
 */
export const javaChunker = new JavaChunker()
