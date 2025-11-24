import { t } from "../../../i18n"

// Image generation types
interface ImageGenerationResponse {
	choices?: Array<{
		message?: {
			content?: string
			images?: Array<{
				type?: string
				image_url?: {
					url?: string
				}
			}>
		}
	}>
	error?: {
		message?: string
		type?: string
		code?: string
	}
}

export interface ImageGenerationResult {
	success: boolean
	imageData?: string
	imageFormat?: string
	error?: string
}

interface ImageGenerationOptions {
	baseURL: string
	authToken: string
	model: string
	prompt: string
	inputImage?: string
}

/**
 * Shared image generation implementation for OpenRouter and Roo Code Cloud providers
 */
export async function generateImageWithProvider(options: ImageGenerationOptions): Promise<ImageGenerationResult> {
	const { baseURL, authToken, model, prompt, inputImage } = options

	try {
		const response = await fetch(`${baseURL}/chat/completions`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
				"HTTP-Referer": "https://github.com/RooVetGit/Roo-Code",
				"X-Title": "Roo Code",
			},
			body: JSON.stringify({
				model,
				messages: [
					{
						role: "user",
						content: inputImage
							? [
									{
										type: "text",
										text: prompt,
									},
									{
										type: "image_url",
										image_url: {
											url: inputImage,
										},
									},
								]
							: prompt,
					},
				],
				modalities: ["image", "text"],
			}),
		})

		if (!response.ok) {
			const errorText = await response.text()
			let errorMessage = t("tools:generateImage.failedWithStatus", {
				status: response.status,
				statusText: response.statusText,
			})

			try {
				const errorJson = JSON.parse(errorText)
				if (errorJson.error?.message) {
					errorMessage = t("tools:generateImage.failedWithMessage", {
						message: errorJson.error.message,
					})
				}
			} catch {
				// Use default error message
			}
			return {
				success: false,
				error: errorMessage,
			}
		}

		const result: ImageGenerationResponse = await response.json()

		if (result.error) {
			return {
				success: false,
				error: t("tools:generateImage.failedWithMessage", {
					message: result.error.message,
				}),
			}
		}

		// Extract the generated image from the response
		const images = result.choices?.[0]?.message?.images
		if (!images || images.length === 0) {
			return {
				success: false,
				error: t("tools:generateImage.noImageGenerated"),
			}
		}

		const imageData = images[0]?.image_url?.url
		if (!imageData) {
			return {
				success: false,
				error: t("tools:generateImage.invalidImageData"),
			}
		}

		// Extract base64 data from data URL
		const base64Match = imageData.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/)
		if (!base64Match) {
			return {
				success: false,
				error: t("tools:generateImage.invalidImageFormat"),
			}
		}

		return {
			success: true,
			imageData: imageData,
			imageFormat: base64Match[1],
		}
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : t("tools:generateImage.unknownError"),
		}
	}
}
