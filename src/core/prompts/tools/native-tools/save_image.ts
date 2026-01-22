import type OpenAI from "openai"

const SAVE_IMAGE_DESCRIPTION = `Request to save an image to a file. This tool supports two methods:

1. **Using source_path (PREFERRED for MCP tools)**: When you receive images from MCP tools like Figma, the images are automatically saved to temporary storage and you receive file paths. Use the source_path parameter to copy the image to your desired location. This is efficient and avoids data corruption.

2. **Using data (for base64 data URLs)**: For images provided as base64 data URLs from other sources.

Parameters:
- path: (required) The destination file path where the image should be saved (relative to the current workspace directory). The tool will automatically add the appropriate image extension based on the source image format if not provided.
- source_path: (optional) The absolute path to a source image file (typically from MCP tool temporary storage). Use this for images received from MCP tools - the path is provided in the tool response. PREFERRED over data.
- data: (optional) Base64-encoded image data URL (e.g., 'data:image/png;base64,...'). Supported formats: PNG, JPG, JPEG, GIF, WEBP, SVG. Only use if source_path is not available.

NOTE: Either source_path OR data must be provided.

Example: Saving an image from MCP tool (PREFERRED)
{ "path": "images/figma-screenshot.png", "source_path": "/path/to/temp/figma_get_screenshot_123.png" }

Example: Saving a base64 image (fallback)
{ "path": "images/screenshot.png", "data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEU..." }`

const PATH_PARAMETER_DESCRIPTION = `Destination filesystem path (relative to the workspace) where the image should be saved`

const SOURCE_PATH_PARAMETER_DESCRIPTION = `Absolute path to a source image file (from MCP tool temporary storage). PREFERRED method for saving images from MCP tools.`

const DATA_PARAMETER_DESCRIPTION = `Base64-encoded image data URL (e.g., 'data:image/png;base64,...'). Only use if source_path is not available.`

export default {
	type: "function",
	function: {
		name: "save_image",
		description: SAVE_IMAGE_DESCRIPTION,
		strict: false, // Changed to non-strict to allow optional parameters
		parameters: {
			type: "object",
			properties: {
				path: {
					type: "string",
					description: PATH_PARAMETER_DESCRIPTION,
				},
				source_path: {
					type: "string",
					description: SOURCE_PATH_PARAMETER_DESCRIPTION,
				},
				data: {
					type: "string",
					description: DATA_PARAMETER_DESCRIPTION,
				},
			},
			required: ["path"],
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
