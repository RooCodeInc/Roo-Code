import type OpenAI from "openai"

export default {
	type: "function",
	function: {
		name: "browser_action",
		description:
			"Interact with a browser session. Always start by launching at a URL and always finish by closing the browser. While the browser is active, do not call any other tools. Use coordinates within the viewport to hover or click, provide text for typing, and ensure actions are grounded in the latest screenshot and console logs.",
		strict: true,
		parameters: {
			type: "object",
			properties: {
				action: {
					type: "string",
					description: "Browser action to perform",
					enum: ["launch", "click", "hover", "type", "press", "scroll_down", "scroll_up", "resize", "close"],
				},
				url: {
					type: ["string", "null"],
					description: "URL to open when performing the launch action; must include protocol",
				},
				coordinate: {
					type: ["string", "null"],
					description:
						"Screen coordinate for hover or click actions in format 'x,y@WIDTHxHEIGHT' where x,y is the target position on the screenshot image and WIDTHxHEIGHT is the exact pixel dimensions of the screenshot image (not the browser viewport). Example: '450,203@900x600' means click at (450,203) on a 900x600 screenshot. The coordinates will be automatically scaled to match the actual viewport dimensions.",
				},
				size: {
					type: ["string", "null"],
					description:
						"Viewport dimensions for the resize action in format 'WIDTHxHEIGHT' or 'WIDTH,HEIGHT'. Example: '1280x800' or '1280,800'",
				},
				text: {
					type: ["string", "null"],
					description:
						"Text to type when performing the type action, or key name to press when performing the press action (e.g., 'Enter', 'Tab', 'Escape')",
				},
			},
			required: ["action"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
