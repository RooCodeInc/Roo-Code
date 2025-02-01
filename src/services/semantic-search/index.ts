import {
	CodeDefinition,
	convertSegmentToDefinition,
	SearchResult,
	SearchResultType,
	FileSearchResult,
	CodeSearchResult,
} from "./types"
import * as path from "path"
import * as vscode from "vscode"
import { TreeSitterParser } from "./parser/tree-sitter"
import { LanceDBVectorStore } from "./vector-store/lancedb"
import { StoreSearchResult } from "./vector-store/types"
import * as crypto from "crypto"
import { ApiHandler } from "../../api"
import { OpenAiNativeHandler } from "../../api/providers/openai-native"
import { isTextFile, isCodeFile } from "./utils/file-utils"

export interface SemanticSearchConfig {
	/**
	 * Directory to store model files and cache
	 */
	storageDir: string

	/**
	 * Maximum number of results to return
	 */
	maxResults?: number

	/**
	 * Context for storage and paths
	 */
	context: vscode.ExtensionContext
}

export enum WorkspaceIndexStatus {
	NotIndexed = "Not indexed",
	Indexing = "Indexing",
	Indexed = "Indexed",
}

export class SemanticSearchService {
	// Maximum size for text files (2MB)
	private static readonly MAX_TEXT_FILE_SIZE = 2 * 1024 * 1024

	private statuses = new Map<string, WorkspaceIndexStatus>()
	private store!: LanceDBVectorStore
	private initialized = false
	private initializationError: Error | null = null
	private parser: TreeSitterParser
	private config: SemanticSearchConfig
	private apiHandler?: ApiHandler
	private embeddingHandler?: OpenAiNativeHandler

	constructor(config: SemanticSearchConfig, apiHandler?: ApiHandler) {
		this.config = config
		this.parser = new TreeSitterParser(config.context.extensionPath)
		this.apiHandler = apiHandler

		// Initialize core components in constructor
		const workspaceId = this.getWorkspaceId(config.context)
		this.store = new LanceDBVectorStore(path.join(config.storageDir, "lancedb"), workspaceId)

		// Set initial status
		this.updateStatus(WorkspaceIndexStatus.NotIndexed)
	}

	private getWorkspaceId(context: vscode.ExtensionContext): string {
		// Use the workspace folder path as the ID
		const workspaceFolders = vscode.workspace.workspaceFolders
		if (workspaceFolders && workspaceFolders.length > 0) {
			return workspaceFolders[0].uri.fsPath
		}
		// Fallback to extension context storage path
		return context.storagePath || "global"
	}

	public updateStatus(status: WorkspaceIndexStatus): void {
		const workspaceId = this.getWorkspaceId(this.config.context)
		this.statuses.set(workspaceId, status)
	}

	public getStatus(): WorkspaceIndexStatus {
		const workspaceId = this.getWorkspaceId(this.config.context)
		return this.statuses.get(workspaceId) || WorkspaceIndexStatus.NotIndexed
	}

	/**
	 * Initializes workspace-specific resources including:
	 * 1. Creating the vector store table if it doesn't exist
	 * 2. Loading existing vectors
	 * 3. Updating workspace status
	 */
	private async initializeWorkspace(): Promise<void> {
		if (this.initialized) return
		if (this.initializationError) throw this.initializationError
		if (!this.store) throw new Error("Vector store not initialized")

		this.updateStatus(WorkspaceIndexStatus.Indexing)

		try {
			await this.store.initialize()

			if (this.store.size() === 0) {
				this.updateStatus(WorkspaceIndexStatus.NotIndexed)
			} else {
				this.updateStatus(WorkspaceIndexStatus.Indexed)
			}

			this.initialized = true
			console.log("Workspace initialized")
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			console.error("Workspace initialization failed:", errorMessage)
			this.updateStatus(WorkspaceIndexStatus.NotIndexed)
			this.initializationError = error instanceof Error ? error : new Error(errorMessage)
			this.initialized = false
			throw error
		}
	}

	private async processFileWithHash(filePath: string): Promise<void> {
		try {
			// Check if path is a directory
			const stat = await vscode.workspace.fs.stat(vscode.Uri.file(filePath))
			if (stat.type === vscode.FileType.Directory) {
				console.log(`Skipping directory: ${filePath}`)
				return
			}

			// First check if it's a supported code file
			const isCode = await SemanticSearchService.isCodeFile(filePath)

			// For non-code files, verify they're valid text files
			if (!isCode && !(await isTextFile(filePath, SemanticSearchService.MAX_TEXT_FILE_SIZE))) {
				console.log("Skipping non-code file", filePath, "Unsupported file type")
				return
			}

			const fileContent = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath))
			const textContent = new TextDecoder().decode(fileContent)

			// Create hash of file content
			const hash = crypto.createHash("sha256").update(textContent).digest("hex")

			// Check if file exists in DB and get its hash
			const { exists: hasExisting, hash: prevHash } = await this.store.hasFileSegments(filePath)

			// If hash matches and has existing segments, skip entirely
			if (hasExisting && hash === prevHash) {
				console.log(`Skipping unchanged file: ${filePath}`)
				return
			}

			// Delete old segments if needed
			if (hasExisting) {
				console.log(`File ${filePath} changed, deleting old segments`)
				await this.store.deleteByFilePath(filePath)
			}

			// Only process if we passed the checks
			console.log("Processing file", filePath, "Is code file?", isCode)
			if (isCode) {
				const parsedFile = await this.parser.parseFile(filePath, hash)
				console.log("Parsed file", parsedFile)
				if (!parsedFile) {
					console.error("Failed to parse file", filePath)
					return
				}

				// Check if we got any segments from parsing
				if (parsedFile.segments.length === 0) {
					console.log(`No code segments found in ${filePath}, falling back to text processing`)
					// Process as text file since no code segments were found
					const chunks = SemanticSearchService.chunkText(textContent)
					for (const [index, chunk] of chunks.entries()) {
						const definition: CodeDefinition = {
							type: "file",
							name: `${path.basename(filePath)} #${index + 1}`,
							filePath: filePath,
							content: chunk,
							startLine: 1 + index * 100, // Approximate line numbers
							endLine: 1 + (index + 1) * 100,
							language: path.extname(filePath).slice(1) || "text",
							contentHash: hash,
						}
						await this.indexDefinition(definition)
					}
				} else {
					// Process normally if we have code segments
					for (const segment of parsedFile.segments) {
						const definition = {
							...convertSegmentToDefinition(segment, filePath),
							contentHash: hash,
						}
						await this.indexDefinition(definition)
					}
				}
			} else {
				const chunks = SemanticSearchService.chunkText(textContent)
				for (const [index, chunk] of chunks.entries()) {
					const definition: CodeDefinition = {
						type: "file",
						name: `${path.basename(filePath)} #${index + 1}`,
						filePath: filePath,
						content: chunk,
						startLine: 1 + index * 100, // Approximate line numbers
						endLine: 1 + (index + 1) * 100,
						language: path.extname(filePath).slice(1) || "text",
						contentHash: hash,
					}
					await this.indexDefinition(definition)
				}
			}
		} catch (error) {
			if (error instanceof Error && error.message.includes("binary")) {
				console.log(`Skipping binary file: ${filePath}`)
				return
			}
			console.error(`Error processing file ${filePath}:`, error)
		}
	}

	async addToIndex(filePath: string): Promise<void> {
		await this.initializeWorkspace()
		await this.processFileWithHash(filePath)
	}

	async addBatchToIndex(filePaths: string[]): Promise<void> {
		await this.initializeWorkspace()
		this.updateStatus(WorkspaceIndexStatus.Indexing)

		try {
			for (const filePath of filePaths) {
				await this.processFileWithHash(filePath)
			}
			this.updateStatus(WorkspaceIndexStatus.Indexed)
		} catch (error) {
			this.updateStatus(WorkspaceIndexStatus.NotIndexed)
			throw error
		}
	}

	// Helper method to get the appropriate handler for embeddings
	private getEmbeddingHandler(): ApiHandler {
		// If we have a dedicated embedding handler, use it
		if (this.embeddingHandler) {
			return this.embeddingHandler
		}
		// Otherwise fall back to the main API handler if it's OpenAI Native
		if (this.apiHandler && this.apiHandler instanceof OpenAiNativeHandler) {
			return this.apiHandler
		}
		throw new Error(
			"No compatible embedding handler available. Please configure OpenAI Native API key for semantic search.",
		)
	}

	// Helper method to index a single definition
	private async indexDefinition(definition: CodeDefinition): Promise<void> {
		const handler = this.getEmbeddingHandler()
		if (!handler.embedText) {
			throw new Error("Embeddings not supported with current API configuration")
		}

		// Split long content into chunks
		const maxLength = 32000 // ~8000 tokens at 4 chars/token
		const chunks =
			definition.type === "file"
				? SemanticSearchService.chunkText(definition.content)
				: SemanticSearchService.chunkCodeContent(definition.content, maxLength)

		for (const [index, chunk] of chunks.entries()) {
			const lineCount = chunk.split("\n").length
			const chunkDefinition: CodeDefinition = {
				...definition,
				name: `${definition.name} [part ${index + 1}]`,
				content: chunk,
				startLine: definition.startLine + index * lineCount,
				endLine: definition.startLine + (index + 1) * lineCount - 1,
			}

			const embedding = await handler.embedText(chunkDefinition.content)
			await this.store.add(chunkDefinition, embedding)
		}
	}

	async search(query: string): Promise<SearchResult[]> {
		const handler = this.getEmbeddingHandler()
		if (!handler.embedText) {
			throw new Error("Embeddings not supported with current API configuration")
		}

		const queryEmbedding = await handler.embedText(query)
		await this.initializeWorkspace()

		const results = await this.store.search(
			queryEmbedding,
			this.config.maxResults ? this.config.maxResults * 2 : 20,
		)

		const dedupedResults = this.deduplicateResults(results)
		const maxResults = this.config.maxResults ?? 10
		const finalResults: StoreSearchResult[] = []

		const codeResults = dedupedResults.filter((r) => r.metadata?.type !== "file")
		const fileResults = dedupedResults.filter((r) => r.metadata?.type === "file")

		for (const result of codeResults) {
			if (finalResults.length >= maxResults) break
			finalResults.push(result)
		}

		for (const result of fileResults) {
			if (finalResults.length >= maxResults) break
			finalResults.push(result)
		}

		return finalResults.slice(0, maxResults).map((r) => this.formatResult(r))
	}

	private formatResult(result: StoreSearchResult): SearchResult {
		if (!result.metadata || !result.metadata.filePath) {
			throw new Error("Invalid metadata in search result")
		}

		if (result.metadata.type === SearchResultType.File) {
			const { content, ...restMetadata } = result.metadata
			return {
				type: SearchResultType.File,
				filePath: result.metadata.filePath,
				name: result.metadata.name,
				metadata: restMetadata,
			} as FileSearchResult
		}

		return {
			type: SearchResultType.Code,
			filePath: result.metadata.filePath,
			content: result.metadata.content,
			startLine: result.metadata.startLine,
			endLine: result.metadata.endLine,
			name: result.metadata.name,
			codeType: result.metadata.type,
			metadata: result.metadata,
		} as CodeSearchResult
	}

	private deduplicateResults(results: StoreSearchResult[]): StoreSearchResult[] {
		const dedupedResults: StoreSearchResult[] = []
		const seenPaths = new Set<string>()
		const seenContent = new Set<string>()
		for (const result of results) {
			const filePath = result.metadata.filePath
			if (!filePath) continue

			if (result.metadata.type === SearchResultType.File) {
				if (!seenPaths.has(filePath)) {
					dedupedResults.push(result)
					seenPaths.add(filePath)
				}
			} else {
				if (!seenContent.has(result.metadata.content)) {
					dedupedResults.push(result)
					seenContent.add(result.metadata.content)
				}
			}
		}

		return dedupedResults
	}

	size(): number {
		if (!this.store) {
			throw new Error("Vector store not initialized")
		}
		return 0
	}

	provideApiHandler(apiHandler: ApiHandler) {
		this.apiHandler = apiHandler
		// If we don't have a dedicated embedding handler and this is an OpenAI Native handler,
		// we'll use it for embeddings
		if (!this.embeddingHandler && apiHandler instanceof OpenAiNativeHandler) {
			this.updateStatus(WorkspaceIndexStatus.NotIndexed) // Reset status since handler changed
		}
	}

	clear(): void {
		this.store.clear()
		this.updateStatus(WorkspaceIndexStatus.NotIndexed)
	}

	private static chunkText(text: string, maxChunkSize: number = 8000): string[] {
		const chunks: string[] = []
		const paragraphs = text.split("\n\n")
		let currentChunk: string[] = []
		let currentLength = 0

		for (const paragraph of paragraphs) {
			if (currentLength + paragraph.length > maxChunkSize) {
				if (currentChunk.length > 0) {
					chunks.push(currentChunk.join("\n\n"))
					currentChunk = []
					currentLength = 0
				}
				// Handle very long paragraphs by splitting into sentences
				if (paragraph.length > maxChunkSize) {
					const sentences = paragraph.split(/[.!?]\s+/)
					for (const sentence of sentences) {
						if (currentLength + sentence.length > maxChunkSize) {
							chunks.push(sentence.substring(0, maxChunkSize))
							currentLength = 0
						} else {
							currentChunk.push(sentence)
							currentLength += sentence.length
						}
					}
				} else {
					chunks.push(paragraph)
				}
			} else {
				currentChunk.push(paragraph)
				currentLength += paragraph.length + 2 // Account for newlines
			}
		}

		if (currentChunk.length > 0) {
			chunks.push(currentChunk.join("\n\n"))
		}

		return chunks
	}

	private static chunkCodeContent(content: string, maxChunkSize: number = 32000): string[] {
		const chunks: string[] = []
		const lines = content.split("\n")
		let currentChunk: string[] = []
		let currentLength = 0

		for (const line of lines) {
			if (currentLength + line.length > maxChunkSize) {
				// Try to find a natural split point in the last 10 lines
				let splitIndex = currentChunk.length - 1
				for (let i = currentChunk.length - 1; i >= Math.max(0, currentChunk.length - 10); i--) {
					if (/[;}]$/.test(currentChunk[i]) || currentChunk[i].trim() === "") {
						splitIndex = i + 1
						break
					}
				}

				chunks.push(currentChunk.slice(0, splitIndex).join("\n"))
				currentChunk = currentChunk.slice(splitIndex)
				currentLength = currentChunk.join("\n").length
			}

			currentChunk.push(line)
			currentLength += line.length + 1 // +1 for newline
		}

		if (currentChunk.length > 0) {
			chunks.push(currentChunk.join("\n"))
		}

		return chunks
	}

	private static async isCodeFile(filePath: string): Promise<boolean> {
		return isCodeFile(filePath)
	}
}
