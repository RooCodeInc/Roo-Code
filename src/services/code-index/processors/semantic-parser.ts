import { Node } from "web-tree-sitter"
import { createHash } from "crypto"
import * as path from "path"
import { CodeBlock } from "../interfaces"
import { MAX_BLOCK_CHARS, MIN_BLOCK_CHARS, MAX_CHARS_TOLERANCE_FACTOR } from "../constants"

/**
 * Semantic context for code blocks
 */
export interface SemanticContext {
	scope: string[] // Nested scope (e.g., ["ClassName", "methodName"])
	imports: string[]
	exports: string[]
	dependencies: string[]
	complexity: number
	semanticType: SemanticBlockType
}

/**
 * Types of semantic blocks for better chunking
 */
export enum SemanticBlockType {
	CLASS_DEFINITION = "class_definition",
	FUNCTION_DEFINITION = "function_definition",
	METHOD_DEFINITION = "method_definition",
	INTERFACE_DEFINITION = "interface_definition",
	TYPE_DEFINITION = "type_definition",
	IMPORT_BLOCK = "import_block",
	EXPORT_BLOCK = "export_block",
	VARIABLE_DECLARATION = "variable_declaration",
	CONTROL_FLOW = "control_flow",
	DOCUMENTATION = "documentation",
	TEST_CASE = "test_case",
	CONFIGURATION = "configuration",
}

/**
 * Enhanced code block with semantic information
 */
export interface SemanticCodeBlock extends CodeBlock {
	semanticContext: SemanticContext
	parentBlockId?: string
	childBlockIds: string[]
	relatedBlockIds: string[]
}

/**
 * Semantic parser that creates intelligent code chunks based on AST analysis
 */
export class SemanticParser {
	private readonly semanticBlocks: Map<string, SemanticCodeBlock> = new Map()

	/**
	 * Parse file with semantic understanding
	 */
	async parseWithSemantics(
		filePath: string,
		content: string,
		tree: any,
		language: string,
	): Promise<SemanticCodeBlock[]> {
		this.semanticBlocks.clear()
		const fileHash = createHash("sha256").update(content).digest("hex")
		const lines = content.split("\n")

		// Extract semantic blocks based on language
		switch (language) {
			case "typescript":
			case "tsx":
			case "javascript":
			case "jsx":
				return this.parseTypeScriptSemantics(tree.rootNode, filePath, lines, fileHash)
			case "python":
				return this.parsePythonSemantics(tree.rootNode, filePath, lines, fileHash)
			default:
				return this.parseGenericSemantics(tree.rootNode, filePath, lines, fileHash)
		}
	}

	/**
	 * Parse TypeScript/JavaScript with semantic understanding
	 */
	private parseTypeScriptSemantics(
		rootNode: Node,
		filePath: string,
		lines: string[],
		fileHash: string,
	): SemanticCodeBlock[] {
		const blocks: SemanticCodeBlock[] = []
		const imports: string[] = []
		const exports: string[] = []
		const globalScope: string[] = []

		// First pass: collect imports and exports
		this.collectImportsExports(rootNode, imports, exports)

		// Second pass: extract semantic blocks
		this.extractSemanticBlocks(rootNode, filePath, lines, fileHash, blocks, imports, exports, globalScope)

		// Third pass: establish relationships
		this.establishBlockRelationships(blocks)

		// Fourth pass: optimize chunking
		return this.optimizeChunking(blocks)
	}

	/**
	 * Collect imports and exports from AST
	 */
	private collectImportsExports(node: Node, imports: string[], exports: string[]): void {
		const visit = (currentNode: Node) => {
			if (currentNode.type === "import_statement") {
				const source = currentNode.childForFieldName("source")?.text?.replace(/['"]/g, "")
				if (source) imports.push(source)
			}

			if (currentNode.type === "export_statement") {
				const declaration = currentNode.childForFieldName("declaration")
				const name = declaration?.childForFieldName("name")?.text
				if (name) exports.push(name)
			}

			for (const child of currentNode.children) {
				if (child) visit(child)
			}
		}

		visit(node)
	}

	/**
	 * Extract semantic blocks from AST
	 */
	private extractSemanticBlocks(
		node: Node,
		filePath: string,
		lines: string[],
		fileHash: string,
		blocks: SemanticCodeBlock[],
		imports: string[],
		exports: string[],
		scope: string[],
		parentBlockId?: string,
	): void {
		const visit = (currentNode: Node, currentScope: string[], currentParentId?: string) => {
			let blockId: string | undefined
			let semanticType: SemanticBlockType | undefined
			let blockName: string | undefined

			// Determine semantic type and extract block
			if (currentNode.type === "class_declaration") {
				semanticType = SemanticBlockType.CLASS_DEFINITION
				blockName = currentNode.childForFieldName("name")?.text
			} else if (currentNode.type === "function_declaration") {
				semanticType = SemanticBlockType.FUNCTION_DEFINITION
				blockName = currentNode.childForFieldName("name")?.text
			} else if (currentNode.type === "method_definition") {
				semanticType = SemanticBlockType.METHOD_DEFINITION
				blockName = currentNode.childForFieldName("name")?.text
			} else if (currentNode.type === "interface_declaration") {
				semanticType = SemanticBlockType.INTERFACE_DEFINITION
				blockName = currentNode.childForFieldName("name")?.text
			} else if (currentNode.type === "type_alias_declaration") {
				semanticType = SemanticBlockType.TYPE_DEFINITION
				blockName = currentNode.childForFieldName("name")?.text
			} else if (this.isTestCase(currentNode)) {
				semanticType = SemanticBlockType.TEST_CASE
				blockName = this.extractTestName(currentNode)
			}

			// Create semantic block if applicable
			if (semanticType && blockName) {
				const startLine = currentNode.startPosition.row + 1
				const endLine = currentNode.endPosition.row + 1
				const content = lines.slice(startLine - 1, endLine).join("\n")

				// Check if content needs intelligent chunking
				if (content.length > MAX_BLOCK_CHARS * MAX_CHARS_TOLERANCE_FACTOR) {
					// Split large blocks intelligently
					const subBlocks = this.splitLargeSemanticBlock(
						currentNode,
						lines,
						filePath,
						fileHash,
						semanticType,
						blockName,
						currentScope,
					)
					blocks.push(...subBlocks)
					blockId = subBlocks[0]?.segmentHash
				} else if (content.length >= MIN_BLOCK_CHARS) {
					blockId = this.createSemanticBlock(
						filePath,
						fileHash,
						blockName,
						semanticType,
						startLine,
						endLine,
						content,
						currentScope,
						imports,
						exports,
						currentParentId,
					)
					blocks.push(this.semanticBlocks.get(blockId)!)
				}

				// Update scope for children
				currentScope = [...currentScope, blockName]
			}

			// Recurse through children
			for (const child of currentNode.children) {
				if (child) {
					visit(child, currentScope, blockId || currentParentId)
				}
			}
		}

		visit(node, scope, parentBlockId)
	}

	/**
	 * Split large semantic blocks intelligently
	 */
	private splitLargeSemanticBlock(
		node: Node,
		lines: string[],
		filePath: string,
		fileHash: string,
		semanticType: SemanticBlockType,
		blockName: string,
		scope: string[],
	): SemanticCodeBlock[] {
		const blocks: SemanticCodeBlock[] = []
		const startLine = node.startPosition.row + 1
		const endLine = node.endPosition.row + 1

		// For classes and interfaces, split by methods/properties
		if (
			semanticType === SemanticBlockType.CLASS_DEFINITION ||
			semanticType === SemanticBlockType.INTERFACE_DEFINITION
		) {
			// Create header block with class/interface signature
			const headerEndLine = this.findBlockHeaderEnd(node, startLine)
			if (headerEndLine > startLine) {
				const headerContent = lines.slice(startLine - 1, headerEndLine).join("\n")
				const headerId = this.createSemanticBlock(
					filePath,
					fileHash,
					`${blockName}_header`,
					semanticType,
					startLine,
					headerEndLine,
					headerContent,
					scope,
					[],
					[],
					undefined,
				)
				blocks.push(this.semanticBlocks.get(headerId)!)
			}

			// Extract methods as separate blocks
			for (const child of node.children) {
				if (child && (child.type === "method_definition" || child.type === "property_signature")) {
					const methodName = child.childForFieldName("name")?.text
					if (methodName) {
						const methodStart = child.startPosition.row + 1
						const methodEnd = child.endPosition.row + 1
						const methodContent = lines.slice(methodStart - 1, methodEnd).join("\n")

						if (methodContent.length >= MIN_BLOCK_CHARS) {
							const methodId = this.createSemanticBlock(
								filePath,
								fileHash,
								methodName,
								SemanticBlockType.METHOD_DEFINITION,
								methodStart,
								methodEnd,
								methodContent,
								[...scope, blockName],
								[],
								[],
								undefined,
							)
							blocks.push(this.semanticBlocks.get(methodId)!)
						}
					}
				}
			}
		} else {
			// For large functions, split by logical sections
			blocks.push(...this.splitFunctionIntoLogicalSections(node, lines, filePath, fileHash, blockName, scope))
		}

		return blocks
	}

	/**
	 * Find where the header of a block ends (e.g., class signature)
	 */
	private findBlockHeaderEnd(node: Node, startLine: number): number {
		// Find the first method or property
		for (const child of node.children) {
			if (
				child &&
				(child.type === "method_definition" ||
					child.type === "property_signature" ||
					child.type === "function_declaration")
			) {
				return child.startPosition.row // Return line before first member
			}
		}
		return startLine + 1 // Default to just the declaration line
	}

	/**
	 * Split a function into logical sections
	 */
	private splitFunctionIntoLogicalSections(
		node: Node,
		lines: string[],
		filePath: string,
		fileHash: string,
		functionName: string,
		scope: string[],
	): SemanticCodeBlock[] {
		const blocks: SemanticCodeBlock[] = []
		const startLine = node.startPosition.row + 1
		const endLine = node.endPosition.row + 1

		// Identify logical sections (initialization, main logic, return statements)
		const sections = this.identifyLogicalSections(node)

		let currentSectionStart = startLine
		sections.forEach((section, index) => {
			const sectionEnd = section.endLine
			const sectionContent = lines.slice(currentSectionStart - 1, sectionEnd).join("\n")

			if (sectionContent.length >= MIN_BLOCK_CHARS) {
				const sectionId = this.createSemanticBlock(
					filePath,
					fileHash,
					`${functionName}_section_${index + 1}`,
					SemanticBlockType.FUNCTION_DEFINITION,
					currentSectionStart,
					sectionEnd,
					sectionContent,
					scope,
					[],
					[],
					undefined,
				)
				blocks.push(this.semanticBlocks.get(sectionId)!)
			}

			currentSectionStart = sectionEnd + 1
		})

		// Add remaining content if any
		if (currentSectionStart <= endLine) {
			const remainingContent = lines.slice(currentSectionStart - 1, endLine).join("\n")
			if (remainingContent.length >= MIN_BLOCK_CHARS) {
				const remainingId = this.createSemanticBlock(
					filePath,
					fileHash,
					`${functionName}_end`,
					SemanticBlockType.FUNCTION_DEFINITION,
					currentSectionStart,
					endLine,
					remainingContent,
					scope,
					[],
					[],
					undefined,
				)
				blocks.push(this.semanticBlocks.get(remainingId)!)
			}
		}

		return blocks.length > 0
			? blocks
			: [
					{
						file_path: filePath,
						identifier: functionName,
						type: "function",
						start_line: startLine,
						end_line: endLine,
						content: lines.slice(startLine - 1, endLine).join("\n"),
						segmentHash: createHash("sha256")
							.update(`${filePath}-${functionName}-${startLine}`)
							.digest("hex"),
						fileHash,
						semanticContext: {
							scope,
							imports: [],
							exports: [],
							dependencies: [],
							complexity: this.calculateComplexity(node),
							semanticType: SemanticBlockType.FUNCTION_DEFINITION,
						},
						childBlockIds: [],
						relatedBlockIds: [],
					},
				]
	}

	/**
	 * Identify logical sections within a function
	 */
	private identifyLogicalSections(node: Node): Array<{ type: string; endLine: number }> {
		const sections: Array<{ type: string; endLine: number }> = []
		let lastSignificantLine = node.startPosition.row

		const visit = (currentNode: Node) => {
			// Look for significant control flow changes
			if (
				currentNode.type === "if_statement" ||
				currentNode.type === "for_statement" ||
				currentNode.type === "while_statement" ||
				currentNode.type === "try_statement"
			) {
				const endLine = currentNode.endPosition.row
				if (endLine - lastSignificantLine > 10) {
					sections.push({ type: "control_flow", endLine })
					lastSignificantLine = endLine
				}
			}

			for (const child of currentNode.children) {
				if (child) visit(child)
			}
		}

		visit(node)
		return sections
	}

	/**
	 * Create a semantic block
	 */
	private createSemanticBlock(
		filePath: string,
		fileHash: string,
		name: string,
		semanticType: SemanticBlockType,
		startLine: number,
		endLine: number,
		content: string,
		scope: string[],
		imports: string[],
		exports: string[],
		parentBlockId?: string,
	): string {
		const segmentHash = createHash("sha256")
			.update(`${filePath}-${name}-${startLine}-${content.length}`)
			.digest("hex")

		const block: SemanticCodeBlock = {
			file_path: filePath,
			identifier: name,
			type: semanticType,
			start_line: startLine,
			end_line: endLine,
			content,
			segmentHash,
			fileHash,
			semanticContext: {
				scope,
				imports: [...imports],
				exports: [...exports],
				dependencies: this.extractDependencies(content),
				complexity: this.calculateComplexityFromContent(content),
				semanticType,
			},
			parentBlockId,
			childBlockIds: [],
			relatedBlockIds: [],
		}

		this.semanticBlocks.set(segmentHash, block)

		// Update parent's children
		if (parentBlockId) {
			const parentBlock = this.semanticBlocks.get(parentBlockId)
			if (parentBlock) {
				parentBlock.childBlockIds.push(segmentHash)
			}
		}

		return segmentHash
	}

	/**
	 * Establish relationships between blocks
	 */
	private establishBlockRelationships(blocks: SemanticCodeBlock[]): void {
		// Find related blocks based on references
		for (const block of blocks) {
			for (const otherBlock of blocks) {
				if (block === otherBlock) continue

				// Check if block references the other
				if (block.content.includes(otherBlock.identifier || "")) {
					block.relatedBlockIds.push(otherBlock.segmentHash)
				}
			}
		}
	}

	/**
	 * Optimize chunking for better retrieval
	 */
	private optimizeChunking(blocks: SemanticCodeBlock[]): SemanticCodeBlock[] {
		const optimized: SemanticCodeBlock[] = []

		for (const block of blocks) {
			// Merge small related blocks
			if (block.content.length < MIN_BLOCK_CHARS * 0.5 && block.relatedBlockIds.length > 0) {
				// Try to merge with related blocks
				const relatedBlock = blocks.find((b) => b.segmentHash === block.relatedBlockIds[0])
				if (relatedBlock && relatedBlock.content.length + block.content.length < MAX_BLOCK_CHARS) {
					// Merge blocks
					relatedBlock.content += "\n\n" + block.content
					relatedBlock.end_line = block.end_line
					relatedBlock.relatedBlockIds.push(
						...block.relatedBlockIds.filter((id) => id !== relatedBlock.segmentHash),
					)
					continue
				}
			}

			optimized.push(block)
		}

		return optimized
	}

	/**
	 * Check if a node represents a test case
	 */
	private isTestCase(node: Node): boolean {
		if (node.type !== "call_expression") return false

		const functionName = node.childForFieldName("function")?.text
		return !!(
			functionName &&
			(functionName === "test" ||
				functionName === "it" ||
				functionName === "describe" ||
				functionName.includes("test") ||
				functionName.includes("spec"))
		)
	}

	/**
	 * Extract test name from test node
	 */
	private extractTestName(node: Node): string {
		const args = node.childForFieldName("arguments")
		if (args && args.children.length > 0) {
			const firstArg = args.children[1] // Skip opening paren
			if (firstArg && firstArg.type === "string") {
				return firstArg.text?.replace(/['"]/g, "") || "test"
			}
		}
		return `test_${node.startPosition.row + 1}`
	}

	/**
	 * Extract dependencies from content
	 */
	private extractDependencies(content: string): string[] {
		const dependencies: string[] = []

		// Simple regex-based extraction
		const importMatches = content.matchAll(/import\s+.*?\s+from\s+['"](.+?)['"]/g)
		for (const match of importMatches) {
			dependencies.push(match[1])
		}

		const requireMatches = content.matchAll(/require\(['"](.+?)['"]\)/g)
		for (const match of requireMatches) {
			dependencies.push(match[1])
		}

		return dependencies
	}

	/**
	 * Calculate complexity from AST node
	 */
	private calculateComplexity(node: Node): number {
		let complexity = 1

		const visit = (currentNode: Node) => {
			// Increment for control flow statements
			if (
				currentNode.type === "if_statement" ||
				currentNode.type === "for_statement" ||
				currentNode.type === "while_statement" ||
				currentNode.type === "switch_statement" ||
				currentNode.type === "catch_clause"
			) {
				complexity++
			}

			// Increment for logical operators
			if (currentNode.type === "binary_expression") {
				const operator = currentNode.childForFieldName("operator")?.text
				if (operator === "&&" || operator === "||") {
					complexity++
				}
			}

			for (const child of currentNode.children) {
				if (child) visit(child)
			}
		}

		visit(node)
		return complexity
	}

	/**
	 * Calculate complexity from content string
	 */
	private calculateComplexityFromContent(content: string): number {
		let complexity = 1

		// Count control flow keywords
		const controlFlowKeywords = ["if", "else", "for", "while", "switch", "case", "catch", "finally"]

		for (const keyword of controlFlowKeywords) {
			const regex = new RegExp(`\\b${keyword}\\b`, "g")
			const matches = content.match(regex)
			if (matches) {
				complexity += matches.length
			}
		}

		// Count logical operators
		complexity += (content.match(/&&|\|\|/g) || []).length

		return complexity
	}

	/**
	 * Parse Python with semantic understanding
	 */
	private parsePythonSemantics(
		rootNode: Node,
		filePath: string,
		lines: string[],
		fileHash: string,
	): SemanticCodeBlock[] {
		// Similar implementation adapted for Python syntax
		return this.parseGenericSemantics(rootNode, filePath, lines, fileHash)
	}

	/**
	 * Generic semantic parsing for other languages
	 */
	private parseGenericSemantics(
		rootNode: Node,
		filePath: string,
		lines: string[],
		fileHash: string,
	): SemanticCodeBlock[] {
		const blocks: SemanticCodeBlock[] = []

		// Basic semantic extraction
		const visit = (node: Node) => {
			const nodeText = node.text
			if (nodeText.length >= MIN_BLOCK_CHARS && nodeText.length <= MAX_BLOCK_CHARS * MAX_CHARS_TOLERANCE_FACTOR) {
				const block: SemanticCodeBlock = {
					file_path: filePath,
					identifier: null,
					type: node.type,
					start_line: node.startPosition.row + 1,
					end_line: node.endPosition.row + 1,
					content: nodeText,
					segmentHash: createHash("sha256")
						.update(`${filePath}-${node.startPosition.row}-${nodeText.length}`)
						.digest("hex"),
					fileHash,
					semanticContext: {
						scope: [],
						imports: [],
						exports: [],
						dependencies: [],
						complexity: 1,
						semanticType: SemanticBlockType.FUNCTION_DEFINITION,
					},
					childBlockIds: [],
					relatedBlockIds: [],
				}
				blocks.push(block)
			}

			for (const child of node.children) {
				if (child) visit(child)
			}
		}

		visit(rootNode)
		return blocks
	}
}
