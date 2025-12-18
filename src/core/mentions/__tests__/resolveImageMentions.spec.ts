import * as path from "path"

import { resolveImageMentions } from "../resolveImageMentions"

vi.mock("fs/promises", () => {
	return {
		default: {
			readFile: vi.fn(),
			stat: vi.fn(),
		},
		readFile: vi.fn(),
		stat: vi.fn(),
	}
})

vi.mock("../../tools/helpers/imageHelpers", () => ({
	SUPPORTED_IMAGE_FORMATS: [
		".png",
		".jpg",
		".jpeg",
		".gif",
		".webp",
		".svg",
		".bmp",
		".ico",
		".tiff",
		".tif",
		".avif",
	],
	IMAGE_MIME_TYPES: {
		".png": "image/png",
		".jpg": "image/jpeg",
		".jpeg": "image/jpeg",
		".gif": "image/gif",
		".webp": "image/webp",
		".svg": "image/svg+xml",
		".bmp": "image/bmp",
		".ico": "image/x-icon",
		".tiff": "image/tiff",
		".tif": "image/tiff",
		".avif": "image/avif",
	},
	validateImageForProcessing: vi.fn(),
	ImageMemoryTracker: vi.fn().mockImplementation(() => ({
		getTotalMemoryUsed: vi.fn().mockReturnValue(0),
		addMemoryUsage: vi.fn(),
	})),
	DEFAULT_MAX_IMAGE_FILE_SIZE_MB: 5,
	DEFAULT_MAX_TOTAL_IMAGE_SIZE_MB: 20,
}))

import * as fs from "fs/promises"
import { validateImageForProcessing } from "../../tools/helpers/imageHelpers"

const mockReadFile = vi.mocked(fs.readFile)
const mockValidateImage = vi.mocked(validateImageForProcessing)

describe("resolveImageMentions", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		// Default: validation passes
		mockValidateImage.mockResolvedValue({ isValid: true, sizeInMB: 0.1 })
	})

	it("should append a data URL when a local png mention is present", async () => {
		mockReadFile.mockResolvedValue(Buffer.from("png-bytes"))

		const result = await resolveImageMentions({
			text: "Please look at @/assets/cat.png",
			images: [],
			cwd: "/workspace",
		})

		expect(mockValidateImage).toHaveBeenCalled()
		expect(mockReadFile).toHaveBeenCalledWith(path.resolve("/workspace", "assets/cat.png"))
		expect(result.text).toBe("Please look at @/assets/cat.png")
		expect(result.images).toEqual([`data:image/png;base64,${Buffer.from("png-bytes").toString("base64")}`])
	})

	it("should support gif images (matching read_file)", async () => {
		mockReadFile.mockResolvedValue(Buffer.from("gif-bytes"))

		const result = await resolveImageMentions({
			text: "See @/animation.gif",
			images: [],
			cwd: "/workspace",
		})

		expect(result.images).toEqual([`data:image/gif;base64,${Buffer.from("gif-bytes").toString("base64")}`])
	})

	it("should support svg images (matching read_file)", async () => {
		mockReadFile.mockResolvedValue(Buffer.from("svg-bytes"))

		const result = await resolveImageMentions({
			text: "See @/icon.svg",
			images: [],
			cwd: "/workspace",
		})

		expect(result.images).toEqual([`data:image/svg+xml;base64,${Buffer.from("svg-bytes").toString("base64")}`])
	})

	it("should ignore non-image mentions", async () => {
		const result = await resolveImageMentions({
			text: "See @/src/index.ts",
			images: [],
			cwd: "/workspace",
		})

		expect(mockReadFile).not.toHaveBeenCalled()
		expect(result.images).toEqual([])
	})

	it("should skip unreadable files (fail-soft)", async () => {
		mockReadFile.mockRejectedValue(new Error("ENOENT"))

		const result = await resolveImageMentions({
			text: "See @/missing.webp",
			images: [],
			cwd: "/workspace",
		})

		expect(result.images).toEqual([])
	})

	it("should respect rooIgnoreController", async () => {
		mockReadFile.mockResolvedValue(Buffer.from("jpg-bytes"))
		const rooIgnoreController = {
			validateAccess: vi.fn().mockReturnValue(false),
		}

		const result = await resolveImageMentions({
			text: "See @/secret.jpg",
			images: [],
			cwd: "/workspace",
			rooIgnoreController,
		})

		expect(rooIgnoreController.validateAccess).toHaveBeenCalledWith("secret.jpg")
		expect(mockReadFile).not.toHaveBeenCalled()
		expect(result.images).toEqual([])
	})

	it("should dedupe when mention repeats", async () => {
		mockReadFile.mockResolvedValue(Buffer.from("png-bytes"))

		const result = await resolveImageMentions({
			text: "@/a.png and again @/a.png",
			images: [],
			cwd: "/workspace",
		})

		expect(result.images).toHaveLength(1)
	})

	it("should skip images when supportsImages is false", async () => {
		mockReadFile.mockResolvedValue(Buffer.from("png-bytes"))

		const result = await resolveImageMentions({
			text: "See @/cat.png",
			images: [],
			cwd: "/workspace",
			supportsImages: false,
		})

		expect(mockReadFile).not.toHaveBeenCalled()
		expect(result.images).toEqual([])
	})

	it("should skip images that exceed size limits", async () => {
		mockValidateImage.mockResolvedValue({
			isValid: false,
			reason: "size_limit",
			notice: "Image too large",
		})

		const result = await resolveImageMentions({
			text: "See @/huge.png",
			images: [],
			cwd: "/workspace",
		})

		expect(mockValidateImage).toHaveBeenCalled()
		expect(mockReadFile).not.toHaveBeenCalled()
		expect(result.images).toEqual([])
	})

	it("should skip images that would exceed memory limit", async () => {
		mockValidateImage.mockResolvedValue({
			isValid: false,
			reason: "memory_limit",
			notice: "Would exceed memory limit",
		})

		const result = await resolveImageMentions({
			text: "See @/large.png",
			images: [],
			cwd: "/workspace",
		})

		expect(result.images).toEqual([])
	})

	it("should pass custom size limits to validation", async () => {
		mockReadFile.mockResolvedValue(Buffer.from("png-bytes"))

		await resolveImageMentions({
			text: "See @/cat.png",
			images: [],
			cwd: "/workspace",
			maxImageFileSize: 10,
			maxTotalImageSize: 50,
		})

		expect(mockValidateImage).toHaveBeenCalledWith(expect.any(String), true, 10, 50, 0)
	})
})
