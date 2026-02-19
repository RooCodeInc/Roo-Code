/**
utils/astHasher.ts
─────────────────────────────────────────────────────────────
AST-based content hashing for spatial independence.
─────────────────────────────────────────────────────────────
*/
import * as crypto from "crypto"
import * as path from "path"

// Dynamic import — @typescript-eslint/typescript-estree is optional
async function tryGetParser() {
	try {
		const { parse } = await import("@typescript-eslint/typescript-estree")
		return parse
	} catch {
		return null
	}
}

export interface ASTHashResult {
	hash: string
	method: "ast" | "raw"
	nodeCount: number
}

/**
Hash a block of code using AST fingerprinting.
*/
export async function hashCodeBlock(
	content: string,
	filePath: string,
	startLine?: number,
	endLine?: number,
): Promise<ASTHashResult> {
	const ext = path.extname(filePath).toLowerCase()
	const isTS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(ext)

	if (!isTS) {
		return {
			hash: "raw-sha256:" + crypto.createHash("sha256").update(content).digest("hex"),
			method: "raw",
			nodeCount: 0,
		}
	}

	const parse = await tryGetParser()
	if (!parse) {
		console.warn("[astHasher] @typescript-eslint/typescript-estree not found, falling back to raw hash")
		return {
			hash: "raw-sha256:" + crypto.createHash("sha256").update(content).digest("hex"),
			method: "raw",
			nodeCount: 0,
		}
	}

	try {
		// ✅ FIX: Cast to any to avoid Program/ASTNode mismatch
		const ast: any = parse(content, {
			loc: true,
			range: true,
			jsx: ext === ".tsx" || ext === ".jsx",
			tolerant: true,
		})
		const nodes = collectNodesInRange(ast, startLine, endLine)
		const fingerprint = buildFingerprint(nodes)
		const hash = "ast-sha256:" + crypto.createHash("sha256").update(fingerprint).digest("hex")

		return { hash, method: "ast", nodeCount: nodes.length }
	} catch (err) {
		console.warn("[astHasher] Parse failed, falling back to raw hash:", err)
		return {
			hash: "raw-sha256:" + crypto.createHash("sha256").update(content).digest("hex"),
			method: "raw",
			nodeCount: 0,
		}
	}
}

// ── Internal helpers ───────────────────────────────────────────
// ✅ FIX: Use any for flexible AST traversal
type ASTNode = any

function collectNodesInRange(ast: ASTNode, startLine?: number, endLine?: number): ASTNode[] {
	const results: ASTNode[] = []

	function walk(node: ASTNode) {
		if (!node || typeof node !== "object") return

		const nodeLine = node.loc?.start?.line
		const inRange =
			startLine === undefined ||
			endLine === undefined ||
			(nodeLine !== undefined && nodeLine >= startLine && nodeLine <= endLine)

		if (inRange && node.type) {
			results.push(node)
		}

		for (const key of Object.keys(node)) {
			if (key === "parent") continue
			const child = node[key]
			if (Array.isArray(child)) {
				child.forEach((c: any) => c && typeof c === "object" && walk(c))
			} else if (child && typeof child === "object" && child.type) {
				walk(child)
			}
		}
	}

	const body = ast?.body
	if (Array.isArray(body)) {
		body.forEach(walk)
	} else {
		walk(ast)
	}
	return results
}

function buildFingerprint(nodes: ASTNode[]): string {
	const normalized = nodes.map((node: any) => ({
		type: node.type,
		id: extractIdentifier(node),
		paramCount: extractParamCount(node),
		childTypes: extractChildTypes(node),
	}))
	return JSON.stringify(normalized)
}

function extractIdentifier(node: ASTNode): string | null {
	return node?.id?.name ?? node?.key?.name ?? node?.name ?? null
}

function extractParamCount(node: ASTNode): number | null {
	if (node?.params) return node.params.length
	if (node?.value?.params) return node.value.params.length
	return null
}

function extractChildTypes(node: ASTNode): string[] {
	const types: string[] = []
	for (const key of Object.keys(node)) {
		if (["type", "loc", "range", "parent", "start", "end"].includes(key)) continue
		const child = node[key]
		if (child && typeof child === "object" && child.type) {
			types.push(child.type)
		}
	}
	return types
}
