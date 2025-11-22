import stringify from "safe-stable-stringify"
import { ToolUse } from "../../shared/tools"
import { t } from "../../i18n"

/**
 * Configuration for tool-specific repetition limits
 */
interface ToolSpecificConfig {
	/** Tool names that should be excluded from repetition detection */
	excludedTools?: string[]
	/** Custom limits for specific tools (key is tool name, value is limit) */
	toolLimits?: Record<string, number>
}

/**
 * Class for detecting consecutive identical tool calls
 * to prevent the AI from getting stuck in a loop.
 *
 * Enhanced to detect actual progress by tracking tool responses
 * and providing special handling for tools that legitimately need
 * multiple consecutive calls (e.g., MCP tools reading streaming data).
 */
export class ToolRepetitionDetector {
	private previousToolCallJson: string | null = null
	private consecutiveIdenticalToolCallCount: number = 0
	private readonly consecutiveIdenticalToolCallLimit: number
	private lastToolResponse: string | null = null
	private responseHistory: string[] = []
	private readonly maxResponseHistorySize = 10
	private readonly toolSpecificConfig: ToolSpecificConfig

	/**
	 * Creates a new ToolRepetitionDetector
	 * @param limit The maximum number of identical consecutive tool calls allowed
	 * @param toolSpecificConfig Configuration for tool-specific behavior
	 */
	constructor(limit: number = 3, toolSpecificConfig: ToolSpecificConfig = {}) {
		this.consecutiveIdenticalToolCallLimit = limit
		this.toolSpecificConfig = {
			excludedTools: toolSpecificConfig.excludedTools || [],
			toolLimits: {
				// MCP tools often need more consecutive calls for legitimate streaming/chunked data
				use_mcp_tool: 50,
				access_mcp_resource: 50,
				// Override with any user-provided limits
				...(toolSpecificConfig.toolLimits || {}),
			},
		}
	}

	/**
	 * Checks if the current tool call is identical to the previous one
	 * and determines if execution should be allowed
	 *
	 * @param currentToolCallBlock ToolUse object representing the current tool call
	 * @param toolResponse Optional tool response from the last execution to track progress
	 * @returns Object indicating if execution is allowed and a message to show if not
	 */
	public check(
		currentToolCallBlock: ToolUse,
		toolResponse?: string,
	): {
		allowExecution: boolean
		askUser?: {
			messageKey: string
			messageDetail: string
		}
	} {
		// Check if this tool is excluded from repetition detection
		if (this.toolSpecificConfig.excludedTools?.includes(currentToolCallBlock.name)) {
			return { allowExecution: true }
		}

		// Browser scroll actions should not be subject to repetition detection
		// as they are frequently needed for navigating through web pages
		if (this.isBrowserScrollAction(currentToolCallBlock)) {
			// Allow browser scroll actions without counting them as repetitions
			return { allowExecution: true }
		}

		// Special handling for MCP tools that may be reading streaming data
		if (this.isMcpStreamingTool(currentToolCallBlock)) {
			// Check if we're making progress by comparing responses
			if (this.isShowingProgress(toolResponse)) {
				// Reset the counter since we're making progress
				this.consecutiveIdenticalToolCallCount = 0
				return { allowExecution: true }
			}
		}

		// Serialize the block to a canonical JSON string for comparison
		const currentToolCallJson = this.serializeToolUse(currentToolCallBlock)

		// Compare with previous tool call
		if (this.previousToolCallJson === currentToolCallJson) {
			this.consecutiveIdenticalToolCallCount++
		} else {
			this.consecutiveIdenticalToolCallCount = 0 // Reset to 0 for a new tool
			this.previousToolCallJson = currentToolCallJson
			// Clear response history when switching to a different tool
			this.responseHistory = []
			this.lastToolResponse = null
		}

		// Update response tracking
		if (toolResponse) {
			this.responseHistory.push(toolResponse)
			if (this.responseHistory.length > this.maxResponseHistorySize) {
				this.responseHistory.shift()
			}
			this.lastToolResponse = toolResponse
		}

		// Get the appropriate limit for this tool
		const toolLimit = this.getToolLimit(currentToolCallBlock.name)

		// Check if limit is reached (0 means unlimited)
		if (toolLimit > 0 && this.consecutiveIdenticalToolCallCount >= toolLimit) {
			// For MCP tools, provide a more helpful message
			const isMcpTool = this.isMcpStreamingTool(currentToolCallBlock)
			const messageDetail = isMcpTool
				? t("tools:toolRepetitionLimitReached", { toolName: currentToolCallBlock.name }) +
					" This may be a false positive if the tool is legitimately reading streaming data. " +
					"Consider increasing the repetition limit for MCP tools in settings."
				: t("tools:toolRepetitionLimitReached", { toolName: currentToolCallBlock.name })

			// Reset counters to allow recovery if user guides the AI past this point
			this.consecutiveIdenticalToolCallCount = 0
			this.previousToolCallJson = null
			this.responseHistory = []
			this.lastToolResponse = null

			// Return result indicating execution should not be allowed
			return {
				allowExecution: false,
				askUser: {
					messageKey: "mistake_limit_reached",
					messageDetail,
				},
			}
		}

		// Execution is allowed
		return { allowExecution: true }
	}

	/**
	 * Updates the last tool response for progress tracking
	 * @param response The response from the last tool execution
	 */
	public updateLastResponse(response: string): void {
		this.lastToolResponse = response
		this.responseHistory.push(response)
		if (this.responseHistory.length > this.maxResponseHistorySize) {
			this.responseHistory.shift()
		}
	}

	/**
	 * Checks if the tool responses show progress is being made
	 * @param currentResponse The current tool response to check
	 * @returns true if progress is detected
	 */
	private isShowingProgress(currentResponse?: string): boolean {
		if (!currentResponse || !this.lastToolResponse) {
			return false
		}

		// Check if the response is different from the last one
		if (currentResponse !== this.lastToolResponse) {
			return true
		}

		// Check if we have varying responses in history (not all the same)
		if (this.responseHistory.length > 1) {
			const uniqueResponses = new Set(this.responseHistory)
			// If we have more than one unique response, we're likely making progress
			return uniqueResponses.size > 1
		}

		return false
	}

	/**
	 * Checks if a tool is an MCP streaming tool that may need many consecutive calls
	 * @param toolUse The tool use to check
	 * @returns true if it's an MCP tool that might stream data
	 */
	private isMcpStreamingTool(toolUse: ToolUse): boolean {
		// MCP tools that commonly need to read streaming/chunked data
		return toolUse.name === "use_mcp_tool" || toolUse.name === "access_mcp_resource"
	}

	/**
	 * Gets the repetition limit for a specific tool
	 * @param toolName The name of the tool
	 * @returns The repetition limit for the tool
	 */
	private getToolLimit(toolName: string): number {
		// Check for tool-specific limit
		if (this.toolSpecificConfig.toolLimits && toolName in this.toolSpecificConfig.toolLimits) {
			return this.toolSpecificConfig.toolLimits[toolName]
		}
		// Fall back to default limit
		return this.consecutiveIdenticalToolCallLimit
	}

	/**
	 * Checks if a tool use is a browser scroll action
	 *
	 * @param toolUse The ToolUse object to check
	 * @returns true if the tool is a browser_action with scroll_down or scroll_up action
	 */
	private isBrowserScrollAction(toolUse: ToolUse): boolean {
		if (toolUse.name !== "browser_action") {
			return false
		}

		const action = toolUse.params.action as string
		return action === "scroll_down" || action === "scroll_up"
	}

	/**
	 * Serializes a ToolUse object into a canonical JSON string for comparison
	 *
	 * @param toolUse The ToolUse object to serialize
	 * @returns JSON string representation of the tool use with sorted parameter keys
	 */
	private serializeToolUse(toolUse: ToolUse): string {
		const toolObject: Record<string, any> = {
			name: toolUse.name,
			params: toolUse.params,
		}

		// Only include nativeArgs if it has content
		if (toolUse.nativeArgs && Object.keys(toolUse.nativeArgs).length > 0) {
			toolObject.nativeArgs = toolUse.nativeArgs
		}

		return stringify(toolObject)
	}
}
