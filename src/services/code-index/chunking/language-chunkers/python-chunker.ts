import { BaseLanguageChunker } from "./base-chunker"
import { Chunk } from "../../interfaces/chunking"

/**
 * Python language-specific chunker
 * Chunks code by function/class/method definitions
 */
export class PythonChunker extends BaseLanguageChunker {
	protected getSupportedLanguages(): string[] {
		return ["python", "py"]
	}

	protected getDefaultChunkSize(): number {
		return 1500
	}

	/**
	 * Extract chunks from Python content
	 * Uses indentation-based parsing to identify code blocks
	 */
	override extractChunks(content: string, maxSize: number): Chunk[] {
		const chunks: Chunk[] = []
		const lines = content.split("\n")

		// Track indentation levels and their corresponding code
		const indentStack: {
			indent: number
			lines: string[]
			startLine: number
			identifier: string | null
			chunkType: string
		}[] = []

		let currentIndent = 0
		let currentChunkLines: string[] = []
		let currentChunkStart = 0
		let currentIdentifier: string | null = null
		let currentChunkType = "module"

		// Pattern to match function/class definitions
		const functionPattern = /^def\s+(\w+)/
		const classPattern = /^class\s+(\w+)/
		const asyncPattern = /^async\s+def\s+(\w+)/

		// Pattern for top-level statements
		const importPattern = /^(import\s+|from\s+)/
		const assignmentPattern = /^(\w+)\s*=/

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]
			const trimmedLine = line.trim()

			// Skip empty lines and comments
			if (trimmedLine.length === 0 || trimmedLine.startsWith("#")) {
				currentChunkLines.push(line)
				continue
			}

			// Calculate the indentation of this line
			const lineIndent = line.search(/\S/)

			// Handle dedent (moving back to a parent block)
			if (lineIndent > currentIndent) {
				// Save current chunk if it has content
				if (currentChunkLines.length > 0) {
					const chunkContent = currentChunkLines.join("\n")
					if (chunkContent.length >= 50) {
						chunks.push(
							this.createChunk(
								chunkContent,
								currentChunkStart + 1,
								currentChunkStart + currentChunkLines.length,
								currentChunkType,
								currentIdentifier,
								"python",
							),
						)
					}
				}

				// Push current state to stack and start new chunk
				indentStack.push({
					indent: currentIndent,
					lines: currentChunkLines,
					startLine: currentChunkStart,
					identifier: currentIdentifier,
					chunkType: currentChunkType,
				})

				currentChunkLines = []
				currentChunkStart = i
				currentIndent = lineIndent
				currentIdentifier = null
				currentChunkType = "block"
			} else if (lineIndent < currentIndent) {
				// Dedent - save current chunk and restore parent
				if (currentChunkLines.length > 0) {
					const chunkContent = currentChunkLines.join("\n")
					if (chunkContent.length >= 50) {
						chunks.push(
							this.createChunk(
								chunkContent,
								currentChunkStart + 1,
								currentChunkStart + currentChunkLines.length,
								currentChunkType,
								currentIdentifier,
								"python",
							),
						)
					}
				}

				// Pop from stack until we find the parent indent level
				while (indentStack.length > 0 && indentStack[indentStack.length - 1].indent >= lineIndent) {
					indentStack.pop()
				}

				if (indentStack.length > 0) {
					const parent = indentStack[indentStack.length - 1]
					currentChunkLines = [...parent.lines]
					currentChunkStart = parent.startLine
					currentIdentifier = parent.identifier
					currentChunkType = parent.chunkType
				} else {
					currentChunkLines = []
					currentChunkStart = i
					currentIdentifier = null
					currentChunkType = "module"
				}
				currentIndent = lineIndent
			}

			// Check for new function/class definitions
			const functionMatch = trimmedLine.match(functionPattern) || trimmedLine.match(asyncPattern)
			const classMatch = trimmedLine.match(classPattern)

			if (functionMatch) {
				currentIdentifier = functionMatch[1]
				currentChunkType = "function"
			} else if (classMatch) {
				currentIdentifier = classMatch[1]
				currentChunkType = "class"
			}

			currentChunkLines.push(line)

			// Check if we need to split the chunk
			const currentChunkText = currentChunkLines.join("\n")

			if (currentChunkText.length > maxSize && currentChunkLines.length > 1) {
				// Find a good split point
				let splitIndex = currentChunkLines.length - 1
				for (let j = currentChunkLines.length - 2; j >= 0; j--) {
					const testChunk = currentChunkLines.slice(0, j + 1).join("\n")
					if (testChunk.length >= 200 && testChunk.length <= maxSize) {
						splitIndex = j
						break
					}
				}

				const chunkContent = currentChunkLines.slice(0, splitIndex + 1).join("\n")
				const chunkEndLine = currentChunkStart + splitIndex

				chunks.push(
					this.createChunk(
						chunkContent,
						currentChunkStart + 1,
						chunkEndLine + 1,
						currentChunkType,
						currentIdentifier,
						"python",
					),
				)

				// Start new chunk
				currentChunkLines = currentChunkLines.slice(splitIndex + 1)
				currentChunkStart = chunkEndLine + 1
				currentIdentifier = null
				currentChunkType = "fragment"
			}
		}

		// Add the remaining chunk
		if (currentChunkLines.length > 0) {
			const chunkContent = currentChunkLines.join("\n")
			if (chunkContent.length >= 50) {
				chunks.push(
					this.createChunk(
						chunkContent,
						currentChunkStart + 1,
						currentChunkStart + currentChunkLines.length,
						currentChunkType,
						currentIdentifier,
						"python",
					),
				)
			}
		}

		// If no chunks were created (file is small), create a single chunk
		if (chunks.length === 0 && content.length > 0) {
			chunks.push(this.createChunk(content, 1, lines.length, "module", null, "python"))
		}

		return chunks
	}
}

/**
 * Singleton instance of PythonChunker
 */
export const pythonChunker = new PythonChunker()
