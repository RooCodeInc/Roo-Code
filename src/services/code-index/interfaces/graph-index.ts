/**
 * Graph-based code indexing interfaces for enhanced codebase understanding
 */

/**
 * Represents a node in the code graph
 */
export interface CodeGraphNode {
	id: string
	type: CodeNodeType
	name: string
	filePath: string
	startLine: number
	endLine: number
	content: string
	embedding?: number[]
	metadata: Record<string, any>
}

/**
 * Types of nodes in the code graph
 */
export enum CodeNodeType {
	FILE = "file",
	CLASS = "class",
	INTERFACE = "interface",
	FUNCTION = "function",
	METHOD = "method",
	VARIABLE = "variable",
	IMPORT = "import",
	EXPORT = "export",
	MODULE = "module",
	NAMESPACE = "namespace",
	TYPE_ALIAS = "type_alias",
	ENUM = "enum",
	CONSTANT = "constant",
}

/**
 * Represents an edge/relationship between code nodes
 */
export interface CodeGraphEdge {
	id: string
	source: string // Node ID
	target: string // Node ID
	type: EdgeType
	weight: number // Relationship strength (0-1)
	metadata?: Record<string, any>
}

/**
 * Types of relationships between code nodes
 */
export enum EdgeType {
	CONTAINS = "contains", // File contains class/function
	IMPORTS = "imports", // Module imports another
	EXPORTS = "exports", // Module exports symbol
	EXTENDS = "extends", // Class inheritance
	IMPLEMENTS = "implements", // Interface implementation
	CALLS = "calls", // Function calls another
	REFERENCES = "references", // Variable/type reference
	DEFINES = "defines", // File defines symbol
	USES = "uses", // Generic usage relationship
	OVERRIDES = "overrides", // Method override
	DECORATES = "decorates", // Decorator relationship
	DEPENDS_ON = "depends_on", // Dependency relationship
}

/**
 * Graph-based index interface
 */
export interface IGraphIndex {
	/**
	 * Add a node to the graph
	 */
	addNode(node: CodeGraphNode): Promise<void>

	/**
	 * Add an edge to the graph
	 */
	addEdge(edge: CodeGraphEdge): Promise<void>

	/**
	 * Get a node by ID
	 */
	getNode(nodeId: string): Promise<CodeGraphNode | null>

	/**
	 * Get edges for a node
	 */
	getEdges(nodeId: string, edgeType?: EdgeType): Promise<CodeGraphEdge[]>

	/**
	 * Get connected nodes
	 */
	getConnectedNodes(nodeId: string, edgeType?: EdgeType, depth?: number): Promise<CodeGraphNode[]>

	/**
	 * Search nodes by similarity
	 */
	searchSimilarNodes(embedding: number[], limit?: number, nodeType?: CodeNodeType): Promise<CodeGraphNode[]>

	/**
	 * Get subgraph around a node
	 */
	getSubgraph(
		nodeId: string,
		depth: number,
	): Promise<{
		nodes: CodeGraphNode[]
		edges: CodeGraphEdge[]
	}>

	/**
	 * Clear the entire graph
	 */
	clear(): Promise<void>
}

/**
 * Context-aware search result
 */
export interface ContextAwareSearchResult {
	node: CodeGraphNode
	score: number
	context: {
		relatedNodes: CodeGraphNode[]
		relationships: CodeGraphEdge[]
		callChain?: CodeGraphNode[]
		dependencies?: CodeGraphNode[]
	}
}

/**
 * Enhanced search interface with context awareness
 */
export interface IContextAwareSearch {
	/**
	 * Search with context awareness
	 */
	searchWithContext(
		query: string,
		options?: {
			includeRelated?: boolean
			maxDepth?: number
			nodeTypes?: CodeNodeType[]
			edgeTypes?: EdgeType[]
		},
	): Promise<ContextAwareSearchResult[]>

	/**
	 * Get code context for a specific location
	 */
	getContextForLocation(filePath: string, line: number): Promise<ContextAwareSearchResult | null>

	/**
	 * Find related code across the codebase
	 */
	findRelatedCode(nodeId: string, relationshipTypes?: EdgeType[]): Promise<CodeGraphNode[]>
}
