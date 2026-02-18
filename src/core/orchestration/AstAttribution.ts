import { CodeParser } from "../../services/code-index/processors/parser"

export interface AstNodeAttribution {
	identifier: string | null
	type: string
	start_line: number
	end_line: number
	segment_hash: string
}

export interface AstAttributionResult {
	status: "ok" | "fallback"
	nodes: AstNodeAttribution[]
}

const codeParser = new CodeParser()
const MAX_AST_NODES_PER_RANGE = 8

function rangesOverlap(
	first: { start_line: number; end_line: number },
	second: { start_line: number; end_line: number },
): boolean {
	return first.start_line <= second.end_line && second.start_line <= first.end_line
}

export async function collectAstAttributionForRange(
	absolutePath: string,
	fileContent: string,
	range: { start_line: number; end_line: number },
): Promise<AstAttributionResult> {
	if (!absolutePath) {
		return { status: "fallback", nodes: [] }
	}

	try {
		const parsedNodes = await codeParser.parseFile(absolutePath, { content: fileContent })
		if (!parsedNodes.length) {
			return { status: "fallback", nodes: [] }
		}

		const nodes = parsedNodes
			.filter((node) =>
				rangesOverlap(range, {
					start_line: node.start_line,
					end_line: node.end_line,
				}),
			)
			.slice(0, MAX_AST_NODES_PER_RANGE)
			.map((node) => ({
				identifier: node.identifier,
				type: node.type,
				start_line: node.start_line,
				end_line: node.end_line,
				segment_hash: node.segmentHash,
			}))

		if (!nodes.length) {
			return { status: "fallback", nodes: [] }
		}

		return { status: "ok", nodes }
	} catch {
		return { status: "fallback", nodes: [] }
	}
}
