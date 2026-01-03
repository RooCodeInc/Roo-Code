/**
 * Global string extensions declaration.
 * This file provides type declarations for String.prototype extensions
 * that are used across the codebase.
 *
 * The actual implementation is in src/utils/path.ts
 */
declare global {
	interface String {
		/**
		 * Convert a path string to POSIX format (forward slashes).
		 * Extended-Length Paths in Windows (\\?\) are preserved.
		 * @returns The path with backslashes converted to forward slashes
		 */
		toPosix(): string
	}
}

// This export is needed to make this file a module
export {}
