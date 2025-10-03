/**
 * Main entry point for task4-mixed test fixture
 */

import type { Config, ApiResponse, RequestOptions, User } from "./types"
import { formatTimestamp, isValidEmail, delay, generateId, safeJsonParse } from "./utils"
import config from "./config.json"

/**
 * API Client class for handling HTTP requests
 */
export class ApiClient {
	private config: Config
	private baseUrl: string

	constructor(customConfig?: Partial<Config>) {
		this.config = { ...config, ...customConfig } as Config
		this.baseUrl = this.config.endpoints.base
	}

	/**
	 * Makes an API request
	 */
	async request<T>(endpoint: string, options: RequestOptions): Promise<ApiResponse<T>> {
		const url = `${this.baseUrl}${endpoint}`
		const timestamp = formatTimestamp(new Date())

		try {
			// Simulate API delay
			await delay(100)

			// Simulate successful response
			return {
				success: true,
				data: {} as T,
				timestamp,
			}
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
				timestamp,
			}
		}
	}

	/**
	 * Creates a new user
	 */
	async createUser(email: string, name: string): Promise<ApiResponse<User>> {
		if (!isValidEmail(email)) {
			return {
				success: false,
				error: "Invalid email address",
				timestamp: formatTimestamp(new Date()),
			}
		}

		const user: User = {
			id: generateId("user"),
			email,
			name,
			createdAt: new Date(),
			updatedAt: new Date(),
		}

		return this.request<User>("/users", {
			method: "POST",
			body: user,
		})
	}

	/**
	 * Gets the current configuration
	 */
	getConfig(): Config {
		return { ...this.config }
	}
}

// Export utilities
export { formatTimestamp, isValidEmail, delay, generateId, safeJsonParse }

// Export types
export type * from "./types"
