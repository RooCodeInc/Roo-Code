import path from "path"

/**
 * Check if a relative file path is within the owned_scope of the active intent.
 * owned_scope entries are glob-like (e.g. "src/auth/**", "src/middleware/jwt.ts").
 */
export function pathInScope(relativePath: string, ownedScope: string[], _cwd: string): boolean {
	if (!ownedScope || ownedScope.length === 0) return true
	const normalized = path.normalize(relativePath).replace(/\\/g, "/")
	for (const pattern of ownedScope) {
		const p = path.normalize(pattern).replace(/\\/g, "/")
		if (p.endsWith("/**")) {
			const prefix = p.slice(0, -3)
			if (normalized === prefix || normalized.startsWith(prefix + "/")) return true
		} else if (p.includes("*")) {
			if (simpleGlobMatch(normalized, p)) return true
		} else {
			if (normalized === p || normalized.endsWith("/" + p)) return true
		}
	}
	return false
}

function simpleGlobMatch(path: string, pattern: string): boolean {
	const re = new RegExp(
		"^" +
			pattern
				.split("/")
				.map((seg) =>
					seg
						.replace(/[.+^${}()|[\]\\]/g, "\\$&")
						.replace(/\*\*/g, ".*")
						.replace(/\*/g, "[^/]*"),
				)
				.join("/") +
			"$",
	)
	return re.test(path)
}
