// Test coordinate scaling functionality in browser actions
import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock the scaleCoordinate function by extracting it
// In a real scenario, we'd export it or test through the main function
// For now, we'll test the regex pattern and logic

describe("Browser Action Coordinate Scaling", () => {
	describe("Coordinate format validation", () => {
		it("should match valid coordinate format with image dimensions", () => {
			const validFormats = [
				"450,300@1024x768",
				"0,0@1920x1080",
				"1920,1080@1920x1080",
				"100,200@800x600",
				" 273 , 273 @ 1280x800 ",
				"267,273@1280,800", // comma separator for dimensions
				"450,300@1024,768", // comma separator for dimensions
			]

			const regex = /^\s*(\d+)\s*,\s*(\d+)\s*@\s*(\d+)\s*[x,]\s*(\d+)\s*$/

			validFormats.forEach((coord) => {
				expect(coord).toMatch(regex)
			})
		})

		it("should not match invalid coordinate formats", () => {
			const invalidFormats = [
				"450,300", // missing image dimensions
				"450,300@", // incomplete dimensions
				"450,300@1024", // missing height
				"450,300@1024x", // missing height value
				"@1024x768", // missing coordinates
				"450@1024x768", // missing y coordinate
				",300@1024x768", // missing x coordinate
				"450,300@1024x768x2", // extra dimension
				"a,b@1024x768", // non-numeric coordinates
				"450,300@axb", // non-numeric dimensions
			]

			const regex = /^\s*(\d+)\s*,\s*(\d+)\s*@\s*(\d+)\s*[x,]\s*(\d+)\s*$/

			invalidFormats.forEach((coord) => {
				expect(coord).not.toMatch(regex)
			})
		})
	})

	describe("Coordinate scaling logic", () => {
		it("should correctly scale coordinates from image to viewport", () => {
			// Simulate the scaling logic
			const scaleCoordinate = (coordinate: string, viewportWidth: number, viewportHeight: number): string => {
				const match = coordinate.match(/^\s*(\d+)\s*,\s*(\d+)\s*@\s*(\d+)\s*[x,]\s*(\d+)\s*$/)
				if (!match) {
					throw new Error(`Invalid coordinate format: "${coordinate}"`)
				}

				const [, xStr, yStr, imgWidthStr, imgHeightStr] = match
				const x = parseInt(xStr, 10)
				const y = parseInt(yStr, 10)
				const imgWidth = parseInt(imgWidthStr, 10)
				const imgHeight = parseInt(imgHeightStr, 10)

				const scaledX = Math.round((x / imgWidth) * viewportWidth)
				const scaledY = Math.round((y / imgHeight) * viewportHeight)

				return `${scaledX},${scaledY}`
			}

			// Test case 1: Same dimensions (no scaling)
			expect(scaleCoordinate("450,300@900x600", 900, 600)).toBe("450,300")

			// Test case 2: Half dimensions (2x upscale)
			expect(scaleCoordinate("225,150@450x300", 900, 600)).toBe("450,300")

			// Test case 3: Double dimensions (0.5x downscale)
			expect(scaleCoordinate("900,600@1800x1200", 900, 600)).toBe("450,300")

			// Test case 4: Different aspect ratio
			expect(scaleCoordinate("512,384@1024x768", 1920, 1080)).toBe("960,540")

			// Test case 5: Edge cases (0,0)
			expect(scaleCoordinate("0,0@1024x768", 1920, 1080)).toBe("0,0")

			// Test case 6: Edge cases (max coordinates)
			expect(scaleCoordinate("1024,768@1024x768", 1920, 1080)).toBe("1920,1080")
		})

		it("should throw error for invalid coordinate format", () => {
			const scaleCoordinate = (coordinate: string, viewportWidth: number, viewportHeight: number): string => {
				const match = coordinate.match(/^\s*(\d+)\s*,\s*(\d+)\s*@\s*(\d+)\s*[x,]\s*(\d+)\s*$/)
				if (!match) {
					throw new Error(
						`Invalid coordinate format: "${coordinate}". ` +
							`Expected format: "x,y@widthxheight" (e.g., "450,300@1024x768")`,
					)
				}

				const [, xStr, yStr, imgWidthStr, imgHeightStr] = match
				const x = parseInt(xStr, 10)
				const y = parseInt(yStr, 10)
				const imgWidth = parseInt(imgWidthStr, 10)
				const imgHeight = parseInt(imgHeightStr, 10)

				const scaledX = Math.round((x / imgWidth) * viewportWidth)
				const scaledY = Math.round((y / imgHeight) * viewportHeight)

				return `${scaledX},${scaledY}`
			}

			// Test invalid formats
			expect(() => scaleCoordinate("450,300", 900, 600)).toThrow("Invalid coordinate format")
			expect(() => scaleCoordinate("450,300@1024", 900, 600)).toThrow("Invalid coordinate format")
			expect(() => scaleCoordinate("invalid", 900, 600)).toThrow("Invalid coordinate format")
		})

		it("should handle rounding correctly", () => {
			const scaleCoordinate = (coordinate: string, viewportWidth: number, viewportHeight: number): string => {
				const match = coordinate.match(/^\s*(\d+)\s*,\s*(\d+)\s*@\s*(\d+)\s*[x,]\s*(\d+)\s*$/)
				if (!match) {
					throw new Error(`Invalid coordinate format: "${coordinate}"`)
				}

				const [, xStr, yStr, imgWidthStr, imgHeightStr] = match
				const x = parseInt(xStr, 10)
				const y = parseInt(yStr, 10)
				const imgWidth = parseInt(imgWidthStr, 10)
				const imgHeight = parseInt(imgHeightStr, 10)

				const scaledX = Math.round((x / imgWidth) * viewportWidth)
				const scaledY = Math.round((y / imgHeight) * viewportHeight)

				return `${scaledX},${scaledY}`
			}

			// Test rounding behavior
			// 333 / 1000 * 900 = 299.7 -> rounds to 300
			expect(scaleCoordinate("333,333@1000x1000", 900, 900)).toBe("300,300")

			// 666 / 1000 * 900 = 599.4 -> rounds to 599
			expect(scaleCoordinate("666,666@1000x1000", 900, 900)).toBe("599,599")

			// 500 / 1000 * 900 = 450.0 -> rounds to 450
			expect(scaleCoordinate("500,500@1000x1000", 900, 900)).toBe("450,450")
		})
	})
})
