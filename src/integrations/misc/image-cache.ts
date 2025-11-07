/**
 * Transient in-memory cache mapping image file paths to their base64 data URLs.
 * - Enforces per-entry max size (10MB)
 * - TTL eviction to avoid leaks
 * - Used to avoid re-reading files for images that originated as base64 from UI
 */

type ImageCacheEntry = {
	dataUrl: string
	size: number // raw bytes (approx from base64)
	ts: number // insertion timestamp
}

const CACHE = new Map<string, ImageCacheEntry>()

// 10 MB limit per image
const MAX_ENTRY_BYTES = 10 * 1024 * 1024
// 10 minutes TTL
const TTL_MS = 10 * 60 * 1000
// Soft cap to prevent unbounded growth
const MAX_ENTRIES = 500

/** Approximate raw bytes for a base64 string (excluding data: header) */
function estimateBytesFromBase64(base64: string): number {
	// Remove padding characters for estimation (not strictly required)
	const cleaned = base64.replace(/=+$/, "")
	// 4 base64 chars represent 3 bytes => bytes ≈ floor(len * 3 / 4)
	return Math.floor((cleaned.length * 3) / 4)
}

function purgeExpired(now = Date.now()) {
	for (const [k, v] of CACHE) {
		if (now - v.ts > TTL_MS) {
			CACHE.delete(k)
		}
	}
	// Simple size cap: if still too large, drop oldest
	if (CACHE.size > MAX_ENTRIES) {
		const entries = Array.from(CACHE.entries()).sort((a, b) => a[1].ts - b[1].ts)
		const toDrop = CACHE.size - MAX_ENTRIES
		for (let i = 0; i < toDrop; i++) {
			CACHE.delete(entries[i][0])
		}
	}
}

/**
 * Store a data URL for a file path (returns false if rejected by size limits)
 */
export function setImageBase64ForPath(filePath: string, dataUrl: string): boolean {
	try {
		const commaIdx = dataUrl.indexOf(",")
		if (commaIdx === -1) return false
		const base64 = dataUrl.slice(commaIdx + 1)
		const size = estimateBytesFromBase64(base64)

		if (size > MAX_ENTRY_BYTES) {
			// Too large; do not cache
			return false
		}

		purgeExpired()
		CACHE.set(filePath, { dataUrl, size, ts: Date.now() })
		return true
	} catch {
		return false
	}
}

/**
 * Retrieve a cached data URL if present and not expired
 */
export function getImageBase64ForPath(filePath: string): string | undefined {
	purgeExpired()
	const entry = CACHE.get(filePath)
	if (!entry) return undefined
	return entry.dataUrl
}

/** Remove a single path from cache */
export function clearImageForPath(filePath: string): void {
	CACHE.delete(filePath)
}

/** Clear entire cache */
export function clearImageCache(): void {
	CACHE.clear()
}

/** Expose limits for callers that want to validate before calling set() */
export const IMAGE_CACHE_LIMITS = {
	MAX_ENTRY_BYTES,
	TTL_MS,
}
