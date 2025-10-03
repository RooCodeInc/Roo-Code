import Anthropic from "@anthropic-ai/sdk"
import crypto from "crypto"

/**
 * Metadata for a file read operation
 */
export interface FileReadMetadata {
	path: string
	content: string
	contentHash: string
	timestamp: number
	messageIndex: number
	blockIndex: number
}

/**
 * Result of file deduplication analysis
 */
export interface DeduplicationResult {
	originalMessages: Anthropic.MessageParam[]
	deduplicatedMessages: Anthropic.MessageParam[]
	duplicateCount: number
	uniqueFiles: Set<string>
	tokensBeforeDedup: number
	tokensAfterDedup: number
	reductionPercent: number
}

/**
 * FileDeduplicator identifies and removes duplicate file content blocks
 * in conversation messages, replacing them with references to the first occurrence.
 *
 * Strategy:
 * - Hash-based detection for exact duplicates
 * - Path-based grouping for same file reads
 * - Keep only the most recent version per file
 * - Replace earlier reads with lightweight references
 */
export class FileDeduplicator {
	/**
	 * Deduplicate file content in messages
	 */
	deduplicate(messages: Anthropic.MessageParam[]): DeduplicationResult {
		// Extract all file reads with metadata
		const fileReads = this.extractFileReads(messages)

		// Find duplicates by content hash
		const duplicateMap = this.findDuplicates(fileReads)

		// Calculate token estimates
		const tokensBeforeDedup = this.estimateTotalTokens(fileReads)
		const tokensAfterDedup = this.estimateTokensAfterDedup(fileReads, duplicateMap)

		// Apply deduplication to messages
		const deduplicatedMessages = this.applyDeduplication(messages, fileReads, duplicateMap)

		const uniqueFiles = new Set(
			Array.from(duplicateMap.values())
				.flat()
				.map((fr) => fr.path),
		)

		return {
			originalMessages: messages,
			deduplicatedMessages,
			duplicateCount: duplicateMap.size,
			uniqueFiles,
			tokensBeforeDedup,
			tokensAfterDedup,
			reductionPercent:
				tokensBeforeDedup > 0 ? ((tokensBeforeDedup - tokensAfterDedup) / tokensBeforeDedup) * 100 : 0,
		}
	}

	/**
	 * Extract file read operations from messages
	 */
	private extractFileReads(messages: Anthropic.MessageParam[]): FileReadMetadata[] {
		const fileReads: FileReadMetadata[] = []

		messages.forEach((message, msgIndex) => {
			if (typeof message.content === "string") {
				return
			}

			message.content.forEach((block, blockIndex) => {
				if (block.type === "text") {
					const fileContent = this.extractFileContentFromText(block.text)
					if (fileContent) {
						fileReads.push({
							path: fileContent.path,
							content: fileContent.content,
							contentHash: this.hashContent(fileContent.content),
							timestamp: Date.now(), // In real scenario, would use message timestamp
							messageIndex: msgIndex,
							blockIndex,
						})
					}
				}
			})
		})

		return fileReads
	}

	/**
	 * Extract file content from text block
	 * Looks for patterns like "File: path/to/file\n<content>"
	 */
	private extractFileContentFromText(text: string): { path: string; content: string } | null {
		// Pattern 1: Tool result format with line numbers "1 | content"
		const toolResultPattern = /(?:File|Path):\s*(.+?)\n((?:\d+\s*\|.+\n?)+)/s
		let match = text.match(toolResultPattern)

		if (match) {
			return {
				path: match[1].trim(),
				content: match[0], // Include the whole "File: path\n<content>" for accurate token count
			}
		}

		// Pattern 2: Simple format "File: path\n<content>" without line numbers
		const simplePattern = /(?:File|Path):\s*(.+?)\n([\s\S]+?)(?:\n\n|$)/
		match = text.match(simplePattern)

		if (match) {
			return {
				path: match[1].trim(),
				content: match[0], // Include the whole "File: path\n<content>" for accurate token count
			}
		}

		return null
	}

	/**
	 * Find duplicate file reads by content hash
	 */
	private findDuplicates(fileReads: FileReadMetadata[]): Map<string, FileReadMetadata[]> {
		const hashMap = new Map<string, FileReadMetadata[]>()

		// Group by content hash
		fileReads.forEach((fileRead) => {
			const existing = hashMap.get(fileRead.contentHash) || []
			existing.push(fileRead)
			hashMap.set(fileRead.contentHash, existing)
		})

		// Keep only actual duplicates (>1 occurrence)
		const duplicates = new Map<string, FileReadMetadata[]>()
		hashMap.forEach((reads, hash) => {
			if (reads.length > 1) {
				// Sort by message index to keep the most recent (last occurrence)
				reads.sort((a, b) => b.messageIndex - a.messageIndex)
				duplicates.set(hash, reads)
			}
		})

		return duplicates
	}

	/**
	 * Hash content for duplicate detection
	 */
	private hashContent(content: string): string {
		return crypto.createHash("sha256").update(content).digest("hex")
	}

	/**
	 * Estimate total tokens before deduplication
	 */
	private estimateTotalTokens(fileReads: FileReadMetadata[]): number {
		return fileReads.reduce((sum, fr) => sum + this.estimateTokens(fr.content), 0)
	}

	/**
	 * Estimate tokens after deduplication
	 */
	private estimateTokensAfterDedup(
		fileReads: FileReadMetadata[],
		duplicateMap: Map<string, FileReadMetadata[]>,
	): number {
		let total = 0

		// Count unique content (kept)
		const uniqueHashes = new Set<string>()
		fileReads.forEach((fr) => {
			if (!uniqueHashes.has(fr.contentHash)) {
				total += this.estimateTokens(fr.content)
				uniqueHashes.add(fr.contentHash)
			}
		})

		// Add reference overhead (~10 tokens per reference)
		duplicateMap.forEach((reads) => {
			// First occurrence is kept, others become references
			total += (reads.length - 1) * 10
		})

		return total
	}

	/**
	 * Estimate tokens (rough: 4 chars ≈ 1 token)
	 */
	private estimateTokens(content: string): number {
		return Math.ceil(content.length / 4)
	}

	/**
	 * Apply deduplication to messages
	 */
	private applyDeduplication(
		messages: Anthropic.MessageParam[],
		fileReads: FileReadMetadata[],
		duplicateMap: Map<string, FileReadMetadata[]>,
	): Anthropic.MessageParam[] {
		// Build a map of (messageIndex, blockIndex) -> replacement text
		const replacementMap = new Map<string, string>()

		duplicateMap.forEach((reads) => {
			// Keep the most recent (first in sorted array), replace others
			const mostRecent = reads[0]
			for (let i = 1; i < reads.length; i++) {
				const older = reads[i]
				const key = `${older.messageIndex}-${older.blockIndex}`
				replacementMap.set(
					key,
					`[File: ${older.path} - Content identical to message #${mostRecent.messageIndex + 1}, see most recent version there]`,
				)
			}
		})

		// Apply replacements
		return messages.map((message, msgIndex) => {
			if (typeof message.content === "string") {
				return message
			}

			const newContent = message.content.map((block, blockIndex) => {
				if (block.type === "text") {
					const key = `${msgIndex}-${blockIndex}`
					if (replacementMap.has(key)) {
						// Replace with reference
						return {
							type: "text" as const,
							text: replacementMap.get(key)!,
						}
					}
				}
				return block
			})

			return {
				...message,
				content: newContent,
			}
		})
	}

	/**
	 * Analyze messages for duplicate potential without applying changes
	 */
	analyzeDuplicates(messages: Anthropic.MessageParam[]): {
		duplicateCount: number
		uniqueFiles: Set<string>
		tokensBeforeDedup: number
		tokensAfterDedup: number
		reductionPercent: number
	} {
		const fileReads = this.extractFileReads(messages)
		const duplicateMap = this.findDuplicates(fileReads)
		const tokensBeforeDedup = this.estimateTotalTokens(fileReads)
		const tokensAfterDedup = this.estimateTokensAfterDedup(fileReads, duplicateMap)

		const uniqueFiles = new Set(
			Array.from(duplicateMap.values())
				.flat()
				.map((fr) => fr.path),
		)

		return {
			duplicateCount: duplicateMap.size,
			uniqueFiles,
			tokensBeforeDedup,
			tokensAfterDedup,
			reductionPercent:
				tokensBeforeDedup > 0 ? ((tokensBeforeDedup - tokensAfterDedup) / tokensBeforeDedup) * 100 : 0,
		}
	}
}
