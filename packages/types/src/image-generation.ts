/**
 * Image generation model constants
 */

export interface ImageGenerationModel {
	value: string
	label: string
}

export const IMAGE_GENERATION_MODELS: ImageGenerationModel[] = [
	{ value: "google/gemini-2.5-flash-image", label: "Gemini 2.5 Flash Image" },
	{ value: "google/gemini-3-pro-image-preview", label: "Gemini 3 Pro Image Preview" },
	{ value: "openai/gpt-5-image", label: "GPT-5 Image" },
	{ value: "openai/gpt-5-image-mini", label: "GPT-5 Image Mini" },
]

/**
 * Get array of model values only (for backend validation)
 */
export const IMAGE_GENERATION_MODEL_IDS = IMAGE_GENERATION_MODELS.map((m) => m.value)
