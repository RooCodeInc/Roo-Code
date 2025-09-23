import { z } from "zod"

/**
 * Image Generation Provider
 */
export const imageGenerationProviders = ["openrouter", "gemini"] as const
export const imageGenerationProviderSchema = z.enum(imageGenerationProviders)
export type ImageGenerationProvider = z.infer<typeof imageGenerationProviderSchema>

/**
 * Image Generation Model Info
 */
export interface ImageGenerationModelInfo {
	provider: ImageGenerationProvider
	modelId: string
	label: string
	supportsEditMode?: boolean // Whether the model supports image editing (text + image input)
	maxInputSize?: number // Maximum input image size in MB
	outputFormats?: string[] // Supported output formats
}

/**
 * Image Generation Models by Provider
 */
export const IMAGE_GENERATION_MODELS: Record<ImageGenerationProvider, ImageGenerationModelInfo[]> = {
	openrouter: [
		{
			provider: "openrouter",
			modelId: "google/gemini-2.5-flash-image-preview",
			label: "Gemini 2.5 Flash Image Preview",
			supportsEditMode: true,
			outputFormats: ["png", "jpeg"],
		},
		{
			provider: "openrouter",
			modelId: "google/gemini-2.5-flash-image-preview:free",
			label: "Gemini 2.5 Flash Image Preview (Free)",
			supportsEditMode: true,
			outputFormats: ["png", "jpeg"],
		},
	],
	gemini: [
		{
			provider: "gemini",
			modelId: "gemini-2.5-flash-image-preview",
			label: "Gemini 2.5 Flash Image Preview",
			supportsEditMode: true,
			outputFormats: ["png", "jpeg"],
		},
	],
}

/**
 * Helper function to get all models for a specific provider
 */
export function getImageGenerationModelsForProvider(provider: ImageGenerationProvider): ImageGenerationModelInfo[] {
	return IMAGE_GENERATION_MODELS[provider] || []
}

/**
 * Helper function to get all available image generation models
 */
export function getAllImageGenerationModels(): ImageGenerationModelInfo[] {
	return Object.values(IMAGE_GENERATION_MODELS).flat()
}

/**
 * Image Generation Result
 */
export interface ImageGenerationResult {
	success: boolean
	imageData?: string // Base64 encoded image data URL
	imageFormat?: string // Format of the generated image (png, jpeg, etc.)
	error?: string
}
