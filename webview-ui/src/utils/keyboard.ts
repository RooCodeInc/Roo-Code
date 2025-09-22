/**
 * Utility functions for keyboard shortcuts
 */

/**
 * Detects if the current platform is macOS
 */
export const isMac = (): boolean => {
	// Check if we're in a browser environment
	if (typeof navigator !== "undefined" && navigator.platform) {
		return navigator.platform.toUpperCase().indexOf("MAC") >= 0
	}
	// Fallback for non-browser environments
	return false
}

/**
 * Gets the platform-specific modifier key label
 */
export const getModifierKey = (): string => {
	return isMac() ? "Cmd" : "Ctrl"
}

/**
 * Gets the platform-specific keyboard shortcut for toggling auto-approve
 */
export const getAutoApproveShortcut = (): string => {
	return isMac() ? "Cmd+Option+A" : "Ctrl+Alt+A"
}

/**
 * Formats a keyboard shortcut for display
 */
export const formatShortcut = (shortcut: string): string => {
	return `(${shortcut})`
}
