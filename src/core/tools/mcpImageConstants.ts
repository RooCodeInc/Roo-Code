/**
 * Constants for MCP image handling
 */

/**
 * Supported image MIME types for MCP responses
 */
export const SUPPORTED_IMAGE_TYPES = [
	"image/png",
	"image/jpeg",
	"image/jpg",
	"image/gif",
	"image/webp",
	"image/svg+xml",
	"image/bmp",
] as const

export type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number]

/**
 * Default limits for MCP image handling
 */
export const DEFAULT_MCP_IMAGE_LIMITS = {
	maxImagesPerResponse: 5,
	maxImageSizeMB: 2,
} as const

/**
 * Check if a MIME type is supported for images
 */
export function isSupportedImageType(mimeType: string): mimeType is SupportedImageType {
	return SUPPORTED_IMAGE_TYPES.includes(mimeType as SupportedImageType)
}

/**
 * Validate base64 image data
 * @param base64Data The base64 string to validate
 * @returns true if valid, false otherwise
 */
export function isValidBase64Image(base64Data: string): boolean {
	// Check if it's a valid base64 string
	const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/

	// Remove data URL prefix if present
	const base64Only = base64Data.replace(/^data:image\/[a-z]+;base64,/, "")

	// Check basic format
	if (!base64Regex.test(base64Only)) {
		return false
	}

	// Check if length is valid (must be multiple of 4)
	if (base64Only.length % 4 !== 0) {
		return false
	}

	try {
		// Try to decode to verify it's valid base64
		atob(base64Only)
		return true
	} catch {
		return false
	}
}

/**
 * Calculate the approximate size of a base64 image in bytes
 * @param base64Data The base64 string
 * @returns Size in bytes
 */
export function calculateBase64Size(base64Data: string): number {
	// Remove data URL prefix if present
	const base64Only = base64Data.replace(/^data:image\/[a-z]+;base64,/, "")

	// Base64 encoding increases size by ~33%, so we reverse that
	// Every 4 base64 characters represent 3 bytes
	const padding = (base64Only.match(/=/g) || []).length
	return Math.floor((base64Only.length * 3) / 4) - padding
}

/**
 * Convert bytes to megabytes
 */
export function bytesToMB(bytes: number): number {
	return bytes / (1024 * 1024)
}

/**
 * Extract MIME type from a data URL
 */
export function extractMimeType(dataUrl: string): string | null {
	const match = dataUrl.match(/^data:([a-z]+\/[a-z+-]+);base64,/)
	return match ? match[1] : null
}
