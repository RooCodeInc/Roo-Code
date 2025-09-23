import path from "path"
import fs from "fs/promises"
import * as vscode from "vscode"
import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { fileExistsAtPath } from "../../utils/fs"
import { getReadablePath } from "../../utils/path"
import { isPathOutsideWorkspace } from "../../utils/pathUtils"
import { EXPERIMENT_IDS, experiments } from "../../shared/experiments"
import { OpenRouterHandler } from "../../api/providers/openrouter"
import { GeminiHandler } from "../../api/providers/gemini"
import { ImageGenerationProvider, getImageGenerationModelsForProvider } from "@roo-code/types"

export async function generateImageTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const prompt: string | undefined = block.params.prompt
	const relPath: string | undefined = block.params.path
	const inputImagePath: string | undefined = block.params.image

	// Check if the experiment is enabled
	const provider = cline.providerRef.deref()
	const state = await provider?.getState()
	const isImageGenerationEnabled = experiments.isEnabled(state?.experiments ?? {}, EXPERIMENT_IDS.IMAGE_GENERATION)

	if (!isImageGenerationEnabled) {
		pushToolResult(
			formatResponse.toolError(
				"Image generation is an experimental feature that must be enabled in settings. Please enable 'Image Generation' in the Experimental Settings section.",
			),
		)
		return
	}

	if (block.partial) {
		return
	}

	if (!prompt) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("generate_image")
		pushToolResult(await cline.sayAndCreateMissingParamError("generate_image", "prompt"))
		return
	}

	if (!relPath) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("generate_image")
		pushToolResult(await cline.sayAndCreateMissingParamError("generate_image", "path"))
		return
	}

	// Validate access permissions
	const accessAllowed = cline.rooIgnoreController?.validateAccess(relPath)
	if (!accessAllowed) {
		await cline.say("rooignore_error", relPath)
		pushToolResult(formatResponse.toolError(formatResponse.rooIgnoreError(relPath)))
		return
	}

	// If input image is provided, validate it exists and can be read
	let inputImageData: string | undefined
	if (inputImagePath) {
		const inputImageFullPath = path.resolve(cline.cwd, inputImagePath)

		// Check if input image exists
		const inputImageExists = await fileExistsAtPath(inputImageFullPath)
		if (!inputImageExists) {
			await cline.say("error", `Input image not found: ${getReadablePath(cline.cwd, inputImagePath)}`)
			pushToolResult(
				formatResponse.toolError(`Input image not found: ${getReadablePath(cline.cwd, inputImagePath)}`),
			)
			return
		}

		// Validate input image access permissions
		const inputImageAccessAllowed = cline.rooIgnoreController?.validateAccess(inputImagePath)
		if (!inputImageAccessAllowed) {
			await cline.say("rooignore_error", inputImagePath)
			pushToolResult(formatResponse.toolError(formatResponse.rooIgnoreError(inputImagePath)))
			return
		}

		// Read the input image file
		try {
			const imageBuffer = await fs.readFile(inputImageFullPath)
			const imageExtension = path.extname(inputImageFullPath).toLowerCase().replace(".", "")

			// Validate image format
			const supportedFormats = ["png", "jpg", "jpeg", "gif", "webp"]
			if (!supportedFormats.includes(imageExtension)) {
				await cline.say(
					"error",
					`Unsupported image format: ${imageExtension}. Supported formats: ${supportedFormats.join(", ")}`,
				)
				pushToolResult(
					formatResponse.toolError(
						`Unsupported image format: ${imageExtension}. Supported formats: ${supportedFormats.join(", ")}`,
					),
				)
				return
			}

			// Convert to base64 data URL
			const mimeType = imageExtension === "jpg" ? "jpeg" : imageExtension
			inputImageData = `data:image/${mimeType};base64,${imageBuffer.toString("base64")}`
		} catch (error) {
			await cline.say(
				"error",
				`Failed to read input image: ${error instanceof Error ? error.message : "Unknown error"}`,
			)
			pushToolResult(
				formatResponse.toolError(
					`Failed to read input image: ${error instanceof Error ? error.message : "Unknown error"}`,
				),
			)
			return
		}
	}

	// Check if file is write-protected
	const isWriteProtected = cline.rooProtectedController?.isWriteProtected(relPath) || false

	// Get the selected provider from settings (default to openrouter)
	const selectedProvider = (state?.imageGenerationProvider || "openrouter") as ImageGenerationProvider

	// Get selected model from settings based on provider
	let selectedModel: string
	let apiKey: string | undefined

	if (selectedProvider === "openrouter") {
		apiKey = state?.openRouterImageApiKey
		if (!apiKey) {
			await cline.say(
				"error",
				"OpenRouter API key is required for image generation. Please configure it in the Image Generation experimental settings.",
			)
			pushToolResult(
				formatResponse.toolError(
					"OpenRouter API key is required for image generation. Please configure it in the Image Generation experimental settings.",
				),
			)
			return
		}
		// Get selected model or use default for OpenRouter
		const models = getImageGenerationModelsForProvider("openrouter")
		selectedModel =
			state?.openRouterImageGenerationSelectedModel ||
			(models[0]?.modelId ?? "google/gemini-2.5-flash-image-preview")
	} else if (selectedProvider === "gemini") {
		// For Gemini, we can use the existing Gemini API key from the provider settings
		// Check for a dedicated image generation API key first, then fall back to the provider's API key
		apiKey =
			state?.geminiImageApiKey ||
			(state?.apiConfiguration?.apiProvider === "gemini" ? state?.apiConfiguration?.geminiApiKey : undefined)
		if (!apiKey) {
			await cline.say(
				"error",
				"Gemini API key is required for image generation. Please configure it in the Image Generation experimental settings or in the Gemini provider settings.",
			)
			pushToolResult(
				formatResponse.toolError(
					"Gemini API key is required for image generation. Please configure it in the Image Generation experimental settings or in the Gemini provider settings.",
				),
			)
			return
		}
		// Get selected model or use default for Gemini
		const models = getImageGenerationModelsForProvider("gemini")
		selectedModel =
			state?.geminiImageGenerationSelectedModel || (models[0]?.modelId ?? "gemini-2.5-flash-image-preview")
	} else {
		await cline.say("error", `Unsupported image generation provider: ${selectedProvider}`)
		pushToolResult(formatResponse.toolError(`Unsupported image generation provider: ${selectedProvider}`))
		return
	}

	// Determine if the path is outside the workspace
	const fullPath = path.resolve(cline.cwd, removeClosingTag("path", relPath))
	const isOutsideWorkspace = isPathOutsideWorkspace(fullPath)

	const sharedMessageProps = {
		tool: "generateImage" as const,
		path: getReadablePath(cline.cwd, removeClosingTag("path", relPath)),
		content: prompt,
		isOutsideWorkspace,
		isProtected: isWriteProtected,
	}

	try {
		if (!block.partial) {
			cline.consecutiveMistakeCount = 0

			// Ask for approval before generating the image
			const approvalMessage = JSON.stringify({
				...sharedMessageProps,
				content: prompt,
				...(inputImagePath && { inputImage: getReadablePath(cline.cwd, inputImagePath) }),
			})

			const didApprove = await askApproval("tool", approvalMessage, undefined, isWriteProtected)

			if (!didApprove) {
				return
			}

			// Generate image based on provider
			let result

			if (selectedProvider === "openrouter") {
				// Create a temporary OpenRouter handler with minimal options
				const openRouterHandler = new OpenRouterHandler({} as any)

				// Call the generateImage method with the explicit API key and optional input image
				result = await openRouterHandler.generateImage(prompt, selectedModel, apiKey!, inputImageData)
			} else if (selectedProvider === "gemini") {
				// Create a temporary Gemini handler with minimal options
				const geminiHandler = new GeminiHandler({ geminiApiKey: apiKey } as any)

				// Call the generateImage method with the optional input image
				result = await geminiHandler.generateImage(prompt, selectedModel, apiKey, inputImageData)
			} else {
				// This should not happen due to earlier check, but for type safety
				result = {
					success: false,
					error: `Unsupported provider: ${selectedProvider}`,
				}
			}

			if (!result.success) {
				await cline.say("error", result.error || "Failed to generate image")
				pushToolResult(formatResponse.toolError(result.error || "Failed to generate image"))
				return
			}

			if (!result.imageData) {
				const errorMessage = "No image data received"
				await cline.say("error", errorMessage)
				pushToolResult(formatResponse.toolError(errorMessage))
				return
			}

			// Extract base64 data from data URL
			const base64Match = result.imageData.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/)
			if (!base64Match) {
				const errorMessage = "Invalid image format received"
				await cline.say("error", errorMessage)
				pushToolResult(formatResponse.toolError(errorMessage))
				return
			}

			const imageFormat = base64Match[1]
			const base64Data = base64Match[2]

			// Ensure the file has the correct extension
			let finalPath = relPath
			if (!finalPath.match(/\.(png|jpg|jpeg)$/i)) {
				finalPath = `${finalPath}.${imageFormat === "jpeg" ? "jpg" : imageFormat}`
			}

			// Convert base64 to buffer
			const imageBuffer = Buffer.from(base64Data, "base64")

			// Create directory if it doesn't exist
			const absolutePath = path.resolve(cline.cwd, finalPath)
			const directory = path.dirname(absolutePath)
			await fs.mkdir(directory, { recursive: true })

			// Write the image file
			await fs.writeFile(absolutePath, imageBuffer)

			// Track file creation
			if (finalPath) {
				await cline.fileContextTracker.trackFileContext(finalPath, "roo_edited")
			}

			cline.didEditFile = true

			// Record successful tool usage
			cline.recordToolUsage("generate_image")

			// Get the webview URI for the image
			const provider = cline.providerRef.deref()
			const fullImagePath = path.join(cline.cwd, finalPath)

			// Convert to webview URI if provider is available
			let imageUri = provider?.convertToWebviewUri?.(fullImagePath) ?? vscode.Uri.file(fullImagePath).toString()

			// Add cache-busting parameter to prevent browser caching issues
			const cacheBuster = Date.now()
			imageUri = imageUri.includes("?") ? `${imageUri}&t=${cacheBuster}` : `${imageUri}?t=${cacheBuster}`

			// Send the image with the webview URI
			await cline.say("image", JSON.stringify({ imageUri, imagePath: fullImagePath }))
			pushToolResult(formatResponse.toolResult(getReadablePath(cline.cwd, finalPath)))

			return
		}
	} catch (error) {
		await handleError("generating image", error)
		return
	}
}
