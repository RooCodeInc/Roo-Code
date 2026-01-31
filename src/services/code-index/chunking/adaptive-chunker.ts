import { createHash } from "crypto"
import { ChunkingConfig, Chunk, LanguageChunker } from "../interfaces/chunking"
import { DEFAULT_CHUNKING_CONFIG } from "../interfaces/chunking"
import { typescriptChunker } from "./language-chunkers/typescript-chunker"
import { pythonChunker } from "./language-chunkers/python-chunker"
import { javaChunker } from "./language-chunkers/java-chunker"
import { goChunker } from "./language-chunkers/go-chunker"
import { rustChunker } from "./language-chunkers/rust-chunker"
import { genericChunker } from "./language-chunkers/generic-chunker"
import { CodeBlock } from "../interfaces"

/**
 * AdaptiveChunker - Main class for adaptive code chunking
 * Orchestrates language-specific chunkers to produce semantic chunks
 */
export class AdaptiveChunker {
	private config: ChunkingConfig
	private chunkers: Map<string, LanguageChunker> = new Map()

	/**
	 * Create a new AdaptiveChunker instance
	 * @param config Optional configuration, uses defaults if not provided
	 */
	constructor(config?: Partial<ChunkingConfig>) {
		this.config = { ...DEFAULT_CHUNKING_CONFIG, ...config }
		this.registerChunkers()
	}

	/**
	 * Register all language-specific chunkers
	 */
	private registerChunkers(): void {
		// Register language-specific chunkers
		this.chunkers.set("typescript", typescriptChunker)
		this.chunkers.set("javascript", typescriptChunker)
		this.chunkers.set("tsx", typescriptChunker)
		this.chunkers.set("jsx", typescriptChunker)
		this.chunkers.set("python", pythonChunker)
		this.chunkers.set("py", pythonChunker)
		this.chunkers.set("java", javaChunker)
		this.chunkers.set("go", goChunker)
		this.chunkers.set("rust", rustChunker)
		this.chunkers.set("rs", rustChunker)
	}

	/**
	 * Get the chunker for a specific language
	 * @param language The programming language
	 * @returns The appropriate LanguageChunker
	 */
	private getChunker(language: string): LanguageChunker {
		const normalizedLang = language.toLowerCase()
		return this.chunkers.get(normalizedLang) || genericChunker
	}

	/**
	 * Chunk a file's content into semantic chunks
	 * @param content The file content to chunk
	 * @param language The programming language
	 * @param filePath Optional file path for metadata
	 * @param fileHash Optional file hash for deduplication
	 * @returns Array of CodeBlock objects
	 */
	chunkFile(content: string, language: string, filePath?: string, fileHash?: string): CodeBlock[] {
		if (!this.config.enabled) {
			return []
		}

		const lang = language.toLowerCase()
		const chunker = this.getChunker(lang)
		const maxSize = this.getMaxSizeForLanguage(lang)

		const chunks = chunker.chunk(content, maxSize)

		return this.convertToCodeBlocks(chunks, lang, filePath || "", fileHash || "")
	}

	/**
	 * Chunk content and return Chunk objects
	 * @param content The content to chunk
	 * @param language The programming language
	 * @returns Array of Chunk objects
	 */
	chunkContent(content: string, language: string): Chunk[] {
		if (!this.config.enabled) {
			return []
		}

		const lang = language.toLowerCase()
		const chunker = this.getChunker(lang)
		const maxSize = this.getMaxSizeForLanguage(lang)

		return chunker.extractChunks(content, maxSize)
	}

	/**
	 * Get the maximum chunk size for a specific language
	 * @param language The programming language
	 * @returns Maximum chunk size in characters
	 */
	private getMaxSizeForLanguage(language: string): number {
		const normalizedLang = language.toLowerCase()
		const override = this.config.languageOverrides[normalizedLang]

		if (override) {
			return override.maxSize
		}

		const chunker = this.chunkers.get(normalizedLang)
		if (chunker) {
			return chunker.getOptimalChunkSize(normalizedLang)
		}

		return this.config.maxChunkSize
	}

	/**
	 * Convert chunk strings to CodeBlock objects
	 */
	private convertToCodeBlocks(chunks: string[], language: string, filePath: string, fileHash: string): CodeBlock[] {
		const results: CodeBlock[] = []

		for (const chunkContent of chunks) {
			if (chunkContent.length < this.config.minChunkSize) {
				continue
			}

			const lines = chunkContent.split("\n")
			const startLine = 1 // Chunks are 1-indexed
			const endLine = lines.length

			const contentPreview = chunkContent.slice(0, 100)
			const segmentHash = createHash("sha256")
				.update(`${filePath}-${startLine}-${endLine}-${chunkContent.length}-${contentPreview}`)
				.digest("hex")

			results.push({
				file_path: filePath,
				identifier: null,
				type: "chunk",
				start_line: startLine,
				end_line: endLine,
				content: chunkContent,
				segmentHash,
				fileHash,
			})
		}

		return results
	}

	/**
	 * Update the chunking configuration
	 * @param config New configuration options
	 */
	updateConfig(config: Partial<ChunkingConfig>): void {
		this.config = { ...this.config, ...config }
	}

	/**
	 * Get the current configuration
	 * @returns Current ChunkingConfig
	 */
	getConfig(): ChunkingConfig {
		return { ...this.config }
	}

	/**
	 * Check if adaptive chunking is enabled
	 * @returns True if enabled
	 */
	isEnabled(): boolean {
		return this.config.enabled
	}

	/**
	 * Enable or disable adaptive chunking
	 * @param enabled New enabled state
	 */
	setEnabled(enabled: boolean): void {
		this.config.enabled = enabled
	}
}

/**
 * Singleton instance of AdaptiveChunker with default config
 */
export const adaptiveChunker = new AdaptiveChunker()
