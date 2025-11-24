/**
 * Image generation model constants
 */

export interface ImageGenerationModel {
	value: string
	label: string
	provider: ImageGenerationProvider
}

export const IMAGE_GENERATION_MODELS: ImageGenerationModel[] = [
	// OpenRouter models
	{ value: "google/gemini-2.5-flash-image", label: "Gemini 2.5 Flash Image", provider: "openrouter" },
	{ value: "google/gemini-3-pro-image-preview", label: "Gemini 3 Pro Image Preview", provider: "openrouter" },
	{ value: "openai/gpt-5-image", label: "GPT-5 Image", provider: "openrouter" },
	{ value: "openai/gpt-5-image-mini", label: "GPT-5 Image Mini", provider: "openrouter" },
	// Roo Code Cloud models
	{ value: "google/gemini-2.5-flash-image", label: "Gemini 2.5 Flash Image", provider: "roo" },
	{ value: "google/gemini-3-pro-image", label: "Gemini 3 Pro Image", provider: "roo" },
]

/**
 * Get array of model values only (for backend validation)
 */
export const IMAGE_GENERATION_MODEL_IDS = IMAGE_GENERATION_MODELS.map((m) => m.value)

/**
 * Image generation provider type
 */
export type ImageGenerationProvider = "openrouter" | "roo"

/**
 * Get the image generation provider with backwards compatibility
 * - If provider is explicitly set, use it
 * - If a model is already configured (existing users), default to "openrouter"
 * - Otherwise default to "roo" (new users)
 */
export function getImageGenerationProvider(
	explicitProvider: ImageGenerationProvider | undefined,
	hasExistingModel: boolean,
): ImageGenerationProvider {
	return explicitProvider !== undefined ? explicitProvider : hasExistingModel ? "openrouter" : "roo"
}
