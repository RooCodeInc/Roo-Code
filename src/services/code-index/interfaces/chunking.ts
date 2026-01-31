/**
 * Configuration interface for adaptive chunking
 */
export interface ChunkingConfig {
	/** Feature flag to enable/disable adaptive chunking */
	enabled: boolean

	/** Chunking strategy to use */
	strategy: "syntactic" | "semantic" | "balanced"

	/** Maximum chunk size in characters */
	maxChunkSize: number

	/** Minimum chunk size in characters */
	minChunkSize: number

	/** Overlap size between chunks in characters */
	overlapSize: number

	/** Language-specific overrides */
	languageOverrides: {
		[language: string]: {
			/** What to chunk by for this language */
			chunkBy: "function" | "class" | "file" | "statement"
			/** Maximum size for chunks of this language */
			maxSize: number
		}
	}
}

/**
 * Language chunker interface for language-specific chunking strategies
 */
export interface LanguageChunker {
	/** Check if this chunker can handle the given language */
	canChunk(language: string): boolean

	/** Chunk content according to language-specific rules */
	chunk(content: string, maxSize: number): string[]

	/** Extract detailed chunks with metadata */
	extractChunks(content: string, maxSize: number): Chunk[]

	/** Get the optimal chunk size for this language */
	getOptimalChunkSize(language: string): number
}

/**
 * A single chunk result
 */
export interface Chunk {
	/** The content of the chunk */
	content: string

	/** The start line number (1-based) */
	startLine: number

	/** The end line number (1-based) */
	endLine: number

	/** The type of chunk (e.g., "function", "class", "statement") */
	chunkType: string

	/** The identifier/name if available */
	identifier: string | null

	/** Language of the chunk */
	language: string
}

/**
 * Default chunking configuration
 */
export const DEFAULT_CHUNKING_CONFIG: ChunkingConfig = {
	enabled: false,
	strategy: "balanced",
	maxChunkSize: 2000,
	minChunkSize: 200,
	overlapSize: 200,
	languageOverrides: {
		typescript: {
			chunkBy: "function",
			maxSize: 1500,
		},
		javascript: {
			chunkBy: "function",
			maxSize: 1500,
		},
		python: {
			chunkBy: "function",
			maxSize: 1500,
		},
		java: {
			chunkBy: "function",
			maxSize: 2000,
		},
		go: {
			chunkBy: "function",
			maxSize: 1500,
		},
		rust: {
			chunkBy: "function",
			maxSize: 1500,
		},
	},
}
