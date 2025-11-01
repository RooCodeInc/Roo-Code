import type { ToolSpec } from "../../../api/transform/tool-converters"

/**
 * Tool specification for generate_image
 * This defines the schema for generating images using AI
 */
export const generateImageToolSpec: ToolSpec = {
	name: "generate_image",
	description:
		"Request to generate or edit an image using AI models through OpenRouter API. This tool can create new images from text prompts or modify existing images based on your instructions. When an input image is provided, the AI will apply the requested edits, transformations, or enhancements to that image.",
	parameters: [
		{
			name: "prompt",
			type: "string",
			required: true,
			description: "The text prompt describing what to generate or how to edit the image",
		},
		{
			name: "path",
			type: "string",
			required: true,
			description:
				"The file path where the generated/edited image should be saved (relative to the current workspace directory). The tool will automatically add the appropriate image extension if not provided.",
		},
		{
			name: "image",
			type: "string",
			required: false,
			description:
				"The file path to an input image to edit or transform (relative to the current workspace directory). Supported formats: PNG, JPG, JPEG, GIF, WEBP.",
		},
	],
}
