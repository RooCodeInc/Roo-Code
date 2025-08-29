import { ToolArgs } from "./types"

export function getGenerateImageDescription(args: ToolArgs): string {
	return `## generate_image
Description: Request to generate an image using AI models through OpenRouter API. This tool creates images from text prompts and saves them to the specified path. Optionally, you can provide an input image to use as a reference or starting point for the generation.
Parameters:
- prompt: (required) The text prompt describing the image to generate
- path: (required) The file path where the generated image should be saved (relative to the current workspace directory ${args.cwd}). The tool will automatically add the appropriate image extension if not provided.
- image: (optional) The file path to an input image to use as a reference or starting point (relative to the current workspace directory ${args.cwd}). Supported formats: PNG, JPG, JPEG, GIF, WEBP.
Usage:
<generate_image>
<prompt>Your image description here</prompt>
<path>path/to/save/image.png</path>
<image>path/to/input/image.jpg</image>
</generate_image>

Example: Requesting to generate a sunset image
<generate_image>
<prompt>A beautiful sunset over mountains with vibrant orange and purple colors</prompt>
<path>images/sunset.png</path>
</generate_image>

Example: Generating an image with an input reference
<generate_image>
<prompt>Transform this image into a watercolor painting style</prompt>
<path>images/watercolor-output.png</path>
<image>images/original-photo.jpg</image>
</generate_image>`
}
