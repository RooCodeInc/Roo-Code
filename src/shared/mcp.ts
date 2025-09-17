export type McpErrorEntry = {
	message: string
	timestamp: number
	level: "error" | "warn" | "info"
}

export type McpServer = {
	name: string
	config: string
	status: "connected" | "connecting" | "disconnected"
	error?: string
	errorHistory?: McpErrorEntry[]
	tools?: McpTool[]
	resources?: McpResource[]
	resourceTemplates?: McpResourceTemplate[]
	prompts?: McpPrompt[]
	disabled?: boolean
	timeout?: number
	source?: "global" | "project"
	projectPath?: string
	instructions?: string
}

export type McpTool = {
	name: string
	description?: string
	inputSchema?: object
	alwaysAllow?: boolean
	enabledForPrompt?: boolean
}

export type McpResource = {
	uri: string
	name: string
	mimeType?: string
	description?: string
}

export type McpResourceTemplate = {
	uriTemplate: string
	name: string
	description?: string
	mimeType?: string
}

export type McpPrompt = {
	name: string
	description?: string
	arguments?: McpPromptArgument[]
}

export type McpPromptArgument = {
	name: string
	description?: string
	required?: boolean
}

export type McpPromptMessage = {
	role: "user" | "assistant" | "system"
	content: {
		type: "text" | "image" | "resource"
		text?: string
		data?: string
		mimeType?: string
		resource?: {
			uri: string
			text?: string
			blob?: string
			mimeType?: string
		}
	}
}

export type McpGetPromptResponse = {
	_meta?: Record<string, any>
	description?: string
	messages: McpPromptMessage[]
}

export type McpResourceResponse = {
	_meta?: Record<string, any>
	contents: Array<{
		uri: string
		mimeType?: string
		text?: string
		blob?: string
	}>
}

export type McpToolCallResponse = {
	_meta?: Record<string, any>
	content: Array<
		| {
				type: "text"
				text: string
		  }
		| {
				type: "image"
				data: string
				mimeType: string
		  }
		| {
				type: "audio"
				data: string
				mimeType: string
		  }
		| {
				type: "resource"
				resource: {
					uri: string
					mimeType?: string
					text?: string
					blob?: string
				}
		  }
	>
	isError?: boolean
}
