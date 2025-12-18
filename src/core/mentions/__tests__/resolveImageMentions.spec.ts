import * as path from "path"

import { resolveImageMentions } from "../resolveImageMentions"

vi.mock("fs/promises", () => {
	return {
		default: {
			readFile: vi.fn(),
		},
		readFile: vi.fn(),
	}
})

import * as fs from "fs/promises"

const mockReadFile = vi.mocked(fs.readFile)

describe("resolveImageMentions", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should append a data URL when a local png mention is present", async () => {
		mockReadFile.mockResolvedValue(Buffer.from("png-bytes"))

		const result = await resolveImageMentions({
			text: "Please look at @/assets/cat.png",
			images: [],
			cwd: "/workspace",
		})

		expect(mockReadFile).toHaveBeenCalledWith(path.resolve("/workspace", "assets/cat.png"))
		expect(result.text).toBe("Please look at @/assets/cat.png")
		expect(result.images).toEqual([`data:image/png;base64,${Buffer.from("png-bytes").toString("base64")}`])
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
})
