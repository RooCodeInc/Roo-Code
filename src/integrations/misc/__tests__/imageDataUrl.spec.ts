import { describe, it, expect, vi, beforeEach } from "vitest"
import { normalizeImageRefsToDataUrls } from "../imageDataUrl"
import * as fs from "fs/promises"
import * as path from "path"

// Mock fs module
vi.mock("fs/promises")

describe("normalizeImageRefsToDataUrls", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should pass through data URLs unchanged", async () => {
		const dataUrl =
			"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
		const result = await normalizeImageRefsToDataUrls([dataUrl])

		expect(result).toEqual([dataUrl])
	})

	it("should convert CDN webview URIs to data URLs", async () => {
		const cdnUri = "https://file+.vscode-resource.vscode-cdn.net/path/to/test.png"
		const mockBuffer = Buffer.from("test image data")

		vi.mocked(fs.readFile).mockResolvedValue(mockBuffer)

		const result = await normalizeImageRefsToDataUrls([cdnUri])

		expect(result).toHaveLength(1)
		expect(result[0]).toMatch(/^data:image\/png;base64,/)
		const expectedPath = path.normalize("/path/to/test.png")
		expect(fs.readFile).toHaveBeenCalledWith(expectedPath)
	})

	it("should handle mixed arrays of data URLs and CDN URIs", async () => {
		const dataUrl = "data:image/jpeg;base64,test123"
		const cdnUri = "https://file+.vscode-resource.vscode-cdn.net/path/to/test.png"
		const mockBuffer = Buffer.from("test image data")

		vi.mocked(fs.readFile).mockResolvedValue(mockBuffer)

		const result = await normalizeImageRefsToDataUrls([dataUrl, cdnUri])

		expect(result).toHaveLength(2)
		expect(result[0]).toBe(dataUrl) // Data URL unchanged
		expect(result[1]).toMatch(/^data:image\/png;base64,/) // CDN URI converted
	})

	it("should handle errors gracefully by skipping problematic images", async () => {
		const validDataUrl = "data:image/png;base64,valid"
		const invalidCdnUri = "vscode-file://vscode-app/nonexistent/test.png"

		vi.mocked(fs.readFile).mockRejectedValue(new Error("File not found"))

		const result = await normalizeImageRefsToDataUrls([validDataUrl, invalidCdnUri])

		expect(result).toEqual([validDataUrl]) // Only valid ones returned
	})

	it("should handle empty arrays", async () => {
		const result = await normalizeImageRefsToDataUrls([])
		expect(result).toEqual([])
	})
})
