import {
	IContextAwareSearch,
	IGraphIndex,
	ContextAwareSearchResult,
	CodeGraphNode,
	CodeGraphEdge,
	CodeNodeType,
	EdgeType,
} from "../interfaces/graph-index"
import { IEmbedder } from "../interfaces/embedder"
import { IVectorStore } from "../interfaces/vector-store"

/**
 * Context-aware search implementation that combines vector similarity
 * with graph relationships for enhanced code understanding
 */
export class ContextAwareSearchService implements IContextAwareSearch {
	constructor(
		private readonly graphIndex: IGraphIndex,
		private readonly embedder: IEmbedder,
		private readonly vectorStore: IVectorStore,
	) {}

	/**
	 * Search with context awareness, combining vector similarity with graph relationships
	 */
	async searchWithContext(
		query: string,
		options?: {
			includeRelated?: boolean
			maxDepth?: number
			nodeTypes?: CodeNodeType[]
			edgeTypes?: EdgeType[]
			limit?: number
		},
	): Promise<ContextAwareSearchResult[]> {
		const { includeRelated = true, maxDepth = 2, nodeTypes, edgeTypes, limit = 10 } = options || {}

		// Generate embedding for the query
		const { embeddings } = await this.embedder.createEmbeddings([query])
		const queryEmbedding = embeddings[0]

		// Search for similar nodes using vector similarity
		const similarNodes = await this.graphIndex.searchSimilarNodes(
			queryEmbedding,
			limit * 2, // Get more candidates for filtering
			nodeTypes?.[0], // Use first node type if specified
		)

		// Build context for each result
		const results: ContextAwareSearchResult[] = []
		const processedNodes = new Set<string>()

		for (const node of similarNodes) {
			if (processedNodes.has(node.id)) continue
			processedNodes.add(node.id)

			// Calculate similarity score
			const score = this.calculateSimilarityScore(queryEmbedding, node.embedding || [])

			// Build context if requested
			let context: ContextAwareSearchResult["context"] = {
				relatedNodes: [],
				relationships: [],
			}

			if (includeRelated) {
				// Get related nodes
				const relatedNodes = await this.graphIndex.getConnectedNodes(node.id, edgeTypes?.[0], maxDepth)

				// Get relationships
				const relationships = await this.graphIndex.getEdges(node.id, edgeTypes?.[0])

				// Build call chain if it's a function/method
				if (node.type === CodeNodeType.FUNCTION || node.type === CodeNodeType.METHOD) {
					const callChain = await this.buildCallChain(node.id, maxDepth)
					context.callChain = callChain
				}

				// Build dependency tree
				const dependencies = await this.buildDependencyTree(node.id, maxDepth)

				context = {
					relatedNodes: relatedNodes.slice(0, 10), // Limit related nodes
					relationships: relationships.slice(0, 20), // Limit relationships
					callChain: context.callChain,
					dependencies,
				}
			}

			results.push({
				node,
				score,
				context,
			})

			if (results.length >= limit) break
		}

		// Sort by score and return top results
		return results.sort((a, b) => b.score - a.score).slice(0, limit)
	}

	/**
	 * Get code context for a specific location in a file
	 */
	async getContextForLocation(filePath: string, line: number): Promise<ContextAwareSearchResult | null> {
		// Search for nodes at this location
		const allNodes = await this.searchNodesByLocation(filePath, line)

		if (allNodes.length === 0) {
			return null
		}

		// Find the most specific node (smallest range containing the line)
		const node = allNodes.reduce((best, current) => {
			const bestRange = best.endLine - best.startLine
			const currentRange = current.endLine - current.startLine
			return currentRange < bestRange ? current : best
		})

		// Get comprehensive context
		const relatedNodes = await this.graphIndex.getConnectedNodes(node.id, undefined, 3)
		const relationships = await this.graphIndex.getEdges(node.id)

		// Build call chain if applicable
		let callChain: CodeGraphNode[] | undefined
		if (node.type === CodeNodeType.FUNCTION || node.type === CodeNodeType.METHOD) {
			callChain = await this.buildCallChain(node.id, 5)
		}

		// Build dependency tree
		const dependencies = await this.buildDependencyTree(node.id, 3)

		return {
			node,
			score: 1.0, // Perfect match for location
			context: {
				relatedNodes,
				relationships,
				callChain,
				dependencies,
			},
		}
	}

	/**
	 * Find related code across the codebase
	 */
	async findRelatedCode(nodeId: string, relationshipTypes?: EdgeType[]): Promise<CodeGraphNode[]> {
		const relatedNodes: CodeGraphNode[] = []
		const visited = new Set<string>()
		const queue: { id: string; depth: number }[] = [{ id: nodeId, depth: 0 }]
		const maxDepth = 3

		while (queue.length > 0) {
			const { id, depth } = queue.shift()!

			if (visited.has(id) || depth > maxDepth) continue
			visited.add(id)

			// Get edges for this node
			const edges = await this.graphIndex.getEdges(id)

			for (const edge of edges) {
				// Filter by relationship type if specified
				if (relationshipTypes && !relationshipTypes.includes(edge.type)) {
					continue
				}

				const targetId = edge.source === id ? edge.target : edge.source
				if (!visited.has(targetId)) {
					const targetNode = await this.graphIndex.getNode(targetId)
					if (targetNode) {
						relatedNodes.push(targetNode)
						queue.push({ id: targetId, depth: depth + 1 })
					}
				}
			}
		}

		// Sort by relevance (based on relationship strength and type)
		return this.rankRelatedNodes(relatedNodes, nodeId)
	}

	/**
	 * Build a call chain for a function/method
	 */
	private async buildCallChain(nodeId: string, maxDepth: number): Promise<CodeGraphNode[]> {
		const chain: CodeGraphNode[] = []
		const visited = new Set<string>()

		const buildChainRecursive = async (currentId: string, depth: number) => {
			if (depth > maxDepth || visited.has(currentId)) return
			visited.add(currentId)

			const node = await this.graphIndex.getNode(currentId)
			if (!node) return

			chain.push(node)

			// Find callers (nodes that have CALLS edge to this node)
			const edges = await this.graphIndex.getEdges(currentId, EdgeType.CALLS)
			for (const edge of edges) {
				if (edge.target === currentId) {
					await buildChainRecursive(edge.source, depth + 1)
				}
			}
		}

		await buildChainRecursive(nodeId, 0)
		return chain
	}

	/**
	 * Build a dependency tree for a node
	 */
	private async buildDependencyTree(nodeId: string, maxDepth: number): Promise<CodeGraphNode[]> {
		const dependencies: CodeGraphNode[] = []
		const visited = new Set<string>()

		const buildTreeRecursive = async (currentId: string, depth: number) => {
			if (depth > maxDepth || visited.has(currentId)) return
			visited.add(currentId)

			// Get import and dependency edges
			const edges = await this.graphIndex.getEdges(currentId)
			const depEdges = edges.filter(
				(e) => e.type === EdgeType.IMPORTS || e.type === EdgeType.DEPENDS_ON || e.type === EdgeType.USES,
			)

			for (const edge of depEdges) {
				const targetId = edge.source === currentId ? edge.target : edge.source
				const targetNode = await this.graphIndex.getNode(targetId)
				if (targetNode && !visited.has(targetId)) {
					dependencies.push(targetNode)
					await buildTreeRecursive(targetId, depth + 1)
				}
			}
		}

		await buildTreeRecursive(nodeId, 0)
		return dependencies
	}

	/**
	 * Search for nodes at a specific file location
	 */
	private async searchNodesByLocation(filePath: string, line: number): Promise<CodeGraphNode[]> {
		// This would need to be implemented with a proper query to the graph store
		// For now, we'll use a simplified approach
		const allNodes: CodeGraphNode[] = []

		// Search through vector store for nodes in this file
		const results = await this.vectorStore.search(
			new Array(768).fill(0), // Dummy embedding
			filePath,
			0, // No minimum score
			100, // Get many results
		)

		for (const result of results) {
			if (
				result.payload?.filePath === filePath &&
				result.payload?.startLine <= line &&
				result.payload?.endLine >= line
			) {
				// Convert to graph node
				const node: CodeGraphNode = {
					id: result.id as string,
					type: CodeNodeType.FUNCTION, // Would need proper type detection
					name: `${filePath}:${line}`,
					filePath,
					startLine: result.payload.startLine,
					endLine: result.payload.endLine,
					content: result.payload.codeChunk,
					metadata: {},
				}
				allNodes.push(node)
			}
		}

		return allNodes
	}

	/**
	 * Calculate similarity score between two embeddings
	 */
	private calculateSimilarityScore(embedding1: number[], embedding2: number[]): number {
		if (embedding1.length !== embedding2.length || embedding1.length === 0) {
			return 0
		}

		// Cosine similarity
		let dotProduct = 0
		let norm1 = 0
		let norm2 = 0

		for (let i = 0; i < embedding1.length; i++) {
			dotProduct += embedding1[i] * embedding2[i]
			norm1 += embedding1[i] * embedding1[i]
			norm2 += embedding2[i] * embedding2[i]
		}

		const denominator = Math.sqrt(norm1) * Math.sqrt(norm2)
		if (denominator === 0) return 0

		// Convert to 0-1 range
		return (dotProduct / denominator + 1) / 2
	}

	/**
	 * Rank related nodes by relevance
	 */
	private rankRelatedNodes(nodes: CodeGraphNode[], sourceNodeId: string): CodeGraphNode[] {
		// Simple ranking based on node type priority
		const typePriority: Record<CodeNodeType, number> = {
			[CodeNodeType.CLASS]: 10,
			[CodeNodeType.INTERFACE]: 9,
			[CodeNodeType.FUNCTION]: 8,
			[CodeNodeType.METHOD]: 7,
			[CodeNodeType.TYPE_ALIAS]: 6,
			[CodeNodeType.ENUM]: 5,
			[CodeNodeType.CONSTANT]: 4,
			[CodeNodeType.VARIABLE]: 3,
			[CodeNodeType.MODULE]: 2,
			[CodeNodeType.IMPORT]: 1,
			[CodeNodeType.EXPORT]: 1,
			[CodeNodeType.FILE]: 0,
			[CodeNodeType.NAMESPACE]: 2,
		}

		return nodes.sort((a, b) => {
			const priorityA = typePriority[a.type] || 0
			const priorityB = typePriority[b.type] || 0
			return priorityB - priorityA
		})
	}
}
