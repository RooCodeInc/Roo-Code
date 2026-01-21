import type OpenAI from "openai"

const SAVE_IMAGE_DESCRIPTION = `Request to save a base64-encoded image to a file. This tool is useful for saving images that were received from MCP tools or other sources. The image data must be provided as a base64 data URL.

Parameters:
- path: (required) The file path where the image should be saved (relative to the current workspace directory). The tool will automatically add the appropriate image extension based on the image format if not provided.
- data: (required) The base64-encoded image data URL (e.g., 'data:image/png;base64,...'). Supported formats: PNG, JPG, JPEG, GIF, WEBP, SVG.

Example: Saving a PNG image
{ "path": "images/screenshot.png", "data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEU..." }

Example: Saving a JPEG image to a specific location
{ "path": "assets/captured-image", "data": "data:image/jpeg;base64,/9j/4AAQSkZJRg..." }`

const PATH_PARAMETER_DESCRIPTION = `Filesystem path (relative to the workspace) where the image should be saved`

const DATA_PARAMETER_DESCRIPTION = `Base64-encoded image data URL (e.g., 'data:image/png;base64,...')`

export default {
	type: "function",
	function: {
		name: "save_image",
		description: SAVE_IMAGE_DESCRIPTION,
		strict: true,
		parameters: {
			type: "object",
			properties: {
				path: {
					type: "string",
					description: PATH_PARAMETER_DESCRIPTION,
				},
				data: {
					type: "string",
					description: DATA_PARAMETER_DESCRIPTION,
				},
			},
			required: ["path", "data"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
