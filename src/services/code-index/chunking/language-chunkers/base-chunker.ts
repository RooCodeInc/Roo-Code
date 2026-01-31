import { LanguageChunker, Chunk } from "../../interfaces/chunking"

/**
 * Base class for language-specific chunkers providing common functionality
 */
export abstract class BaseLanguageChunker implements LanguageChunker {
	/**
	 * Get the supported languages for this chunker
	 */
	protected abstract getSupportedLanguages(): string[]

	/**
	 * Get the default optimal chunk size for this language family
	 */
	protected abstract getDefaultChunkSize(): number

	canChunk(language: string): boolean {
		return this.getSupportedLanguages().includes(language.toLowerCase())
	}

	chunk(content: string, maxSize: number): string[] {
		const chunks = this.extractChunks(content, maxSize)
		return chunks.map((chunk) => chunk.content)
	}

	getOptimalChunkSize(language: string): number {
		if (this.canChunk(language)) {
			return this.getDefaultChunkSize()
		}
		return 1500 // Default fallback size
	}

	extractChunks(content: string, maxSize: number): Chunk[] {
		return []
	}

	/**
	 * Calculate the number of tokens in content (rough estimate)
	 * This is a simple estimate - for more accurate results, use a tokenizer
	 */
	protected estimateTokens(content: string): number {
		return content.split(/\s+/).filter((word) => word.length > 0).length
	}

	/**
	 * Check if content exceeds the max size
	 */
	protected exceedsMaxSize(content: string, maxSize: number): boolean {
		return content.length > maxSize
	}

	/**
	 * Split content by a delimiter while respecting max size
	 */
	protected splitByDelimiter(content: string, delimiter: RegExp, maxSize: number, minSize: number): string[] {
		const result: string[] = []
		let currentChunk = ""

		const parts = content.split(delimiter)

		for (const part of parts) {
			const testChunk = currentChunk ? `${currentChunk}${part}` : part

			if (testChunk.length > maxSize && currentChunk.length >= minSize) {
				result.push(currentChunk)
				currentChunk = part
			} else {
				currentChunk = testChunk
			}
		}

		if (currentChunk) {
			result.push(currentChunk)
		}

		return result
	}

	/**
	 * Create a chunk object from content and metadata
	 */
	protected createChunk(
		content: string,
		startLine: number,
		endLine: number,
		chunkType: string,
		identifier: string | null,
		language: string,
	): Chunk {
		return {
			content,
			startLine,
			endLine,
			chunkType,
			identifier,
			language,
		}
	}
}
