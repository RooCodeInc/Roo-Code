import fs from "fs"
import crypto from "crypto"
import path from "path"
import { parse } from "@babel/parser"
import traverse, { NodePath } from "@babel/traverse"
import * as t from "@babel/types"
import { Intent } from "./preHook"

export function computeHash(content: string): string {
	return crypto.createHash("sha256").update(content).digest("hex")
}

export function countAstNodes(ast: t.File): number {
	let count = 0
	traverse(ast, {
		enter() {
			count++
		},
	})
	return count
}

export function detectMutationClass(oldContent: string, newContent: string): "AST_REFACTOR" | "INTENT_EVOLUTION" {
	const oldAST = parse(oldContent, {
		sourceType: "module",
		plugins: ["typescript"],
	})

	const newAST = parse(newContent, {
		sourceType: "module",
		plugins: ["typescript"],
	})

	// compute simple metrics for a more mathematical decision
	const oldNodes = countAstNodes(oldAST)
	const newNodes = countAstNodes(newAST)

	// fall back to function count if node counts are both zero
	let oldFunctions = 0
	let newFunctions = 0
	traverse(oldAST, {
		FunctionDeclaration(_path: NodePath<t.FunctionDeclaration>) {
			oldFunctions++
		},
	})
	traverse(newAST, {
		FunctionDeclaration(_path: NodePath<t.FunctionDeclaration>) {
			newFunctions++
		},
	})

	// If the relative change in node count is small (<10%), treat as refactor
	const maxNodes = Math.max(oldNodes, newNodes, 1)
	const ratio = Math.abs(oldNodes - newNodes) / maxNodes
	if (ratio < 0.1) {
		return "AST_REFACTOR"
	}

	// if node count is identical but functions changed, still a refactor
	if (oldNodes === newNodes && oldFunctions === newFunctions) {
		return "AST_REFACTOR"
	}

	return "INTENT_EVOLUTION"
}

export function postWriteHook(
	filePath: string,
	intent: Intent,
	sessionId: string,
	contributorModel: string,
	status: "SUCCESS" | "FAILED",
	error?: unknown,
) {
	const orchestrationDir = path.resolve(".orchestration")
	if (!fs.existsSync(orchestrationDir)) {
		fs.mkdirSync(orchestrationDir)
	}

	const tracePath = path.join(orchestrationDir, "agent_trace.jsonl")

	const newContent = fs.readFileSync(filePath, "utf-8")
	const contentHash = computeHash(newContent)

	const backupPath = filePath + ".bak"
	const oldContent = fs.existsSync(backupPath) ? fs.readFileSync(backupPath, "utf-8") : newContent

	const mutationClass = detectMutationClass(oldContent, newContent)

	const traceEntry = {
		id: crypto.randomUUID(),
		timestamp: new Date().toISOString(),
		vcs: { revision_id: "local-dev" }, // replace later with real git SHA
		files: [
			{
				relative_path: filePath,
				conversations: [
					{
						url: sessionId,
						contributor: {
							entity_type: "AI",
							model_identifier: contributorModel,
						},
						ranges: [
							{
								start_line: 1,
								end_line: newContent.split("\n").length,
								content_hash: `sha256:${contentHash}`,
							},
						],
						related: [
							{
								type: "specification",
								value: intent.id,
							},
						],
						mutation_class: mutationClass,
					},
				],
			},
		],
	}

	fs.appendFileSync(tracePath, JSON.stringify(traceEntry) + "\n")
}
