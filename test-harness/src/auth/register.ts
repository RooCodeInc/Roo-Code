/**
 * Authentication — Registration Module
 *
 * Handles new user registration with basic validation.
 * This module is a candidate for refactoring under the "refactor-auth" intent.
 */

export interface RegistrationData {
	email: string
	password: string
	confirmPassword: string
	displayName: string
}

export interface RegistrationResult {
	success: boolean
	userId?: string
	error?: string
}

const registeredEmails = new Set<string>()

/**
 * Register a new user account.
 * Validates input and checks for duplicate emails.
 */
export function registerUser(data: RegistrationData): RegistrationResult {
	const { email, password, confirmPassword, displayName } = data

	if (!email || !password || !displayName) {
		return { success: false, error: "All fields are required" }
	}

	if (password.length < 8) {
		return { success: false, error: "Password must be at least 8 characters" }
	}

	if (password !== confirmPassword) {
		return { success: false, error: "Passwords do not match" }
	}

	if (!email.includes("@")) {
		return { success: false, error: "Invalid email format" }
	}

	if (registeredEmails.has(email)) {
		return { success: false, error: "Email already registered" }
	}

	registeredEmails.add(email)
	const userId = `user_${Date.now()}`

	return { success: true, userId }
}

/**
 * Check if an email is already registered.
 */
export function isEmailTaken(email: string): boolean {
	return registeredEmails.has(email)
}
