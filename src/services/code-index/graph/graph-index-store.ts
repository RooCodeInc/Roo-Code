import { QdrantClient } from "@qdrant/js-client-rest"
import { v5 as uuidv5 } from "uuid"
import { createHash } from "crypto"
import { IGraphIndex, CodeGraphNode, CodeGraphEdge, CodeNodeType, EdgeType } from "../interfaces/graph-index"
import { QDRANT_CODE_BLOCK_NAMESPACE } from "../constants"

/**
 * Graph-based index implementation using Qdrant collections
 * Uses separate collections for nodes and edges to enable graph traversal
 */
export class GraphIndexStore implements IGraphIndex {
	private client: QdrantClient
	private readonly nodesCollectionName: string
	private readonly edgesCollectionName: string
	private readonly vectorSize: number
	private readonly workspacePath: string

	constructor(workspacePath: string, qdrantUrl: string, vectorSize: number, apiKey?: string) {
		this.workspacePath = workspacePath
		this.vectorSize = vectorSize

		// Generate collection names based on workspace
		const hash = createHash("sha256").update(workspacePath).digest("hex")
		this.nodesCollectionName = `graph-nodes-${hash.substring(0, 16)}`
		this.edgesCollectionName = `graph-edges-${hash.substring(0, 16)}`

		// Initialize Qdrant client
		try {
			const urlObj = new URL(qdrantUrl)
			const port = urlObj.port ? Number(urlObj.port) : urlObj.protocol === "https:" ? 443 : 80

			this.client = new QdrantClient({
				host: urlObj.hostname,
				https: urlObj.protocol === "https:",
				port: port,
				prefix: urlObj.pathname === "/" ? undefined : urlObj.pathname.replace(/\/+$/, ""),
				apiKey,
				headers: {
					"User-Agent": "Roo-Code-GraphIndex",
				},
			})
		} catch {
			this.client = new QdrantClient({
				url: qdrantUrl,
				apiKey,
				headers: {
					"User-Agent": "Roo-Code-GraphIndex",
				},
			})
		}
	}

	/**
	 * Initialize the graph collections
	 */
	async initialize(): Promise<void> {
		// Create nodes collection
		try {
			await this.client.createCollection(this.nodesCollectionName, {
				vectors: {
					size: this.vectorSize,
					distance: "Cosine",
					on_disk: true,
				},
				hnsw_config: {
					m: 64,
					ef_construct: 512,
					on_disk: true,
				},
			})
		} catch (error: any) {
			if (!error?.message?.includes("already exists")) {
				throw error
			}
		}

		// Create edges collection (no vectors, just metadata)
		try {
			await this.client.createCollection(this.edgesCollectionName, {
				vectors: {
					size: 4, // Minimal vector size for edges
					distance: "Cosine",
					on_disk: true,
				},
			})
		} catch (error: any) {
			if (!error?.message?.includes("already exists")) {
				throw error
			}
		}

		// Create indexes for efficient querying
		await this.createIndexes()
	}

	private async createIndexes(): Promise<void> {
		// Node indexes
		const nodeIndexFields = ["type", "name", "filePath", "startLine", "endLine"]
		for (const field of nodeIndexFields) {
			try {
				await this.client.createPayloadIndex(this.nodesCollectionName, {
					field_name: field,
					field_schema: "keyword",
				})
			} catch (error: any) {
				// Ignore if index already exists
			}
		}

		// Edge indexes
		const edgeIndexFields = ["source", "target", "type", "weight"]
		for (const field of edgeIndexFields) {
			try {
				await this.client.createPayloadIndex(this.edgesCollectionName, {
					field_name: field,
					field_schema: field === "weight" ? "float" : "keyword",
				})
			} catch (error: any) {
				// Ignore if index already exists
			}
		}
	}

	async addNode(node: CodeGraphNode): Promise<void> {
		const point = {
			id: node.id,
			vector: node.embedding || new Array(this.vectorSize).fill(0),
			payload: {
				type: node.type,
				name: node.name,
				filePath: node.filePath,
				startLine: node.startLine,
				endLine: node.endLine,
				content: node.content,
				metadata: node.metadata || {},
			},
		}

		await this.client.upsert(this.nodesCollectionName, {
			points: [point],
			wait: true,
		})
	}

	async addEdge(edge: CodeGraphEdge): Promise<void> {
		const point = {
			id: edge.id,
			vector: [edge.weight, 0, 0, 0], // Use weight as first dimension
			payload: {
				source: edge.source,
				target: edge.target,
				type: edge.type,
				weight: edge.weight,
				metadata: edge.metadata || {},
			},
		}

		await this.client.upsert(this.edgesCollectionName, {
			points: [point],
			wait: true,
		})
	}

	async getNode(nodeId: string): Promise<CodeGraphNode | null> {
		try {
			const result = await this.client.retrieve(this.nodesCollectionName, {
				ids: [nodeId],
			})

			if (result.length === 0) {
				return null
			}

			const point = result[0]
			return {
				id: nodeId,
				type: point.payload?.type as CodeNodeType,
				name: point.payload?.name as string,
				filePath: point.payload?.filePath as string,
				startLine: point.payload?.startLine as number,
				endLine: point.payload?.endLine as number,
				content: point.payload?.content as string,
				embedding: point.vector as number[],
				metadata: point.payload?.metadata as Record<string, any>,
			}
		} catch {
			return null
		}
	}

	async getEdges(nodeId: string, edgeType?: EdgeType): Promise<CodeGraphEdge[]> {
		const filter: any = {
			should: [
				{ key: "source", match: { value: nodeId } },
				{ key: "target", match: { value: nodeId } },
			],
		}

		if (edgeType) {
			filter.must = [{ key: "type", match: { value: edgeType } }]
		}

		const result = await this.client.scroll(this.edgesCollectionName, {
			filter,
			limit: 1000,
			with_payload: true,
		})

		return result.points.map((point) => ({
			id: point.id as string,
			source: point.payload?.source as string,
			target: point.payload?.target as string,
			type: point.payload?.type as EdgeType,
			weight: point.payload?.weight as number,
			metadata: point.payload?.metadata as Record<string, any>,
		}))
	}

	async getConnectedNodes(nodeId: string, edgeType?: EdgeType, depth: number = 1): Promise<CodeGraphNode[]> {
		const visited = new Set<string>()
		const nodes: CodeGraphNode[] = []
		const queue: { id: string; currentDepth: number }[] = [{ id: nodeId, currentDepth: 0 }]

		while (queue.length > 0) {
			const { id, currentDepth } = queue.shift()!

			if (visited.has(id) || currentDepth > depth) {
				continue
			}

			visited.add(id)

			// Get the node
			const node = await this.getNode(id)
			if (node && currentDepth > 0) {
				nodes.push(node)
			}

			// Get edges if we haven't reached max depth
			if (currentDepth < depth) {
				const edges = await this.getEdges(id, edgeType)
				for (const edge of edges) {
					const nextId = edge.source === id ? edge.target : edge.source
					if (!visited.has(nextId)) {
						queue.push({ id: nextId, currentDepth: currentDepth + 1 })
					}
				}
			}
		}

		return nodes
	}

	async searchSimilarNodes(
		embedding: number[],
		limit: number = 10,
		nodeType?: CodeNodeType,
	): Promise<CodeGraphNode[]> {
		const filter = nodeType ? { must: [{ key: "type", match: { value: nodeType } }] } : undefined

		const result = await this.client.query(this.nodesCollectionName, {
			query: embedding,
			filter,
			limit,
			with_payload: true,
		})

		return result.points.map((point) => ({
			id: point.id as string,
			type: point.payload?.type as CodeNodeType,
			name: point.payload?.name as string,
			filePath: point.payload?.filePath as string,
			startLine: point.payload?.startLine as number,
			endLine: point.payload?.endLine as number,
			content: point.payload?.content as string,
			embedding: point.vector as number[],
			metadata: point.payload?.metadata as Record<string, any>,
		}))
	}

	async getSubgraph(nodeId: string, depth: number): Promise<{ nodes: CodeGraphNode[]; edges: CodeGraphEdge[] }> {
		const nodes = await this.getConnectedNodes(nodeId, undefined, depth)
		const nodeIds = new Set([nodeId, ...nodes.map((n) => n.id)])

		// Get all edges between these nodes
		const allEdges: CodeGraphEdge[] = []
		for (const id of nodeIds) {
			const edges = await this.getEdges(id)
			for (const edge of edges) {
				if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
					allEdges.push(edge)
				}
			}
		}

		// Get the root node
		const rootNode = await this.getNode(nodeId)
		if (rootNode) {
			nodes.unshift(rootNode)
		}

		// Remove duplicate edges
		const uniqueEdges = Array.from(new Map(allEdges.map((e) => [e.id, e])).values())

		return { nodes, edges: uniqueEdges }
	}

	async clear(): Promise<void> {
		try {
			await this.client.deleteCollection(this.nodesCollectionName)
		} catch {
			// Collection might not exist
		}

		try {
			await this.client.deleteCollection(this.edgesCollectionName)
		} catch {
			// Collection might not exist
		}

		// Reinitialize collections
		await this.initialize()
	}

	/**
	 * Helper method to generate node ID
	 */
	static generateNodeId(filePath: string, type: string, name: string, line: number): string {
		const content = `${filePath}-${type}-${name}-${line}`
		return uuidv5(content, QDRANT_CODE_BLOCK_NAMESPACE)
	}

	/**
	 * Helper method to generate edge ID
	 */
	static generateEdgeId(source: string, target: string, type: EdgeType): string {
		const content = `${source}-${target}-${type}`
		return uuidv5(content, QDRANT_CODE_BLOCK_NAMESPACE)
	}
}
