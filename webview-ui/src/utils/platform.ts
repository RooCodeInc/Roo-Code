/**
 * Platform detection utilities
 */

/**
 * Detects if the current platform is macOS
 * @returns boolean indicating if the platform is macOS
 */
export const isMacOS = (): boolean => {
	// Check for macOS user agent or navigator platform
	if (typeof navigator !== "undefined") {
		return /Mac|iPod|iPhone|iPad/.test(navigator.platform)
	}
	return false
}

/**
 * Gets the primary modifier key for the current platform
 * @returns "Cmd" for macOS, "Ctrl" for other platforms
 */
export const getPrimaryModifierKey = (): string => {
	return isMacOS() ? "Cmd" : "Ctrl"
}

/**
 * Gets the primary modifier key symbol for the current platform
 * @returns "⌘" for macOS, "Ctrl" for other platforms
 */
export const getPrimaryModifierSymbol = (): string => {
	return isMacOS() ? "⌘" : "Ctrl"
}

/**
 * Gets the platform-aware key combination for sending messages
 * @returns "Cmd+Enter" for macOS, "Ctrl+Enter" for other platforms
 */
export const getSendMessageKeyCombination = (): string => {
	return `${getPrimaryModifierKey()}+Enter`
}

/**
 * Gets the platform-aware key combination symbol for sending messages
 * @returns "⌘⏎" for macOS, "Ctrl+Enter" for other platforms
 */
export const getSendMessageKeyCombinationSymbol = (): string => {
	return isMacOS() ? "⌘⏎" : "Ctrl+Enter"
}
