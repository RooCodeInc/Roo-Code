import * as vscode from "vscode"

/**
 * Dedicated TextDocumentContentProvider for Files Changed Overview (FCO) diff viewing.
 * Eliminates base64 encoding in query strings by storing content in memory and serving it on-demand.
 */
export class FcoTextDocumentContentProvider implements vscode.TextDocumentContentProvider {
	private contentStore = new Map<string, string>()
	private fileToUriMapping = new Map<string, { beforeUri: string; afterUri: string }>()
	private static instance: FcoTextDocumentContentProvider

	private normalizeKey(rawKey: string): string {
		return rawKey.startsWith("/") ? rawKey.slice(1) : rawKey
	}

	static getInstance(): FcoTextDocumentContentProvider {
		if (!this.instance) {
			this.instance = new FcoTextDocumentContentProvider()
		}
		return this.instance
	}

	/**
	 * Provides text document content for FCO diff URIs.
	 * Called by VS Code when it needs the actual content for a URI.
	 */
	provideTextDocumentContent(uri: vscode.Uri): string {
		const key = this.normalizeKey(uri.path)
		const content = this.contentStore.get(key)
		if (!content) {
			return ""
		}
		return content
	}

	/**
	 * Stores before/after content for a diff session and returns clean URIs.
	 * Uses content-based stable IDs to prevent duplicate diffs for same content.
	 * No base64 encoding - content is stored in memory and served on-demand.
	 */
	storeDiffContent(
		beforeContent: string,
		afterContent: string,
		filePath?: string,
	): { beforeUri: string; afterUri: string } {
		// Create stable ID based on file path and content hash to prevent duplicates
		const contentHash = this.hashContent(beforeContent + afterContent + (filePath || ""))
		const beforeKey = this.normalizeKey(`before-${contentHash}`)
		const afterKey = this.normalizeKey(`after-${contentHash}`)

		// Check if already exists - reuse existing URIs to prevent duplicate diffs
		if (this.contentStore.has(beforeKey)) {
			const beforeUri = `fco-diff:${beforeKey}`
			const afterUri = `fco-diff:${afterKey}`

			// Update file mapping in case filePath changed
			if (filePath) {
				this.fileToUriMapping.set(filePath, { beforeUri, afterUri })
			}

			return { beforeUri, afterUri }
		}

		// Store new content in memory
		this.contentStore.set(beforeKey, beforeContent)
		this.contentStore.set(afterKey, afterContent)

		// Return clean URIs without any base64 content
		const beforeUri = `fco-diff:${beforeKey}`
		const afterUri = `fco-diff:${afterKey}`

		// Track file path to URI mapping for cleanup
		if (filePath) {
			this.fileToUriMapping.set(filePath, { beforeUri, afterUri })
		}

		return { beforeUri, afterUri }
	}

	/**
	 * Get URIs for a specific file path (for diff tab management)
	 */
	getUrisForFile(filePath: string): { beforeUri: string; afterUri: string } | undefined {
		return this.fileToUriMapping.get(filePath)
	}

	/**
	 * Clean up all content associated with a specific file path
	 */
	cleanupFile(filePath: string): void {
		const uris = this.fileToUriMapping.get(filePath)
		if (uris) {
			this.cleanup([uris.beforeUri, uris.afterUri])
			this.fileToUriMapping.delete(filePath)
		}
	}

	/**
	 * Cleanup stored content to prevent memory leaks.
	 * Should be called when diff tabs are closed.
	 */
	cleanup(uris: string[]): void {
		uris.forEach((uri) => {
			const key = this.normalizeKey(uri.replace("fco-diff:", ""))
			this.contentStore.delete(key)
		})
	}

	/**
	 * Create a stable hash from content for consistent IDs
	 */
	private hashContent(content: string): string {
		// Simple hash for stable IDs - ensures same content gets same ID
		let hash = 0
		for (let i = 0; i < content.length; i++) {
			const char = content.charCodeAt(i)
			hash = (hash << 5) - hash + char
			hash = hash & hash // Convert to 32-bit integer
		}
		return Math.abs(hash).toString(36)
	}

	/**
	 * Get total number of stored content items (for debugging/monitoring)
	 */
	getStoredContentCount(): number {
		return this.contentStore.size
	}

	/**
	 * Clear all stored content (for testing or cleanup)
	 */
	clearAll(): void {
		this.contentStore.clear()
		this.fileToUriMapping.clear()
	}

	/**
	 * Register a listener to automatically clean up content when diff documents are closed.
	 * Should be called during extension activation.
	 */
	registerCloseListener(): vscode.Disposable {
		return vscode.workspace.onDidCloseTextDocument((document) => {
			// Only handle fco-diff scheme documents
			if (document.uri.scheme === "fco-diff") {
				this.cleanupByUri(document.uri.toString())
			}
		})
	}

	/**
	 * Clean up content for a specific URI.
	 * Called when a diff document is closed to prevent memory leaks.
	 */
	private cleanupByUri(uriString: string): void {
		const key = this.normalizeKey(uriString.replace("fco-diff:", ""))
		this.contentStore.delete(key)

		// Also clean up any file mappings that reference this URI
		for (const [filePath, uris] of this.fileToUriMapping.entries()) {
			if (uris.beforeUri === uriString || uris.afterUri === uriString) {
				// If both before and after URIs are being removed, delete the mapping
				const beforeKey = uris.beforeUri.replace("fco-diff:", "")
				const afterKey = uris.afterUri.replace("fco-diff:", "")

				if (!this.contentStore.has(beforeKey) && !this.contentStore.has(afterKey)) {
					this.fileToUriMapping.delete(filePath)
				}
				break
			}
		}
	}
}
