import { Node } from "web-tree-sitter"
import * as path from "path"
import { v5 as uuidv5 } from "uuid"
import { CodeGraphNode, CodeGraphEdge, CodeNodeType, EdgeType } from "../interfaces/graph-index"
import { GraphIndexStore } from "./graph-index-store"
import { QDRANT_CODE_BLOCK_NAMESPACE } from "../constants"

/**
 * Extracts relationships between code elements from AST
 */
export class RelationshipExtractor {
	private readonly workspacePath: string

	constructor(workspacePath: string) {
		this.workspacePath = workspacePath
	}

	/**
	 * Extract nodes and relationships from an AST
	 */
	extractFromAST(
		tree: any,
		filePath: string,
		content: string,
		language: string,
	): { nodes: CodeGraphNode[]; edges: CodeGraphEdge[] } {
		const nodes: CodeGraphNode[] = []
		const edges: CodeGraphEdge[] = []
		const relativePath = path.relative(this.workspacePath, filePath)

		// Create file node
		const fileNodeId = GraphIndexStore.generateNodeId(relativePath, "file", relativePath, 0)
		const fileNode: CodeGraphNode = {
			id: fileNodeId,
			type: CodeNodeType.FILE,
			name: path.basename(filePath),
			filePath: relativePath,
			startLine: 1,
			endLine: content.split("\n").length,
			content: content.substring(0, 500), // Store first 500 chars as preview
			metadata: {
				language,
				fullPath: filePath,
			},
		}
		nodes.push(fileNode)

		// Extract based on language
		switch (language) {
			case "typescript":
			case "tsx":
			case "javascript":
			case "jsx":
				this.extractTypeScriptRelationships(tree.rootNode, relativePath, fileNodeId, nodes, edges)
				break
			case "python":
				this.extractPythonRelationships(tree.rootNode, relativePath, fileNodeId, nodes, edges)
				break
			case "java":
				this.extractJavaRelationships(tree.rootNode, relativePath, fileNodeId, nodes, edges)
				break
			case "go":
				this.extractGoRelationships(tree.rootNode, relativePath, fileNodeId, nodes, edges)
				break
			case "rust":
				this.extractRustRelationships(tree.rootNode, relativePath, fileNodeId, nodes, edges)
				break
			default:
				// Generic extraction for other languages
				this.extractGenericRelationships(tree.rootNode, relativePath, fileNodeId, nodes, edges)
		}

		return { nodes, edges }
	}

	private extractTypeScriptRelationships(
		node: Node,
		filePath: string,
		fileNodeId: string,
		nodes: CodeGraphNode[],
		edges: CodeGraphEdge[],
	): void {
		const visit = (currentNode: Node, parentNodeId?: string) => {
			let currentNodeId: string | undefined

			// Extract imports
			if (currentNode.type === "import_statement") {
				const source = currentNode.childForFieldName("source")?.text?.replace(/['"]/g, "")
				if (source) {
					const importNodeId = GraphIndexStore.generateNodeId(
						filePath,
						"import",
						source,
						currentNode.startPosition.row + 1,
					)
					const importNode: CodeGraphNode = {
						id: importNodeId,
						type: CodeNodeType.IMPORT,
						name: source,
						filePath,
						startLine: currentNode.startPosition.row + 1,
						endLine: currentNode.endPosition.row + 1,
						content: currentNode.text,
						metadata: { source },
					}
					nodes.push(importNode)

					// File imports module
					edges.push({
						id: GraphIndexStore.generateEdgeId(fileNodeId, importNodeId, EdgeType.IMPORTS),
						source: fileNodeId,
						target: importNodeId,
						type: EdgeType.IMPORTS,
						weight: 1.0,
					})
				}
			}

			// Extract classes
			if (currentNode.type === "class_declaration") {
				const className = currentNode.childForFieldName("name")?.text
				if (className) {
					currentNodeId = GraphIndexStore.generateNodeId(
						filePath,
						"class",
						className,
						currentNode.startPosition.row + 1,
					)
					const classNode: CodeGraphNode = {
						id: currentNodeId,
						type: CodeNodeType.CLASS,
						name: className,
						filePath,
						startLine: currentNode.startPosition.row + 1,
						endLine: currentNode.endPosition.row + 1,
						content: currentNode.text.substring(0, 500),
						metadata: {},
					}
					nodes.push(classNode)

					// File contains class
					edges.push({
						id: GraphIndexStore.generateEdgeId(fileNodeId, currentNodeId, EdgeType.CONTAINS),
						source: fileNodeId,
						target: currentNodeId,
						type: EdgeType.CONTAINS,
						weight: 1.0,
					})

					// Check for inheritance
					const heritage = currentNode.childForFieldName("heritage")
					if (heritage) {
						heritage.children.forEach((clause) => {
							if (clause && clause.type === "extends_clause") {
								const superClass = clause.children.find((c) => c && c.type === "identifier")?.text
								if (superClass && currentNodeId) {
									edges.push({
										id: GraphIndexStore.generateEdgeId(currentNodeId, superClass, EdgeType.EXTENDS),
										source: currentNodeId,
										target: superClass, // This would need to be resolved to actual node ID
										type: EdgeType.EXTENDS,
										weight: 1.0,
										metadata: { unresolved: true },
									})
								}
							}
							if (clause && clause.type === "implements_clause") {
								clause.children
									.filter((c) => c && c.type === "identifier")
									.forEach((interfaceNode) => {
										if (interfaceNode && currentNodeId) {
											const interfaceName = interfaceNode.text
											edges.push({
												id: GraphIndexStore.generateEdgeId(
													currentNodeId,
													interfaceName,
													EdgeType.IMPLEMENTS,
												),
												source: currentNodeId,
												target: interfaceName, // This would need to be resolved to actual node ID
												type: EdgeType.IMPLEMENTS,
												weight: 1.0,
												metadata: { unresolved: true },
											})
										}
									})
							}
						})
					}
				}
			}

			// Extract interfaces
			if (currentNode.type === "interface_declaration") {
				const interfaceName = currentNode.childForFieldName("name")?.text
				if (interfaceName) {
					currentNodeId = GraphIndexStore.generateNodeId(
						filePath,
						"interface",
						interfaceName,
						currentNode.startPosition.row + 1,
					)
					const interfaceNode: CodeGraphNode = {
						id: currentNodeId,
						type: CodeNodeType.INTERFACE,
						name: interfaceName,
						filePath,
						startLine: currentNode.startPosition.row + 1,
						endLine: currentNode.endPosition.row + 1,
						content: currentNode.text.substring(0, 500),
						metadata: {},
					}
					nodes.push(interfaceNode)

					// File contains interface
					edges.push({
						id: GraphIndexStore.generateEdgeId(fileNodeId, currentNodeId, EdgeType.CONTAINS),
						source: fileNodeId,
						target: currentNodeId,
						type: EdgeType.CONTAINS,
						weight: 1.0,
					})
				}
			}

			// Extract functions
			if (
				currentNode.type === "function_declaration" ||
				currentNode.type === "arrow_function" ||
				currentNode.type === "function_expression"
			) {
				const functionName =
					currentNode.childForFieldName("name")?.text || `anonymous_${currentNode.startPosition.row + 1}`
				currentNodeId = GraphIndexStore.generateNodeId(
					filePath,
					"function",
					functionName,
					currentNode.startPosition.row + 1,
				)
				const functionNode: CodeGraphNode = {
					id: currentNodeId,
					type: CodeNodeType.FUNCTION,
					name: functionName,
					filePath,
					startLine: currentNode.startPosition.row + 1,
					endLine: currentNode.endPosition.row + 1,
					content: currentNode.text.substring(0, 500),
					metadata: {
						isAsync: currentNode.children.some((c) => c && c.type === "async"),
						isArrow: currentNode.type === "arrow_function",
					},
				}
				nodes.push(functionNode)

				// Determine container
				const containerId = parentNodeId || fileNodeId
				edges.push({
					id: GraphIndexStore.generateEdgeId(containerId, currentNodeId, EdgeType.CONTAINS),
					source: containerId,
					target: currentNodeId,
					type: EdgeType.CONTAINS,
					weight: 1.0,
				})
			}

			// Extract method definitions
			if (currentNode.type === "method_definition") {
				const methodName = currentNode.childForFieldName("name")?.text
				if (methodName && parentNodeId) {
					currentNodeId = GraphIndexStore.generateNodeId(
						filePath,
						"method",
						methodName,
						currentNode.startPosition.row + 1,
					)
					const methodNode: CodeGraphNode = {
						id: currentNodeId,
						type: CodeNodeType.METHOD,
						name: methodName,
						filePath,
						startLine: currentNode.startPosition.row + 1,
						endLine: currentNode.endPosition.row + 1,
						content: currentNode.text.substring(0, 500),
						metadata: {
							isStatic: currentNode.children.some((c) => c && c.type === "static"),
							isPrivate: currentNode.children.some((c) => c && c.type === "private"),
							isAsync: currentNode.children.some((c) => c && c.type === "async"),
						},
					}
					nodes.push(methodNode)

					// Class contains method
					edges.push({
						id: GraphIndexStore.generateEdgeId(parentNodeId, currentNodeId, EdgeType.CONTAINS),
						source: parentNodeId,
						target: currentNodeId,
						type: EdgeType.CONTAINS,
						weight: 1.0,
					})
				}
			}

			// Extract type aliases
			if (currentNode.type === "type_alias_declaration") {
				const typeName = currentNode.childForFieldName("name")?.text
				if (typeName) {
					currentNodeId = GraphIndexStore.generateNodeId(
						filePath,
						"type_alias",
						typeName,
						currentNode.startPosition.row + 1,
					)
					const typeNode: CodeGraphNode = {
						id: currentNodeId,
						type: CodeNodeType.TYPE_ALIAS,
						name: typeName,
						filePath,
						startLine: currentNode.startPosition.row + 1,
						endLine: currentNode.endPosition.row + 1,
						content: currentNode.text,
						metadata: {},
					}
					nodes.push(typeNode)

					// File contains type
					edges.push({
						id: GraphIndexStore.generateEdgeId(fileNodeId, currentNodeId, EdgeType.CONTAINS),
						source: fileNodeId,
						target: currentNodeId,
						type: EdgeType.CONTAINS,
						weight: 1.0,
					})
				}
			}

			// Extract enums
			if (currentNode.type === "enum_declaration") {
				const enumName = currentNode.childForFieldName("name")?.text
				if (enumName) {
					currentNodeId = GraphIndexStore.generateNodeId(
						filePath,
						"enum",
						enumName,
						currentNode.startPosition.row + 1,
					)
					const enumNode: CodeGraphNode = {
						id: currentNodeId,
						type: CodeNodeType.ENUM,
						name: enumName,
						filePath,
						startLine: currentNode.startPosition.row + 1,
						endLine: currentNode.endPosition.row + 1,
						content: currentNode.text.substring(0, 500),
						metadata: {},
					}
					nodes.push(enumNode)

					// File contains enum
					edges.push({
						id: GraphIndexStore.generateEdgeId(fileNodeId, currentNodeId, EdgeType.CONTAINS),
						source: fileNodeId,
						target: currentNodeId,
						type: EdgeType.CONTAINS,
						weight: 1.0,
					})
				}
			}

			// Extract exports
			if (currentNode.type === "export_statement") {
				const declaration = currentNode.childForFieldName("declaration")
				if (declaration) {
					const exportName =
						declaration.childForFieldName("name")?.text || `export_${currentNode.startPosition.row + 1}`
					const exportNodeId = GraphIndexStore.generateNodeId(
						filePath,
						"export",
						exportName,
						currentNode.startPosition.row + 1,
					)
					const exportNode: CodeGraphNode = {
						id: exportNodeId,
						type: CodeNodeType.EXPORT,
						name: exportName,
						filePath,
						startLine: currentNode.startPosition.row + 1,
						endLine: currentNode.endPosition.row + 1,
						content: currentNode.text,
						metadata: {
							isDefault: currentNode.children.some((c) => c && c.type === "default"),
						},
					}
					nodes.push(exportNode)

					// File exports symbol
					edges.push({
						id: GraphIndexStore.generateEdgeId(fileNodeId, exportNodeId, EdgeType.EXPORTS),
						source: fileNodeId,
						target: exportNodeId,
						type: EdgeType.EXPORTS,
						weight: 1.0,
					})
				}
			}

			// Recurse through children
			for (const child of currentNode.children) {
				if (child) {
					visit(child, currentNodeId || parentNodeId)
				}
			}
		}

		visit(node)
	}

	private extractPythonRelationships(
		node: Node,
		filePath: string,
		fileNodeId: string,
		nodes: CodeGraphNode[],
		edges: CodeGraphEdge[],
	): void {
		const visit = (currentNode: Node, parentNodeId?: string) => {
			let currentNodeId: string | undefined

			// Extract imports
			if (currentNode.type === "import_statement" || currentNode.type === "import_from_statement") {
				const moduleName = currentNode.children.find((c) => c && c.type === "dotted_name")?.text
				if (moduleName) {
					const importNodeId = GraphIndexStore.generateNodeId(
						filePath,
						"import",
						moduleName,
						currentNode.startPosition.row + 1,
					)
					const importNode: CodeGraphNode = {
						id: importNodeId,
						type: CodeNodeType.IMPORT,
						name: moduleName,
						filePath,
						startLine: currentNode.startPosition.row + 1,
						endLine: currentNode.endPosition.row + 1,
						content: currentNode.text,
						metadata: {},
					}
					nodes.push(importNode)

					edges.push({
						id: GraphIndexStore.generateEdgeId(fileNodeId, importNodeId, EdgeType.IMPORTS),
						source: fileNodeId,
						target: importNodeId,
						type: EdgeType.IMPORTS,
						weight: 1.0,
					})
				}
			}

			// Extract classes
			if (currentNode.type === "class_definition") {
				const className = currentNode.childForFieldName("name")?.text
				if (className) {
					currentNodeId = GraphIndexStore.generateNodeId(
						filePath,
						"class",
						className,
						currentNode.startPosition.row + 1,
					)
					const classNode: CodeGraphNode = {
						id: currentNodeId,
						type: CodeNodeType.CLASS,
						name: className,
						filePath,
						startLine: currentNode.startPosition.row + 1,
						endLine: currentNode.endPosition.row + 1,
						content: currentNode.text.substring(0, 500),
						metadata: {},
					}
					nodes.push(classNode)

					edges.push({
						id: GraphIndexStore.generateEdgeId(fileNodeId, currentNodeId, EdgeType.CONTAINS),
						source: fileNodeId,
						target: currentNodeId,
						type: EdgeType.CONTAINS,
						weight: 1.0,
					})

					// Check for inheritance
					const superclasses = currentNode.childForFieldName("superclasses")
					if (superclasses) {
						superclasses.children
							.filter((c) => c && c.type === "identifier")
							.forEach((superClass) => {
								if (superClass && currentNodeId && superClass.text) {
									edges.push({
										id: GraphIndexStore.generateEdgeId(
											currentNodeId,
											superClass.text,
											EdgeType.EXTENDS,
										),
										source: currentNodeId,
										target: superClass.text,
										type: EdgeType.EXTENDS,
										weight: 1.0,
										metadata: { unresolved: true },
									})
								}
							})
					}
				}
			}

			// Extract functions
			if (currentNode.type === "function_definition") {
				const functionName = currentNode.childForFieldName("name")?.text
				if (functionName) {
					const nodeType = parentNodeId ? CodeNodeType.METHOD : CodeNodeType.FUNCTION
					currentNodeId = GraphIndexStore.generateNodeId(
						filePath,
						nodeType === CodeNodeType.METHOD ? "method" : "function",
						functionName,
						currentNode.startPosition.row + 1,
					)
					const functionNode: CodeGraphNode = {
						id: currentNodeId,
						type: nodeType,
						name: functionName,
						filePath,
						startLine: currentNode.startPosition.row + 1,
						endLine: currentNode.endPosition.row + 1,
						content: currentNode.text.substring(0, 500),
						metadata: {
							isAsync: currentNode.children.some((c) => c && c.type === "async"),
						},
					}
					nodes.push(functionNode)

					const containerId = parentNodeId || fileNodeId
					edges.push({
						id: GraphIndexStore.generateEdgeId(containerId, currentNodeId, EdgeType.CONTAINS),
						source: containerId,
						target: currentNodeId,
						type: EdgeType.CONTAINS,
						weight: 1.0,
					})
				}
			}

			// Recurse through children
			for (const child of currentNode.children) {
				if (child) {
					visit(child, currentNodeId || parentNodeId)
				}
			}
		}

		visit(node)
	}

	private extractJavaRelationships(
		node: Node,
		filePath: string,
		fileNodeId: string,
		nodes: CodeGraphNode[],
		edges: CodeGraphEdge[],
	): void {
		// Similar implementation for Java
		this.extractGenericRelationships(node, filePath, fileNodeId, nodes, edges)
	}

	private extractGoRelationships(
		node: Node,
		filePath: string,
		fileNodeId: string,
		nodes: CodeGraphNode[],
		edges: CodeGraphEdge[],
	): void {
		// Similar implementation for Go
		this.extractGenericRelationships(node, filePath, fileNodeId, nodes, edges)
	}

	private extractRustRelationships(
		node: Node,
		filePath: string,
		fileNodeId: string,
		nodes: CodeGraphNode[],
		edges: CodeGraphEdge[],
	): void {
		// Similar implementation for Rust
		this.extractGenericRelationships(node, filePath, fileNodeId, nodes, edges)
	}

	private extractGenericRelationships(
		node: Node,
		filePath: string,
		fileNodeId: string,
		nodes: CodeGraphNode[],
		edges: CodeGraphEdge[],
	): void {
		// Generic extraction for functions and classes
		const visit = (currentNode: Node) => {
			// Look for function-like constructs
			if (currentNode.type.includes("function") || currentNode.type.includes("method")) {
				const name = currentNode.childForFieldName("name")?.text || `func_${currentNode.startPosition.row + 1}`
				const nodeId = GraphIndexStore.generateNodeId(
					filePath,
					"function",
					name,
					currentNode.startPosition.row + 1,
				)
				const functionNode: CodeGraphNode = {
					id: nodeId,
					type: CodeNodeType.FUNCTION,
					name,
					filePath,
					startLine: currentNode.startPosition.row + 1,
					endLine: currentNode.endPosition.row + 1,
					content: currentNode.text.substring(0, 500),
					metadata: {},
				}
				nodes.push(functionNode)

				edges.push({
					id: GraphIndexStore.generateEdgeId(fileNodeId, nodeId, EdgeType.CONTAINS),
					source: fileNodeId,
					target: nodeId,
					type: EdgeType.CONTAINS,
					weight: 1.0,
				})
			}

			// Look for class-like constructs
			if (currentNode.type.includes("class") || currentNode.type.includes("struct")) {
				const name = currentNode.childForFieldName("name")?.text || `class_${currentNode.startPosition.row + 1}`
				const nodeId = GraphIndexStore.generateNodeId(
					filePath,
					"class",
					name,
					currentNode.startPosition.row + 1,
				)
				const classNode: CodeGraphNode = {
					id: nodeId,
					type: CodeNodeType.CLASS,
					name,
					filePath,
					startLine: currentNode.startPosition.row + 1,
					endLine: currentNode.endPosition.row + 1,
					content: currentNode.text.substring(0, 500),
					metadata: {},
				}
				nodes.push(classNode)

				edges.push({
					id: GraphIndexStore.generateEdgeId(fileNodeId, nodeId, EdgeType.CONTAINS),
					source: fileNodeId,
					target: nodeId,
					type: EdgeType.CONTAINS,
					weight: 1.0,
				})
			}

			// Recurse through children
			for (const child of currentNode.children) {
				if (child) {
					visit(child)
				}
			}
		}

		visit(node)
	}
}
