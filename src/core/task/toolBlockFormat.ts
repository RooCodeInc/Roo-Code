export type ToolUseLikeBlock = {
	type: "tool_use" | "tool-call"
	id?: string
	toolCallId?: string
	name?: string
	toolName?: string
	input?: unknown
}

export type ToolResultLikeBlock = {
	type: "tool_result" | "tool-result"
	tool_use_id?: string
	toolCallId?: string
	content?: unknown
	output?: unknown
	is_error?: boolean
	isError?: boolean
}

export function isToolUseLikeBlock(block: unknown): block is ToolUseLikeBlock {
	if (!block || typeof block !== "object") {
		return false
	}
	const maybeTool = block as ToolUseLikeBlock
	return maybeTool.type === "tool_use" || maybeTool.type === "tool-call"
}

export function getToolUseLikeId(block: ToolUseLikeBlock): string | undefined {
	return block.type === "tool_use" ? block.id : block.toolCallId
}

export function getToolUseLikeName(block: ToolUseLikeBlock): string {
	return block.type === "tool_use" ? (block.name ?? "unknown_tool") : (block.toolName ?? "unknown_tool")
}

export function isToolResultLikeBlock(block: unknown): block is ToolResultLikeBlock {
	if (!block || typeof block !== "object") {
		return false
	}
	const maybeToolResult = block as ToolResultLikeBlock
	return maybeToolResult.type === "tool_result" || maybeToolResult.type === "tool-result"
}

export function getToolResultLikeId(block: ToolResultLikeBlock): string | undefined {
	return block.type === "tool_result" ? block.tool_use_id : block.toolCallId
}

export function getToolResultLikePayload(block: ToolResultLikeBlock): unknown {
	return block.type === "tool_result" ? block.content : block.output
}

export function stringifyUnknown(value: unknown): string {
	if (typeof value === "string") {
		return value
	}
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value)
	}
	if (value === null || value === undefined) {
		return ""
	}
	try {
		return JSON.stringify(value, null, 2)
	} catch {
		return String(value)
	}
}
