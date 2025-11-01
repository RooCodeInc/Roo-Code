import type { ToolSpec } from "../../../api/transform/tool-converters"

/**
 * Tool specification for browser_action
 * This defines the schema for browser automation actions
 */
export const browserActionToolSpec: ToolSpec = {
	name: "browser_action",
	description:
		"Request to interact with a browser session for web automation and testing. Supports actions like launching URLs, clicking elements, typing text, scrolling, and capturing screenshots.",
	parameters: [
		{
			name: "action",
			type: "string",
			required: true,
			description:
				"The browser action to perform: 'launch' (open URL), 'click' (click element at coordinate), 'type' (type text), 'scroll_down', 'scroll_up', 'screenshot', or 'close'",
		},
		{
			name: "url",
			type: "string",
			required: false,
			description: "The URL to navigate to (required for 'launch' action)",
		},
		{
			name: "coordinate",
			type: "string",
			required: false,
			description: "The x,y coordinate to click (required for 'click' action, format: 'x,y')",
		},
		{
			name: "text",
			type: "string",
			required: false,
			description: "The text to type (required for 'type' action)",
		},
		{
			name: "size",
			type: "string",
			required: false,
			description: "Browser viewport size (optional, format: 'widthxheight', e.g., '1024x768')",
		},
	],
}
