import { maybeResizeImage, DEFAULT_IMAGE_DOWNSCALE_QUALITY } from "../resize-image"
import sharp from "sharp"

describe("maybeResizeImage", () => {
	/**
	 * Helper to create a test image buffer with specified dimensions.
	 */
	async function createTestImage(
		width: number,
		height: number,
		format: "png" | "jpeg" | "webp" = "png",
	): Promise<Buffer> {
		const channels = 3
		const rawData = Buffer.alloc(width * height * channels, 128)
		let pipeline = sharp(rawData, { raw: { width, height, channels } })

		if (format === "png") {
			pipeline = pipeline.png()
		} else if (format === "jpeg") {
			pipeline = pipeline.jpeg()
		} else if (format === "webp") {
			pipeline = pipeline.webp()
		}

		return pipeline.toBuffer()
	}

	it("should return original buffer when maxDimension is 0", async () => {
		const buffer = await createTestImage(100, 100)
		const result = await maybeResizeImage({
			buffer,
			mimeType: "image/png",
			maxDimension: 0,
		})
		expect(result.wasResized).toBe(false)
		expect(result.buffer).toBe(buffer) // same reference
	})

	it("should return original buffer when maxDimension is undefined", async () => {
		const buffer = await createTestImage(100, 100)
		const result = await maybeResizeImage({
			buffer,
			mimeType: "image/png",
		})
		expect(result.wasResized).toBe(false)
		expect(result.buffer).toBe(buffer)
	})

	it("should not resize when image is smaller than maxDimension", async () => {
		const buffer = await createTestImage(200, 100)
		const result = await maybeResizeImage({
			buffer,
			mimeType: "image/png",
			maxDimension: 300,
		})
		expect(result.wasResized).toBe(false)
		expect(result.buffer).toBe(buffer)
	})

	it("should downscale a wide image exceeding maxDimension", async () => {
		const buffer = await createTestImage(2000, 1000, "png")
		const result = await maybeResizeImage({
			buffer,
			mimeType: "image/png",
			maxDimension: 500,
		})
		expect(result.wasResized).toBe(true)

		const metadata = await sharp(result.buffer).metadata()
		expect(metadata.width).toBeLessThanOrEqual(500)
		expect(metadata.height).toBeLessThanOrEqual(500)
		// Check aspect ratio is roughly preserved (2:1)
		expect(metadata.width! / metadata.height!).toBeCloseTo(2, 0)
	})

	it("should downscale a tall image exceeding maxDimension", async () => {
		const buffer = await createTestImage(500, 2000, "jpeg")
		const result = await maybeResizeImage({
			buffer,
			mimeType: "image/jpeg",
			maxDimension: 1000,
		})
		expect(result.wasResized).toBe(true)

		const metadata = await sharp(result.buffer).metadata()
		expect(metadata.width).toBeLessThanOrEqual(1000)
		expect(metadata.height).toBeLessThanOrEqual(1000)
		// Check aspect ratio is roughly preserved (1:4)
		expect(metadata.height! / metadata.width!).toBeCloseTo(4, 0)
	})

	it("should handle webp format", async () => {
		const buffer = await createTestImage(1500, 1500, "webp")
		const result = await maybeResizeImage({
			buffer,
			mimeType: "image/webp",
			maxDimension: 800,
		})
		expect(result.wasResized).toBe(true)

		const metadata = await sharp(result.buffer).metadata()
		expect(metadata.format).toBe("webp")
		expect(metadata.width).toBeLessThanOrEqual(800)
		expect(metadata.height).toBeLessThanOrEqual(800)
	})

	it("should return original buffer for unsupported mime types", async () => {
		const buffer = await createTestImage(2000, 2000)
		const result = await maybeResizeImage({
			buffer,
			mimeType: "image/gif",
			maxDimension: 500,
		})
		expect(result.wasResized).toBe(false)
		expect(result.buffer).toBe(buffer)
	})

	it("should use default quality when not specified", async () => {
		expect(DEFAULT_IMAGE_DOWNSCALE_QUALITY).toBe(85)
	})

	it("should accept custom quality setting for jpeg without error", async () => {
		const buffer = await createTestImage(2000, 2000, "jpeg")

		const resultHighQ = await maybeResizeImage({
			buffer,
			mimeType: "image/jpeg",
			maxDimension: 500,
			quality: 95,
		})

		const resultLowQ = await maybeResizeImage({
			buffer,
			mimeType: "image/jpeg",
			maxDimension: 500,
			quality: 10,
		})

		// Both should be resized successfully
		expect(resultHighQ.wasResized).toBe(true)
		expect(resultLowQ.wasResized).toBe(true)

		// Both should produce valid image buffers
		const metaHigh = await sharp(resultHighQ.buffer).metadata()
		const metaLow = await sharp(resultLowQ.buffer).metadata()
		expect(metaHigh.format).toBe("jpeg")
		expect(metaLow.format).toBe("jpeg")
		expect(metaHigh.width).toBeLessThanOrEqual(500)
		expect(metaLow.width).toBeLessThanOrEqual(500)
	})

	it("should not upscale small images", async () => {
		const buffer = await createTestImage(100, 50, "png")
		const result = await maybeResizeImage({
			buffer,
			mimeType: "image/png",
			maxDimension: 500,
		})
		expect(result.wasResized).toBe(false)
		expect(result.buffer).toBe(buffer)
	})
})
