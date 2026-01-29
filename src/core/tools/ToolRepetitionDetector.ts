import stringify from "safe-stable-stringify"
import { ToolUse } from "../../shared/tools"
import { t } from "../../i18n"

/**
 * Class for detecting consecutive identical tool calls
 * to prevent the AI from getting stuck in a loop.
 *
 * Also includes path-based detection for read_file to catch cases where
 * the model reads the same file with different parameters (e.g., different line ranges).
 */
export class ToolRepetitionDetector {
	private previousToolCallJson: string | null = null
	private consecutiveIdenticalToolCallCount: number = 0
	private readonly consecutiveIdenticalToolCallLimit: number

	// Path-based tracking for read_file
	private previousReadFilePaths: string | null = null
	private consecutiveReadFilePathCount: number = 0
	private readonly readFilePathLimit: number

	/**
	 * Creates a new ToolRepetitionDetector
	 * @param limit The maximum number of identical consecutive tool calls allowed
	 * @param readFilePathLimit The maximum number of consecutive read_file calls for the same file path (default: same as limit)
	 */
	constructor(limit: number = 3, readFilePathLimit?: number) {
		this.consecutiveIdenticalToolCallLimit = limit
		this.readFilePathLimit = readFilePathLimit ?? limit
	}

	/**
	 * Checks if the current tool call is identical to the previous one
	 * and determines if execution should be allowed
	 *
	 * @param currentToolCallBlock ToolUse object representing the current tool call
	 * @returns Object indicating if execution is allowed and a message to show if not
	 */
	public check(currentToolCallBlock: ToolUse): {
		allowExecution: boolean
		askUser?: {
			messageKey: string
			messageDetail: string
		}
	} {
		// Browser scroll actions should not be subject to repetition detection
		// as they are frequently needed for navigating through web pages
		if (this.isBrowserScrollAction(currentToolCallBlock)) {
			// Allow browser scroll actions without counting them as repetitions
			return { allowExecution: true }
		}

		// Check path-based repetition for read_file
		const pathRepetitionResult = this.checkReadFilePathRepetition(currentToolCallBlock)
		if (!pathRepetitionResult.allowExecution) {
			return pathRepetitionResult
		}

		// Serialize the block to a canonical JSON string for comparison
		const currentToolCallJson = this.serializeToolUse(currentToolCallBlock)

		// Compare with previous tool call
		if (this.previousToolCallJson === currentToolCallJson) {
			this.consecutiveIdenticalToolCallCount++
		} else {
			this.consecutiveIdenticalToolCallCount = 0 // Reset to 0 for a new tool
			this.previousToolCallJson = currentToolCallJson
		}

		// Check if limit is reached (0 means unlimited)
		if (
			this.consecutiveIdenticalToolCallLimit > 0 &&
			this.consecutiveIdenticalToolCallCount >= this.consecutiveIdenticalToolCallLimit
		) {
			// Reset counters to allow recovery if user guides the AI past this point
			this.consecutiveIdenticalToolCallCount = 0
			this.previousToolCallJson = null

			// Return result indicating execution should not be allowed
			return {
				allowExecution: false,
				askUser: {
					messageKey: "mistake_limit_reached",
					messageDetail: t("tools:toolRepetitionLimitReached", { toolName: currentToolCallBlock.name }),
				},
			}
		}

		// Execution is allowed
		return { allowExecution: true }
	}

	/**
	 * Checks for path-based repetition specifically for read_file tool.
	 * This catches cases where the model reads the same file with different parameters
	 * (e.g., different line ranges), which would not be caught by identical call detection.
	 *
	 * @param toolUse The ToolUse object to check
	 * @returns Object indicating if execution is allowed and a message to show if not
	 */
	private checkReadFilePathRepetition(toolUse: ToolUse): {
		allowExecution: boolean
		askUser?: {
			messageKey: string
			messageDetail: string
		}
	} {
		// Only apply to read_file tool
		if (toolUse.name !== "read_file") {
			// Reset path tracking when switching to a different tool
			this.previousReadFilePaths = null
			this.consecutiveReadFilePathCount = 0
			return { allowExecution: true }
		}

		// Extract file paths from the tool use
		const currentPaths = this.extractReadFilePaths(toolUse)

		// Compare with previous paths
		if (this.previousReadFilePaths === currentPaths) {
			this.consecutiveReadFilePathCount++
		} else {
			this.consecutiveReadFilePathCount = 0
			this.previousReadFilePaths = currentPaths
		}

		// Check if limit is reached (0 means unlimited)
		if (this.readFilePathLimit > 0 && this.consecutiveReadFilePathCount >= this.readFilePathLimit) {
			// Reset counters to allow recovery if user guides the AI past this point
			this.consecutiveReadFilePathCount = 0
			this.previousReadFilePaths = null

			// Return result indicating execution should not be allowed
			return {
				allowExecution: false,
				askUser: {
					messageKey: "mistake_limit_reached",
					messageDetail: t("tools:readFilePathRepetitionLimitReached", { toolName: toolUse.name }),
				},
			}
		}

		return { allowExecution: true }
	}

	/**
	 * Extracts file paths from a read_file tool use.
	 * Handles both params-based and nativeArgs-based formats.
	 *
	 * @param toolUse The read_file ToolUse object
	 * @returns A canonical string representation of the file paths
	 */
	private extractReadFilePaths(toolUse: ToolUse): string {
		const paths: string[] = []

		// Check nativeArgs first (native protocol format)
		if (toolUse.nativeArgs && typeof toolUse.nativeArgs === "object") {
			const nativeArgs = toolUse.nativeArgs as { files?: Array<{ path?: string }> }
			if (nativeArgs.files && Array.isArray(nativeArgs.files)) {
				for (const file of nativeArgs.files) {
					if (file.path) {
						paths.push(file.path)
					}
				}
			}
		}

		// Check params (legacy format or if nativeArgs didn't have files)
		if (paths.length === 0 && toolUse.params) {
			// Single file path
			if (toolUse.params.path) {
				paths.push(toolUse.params.path as string)
			}
			// Multiple files format (params.files is a JSON array string or array)
			if (toolUse.params.files) {
				const files = toolUse.params.files
				if (typeof files === "string") {
					try {
						const parsed = JSON.parse(files)
						if (Array.isArray(parsed)) {
							for (const file of parsed) {
								if (file.path) {
									paths.push(file.path)
								}
							}
						}
					} catch {
						// Ignore parse errors
					}
				}
			}
		}

		// Sort paths for consistent comparison
		return paths.sort().join("|")
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
