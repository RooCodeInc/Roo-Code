import { BaseLanguageChunker } from "./base-chunker"
import { Chunk } from "../../interfaces/chunking"

/**
 * TypeScript/JavaScript language-specific chunker
 * Chunks code by function/class boundaries using AST patterns
 */
export class TypeScriptChunker extends BaseLanguageChunker {
	protected getSupportedLanguages(): string[] {
		return ["typescript", "javascript", "tsx", "jsx"]
	}

	protected getDefaultChunkSize(): number {
		return 1500
	}

	/**
	 * Extract chunks from TypeScript/JavaScript content
	 * Uses regex patterns to identify function/class definitions
	 */
	override extractChunks(content: string, maxSize: number): Chunk[] {
		const chunks: Chunk[] = []
		const lines = content.split("\n")
		let currentChunkLines: string[] = []
		let currentChunkStart = 0
		let currentIdentifier: string | null = null
		let currentChunkType = "global"

		// Pattern to match function/class declarations
		const functionPattern =
			/^(export\s+)?(async\s+)?function\s+(\w+)|^(export\s+)?(async\s+)?const\s+(\w+)\s*=\s*(async\s+)?(\([^)]*\)|[^=]+)\s*=>/

		const classPattern = /^(export\s+)?class\s+(\w+)/
		const arrowFunctionPattern = /^(export\s+)?(async\s+)?const\s+(\w+)\s*=\s*(async\s+)?(\([^)]*\)|[^=]+)\s*=>/

		const methodPattern = /^\s*(public|private|protected)?\s*(static\s+)?(async\s+)?(\w+)\s*\([^)]*\)\s*\{/

		// Track structure changes
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]
			const trimmedLine = line.trim()

			// Check for new function/class definitions at the top level
			const isFunctionDef = functionPattern.test(trimmedLine) || arrowFunctionPattern.test(trimmedLine)
			const isClassDef = classPattern.test(trimmedLine)
			const isMethodDef = methodPattern.test(trimmedLine)

			const isTopLevelDeclaration = isFunctionDef || isClassDef
			const isNewDefinition = !isMethodDef && isTopLevelDeclaration

			// Extract identifier if this is a new definition
			if (isNewDefinition) {
				const identifierMatch = trimmedLine.match(/function\s+(\w+)|class\s+(\w+)|const\s+(\w+)\s*=/)
				if (identifierMatch) {
					currentIdentifier = identifierMatch[1] || identifierMatch[2] || identifierMatch[3]
				}

				if (isClassDef) {
					currentChunkType = "class"
				} else {
					currentChunkType = "function"
				}
			}

			currentChunkLines.push(line)

			// Check if we need to split the chunk
			const currentChunkText = currentChunkLines.join("\n")

			if (currentChunkText.length > maxSize && currentChunkLines.length > 1) {
				// Find a good split point (prefer at empty lines or statements)
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
						"typescript",
					),
				)

				// Start new chunk from the split point
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
						"typescript",
					),
				)
			}
		}

		// If no chunks were created (file is small), create a single chunk
		if (chunks.length === 0 && content.length > 0) {
			chunks.push(this.createChunk(content, 1, lines.length, "file", null, "typescript"))
		}

		return chunks
	}
}

/**
 * Singleton instance of TypeScriptChunker
 */
export const typescriptChunker = new TypeScriptChunker()
