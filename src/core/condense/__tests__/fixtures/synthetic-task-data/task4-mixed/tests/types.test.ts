import { describe, it, expect } from "vitest"
import type {
	Config,
	Endpoints,
	Features,
	User,
	ApiResponse,
	RequestMethod,
	RequestOptions,
	ErrorDetails,
} from "../types"

describe("Type Definitions", () => {
	describe("Config", () => {
		it("should accept valid config object", () => {
			const config: Config = {
				apiVersion: "1.0.0",
				environment: "test",
				endpoints: {
					base: "https://api.example.com",
					auth: "/auth/login",
					data: "/api/v1/data",
				},
				timeout: 5000,
				retryAttempts: 3,
				features: {
					caching: true,
					compression: true,
					logging: true,
				},
			}
			expect(config.apiVersion).toBe("1.0.0")
			expect(config.environment).toBe("test")
		})
	})

	describe("User", () => {
		it("should accept valid user object", () => {
			const user: User = {
				id: "user-123",
				email: "test@example.com",
				name: "Test User",
				createdAt: new Date(),
				updatedAt: new Date(),
			}
			expect(user.id).toBe("user-123")
			expect(user.email).toBe("test@example.com")
		})
	})

	describe("ApiResponse", () => {
		it("should accept successful response", () => {
			const response: ApiResponse<User> = {
				success: true,
				data: {
					id: "user-123",
					email: "test@example.com",
					name: "Test User",
					createdAt: new Date(),
					updatedAt: new Date(),
				},
				timestamp: new Date().toISOString(),
			}
			expect(response.success).toBe(true)
			expect(response.data).toBeDefined()
		})

		it("should accept error response", () => {
			const response: ApiResponse<User> = {
				success: false,
				error: "User not found",
				timestamp: new Date().toISOString(),
			}
			expect(response.success).toBe(false)
			expect(response.error).toBe("User not found")
		})
	})

	describe("RequestMethod", () => {
		it("should accept valid HTTP methods", () => {
			const methods: RequestMethod[] = ["GET", "POST", "PUT", "DELETE", "PATCH"]
			methods.forEach((method) => {
				const options: RequestOptions = { method }
				expect(options.method).toBe(method)
			})
		})
	})

	describe("RequestOptions", () => {
		it("should accept full request options", () => {
			const options: RequestOptions = {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: { name: "test" },
				timeout: 3000,
			}
			expect(options.method).toBe("POST")
			expect(options.headers).toBeDefined()
			expect(options.timeout).toBe(3000)
		})

		it("should accept minimal request options", () => {
			const options: RequestOptions = {
				method: "GET",
			}
			expect(options.method).toBe("GET")
			expect(options.headers).toBeUndefined()
		})
	})

	describe("ErrorDetails", () => {
		it("should accept error details with all fields", () => {
			const error: ErrorDetails = {
				code: "ERR_NOT_FOUND",
				message: "Resource not found",
				timestamp: new Date(),
				stackTrace: "Error stack trace here",
			}
			expect(error.code).toBe("ERR_NOT_FOUND")
			expect(error.stackTrace).toBeDefined()
		})

		it("should accept error details without optional stack trace", () => {
			const error: ErrorDetails = {
				code: "ERR_INVALID_INPUT",
				message: "Invalid input provided",
				timestamp: new Date(),
			}
			expect(error.code).toBe("ERR_INVALID_INPUT")
			expect(error.stackTrace).toBeUndefined()
		})
	})
})
