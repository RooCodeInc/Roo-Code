import path from "path"

export class ScopeValidationError extends Error {
	constructor(
		public readonly code: "PATH_INVALID" | "PATH_OUTSIDE_WORKSPACE" | "SCOPE_VIOLATION",
		message: string,
		public readonly details?: Record<string, unknown>,
	) {
		super(message)
	}
}

function escapeRegex(value: string): string {
	return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&")
}

function globToRegex(pattern: string): RegExp {
	const normalized = pattern.replace(/\\/g, "/")
	let source = "^"
	for (let i = 0; i < normalized.length; i++) {
		const char = normalized[i]
		const next = normalized[i + 1]
		if (char === "*" && next === "*") {
			source += ".*"
			i++
			continue
		}
		if (char === "*") {
			source += "[^/]*"
			continue
		}
		if (char === "?") {
			source += "."
			continue
		}
		source += escapeRegex(char)
	}
	source += "$"
	return new RegExp(source)
}

export function sanitizeAndNormalizePath(
	cwd: string,
	targetPath: string,
): {
	absolutePath: string
	relativePath: string
} {
	if (!targetPath || typeof targetPath !== "string") {
		throw new ScopeValidationError("PATH_INVALID", "Target path is missing or invalid.")
	}
	if (targetPath.includes("\0")) {
		throw new ScopeValidationError("PATH_INVALID", "Target path contains null byte.")
	}

	const absolutePath = path.resolve(cwd, targetPath)
	const workspaceRoot = path.resolve(cwd)
	const relativePath = path.relative(workspaceRoot, absolutePath).replace(/\\/g, "/")

	if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
		throw new ScopeValidationError("PATH_OUTSIDE_WORKSPACE", "Path traversal outside workspace is blocked.", {
			path: targetPath,
		})
	}

	return { absolutePath, relativePath }
}

export function validatePathAgainstScope(relativePath: string, scopePatterns: string[]): void {
	const allowed = scopePatterns.some((pattern) => globToRegex(pattern).test(relativePath))
	if (!allowed) {
		throw new ScopeValidationError("SCOPE_VIOLATION", `Path '${relativePath}' is not allowed by intent scope.`, {
			path: relativePath,
			scope: scopePatterns,
		})
	}
}
