import { ToolUse } from "../../shared/tools"
import { t } from "../../i18n"

/**
 * Class for detecting both consecutive and non-consecutive repetitive tool call patterns
 * to prevent the AI from getting stuck in loops.
 */
export class ToolRepetitionDetector {
	private previousToolCallJson: string | null = null
	private consecutiveIdenticalToolCallCount: number = 0
	private readonly consecutiveIdenticalToolCallLimit: number

	// Enhanced pattern detection for non-continuous repetitions
	private toolCallHistory: string[] = []
	private readonly maxHistorySize: number = 20 // Keep last 20 tool calls for pattern detection
	private readonly minPatternLength: number = 2 // Minimum pattern length (e.g., AB)
	private readonly maxPatternLength: number = 6 // Maximum pattern length (e.g., ABCDEF)
	private readonly minPatternRepetitions: number = 2 // Minimum repetitions to consider it a loop

	/**
	 * Creates a new ToolRepetitionDetector
	 * @param limit The maximum number of identical consecutive tool calls allowed
	 */
	constructor(limit: number = 3) {
		this.consecutiveIdenticalToolCallLimit = limit
	}

	/**
	 * Checks if the current tool call is identical to the previous one or forms a repetitive pattern
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
		// Serialize the block to a canonical JSON string for comparison
		const currentToolCallJson = this.serializeToolUse(currentToolCallBlock)

		// Add to history for pattern detection
		this.addToHistory(currentToolCallJson)

		// Check for consecutive repetitions (existing behavior)
		if (this.previousToolCallJson === currentToolCallJson) {
			this.consecutiveIdenticalToolCallCount++
		} else {
			this.consecutiveIdenticalToolCallCount = 1 // Start with 1 for the first occurrence
			this.previousToolCallJson = currentToolCallJson
		}

		// Check if consecutive limit is reached
		if (this.consecutiveIdenticalToolCallCount >= this.consecutiveIdenticalToolCallLimit) {
			// Reset counters to allow recovery if user guides the AI past this point
			this.resetState()

			// Return result indicating execution should not be allowed
			return {
				allowExecution: false,
				askUser: {
					messageKey: "mistake_limit_reached",
					messageDetail: t("tools:toolRepetitionLimitReached", { toolName: currentToolCallBlock.name }),
				},
			}
		}

		// Check for non-consecutive repetitive patterns
		const patternDetectionResult = this.detectRepetitivePattern()
		if (patternDetectionResult.isRepetitive) {
			// Reset state to allow recovery
			this.resetState()

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
	 * Serializes a ToolUse object into a canonical JSON string for comparison
	 *
	 * @param toolUse The ToolUse object to serialize
	 * @returns JSON string representation of the tool use with sorted parameter keys
	 */
	private serializeToolUse(toolUse: ToolUse): string {
		// Create a new parameters object with alphabetically sorted keys
		const sortedParams: Record<string, unknown> = {}

		// Get parameter keys and sort them alphabetically
		const sortedKeys = Object.keys(toolUse.params).sort()

		// Populate the sorted parameters object in a type-safe way
		for (const key of sortedKeys) {
			if (Object.prototype.hasOwnProperty.call(toolUse.params, key)) {
				sortedParams[key] = toolUse.params[key as keyof typeof toolUse.params]
			}
		}

		// Create the object with the tool name and sorted parameters
		const toolObject = {
			name: toolUse.name,
			parameters: sortedParams,
		}

		// Convert to a canonical JSON string
		return JSON.stringify(toolObject)
	}

	/**
	 * Adds a tool call to the history for pattern detection
	 * @param toolCallJson Serialized tool call JSON
	 */
	private addToHistory(toolCallJson: string): void {
		this.toolCallHistory.push(toolCallJson)

		// Keep history size manageable
		if (this.toolCallHistory.length > this.maxHistorySize) {
			this.toolCallHistory.shift() // Remove oldest entry
		}
	}

	/**
	 * Resets the internal state of the detector
	 */
	private resetState(): void {
		this.consecutiveIdenticalToolCallCount = 0
		this.previousToolCallJson = null
		// Clear history to prevent false positives after reset
		this.toolCallHistory = []
	}

	/**
	 * Detects repetitive patterns in the tool call history
	 * @returns Object indicating if a repetitive pattern was detected
	 */
	private detectRepetitivePattern(): { isRepetitive: boolean; pattern?: string[] } {
		// Need at least enough history to detect a pattern
		if (this.toolCallHistory.length < this.minPatternLength * this.minPatternRepetitions) {
			return { isRepetitive: false }
		}

		// Try different pattern lengths, starting from the smallest
		for (let patternLength = this.minPatternLength; patternLength <= this.maxPatternLength; patternLength++) {
			// Don't check patterns longer than what we can fit with minimum repetitions
			if (patternLength * this.minPatternRepetitions > this.toolCallHistory.length) {
				break
			}

			// Check if the last N elements form a repeating pattern
			if (this.isRepeatingPattern(patternLength)) {
				const pattern = this.toolCallHistory.slice(-patternLength)
				return { isRepetitive: true, pattern }
			}
		}

		return { isRepetitive: false }
	}

	/**
	 * Checks if the end of the history forms a repeating pattern of the given length
	 * @param patternLength Length of the pattern to check
	 * @returns True if a repeating pattern is found
	 */
	private isRepeatingPattern(patternLength: number): boolean {
		const totalLength = patternLength * this.minPatternRepetitions
		if (this.toolCallHistory.length < totalLength) {
			return false
		}

		// Get the pattern from the end
		const pattern = this.toolCallHistory.slice(-patternLength)

		// Check if this pattern repeats the required number of times
		for (let i = 1; i < this.minPatternRepetitions; i++) {
			const startIndex = this.toolCallHistory.length - (i + 1) * patternLength
			const endIndex = this.toolCallHistory.length - i * patternLength

			if (startIndex < 0) {
				return false
			}

			const segment = this.toolCallHistory.slice(startIndex, endIndex)
			if (!this.arraysEqual(segment, pattern)) {
				return false
			}
		}

		return true
	}

	/**
	 * Utility method to check if two arrays are equal
	 * @param arr1 First array
	 * @param arr2 Second array
	 * @returns True if arrays are equal
	 */
	private arraysEqual(arr1: string[], arr2: string[]): boolean {
		if (arr1.length !== arr2.length) {
			return false
		}

		for (let i = 0; i < arr1.length; i++) {
			if (arr1[i] !== arr2[i]) {
				return false
			}
		}

		return true
	}
}
