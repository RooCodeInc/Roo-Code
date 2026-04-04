import { z } from "zod"
import { McpSettings, mcpSettingsSchema } from "../../../packages/types/src/mcp"

/**
 * Migrates legacy MCP settings to Jabberwock format
 * This utility ensures that old mcp_settings.json files continue to work
 * while adding default values for the new Jabberwock features
 */
export function migrateMcpSettings(rawSettings: unknown): McpSettings {
	if (!rawSettings || typeof rawSettings !== "object") {
		return { mcpServers: {} }
	}

	// Pre-process raw settings to inject default values for older configs
	const settings = rawSettings as Record<string, unknown>
	const servers = (settings.mcpServers as Record<string, unknown>) || {}

	const migratedServers: Record<string, unknown> = {}

	for (const [key, config] of Object.entries(servers)) {
		if (config && typeof config === "object") {
			const configObj = config as Record<string, unknown>
			migratedServers[key] = {
				...configObj,
				// Legacy servers become globally visible by default to preserve behavior
				isGloballyVisible: configObj.isGloballyVisible ?? true,
				type: configObj.type ?? "tool",
				allowedContext: Array.isArray(configObj.allowedContext) ? configObj.allowedContext : [],
				// Ensure arrays are properly initialized
				alwaysAllow: Array.isArray(configObj.alwaysAllow) ? configObj.alwaysAllow : [],
				disabledTools: Array.isArray(configObj.disabledTools) ? configObj.disabledTools : [],
			}
		} else {
			// Skip invalid config entries
			migratedServers[key] = config
		}
	}

	// Zod will parse and strip out any unknown properties automatically
	const result = mcpSettingsSchema.safeParse({ mcpServers: migratedServers })

	if (!result.success) {
		console.error("Failed to migrate MCP settings", result.error)
		return { mcpServers: {} }
	}

	return result.data
}

/**
 * Validates MCP settings against the Jabberwock schema
 * Returns both the validated settings and any validation errors
 */
export function validateMcpSettings(settings: unknown): {
	success: boolean
	data?: McpSettings
	errors?: string[]
} {
	const result = mcpSettingsSchema.safeParse(settings)

	if (!result.success) {
		return {
			success: false,
			errors: result.error.errors.map((err: z.ZodIssue) => `${err.path.join(".")}: ${err.message}`),
		}
	}

	return {
		success: true,
		data: result.data,
	}
}

/**
 * Helper to check if a server configuration requires user interaction
 * This is used by the state machine to determine if auto-approval should be blocked
 */
export function requiresUserInteraction(serverConfig: any): boolean {
	return serverConfig?.requiresUserInteraction === true || serverConfig?.type === "interactiveApp"
}

/**
 * Helper to check if a server should be visible to a specific agent
 * Based on the per-agent MCP isolation strategy
 */
export function isServerVisibleToAgent(serverName: string, serverConfig: any, agentMcpList: string[] = []): boolean {
	// Globally visible servers are always available
	if (serverConfig?.isGloballyVisible !== false) {
		return true
	}

	// Check if this server is explicitly allowed for the agent
	return agentMcpList.includes(serverName)
}
