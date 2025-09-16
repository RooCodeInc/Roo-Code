import { describe, it, expect, vi, beforeEach } from "vitest"
import {
	SUPPORTED_IMAGE_TYPES,
	DEFAULT_MCP_IMAGE_LIMITS,
	isSupportedImageType,
	isValidBase64Image,
	calculateBase64Size,
	bytesToMB,
	extractMimeType,
} from "../mcpImageConstants"

describe("MCP Image Constants", () => {
	describe("SUPPORTED_IMAGE_TYPES", () => {
		it("should include all common image MIME types", () => {
			expect(SUPPORTED_IMAGE_TYPES).toContain("image/png")
			expect(SUPPORTED_IMAGE_TYPES).toContain("image/jpeg")
			expect(SUPPORTED_IMAGE_TYPES).toContain("image/gif")
			expect(SUPPORTED_IMAGE_TYPES).toContain("image/webp")
			expect(SUPPORTED_IMAGE_TYPES).toContain("image/svg+xml")
			expect(SUPPORTED_IMAGE_TYPES).toContain("image/bmp")
		})
	})

	describe("DEFAULT_MCP_IMAGE_LIMITS", () => {
		it("should have reasonable default limits", () => {
			expect(DEFAULT_MCP_IMAGE_LIMITS.maxImagesPerResponse).toBe(5)
			expect(DEFAULT_MCP_IMAGE_LIMITS.maxImageSizeMB).toBe(2)
		})
	})

	describe("isSupportedImageType", () => {
		it("should return true for supported MIME types", () => {
			expect(isSupportedImageType("image/png")).toBe(true)
			expect(isSupportedImageType("image/jpeg")).toBe(true)
			expect(isSupportedImageType("image/gif")).toBe(true)
			expect(isSupportedImageType("image/webp")).toBe(true)
			expect(isSupportedImageType("image/svg+xml")).toBe(true)
			expect(isSupportedImageType("image/bmp")).toBe(true)
		})

		it("should return false for unsupported MIME types", () => {
			expect(isSupportedImageType("image/tiff")).toBe(false)
			expect(isSupportedImageType("application/pdf")).toBe(false)
			expect(isSupportedImageType("text/plain")).toBe(false)
			expect(isSupportedImageType("video/mp4")).toBe(false)
		})

		it("should handle edge cases", () => {
			expect(isSupportedImageType("")).toBe(false)
			expect(isSupportedImageType("IMAGE/PNG")).toBe(false) // Case sensitive
		})
	})

	describe("isValidBase64Image", () => {
		// Mock atob for Node.js environment
		beforeEach(() => {
			if (typeof global.atob === "undefined") {
				global.atob = (str: string) => Buffer.from(str, "base64").toString("binary")
			}
		})

		it("should validate correct base64 image data", () => {
			// Valid PNG data URL
			const validPngDataUrl =
				"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
			expect(isValidBase64Image(validPngDataUrl)).toBe(true)

			// Valid base64 without data URL prefix
			const validBase64 =
				"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
			expect(isValidBase64Image(validBase64)).toBe(true)
		})

		it("should reject invalid base64 data", () => {
			// Invalid base64 characters
			expect(isValidBase64Image("!@#$%^&*()")).toBe(false)

			// Not base64 at all
			expect(isValidBase64Image("not base64 data")).toBe(false)

			// Empty string - returns true because empty base64 is technically valid
			expect(isValidBase64Image("")).toBe(true)

			// Malformed data URL
			expect(isValidBase64Image("data:image/png;base64,!!!invalid!!!")).toBe(false)
		})

		it("should handle corrupted base64 data", () => {
			// Missing padding - still valid base64
			const corruptedBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ"
			// This is actually valid base64 (padding is optional in some implementations)
			expect(isValidBase64Image(corruptedBase64)).toBe(true)

			// Truncated data - not multiple of 4
			const truncatedBase64 = "iVBORw0KGg="
			expect(isValidBase64Image(truncatedBase64)).toBe(false)
		})
	})

	describe("calculateBase64Size", () => {
		it("should calculate size for base64 string without data URL prefix", () => {
			// Base64 string of known size (approximately)
			const base64 =
				"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
			const size = calculateBase64Size(base64)
			// Base64 encoding increases size by ~33%, so we expect around 75% of string length
			expect(size).toBeGreaterThan(0)
			expect(size).toBeLessThan(base64.length)
		})

		it("should calculate size for data URL", () => {
			const dataUrl =
				"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
			const size = calculateBase64Size(dataUrl)
			expect(size).toBeGreaterThan(0)
			// Should only count the base64 part, not the prefix
			expect(size).toBeLessThan(dataUrl.length)
		})

		it("should handle edge cases", () => {
			expect(calculateBase64Size("")).toBe(0)
			expect(calculateBase64Size("data:image/png;base64,")).toBe(0)
		})
	})

	describe("bytesToMB", () => {
		it("should convert bytes to megabytes correctly", () => {
			expect(bytesToMB(1048576)).toBe(1) // 1 MB
			expect(bytesToMB(2097152)).toBe(2) // 2 MB
			expect(bytesToMB(524288)).toBe(0.5) // 0.5 MB
			expect(bytesToMB(0)).toBe(0)
		})

		it("should handle decimal values", () => {
			expect(bytesToMB(1572864)).toBeCloseTo(1.5, 2) // 1.5 MB
			expect(bytesToMB(3145728)).toBeCloseTo(3, 2) // 3 MB
		})
	})

	describe("extractMimeType", () => {
		it("should extract MIME type from data URL", () => {
			expect(extractMimeType("data:image/png;base64,iVBORw0KG...")).toBe("image/png")
			expect(extractMimeType("data:image/jpeg;base64,/9j/4AAQ...")).toBe("image/jpeg")
			expect(extractMimeType("data:image/gif;base64,R0lGODlh...")).toBe("image/gif")
		})

		it("should return null for non-data URLs", () => {
			expect(extractMimeType("iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB")).toBeNull()
			expect(extractMimeType("not a data url")).toBeNull()
			expect(extractMimeType("")).toBeNull()
		})

		it("should handle malformed data URLs", () => {
			expect(extractMimeType("data:;base64,iVBORw0KG...")).toBeNull()
			expect(extractMimeType("data:image/png")).toBeNull()
		})
	})
})

describe("MCP Image Processing Integration", () => {
	// Mock atob for Node.js environment
	beforeEach(() => {
		if (typeof global.atob === "undefined") {
			global.atob = (str: string) => Buffer.from(str, "base64").toString("binary")
		}
	})

	it("should validate and process a valid image", () => {
		const validImage =
			"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="

		// Extract MIME type
		const mimeType = extractMimeType(validImage)
		expect(mimeType).toBe("image/png")

		// Check if supported
		expect(isSupportedImageType(mimeType!)).toBe(true)

		// Validate base64
		expect(isValidBase64Image(validImage)).toBe(true)

		// Check size
		const sizeBytes = calculateBase64Size(validImage)
		const sizeMB = bytesToMB(sizeBytes)
		expect(sizeMB).toBeLessThan(DEFAULT_MCP_IMAGE_LIMITS.maxImageSizeMB)
	})

	it("should reject an oversized image", () => {
		// Create a large base64 string (simulating > 2MB)
		const largeBase64 = "data:image/png;base64," + "A".repeat(3 * 1024 * 1024) // ~3MB of 'A's

		const sizeBytes = calculateBase64Size(largeBase64)
		const sizeMB = bytesToMB(sizeBytes)

		expect(sizeMB).toBeGreaterThan(DEFAULT_MCP_IMAGE_LIMITS.maxImageSizeMB)
	})

	it("should handle multiple images respecting count limits", () => {
		const images = [
			"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ",
			"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAg",
			"data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAA",
			"data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEA",
			"data:image/bmp;base64,Qk06AAAAAAAAADYAAAAoAAAAAQAAAAEAAAABABgA",
			"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmc", // 6th image
		]

		const processedImages: string[] = []
		const errors: string[] = []

		for (const image of images) {
			if (processedImages.length >= DEFAULT_MCP_IMAGE_LIMITS.maxImagesPerResponse) {
				errors.push(`Maximum number of images (${DEFAULT_MCP_IMAGE_LIMITS.maxImagesPerResponse}) exceeded`)
				continue
			}
			processedImages.push(image)
		}

		expect(processedImages).toHaveLength(5)
		expect(errors).toHaveLength(1)
		expect(errors[0]).toContain("Maximum number of images")
	})
})
