/**
 * TypeScript bindings for Rust image processor native module
 *
 * This module provides type-safe wrappers around the Rust native addon
 * for high-performance image processing operations.
 */

let nativeModule: any = null

/**
 * Lazily load the native module
 * This allows the application to run even if Rust modules aren't built yet
 */
function getNativeModule() {
	if (nativeModule === null) {
		try {
			// Try to load the native module
			// The actual .node file will be at ../../native/image-processor/index.node after build
			nativeModule = require("../../native/image-processor/index.node")
		} catch (error) {
			console.warn("[Native Image Processor] Failed to load native module, falling back to JavaScript:", error)
			// Return null to indicate fallback should be used
			return null
		}
	}
	return nativeModule
}

/**
 * Result of image dimension check
 */
export interface ImageDimensions {
	width: number
	height: number
}

/**
 * Decode a base64 encoded string to a Buffer
 *
 * @param data - Base64 encoded string
 * @returns Decoded Buffer
 * @throws Error if decoding fails
 */
export function decodeBase64(data: string): Buffer {
	const native = getNativeModule()
	if (native === null) {
		// Fallback to JavaScript implementation
		return Buffer.from(data, "base64")
	}

	return native.decodeBase64(data)
}

/**
 * Encode a Buffer to base64 string
 *
 * @param data - Buffer to encode
 * @returns Base64 encoded string
 */
export function encodeBase64(data: Buffer): string {
	const native = getNativeModule()
	if (native === null) {
		// Fallback to JavaScript implementation
		return data.toString("base64")
	}

	return native.encodeBase64(data)
}

/**
 * Validate image format and return format name
 *
 * @param data - Image data as Buffer
 * @returns Image format name (PNG, JPEG, etc.)
 * @throws Error if validation fails or format is unsupported
 */
export function validateImage(data: Buffer): string {
	const native = getNativeModule()
	if (native === null) {
		// Fallback: basic validation
		if (data.length < 4) {
			throw new Error("Invalid image: data too short")
		}
		// Simple magic number checks
		if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) {
			return "PNG"
		} else if (data[0] === 0xff && data[1] === 0xd8) {
			return "JPEG"
		} else if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) {
			return "GIF"
		}
		return "UNKNOWN"
	}

	return native.validateImage(data)
}

/**
 * Get image dimensions from image data
 *
 * @param data - Image data as Buffer
 * @returns Object with width and height
 * @throws Error if image cannot be decoded
 */
export function getDimensions(data: Buffer): ImageDimensions {
	const native = getNativeModule()
	if (native === null) {
		// Fallback: cannot determine dimensions without native module
		// Would require full image decoding library
		throw new Error("Native module required for image dimension detection")
	}

	return native.getDimensions(data)
}

/**
 * Calculate memory usage for image data
 *
 * @param data - Image data as Buffer
 * @returns Size in bytes
 */
export function calculateMemoryUsage(data: Buffer): number {
	const native = getNativeModule()
	if (native === null) {
		// Fallback: just return buffer length
		return data.length
	}

	return native.calculateMemoryUsage(data)
}

/**
 * Get image format without throwing errors
 *
 * @param data - Image data as Buffer
 * @returns Image format string or null if cannot be determined
 */
export function getImageFormat(data: Buffer): string | null {
	const native = getNativeModule()
	if (native === null) {
		// Fallback: basic detection
		if (data.length < 4) return null
		if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return "png"
		if (data[0] === 0xff && data[1] === 0xd8) return "jpeg"
		if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) return "gif"
		return null
	}

	return native.getImageFormat(data)
}

/**
 * Check if native module is available
 *
 * @returns true if native module is loaded, false otherwise
 */
export function isNativeAvailable(): boolean {
	return getNativeModule() !== null
}
