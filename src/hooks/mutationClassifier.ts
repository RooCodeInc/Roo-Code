import path from "path"

export type SemanticMutationClass = "create" | "modify" | "replace" | "delete" | "AST_REFACTOR" | "INTENT_EVOLUTION"

function stripCommentsAndWhitespace(content: string, ext: string): string {
	let result = content
	if ([".ts", ".tsx", ".js", ".jsx", ".cjs", ".mjs"].includes(ext)) {
		result = result
			.replace(/\/\*[\s\S]*?\*\//g, "")
			.replace(/\/\/.*$/gm, "")
			.replace(/\s+/g, "")
		return result
	}
	if ([".py", ".rb", ".sh"].includes(ext)) {
		result = result.replace(/#.*$/gm, "").replace(/\s+/g, "")
		return result
	}
	return result.replace(/\s+/g, "")
}

function extractPublicSymbols(content: string, ext: string): Set<string> {
	const symbols = new Set<string>()
	if ([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(ext)) {
		for (const match of content.matchAll(
			/\bexport\s+(?:async\s+)?(?:class|function|const|let|var|interface|type|enum)\s+([A-Za-z_]\w*)/g,
		)) {
			symbols.add(match[1])
		}
		for (const match of content.matchAll(/\bmodule\.exports\.([A-Za-z_]\w*)\s*=/g)) {
			symbols.add(match[1])
		}
	}
	return symbols
}

function hasNewPublicApi(oldContent: string, newContent: string, ext: string): boolean {
	const oldSymbols = extractPublicSymbols(oldContent, ext)
	const newSymbols = extractPublicSymbols(newContent, ext)
	for (const symbol of newSymbols) {
		if (!oldSymbols.has(symbol)) {
			return true
		}
	}
	return false
}

export function inferSemanticMutationClass(input: {
	filePath: string
	oldContent: string | null
	newContent: string
}): SemanticMutationClass {
	const ext = path.extname(input.filePath).toLowerCase()
	const oldContent = input.oldContent
	const newContent = input.newContent
	if (oldContent === null) {
		return "create"
	}
	if (newContent.length === 0 && oldContent.length > 0) {
		return "delete"
	}

	const oldNormalized = stripCommentsAndWhitespace(oldContent, ext)
	const newNormalized = stripCommentsAndWhitespace(newContent, ext)
	if (oldNormalized === newNormalized && oldContent !== newContent) {
		return "AST_REFACTOR"
	}
	if (hasNewPublicApi(oldContent, newContent, ext)) {
		return "INTENT_EVOLUTION"
	}
	if (newContent.length > oldContent.length * 2 || oldContent.length > newContent.length * 2) {
		return "replace"
	}
	return "modify"
}

export function isMutationClassCompatible(provided: string, inferred: SemanticMutationClass): boolean {
	if (provided === inferred) {
		return true
	}
	// Backward compatibility: allow legacy "modify" for semantic refactor/evolution only when strict mode not possible.
	if (provided === "modify" && (inferred === "AST_REFACTOR" || inferred === "INTENT_EVOLUTION")) {
		return false
	}
	return false
}
