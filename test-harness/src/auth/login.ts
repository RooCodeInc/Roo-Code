/**
 * Authentication — Login Module
 *
 * Handles user login with basic credential validation.
 * This module is a candidate for refactoring under the "refactor-auth" intent.
 */

export interface LoginCredentials {
	email: string
	password: string
}

export interface LoginResult {
	success: boolean
	token?: string
	error?: string
}

const MOCK_USERS: Record<string, string> = {
	"admin@example.com": "admin123",
	"user@example.com": "password",
}

/**
 * Authenticate a user with email and password.
 * Returns a token on success or an error message on failure.
 */
export function authenticateUser(credentials: LoginCredentials): LoginResult {
	const { email, password } = credentials

	if (!email || !password) {
		return { success: false, error: "Email and password are required" }
	}

	const storedPassword = MOCK_USERS[email]

	if (!storedPassword) {
		return { success: false, error: "User not found" }
	}

	if (storedPassword !== password) {
		return { success: false, error: "Invalid password" }
	}

	const token = Buffer.from(`${email}:${Date.now()}`).toString("base64")
	return { success: true, token }
}

/**
 * Validate an existing authentication token.
 */
export function validateToken(token: string): boolean {
	if (!token) {
		return false
	}

	try {
		const decoded = Buffer.from(token, "base64").toString("utf-8")
		const [email, timestamp] = decoded.split(":")
		const age = Date.now() - parseInt(timestamp, 10)
		const ONE_HOUR = 3600000

		return !!email && age < ONE_HOUR
	} catch {
		return false
	}
}
