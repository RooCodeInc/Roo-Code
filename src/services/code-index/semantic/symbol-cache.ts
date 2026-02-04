/**
 * Symbol Cache
 * LRU cache for caching resolved symbols to improve performance
 */

import { ResolvedSymbol } from "./interfaces"

interface CacheEntry {
	symbol: ResolvedSymbol
	timestamp: number
	accessCount: number
}

export class SymbolCache {
	private cache: Map<string, CacheEntry> = new Map()
	private readonly maxSize: number
	private readonly maxAgeMs: number

	constructor(maxSize: number = 10000, maxAgeMs: number = 60 * 60 * 1000) {
		this.maxSize = maxSize
		this.maxAgeMs = maxAgeMs
	}

	/**
	 * Generate a cache key from symbol name and file context
	 */
	private generateKey(symbolName: string, filePath: string): string {
		return `${filePath}::${symbolName}`
	}

	/**
	 * Get a cached symbol
	 */
	get(symbolName: string, filePath: string): ResolvedSymbol | undefined {
		const key = this.generateKey(symbolName, filePath)
		const entry = this.cache.get(key)

		if (!entry) {
			return undefined
		}

		// Check if entry is expired
		if (Date.now() - entry.timestamp > this.maxAgeMs) {
			this.cache.delete(key)
			return undefined
		}

		// Update access count for LRU
		entry.accessCount++
		return entry.symbol
	}

	/**
	 * Set a symbol in the cache
	 */
	set(symbolName: string, filePath: string, symbol: ResolvedSymbol): void {
		const key = this.generateKey(symbolName, filePath)

		// Evict if at capacity
		if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
			this.evictLeastRecentlyUsed()
		}

		this.cache.set(key, {
			symbol,
			timestamp: Date.now(),
			accessCount: 1,
		})
	}

	/**
	 * Invalidate all cached symbols for a file
	 */
	invalidateFile(filePath: string): void {
		const keysToDelete: string[] = []

		for (const key of this.cache.keys()) {
			if (key.startsWith(`${filePath}::`)) {
				keysToDelete.push(key)
			}
		}

		for (const key of keysToDelete) {
			this.cache.delete(key)
		}
	}

	/**
	 * Invalidate all cached symbols that reference a specific file
	 */
	invalidateReferencesTo(filePath: string): void {
		const keysToDelete: string[] = []

		for (const [key, entry] of this.cache.entries()) {
			if (entry.symbol.filePath === filePath) {
				keysToDelete.push(key)
			}
		}

		for (const key of keysToDelete) {
			this.cache.delete(key)
		}
	}

	/**
	 * Clear the entire cache
	 */
	clear(): void {
		this.cache.clear()
	}

	/**
	 * Get cache statistics
	 */
	getStats(): { size: number; maxSize: number; hitRate: number } {
		return {
			size: this.cache.size,
			maxSize: this.maxSize,
			hitRate: 0, // Would need to track hits/misses for this
		}
	}

	/**
	 * Evict the least recently used entry
	 */
	private evictLeastRecentlyUsed(): void {
		let lruKey: string | null = null
		let lruAccessCount = Infinity

		for (const [key, entry] of this.cache.entries()) {
			if (entry.accessCount < lruAccessCount) {
				lruAccessCount = entry.accessCount
				lruKey = key
			}
		}

		if (lruKey) {
			this.cache.delete(lruKey)
		}
	}
}
