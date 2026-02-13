import type OpenAI from "openai"

const fetchUrl: OpenAI.Chat.ChatCompletionTool = {
	type: "function",
	function: {
		name: "fetch_url",
		description:
			"Fetch the content of a URL. Returns the text content of the page. This is a lightweight alternative to browser_action for simply reading web content without needing a full browser. Supports HTML pages (returns stripped text), JSON, XML, and plain text. Does not support authentication or JavaScript rendering.",
		parameters: {
			type: "object",
			properties: {
				url: {
					type: "string",
					description: "The URL to fetch. Must be HTTP or HTTPS.",
				},
				max_length: {
					type: "number",
					description: "Maximum number of characters to return. Default: 50000.",
				},
			},
			required: ["url"],
		},
	},
}

export default fetchUrl
