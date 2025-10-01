/**
 * Utilities for handling path-related operations in mentions
 */

import { removeLeadingNonAlphanumeric } from "./removeLeadingNonAlphanumeric"

/**
 * Extract the basename (filename or directory name) from a path
 * Similar to Node.js path.basename() but works in the browser
 */
export function getBasename(path: string): string {
	if (!path) return ""

	// Remove trailing slashes
	const trimmed = path.replace(/\/+$/, "")

	// Find the last slash
	const lastSlashIndex = trimmed.lastIndexOf("/")

	// If no slash found, return the whole path
	if (lastSlashIndex === -1) {
		return trimmed
	}

	// Return everything after the last slash
	return trimmed.slice(lastSlashIndex + 1)
}

/**
 * Extract the directory name from a path
 * For directories with trailing slash, returns the last directory name
 */
export function getDirname(path: string): string {
	if (!path) return ""

	// If path ends with slash, it's already a directory
	if (path.endsWith("/")) {
		return getBasename(path)
	}

	// Otherwise get the parent directory
	const lastSlashIndex = path.lastIndexOf("/")
	if (lastSlashIndex === -1) {
		return path
	}

	return path.slice(0, lastSlashIndex + 1)
}

/**
 * Extract domain from a URL
 */
export function getDomainFromUrl(url: string): string {
	try {
		const urlObj = new URL(url)
		return urlObj.hostname
	} catch {
		// If URL parsing fails, try to extract domain manually
		const match = url.match(/^(?:https?:\/\/)?([^/\s:]+)/)
		return match ? match[1] : url
	}
}

/**
 * Extract a display label from a value based on its type
 */
export function extractLabelFromValue(value: string, type?: string): string {
	if (!value) return ""

	switch (type) {
		case "file":
		case "openedFile":
			return getBasename(value)

		case "folder":
			// For folders, get the directory name (last part of path)
			return getBasename(value) || value

		case "url":
			return getDomainFromUrl(value)

		case "git":
			// For git hashes, return first 7 characters if longer
			if (value.length > 7 && /^[a-f0-9]+$/i.test(value)) {
				return value.slice(0, 7)
			}
			return value

		case "problems":
			return "problems"

		case "terminal":
			return "terminal"

		default:
			// For everything else (commands, mode, etc), use the value as-is
			return value
	}
}

/**
 * Escapes spaces in a path with backslashes
 *
 * @param path The path to escape
 * @returns A path with spaces escaped
 */
export function escapeSpaces(path: string): string {
	return path.replace(/ /g, "\\ ")
}

/**
 * Get display name for a path with conflict resolution
 * If multiple paths have the same filename, shows parent directory to disambiguate
 *
 * @param path The path to get display name for
 * @param allPaths All paths in the current context (for conflict detection)
 * @returns A display name that disambiguates conflicts
 */
export function getDisplayNameForPath(path: string, allPaths: string[]): string {
	// Remove leading non-alphanumeric and trailing slash
	const cleanPath = removeLeadingNonAlphanumeric(path).replace(/\/$/, "")
	const pathList = cleanPath.split("/")
	const filename = pathList.at(-1) || path

	// Check if there are other paths with the same filename
	const sameFilenames = allPaths.filter((p) => {
		const otherPath = removeLeadingNonAlphanumeric(p).replace(/\/$/, "")
		const otherFilename = otherPath.split("/").at(-1) || p
		return otherFilename === filename && p !== path
	})

	if (sameFilenames.length === 0) {
		return filename // No conflicts, just show filename
	}

	// There are conflicts, need to show directory to disambiguate
	if (pathList.length > 1) {
		// Show filename with first directory
		return `${pathList[pathList.length - 2]}/${filename}`
	}

	return filename
}

/**
 * Converts an absolute path to a mention-friendly path
 * If the provided path starts with the current working directory,
 * it's converted to a relative path prefixed with @
 * Spaces in the path are escaped with backslashes
 *
 * @param path The path to convert
 * @param cwd The current working directory
 * @returns A mention-friendly path
 */
export function convertToMentionPath(path: string, cwd?: string): string {
	// Strip file:// or vscode-remote:// protocol if present
	let pathWithoutProtocol = path

	if (path.startsWith("file://")) {
		pathWithoutProtocol = path.substring(7)
	} else if (path.startsWith("vscode-remote://")) {
		const protocolStripped = path.substring("vscode-remote://".length)
		const firstSlashIndex = protocolStripped.indexOf("/")
		if (firstSlashIndex !== -1) {
			pathWithoutProtocol = protocolStripped.substring(firstSlashIndex + 1)
		} else {
			pathWithoutProtocol = ""
		}
	}

	try {
		pathWithoutProtocol = decodeURIComponent(pathWithoutProtocol)
		// Fix: Remove leading slash for Windows paths like /d:/...
		if (pathWithoutProtocol.startsWith("/") && pathWithoutProtocol[2] === ":") {
			pathWithoutProtocol = pathWithoutProtocol.substring(1)
		}
	} catch (e) {
		// Log error if decoding fails, but continue with the potentially problematic path
		console.error("Error decoding URI component in convertToMentionPath:", e, pathWithoutProtocol)
	}

	const normalizedPath = pathWithoutProtocol.replace(/\\/g, "/")
	let normalizedCwd = cwd ? cwd.replace(/\\/g, "/") : ""

	if (!normalizedCwd) {
		return pathWithoutProtocol
	}

	// Remove trailing slash from cwd if it exists
	if (normalizedCwd.endsWith("/")) {
		normalizedCwd = normalizedCwd.slice(0, -1)
	}

	// Always use case-insensitive comparison for path matching
	const lowerPath = normalizedPath.toLowerCase()
	const lowerCwd = normalizedCwd.toLowerCase()

	if (lowerPath.startsWith(lowerCwd)) {
		let relativePath = normalizedPath.substring(normalizedCwd.length)
		// Ensure there's a slash after the @ symbol when we create the mention path
		relativePath = relativePath.startsWith("/") ? relativePath : "/" + relativePath

		// Escape any spaces in the path with backslashes
		const escapedRelativePath = escapeSpaces(relativePath)

		return "@" + escapedRelativePath
	}

	return pathWithoutProtocol
}
