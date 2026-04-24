import path from "path"

interface IntentScope {
	files?: string[]
}

const PATCH_HEADER_RE = /^\*\*\*\s+(?:Add|Update|Delete)\s+File:\s+(.+)$/

function normalizePathForMatch(input: string): string {
	return input.replaceAll("\\", "/").replace(/^\.?\//, "")
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function globToRegExp(globPattern: string): RegExp {
	const normalized = normalizePathForMatch(globPattern)
	const withDoubleStar = normalized.replaceAll("**", "__DOUBLE_STAR__")
	const withSingleStar = withDoubleStar.replaceAll("*", "__SINGLE_STAR__")
	const escaped = escapeRegExp(withSingleStar)
		.replaceAll("__DOUBLE_STAR__", ".*")
		.replaceAll("__SINGLE_STAR__", "[^/]*")
	return new RegExp(`^${escaped}$`)
}

function isPathAllowed(filePath: string, allowedPatterns: string[]): boolean {
	if (allowedPatterns.length === 0) {
		return false
	}

	const normalizedPath = normalizePathForMatch(filePath)
	return allowedPatterns.some((pattern) => globToRegExp(pattern).test(normalizedPath))
}

function extractPathsFromApplyPatch(patch: string): string[] {
	return patch
		.split(/\r?\n/)
		.map((line) => line.trim())
		.map((line) => PATCH_HEADER_RE.exec(line)?.[1])
		.filter((value): value is string => !!value)
}

export function getToolTargetPaths(toolName: string, nativeArgs?: Record<string, unknown>): string[] {
	if (!nativeArgs) {
		return []
	}

	switch (toolName) {
		case "write_to_file":
		case "apply_diff":
			return typeof nativeArgs.path === "string" ? [nativeArgs.path] : []
		case "edit":
		case "search_and_replace":
		case "search_replace":
		case "edit_file":
			return typeof nativeArgs.file_path === "string" ? [nativeArgs.file_path] : []
		case "apply_patch":
			return typeof nativeArgs.patch === "string" ? extractPathsFromApplyPatch(nativeArgs.patch) : []
		default:
			return []
	}
}

export function enforceIntentScope(
	intentId: string,
	cwd: string,
	intentScope: IntentScope | unknown,
	targetPaths: string[],
): { allowed: true } | { allowed: false; error: string } {
	const filePatterns = Array.isArray((intentScope as IntentScope)?.files)
		? ((intentScope as IntentScope).files as string[])
		: []

	if (targetPaths.length === 0) {
		return { allowed: true }
	}

	for (const targetPath of targetPaths) {
		const relativeTarget = path.isAbsolute(targetPath) ? path.relative(cwd, targetPath) : targetPath
		if (!isPathAllowed(relativeTarget, filePatterns)) {
			return {
				allowed: false,
				error: `Scope Violation: ${intentId} is not authorized to edit [${relativeTarget}]. Request scope expansion.`,
			}
		}
	}

	return { allowed: true }
}
