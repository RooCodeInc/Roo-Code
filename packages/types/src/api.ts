/**
 * API for programmatic MCP server operations
 */

import type { EventEmitter } from "events"
import type { RooCodeEvents } from "./events.js"
import type { RooCodeSettings, ProviderSettings, ProviderSettingsEntry } from "./index.js"

/**
 * Interface for MCP operations that can be accessed programmatically
 */
export interface McpApi {
	/**
	 * Refresh all MCP server connections
	 * @returns Promise that resolves when refresh is complete
	 */
	refreshMcpServers(): Promise<void>
}

/**
 * Main API interface for Roo Code extension
 */
export interface RooCodeAPI extends EventEmitter<RooCodeEvents>, McpApi {
	// Task Management
	startNewTask(options: {
		configuration?: RooCodeSettings
		text?: string
		images?: string[]
		newTab?: boolean
	}): Promise<string>
	resumeTask(taskId: string): Promise<void>
	isTaskInHistory(taskId: string): Promise<boolean>
	getCurrentTaskStack(): unknown
	clearCurrentTask(lastMessage?: string): Promise<void>
	cancelCurrentTask(): Promise<void>
	cancelTask(taskId: string): Promise<void>

	// Messaging
	sendMessage(text?: string, images?: string[]): Promise<void>
	pressPrimaryButton(): Promise<void>
	pressSecondaryButton(): Promise<void>

	// State
	isReady(): boolean

	// Configuration
	getConfiguration(): RooCodeSettings
	setConfiguration(values: RooCodeSettings): Promise<void>

	// Profile Management
	getProfiles(): string[]
	getProfileEntry(name: string): ProviderSettingsEntry | undefined
	createProfile(name: string, profile?: ProviderSettings, activate?: boolean): Promise<string>
	updateProfile(name: string, profile: ProviderSettings, activate?: boolean): Promise<string | undefined>
	upsertProfile(name: string, profile: ProviderSettings, activate?: boolean): Promise<string | undefined>
	deleteProfile(name: string): Promise<void>
	getActiveProfile(): string | undefined
	setActiveProfile(name: string): Promise<string | undefined>
}

/**
 * Global MCP API instance that will be set by the extension
 */
export let mcpApi: McpApi | undefined

/**
 * Set the global MCP API instance
 * @param api The MCP API implementation
 */
export function setMcpApi(api: McpApi): void {
	mcpApi = api
}

/**
 * Get the global MCP API instance
 * @returns The MCP API instance or undefined if not set
 */
export function getMcpApi(): McpApi | undefined {
	return mcpApi
}
