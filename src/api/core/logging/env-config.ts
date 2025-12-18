/**
 * @fileoverview Environment configuration reader for API logging
 *
 * Reads logging settings from workspace .env.local file
 */

import * as fs from "fs"
import * as path from "path"
import * as vscode from "vscode"

// Cache for parsed .env.local values
let envCache: Record<string, string> | null = null
let lastCacheTime = 0
const CACHE_TTL_MS = 5000 // Re-read file every 5 seconds

/**
 * Parse a .env file content into key-value pairs
 */
function parseEnvFile(content: string): Record<string, string> {
	const result: Record<string, string> = {}
	const lines = content.split("\n")

	for (const line of lines) {
		const trimmed = line.trim()
		// Skip empty lines and comments
		if (!trimmed || trimmed.startsWith("#")) {
			continue
		}

		const equalsIndex = trimmed.indexOf("=")
		if (equalsIndex > 0) {
			const key = trimmed.substring(0, equalsIndex).trim()
			let value = trimmed.substring(equalsIndex + 1).trim()

			// Remove surrounding quotes if present
			if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
				value = value.slice(1, -1)
			}

			result[key] = value
		}
	}

	return result
}

/**
 * Get the workspace .env.local file path
 */
function getEnvLocalPath(): string | undefined {
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
	if (!workspaceFolder) {
		return undefined
	}
	return path.join(workspaceFolder.uri.fsPath, ".env.local")
}

/**
 * Read and parse the workspace .env.local file (cached)
 */
function getEnvLocalValues(): Record<string, string> {
	const now = Date.now()

	// Return cached values if still valid
	if (envCache && now - lastCacheTime < CACHE_TTL_MS) {
		return envCache
	}

	const envPath = getEnvLocalPath()
	if (!envPath) {
		envCache = {}
		lastCacheTime = now
		return envCache
	}

	try {
		const content = fs.readFileSync(envPath, "utf-8")
		envCache = parseEnvFile(content)
	} catch {
		// File doesn't exist or can't be read
		envCache = {}
	}

	lastCacheTime = now
	return envCache
}

/**
 * Check if API logging is enabled
 *
 * Checks in order:
 * 1. Workspace .env.local: ROO_CODE_API_LOGGING=true or ROO_CODE_LOGGING=true (for user's workspace)
 * 2. Process env (loaded from extension's .env.local via envFile in launch.json)
 *
 * Note: Both ROO_CODE_API_LOGGING and ROO_CODE_LOGGING are accepted for backward compatibility
 */
export function isLoggingEnabled(): boolean {
	// Check workspace .env.local first (user's current workspace)
	const envLocal = getEnvLocalValues()
	if (envLocal["ROO_CODE_API_LOGGING"] === "true" || envLocal["ROO_CODE_LOGGING"] === "true") {
		return true
	}

	// Fallback to process.env (populated from extension's .env.local via launch.json envFile)
	return process.env.ROO_CODE_API_LOGGING === "true" || process.env.ROO_CODE_LOGGING === "true"
}

/**
 * Clear the env cache (useful for testing or when .env.local changes)
 */
export function clearEnvCache(): void {
	envCache = null
	lastCacheTime = 0
}

/**
 * Get a specific value from workspace .env.local
 */
export function getEnvLocalValue(key: string): string | undefined {
	const values = getEnvLocalValues()
	return values[key]
}
