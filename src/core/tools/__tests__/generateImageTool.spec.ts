import * as path from "path"
import * as fs from "fs/promises"
import type { MockedFunction } from "vitest"

import { fileExistsAtPath } from "../../../utils/fs"
import { isPathOutsideWorkspace } from "../../../utils/pathUtils"
import { getReadablePath } from "../../../utils/path"
import { ToolUse, ToolResponse } from "../../../shared/tools"
import { generateImageTool } from "../generateImageTool"
import { OpenRouterHandler } from "../../../api/providers/openrouter"
import { EXPERIMENT_IDS, experiments } from "../../../shared/experiments"

vi.mock("path", async () => {
	const originalPath = await vi.importActual("path")
	return {
		...originalPath,
		resolve: vi.fn().mockImplementation((...args) => {
			const separator = process.platform === "win32" ? "\\" : "/"
			return args.join(separator)
		}),
	}
})

vi.mock("fs/promises", () => ({
	default: {
		mkdir: vi.fn().mockResolvedValue(undefined),
		writeFile: vi.fn().mockResolvedValue(undefined),
		readFile: vi.fn().mockResolvedValue(Buffer.from("test image data")),
	},
	mkdir: vi.fn().mockResolvedValue(undefined),
	writeFile: vi.fn().mockResolvedValue(undefined),
	readFile: vi.fn().mockResolvedValue(Buffer.from("test image data")),
}))

vi.mock("../../../utils/fs", () => ({
	fileExistsAtPath: vi.fn().mockResolvedValue(false),
}))

vi.mock("../../../utils/pathUtils", () => ({
	isPathOutsideWorkspace: vi.fn().mockReturnValue(false),
}))

vi.mock("../../../utils/path", () => ({
	getReadablePath: vi.fn().mockReturnValue("test/path.png"),
}))

vi.mock("../../prompts/responses", () => ({
	formatResponse: {
		toolError: vi.fn((msg) => `Error: ${msg}`),
		toolResult: vi.fn((msg) => `Result: ${msg}`),
		rooIgnoreError: vi.fn((path) => `Access denied: ${path}`),
	},
}))

vi.mock("../../../api/providers/openrouter", () => ({
	OpenRouterHandler: vi.fn().mockImplementation(() => ({
		generateImage: vi.fn().mockResolvedValue({
			success: true,
			imageData:
				"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
			imageFormat: "png",
		}),
	})),
}))

vi.mock("../../../shared/experiments", () => ({
	EXPERIMENT_IDS: {
		IMAGE_GENERATION: "imageGeneration",
	},
	experiments: {
		isEnabled: vi.fn().mockReturnValue(true),
	},
}))

describe("generateImageTool", () => {
	const testImagePath = "test/image.png"
	const testInputImagePath = "test/input.jpg"
	const testPrompt = "A beautiful sunset"
	const absoluteImagePath = process.platform === "win32" ? "C:\\test\\image.png" : "/test/image.png"
	const absoluteInputImagePath = process.platform === "win32" ? "C:\\test\\input.jpg" : "/test/input.jpg"

	const mockedFileExistsAtPath = fileExistsAtPath as MockedFunction<typeof fileExistsAtPath>
	const mockedIsPathOutsideWorkspace = isPathOutsideWorkspace as MockedFunction<typeof isPathOutsideWorkspace>
	const mockedGetReadablePath = getReadablePath as MockedFunction<typeof getReadablePath>
	const mockedPathResolve = path.resolve as MockedFunction<typeof path.resolve>
	const mockedFsReadFile = (fs as any).readFile as MockedFunction<typeof fs.readFile>
	const mockedFsWriteFile = (fs as any).writeFile as MockedFunction<typeof fs.writeFile>
	const mockedFsMkdir = (fs as any).mkdir as MockedFunction<typeof fs.mkdir>
	const mockedExperimentsIsEnabled = experiments.isEnabled as MockedFunction<typeof experiments.isEnabled>

	const mockCline: any = {}
	let mockAskApproval: ReturnType<typeof vi.fn>
	let mockHandleError: ReturnType<typeof vi.fn>
	let mockPushToolResult: ReturnType<typeof vi.fn>
	let mockRemoveClosingTag: ReturnType<typeof vi.fn>
	let mockOpenRouterHandler: any
	let toolResult: ToolResponse | undefined

	beforeEach(() => {
		vi.clearAllMocks()

		mockedPathResolve.mockImplementation((...args) => {
			const separator = process.platform === "win32" ? "\\" : "/"
			return args.join(separator)
		})
		mockedFileExistsAtPath.mockResolvedValue(false)
		mockedIsPathOutsideWorkspace.mockReturnValue(false)
		mockedGetReadablePath.mockImplementation((cwd, path) => path || "")
		mockedExperimentsIsEnabled.mockReturnValue(true)

		mockOpenRouterHandler = {
			generateImage: vi.fn().mockResolvedValue({
				success: true,
				imageData:
					"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
				imageFormat: "png",
			}),
		}
		;(OpenRouterHandler as any).mockImplementation(() => mockOpenRouterHandler)

		mockCline.cwd = "/"
		mockCline.consecutiveMistakeCount = 0
		mockCline.didEditFile = false
		mockCline.providerRef = {
			deref: vi.fn().mockReturnValue({
				getState: vi.fn().mockResolvedValue({
					experiments: {
						imageGeneration: true,
					},
					apiConfiguration: {
						openRouterImageGenerationSettings: {
							openRouterApiKey: "test-api-key",
							selectedModel: "google/gemini-2.5-flash-image-preview",
						},
					},
				}),
			}),
		}
		mockCline.rooIgnoreController = {
			validateAccess: vi.fn().mockReturnValue(true),
		}
		mockCline.rooProtectedController = {
			isWriteProtected: vi.fn().mockReturnValue(false),
		}
		mockCline.fileContextTracker = {
			trackFileContext: vi.fn().mockResolvedValue(undefined),
		}
		mockCline.say = vi.fn().mockResolvedValue(undefined)
		mockCline.recordToolError = vi.fn()
		mockCline.recordToolUsage = vi.fn()
		mockCline.sayAndCreateMissingParamError = vi.fn().mockResolvedValue("Missing param error")

		mockAskApproval = vi.fn().mockResolvedValue(true)
		mockHandleError = vi.fn().mockResolvedValue(undefined)
		mockRemoveClosingTag = vi.fn((tag, content) => content)

		toolResult = undefined
		mockPushToolResult = vi.fn((result: ToolResponse) => {
			toolResult = result
		})
	})

	async function executeGenerateImageTool(
		params: Partial<ToolUse["params"]> = {},
		options: {
			isPartial?: boolean
			accessAllowed?: boolean
			experimentEnabled?: boolean
			inputImageExists?: boolean
		} = {},
	): Promise<ToolResponse | undefined> {
		const isPartial = options.isPartial ?? false
		const accessAllowed = options.accessAllowed ?? true
		const experimentEnabled = options.experimentEnabled ?? true
		const inputImageExists = options.inputImageExists ?? true

		mockedExperimentsIsEnabled.mockReturnValue(experimentEnabled)
		mockCline.rooIgnoreController.validateAccess.mockReturnValue(accessAllowed)

		if (params.image) {
			mockedFileExistsAtPath.mockImplementation(async (path) => {
				if (path.includes("input")) {
					return inputImageExists
				}
				return false
			})
		}

		const toolUse: ToolUse = {
			type: "tool_use",
			name: "generate_image",
			params: {
				prompt: testPrompt,
				path: testImagePath,
				...params,
			},
			partial: isPartial,
		}

		await generateImageTool(
			mockCline,
			toolUse,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		return toolResult
	}

	describe("basic functionality", () => {
		it("generates image successfully without input image", async () => {
			const result = await executeGenerateImageTool()

			expect(mockOpenRouterHandler.generateImage).toHaveBeenCalledWith(
				testPrompt,
				"google/gemini-2.5-flash-image-preview",
				"test-api-key",
				undefined,
			)
			expect(mockCline.say).toHaveBeenCalledWith("text", testImagePath, expect.any(Array))
			expect(mockCline.recordToolUsage).toHaveBeenCalledWith("generate_image")
			expect(toolResult).toBe("Result: test/image.png")
		})

		it("generates image with input image reference", async () => {
			const mockImageBuffer = Buffer.from("test image data")
			mockedFsReadFile.mockResolvedValue(mockImageBuffer)

			const result = await executeGenerateImageTool({ image: testInputImagePath })

			expect(mockedFileExistsAtPath).toHaveBeenCalledWith(expect.stringContaining("input"))
			expect(mockedFsReadFile).toHaveBeenCalledWith(expect.stringContaining("input"))
			expect(mockOpenRouterHandler.generateImage).toHaveBeenCalledWith(
				testPrompt,
				"google/gemini-2.5-flash-image-preview",
				"test-api-key",
				expect.stringContaining("data:image/jpeg;base64,"),
			)
			expect(mockCline.recordToolUsage).toHaveBeenCalledWith("generate_image")
			expect(toolResult).toBe("Result: test/image.png")
		})
	})

	describe("input image validation", () => {
		it("fails when input image does not exist", async () => {
			const result = await executeGenerateImageTool({ image: testInputImagePath }, { inputImageExists: false })

			expect(mockCline.say).toHaveBeenCalledWith("error", expect.stringContaining("Input image not found"))
			expect(toolResult).toBe("Error: Input image not found: test/input.jpg")
			expect(mockOpenRouterHandler.generateImage).not.toHaveBeenCalled()
		})

		it("fails when input image has unsupported format", async () => {
			const unsupportedImagePath = "test/input.bmp"
			const result = await executeGenerateImageTool({ image: unsupportedImagePath })

			expect(mockCline.say).toHaveBeenCalledWith("error", expect.stringContaining("Unsupported image format"))
			expect(toolResult).toContain("Error: Unsupported image format")
			expect(mockOpenRouterHandler.generateImage).not.toHaveBeenCalled()
		})

		it("validates access permissions for input image", async () => {
			mockCline.rooIgnoreController.validateAccess.mockImplementation((path: string) => {
				return !path.includes("input")
			})

			const result = await executeGenerateImageTool({ image: testInputImagePath })

			expect(mockCline.rooIgnoreController.validateAccess).toHaveBeenCalledWith(testInputImagePath)
			expect(mockCline.say).toHaveBeenCalledWith("rooignore_error", testInputImagePath)
			expect(toolResult).toBe("Error: Access denied: test/input.jpg")
		})

		it("handles input image read errors gracefully", async () => {
			mockedFsReadFile.mockRejectedValue(new Error("Read error"))

			const result = await executeGenerateImageTool({ image: testInputImagePath })

			expect(mockCline.say).toHaveBeenCalledWith("error", expect.stringContaining("Failed to read input image"))
			expect(toolResult).toContain("Error: Failed to read input image")
			expect(mockOpenRouterHandler.generateImage).not.toHaveBeenCalled()
		})
	})

	describe("experiment and API key validation", () => {
		it("fails when experiment is not enabled", async () => {
			const result = await executeGenerateImageTool({}, { experimentEnabled: false })

			expect(toolResult).toContain("Error: Image generation is an experimental feature")
			expect(mockOpenRouterHandler.generateImage).not.toHaveBeenCalled()
		})

		it("fails when API key is missing", async () => {
			mockCline.providerRef.deref().getState.mockResolvedValue({
				experiments: { imageGeneration: true },
				apiConfiguration: {
					openRouterImageGenerationSettings: {
						openRouterApiKey: undefined,
						selectedModel: "google/gemini-2.5-flash-image-preview",
					},
				},
			})

			const result = await executeGenerateImageTool()

			expect(mockCline.say).toHaveBeenCalledWith(
				"error",
				expect.stringContaining("OpenRouter API key is required"),
			)
			expect(toolResult).toContain("Error: OpenRouter API key is required")
			expect(mockOpenRouterHandler.generateImage).not.toHaveBeenCalled()
		})
	})

	describe("parameter validation", () => {
		it("fails when prompt is missing", async () => {
			const result = await executeGenerateImageTool({ prompt: undefined })

			expect(mockCline.recordToolError).toHaveBeenCalledWith("generate_image")
			expect(mockCline.sayAndCreateMissingParamError).toHaveBeenCalledWith("generate_image", "prompt")
			expect(toolResult).toBe("Missing param error")
		})

		it("fails when path is missing", async () => {
			const result = await executeGenerateImageTool({ path: undefined })

			expect(mockCline.recordToolError).toHaveBeenCalledWith("generate_image")
			expect(mockCline.sayAndCreateMissingParamError).toHaveBeenCalledWith("generate_image", "path")
			expect(toolResult).toBe("Missing param error")
		})

		it("returns early for partial blocks with missing params", async () => {
			const result = await executeGenerateImageTool({ prompt: undefined }, { isPartial: true })

			expect(mockOpenRouterHandler.generateImage).not.toHaveBeenCalled()
			expect(toolResult).toBeUndefined()
		})
	})

	describe("approval flow", () => {
		it("includes input image path in approval message", async () => {
			const result = await executeGenerateImageTool({ image: testInputImagePath })

			expect(mockAskApproval).toHaveBeenCalledWith(
				"tool",
				expect.stringContaining(testInputImagePath),
				undefined,
				false,
			)
		})

		it("skips generation when user denies approval", async () => {
			mockAskApproval.mockResolvedValue(false)

			const result = await executeGenerateImageTool()

			expect(mockOpenRouterHandler.generateImage).not.toHaveBeenCalled()
			expect(toolResult).toBeUndefined()
		})
	})

	describe("error handling", () => {
		it("handles API generation failure", async () => {
			mockOpenRouterHandler.generateImage.mockResolvedValue({
				success: false,
				error: "API error occurred",
			})

			const result = await executeGenerateImageTool()

			expect(mockCline.say).toHaveBeenCalledWith("error", "API error occurred")
			expect(toolResult).toBe("Error: API error occurred")
		})

		it("handles missing image data in response", async () => {
			mockOpenRouterHandler.generateImage.mockResolvedValue({
				success: true,
				imageData: undefined,
			})

			const result = await executeGenerateImageTool()

			expect(mockCline.say).toHaveBeenCalledWith("error", "No image data received")
			expect(toolResult).toBe("Error: No image data received")
		})

		it("handles invalid image format in response", async () => {
			mockOpenRouterHandler.generateImage.mockResolvedValue({
				success: true,
				imageData: "invalid-data",
			})

			const result = await executeGenerateImageTool()

			expect(mockCline.say).toHaveBeenCalledWith("error", "Invalid image format received")
			expect(toolResult).toBe("Error: Invalid image format received")
		})

		it("handles general errors with error handler", async () => {
			mockOpenRouterHandler.generateImage.mockRejectedValue(new Error("Unexpected error"))

			const result = await executeGenerateImageTool()

			expect(mockHandleError).toHaveBeenCalledWith("generating image", expect.any(Error))
		})
	})

	describe("file operations", () => {
		it("creates directory structure if needed", async () => {
			const result = await executeGenerateImageTool()

			expect(mockedFsMkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true })
		})

		it("adds correct extension if missing", async () => {
			mockOpenRouterHandler.generateImage.mockResolvedValue({
				success: true,
				imageData: "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
				imageFormat: "jpeg",
			})

			const result = await executeGenerateImageTool({ path: "test/image" })

			expect(mockedFsWriteFile).toHaveBeenCalledWith(expect.stringContaining(".jpg"), expect.any(Buffer))
		})

		it("tracks file context after creation", async () => {
			const result = await executeGenerateImageTool()

			expect(mockCline.fileContextTracker.trackFileContext).toHaveBeenCalledWith(
				expect.stringContaining(".png"),
				"roo_edited",
			)
			expect(mockCline.didEditFile).toBe(true)
		})
	})
})
