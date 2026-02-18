import { createHash, randomBytes, timingSafeEqual } from "crypto"

/**
 * Result object containing the hashed password and its salt
 */
interface HashResult {
	hash: string
	salt: string
}

/**
 * Generates a cryptographically secure random salt
 *
 * @returns A 32-character hexadecimal string (16 bytes)
 *
 * @example
 * const salt = generateSalt();
 * // Returns: "a3f2c1b4e5d6..."
 */
function generateSalt(): string {
	return randomBytes(16).toString("hex")
}

/**
 * Hashes a password using SHA-256 with salt
 *
 * @param password - The plain text password to hash
 * @param salt - Optional salt to use; if not provided, a new salt will be generated
 * @returns An object containing the hash and salt
 * @throws Error if password is empty or invalid
 *
 * @example
 * // Hash a new password
 * const result = hashPassword('mySecurePassword123');
 * // Returns: { hash: "abc123...", salt: "def456..." }
 *
 * // Hash with existing salt (for verification)
 * const result2 = hashPassword('mySecurePassword123', result.salt);
 * // Returns: { hash: "abc123...", salt: "def456..." }
 */
function hashPassword(password: string, salt?: string): HashResult {
	// Input validation
	if (!password || typeof password !== "string") {
		throw new Error("Password must be a non-empty string")
	}

	// Generate new salt if not provided
	const useSalt = salt || generateSalt()

	// Combine password and salt, then hash with SHA-256
	const hash = createHash("sha256")
		.update(password + useSalt)
		.digest("hex")

	return {
		hash,
		salt: useSalt,
	}
}

/**
 * Verifies a password against a stored hash using timing-safe comparison
 *
 * @param password - The plain text password to verify
 * @param storedHash - The stored hash to compare against
 * @param storedSalt - The salt that was used to create the stored hash
 * @returns True if the password matches, false otherwise
 * @throws Error if any parameter is empty or invalid
 *
 * @example
 * // During registration
 * const { hash, salt } = hashPassword('userPassword123');
 * // Store hash and salt in database
 *
 * // During login
 * const isValid = verifyPassword('userPassword123', hash, salt);
 * // Returns: true
 *
 * const isInvalid = verifyPassword('wrongPassword', hash, salt);
 * // Returns: false
 */
function verifyPassword(password: string, storedHash: string, storedSalt: string): boolean {
	// Input validation
	if (!password || typeof password !== "string") {
		throw new Error("Password must be a non-empty string")
	}
	if (!storedHash || typeof storedHash !== "string") {
		throw new Error("Stored hash must be a non-empty string")
	}
	if (!storedSalt || typeof storedSalt !== "string") {
		throw new Error("Stored salt must be a non-empty string")
	}

	try {
		// Hash the input password with the stored salt
		const { hash } = hashPassword(password, storedSalt)

		// Convert hex strings to buffers for timing-safe comparison
		const hashBuffer = Buffer.from(hash, "hex")
		const storedHashBuffer = Buffer.from(storedHash, "hex")

		// Ensure buffers are the same length before comparison
		if (hashBuffer.length !== storedHashBuffer.length) {
			return false
		}

		// Timing-safe comparison to prevent timing attacks
		return timingSafeEqual(hashBuffer, storedHashBuffer)
	} catch (error) {
		// Return false on any error during verification
		return false
	}
}

/**
 * USAGE EXAMPLES:
 *
 * // 1. User Registration
 * const userPassword = 'MySecurePassword123!';
 * const { hash, salt } = hashPassword(userPassword);
 * // Save hash and salt to database: user.passwordHash = hash; user.passwordSalt = salt;
 *
 * // 2. User Login
 * const loginPassword = 'MySecurePassword123!';
 * const isAuthenticated = verifyPassword(loginPassword, user.passwordHash, user.passwordSalt);
 * if (isAuthenticated) {
 *     // Grant access
 * } else {
 *     // Deny access
 * }
 *
 * // 3. Password Change
 * const newPassword = 'NewPassword456!';
 * const newCredentials = hashPassword(newPassword);
 * // Update database: user.passwordHash = newCredentials.hash; user.passwordSalt = newCredentials.salt;
 */

// Export functions for use in other modules
export { generateSalt, hashPassword, verifyPassword }
export type { HashResult }
