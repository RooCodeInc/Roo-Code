import { MemoryEntry, MemoryType, MemoryPriority } from "./ConversationMemory"
import { VectorMemoryStore, MemorySearchResult } from "./VectorMemoryStore"
import { IEmbedder } from "../../services/code-index/interfaces/embedder"
import { VectorStoreSearchResult } from "../../services/code-index/interfaces/vector-store"

/**
 * 代码块关联信息
 */
export interface CodeChunkAssociation {
	/** 文件路径 */
	filePath: string
	/** 代码内容 */
	codeChunk: string
	/** 起始行 */
	startLine: number
	/** 结束行 */
	endLine: number
	/** 与记忆的相关性分数 */
	relevanceScore: number
}

/**
 * 增强的记忆条目（包含代码关联）
 */
export interface EnhancedMemoryEntry extends MemoryEntry {
	/** 关联的代码块 */
	associatedCode?: CodeChunkAssociation[]
}

/**
 * 记忆推荐结果
 */
export interface MemoryRecommendation {
	/** 推荐的记忆 */
	memory: MemoryEntry
	/** 推荐分数 */
	score: number
	/** 推荐原因 */
	reason: string
	/** 相关代码块 */
	relatedCode?: CodeChunkAssociation[]
}

/**
 * 记忆增强服务
 * 提供高级功能：记忆与代码块关联、智能推荐等
 */
export class MemoryEnhancementService {
	constructor(
		private vectorMemoryStore: VectorMemoryStore,
		private codeIndexVectorStore: any, // 代码索引的向量存储
		private embedder: IEmbedder,
	) {}

	/**
	 * 为记忆关联相关代码块
	 * @param memory 记忆条目
	 * @param maxCodeBlocks 最大关联代码块数量
	 * @returns 增强的记忆条目
	 */
	async associateCodeWithMemory(memory: MemoryEntry, maxCodeBlocks: number = 3): Promise<EnhancedMemoryEntry> {
		// 如果记忆已经包含文件路径，优先在这些文件中搜索
		let codeSearchResults: VectorStoreSearchResult[] = []

		if (memory.relatedFiles && memory.relatedFiles.length > 0) {
			// 为每个文件执行语义搜索
			for (const filePath of memory.relatedFiles.slice(0, 3)) {
				// 限制搜索文件数
				try {
					const embeddingResponse = await this.embedder.createEmbeddings([memory.content])
					const queryVector = embeddingResponse.embeddings[0]

					const results = await this.codeIndexVectorStore.search(
						queryVector,
						filePath, // 使用文件路径作为过滤
						0.6, // 较低的阈值以获取更多结果
						5, // 每个文件最多5个结果
					)

					codeSearchResults.push(...results)
				} catch (error) {
					console.warn(`Failed to search code for file ${filePath}:`, error)
				}
			}
		} else {
			// 全局搜索相关代码
			try {
				const embeddingResponse = await this.embedder.createEmbeddings([memory.content])
				const queryVector = embeddingResponse.embeddings[0]

				codeSearchResults = await this.codeIndexVectorStore.search(
					queryVector,
					undefined, // 不限制目录
					0.65, // 中等阈值
					maxCodeBlocks * 2, // 获取更多结果以便筛选
				)
			} catch (error) {
				console.warn("Failed to search code for memory:", error)
			}
		}

		// 转换为代码块关联
		const associations: CodeChunkAssociation[] = codeSearchResults
			.slice(0, maxCodeBlocks)
			.map((result) => ({
				filePath: result.payload?.filePath || "",
				codeChunk: result.payload?.codeChunk || "",
				startLine: result.payload?.startLine || 0,
				endLine: result.payload?.endLine || 0,
				relevanceScore: result.score,
			}))
			.filter((assoc) => assoc.filePath) // 过滤无效结果

		return {
			...memory,
			associatedCode: associations,
		}
	}

	/**
	 * 智能推荐相关记忆
	 * 基于当前上下文、代码和历史行为
	 * @param context 当前上下文（用户输入或代码）
	 * @param options 推荐选项
	 * @returns 推荐的记忆列表
	 */
	async recommendMemories(
		context: string,
		options?: {
			/** 当前文件路径 */
			currentFile?: string
			/** 当前技术栈 */
			currentTech?: string[]
			/** 最大推荐数 */
			maxRecommendations?: number
			/** 是否包含代码关联 */
			includeCodeAssociations?: boolean
		},
	): Promise<MemoryRecommendation[]> {
		const maxRecommendations = options?.maxRecommendations ?? 5

		// 1. 基于语义相似度搜索
		const semanticResults: MemorySearchResult[] = await this.vectorMemoryStore.searchProjectMemories(context, {
			minScore: 0.7,
			maxResults: maxRecommendations * 2, // 获取更多候选
		})

		// 2. 计算推荐分数（综合多个因素）
		const recommendations: MemoryRecommendation[] = []

		for (const result of semanticResults) {
			let score = result.score
			let reason = "语义相关"

			// 文件路径匹配加分
			if (options?.currentFile && result.memory.relatedFiles?.includes(options.currentFile)) {
				score += 0.15
				reason += "，相同文件"
			}

			// 技术栈匹配加分
			if (options?.currentTech && result.memory.relatedTech) {
				const techOverlap = options.currentTech.filter((tech) =>
					result.memory.relatedTech?.includes(tech),
				).length
				if (techOverlap > 0) {
					score += 0.1 * techOverlap
					reason += "，相关技术栈"
				}
			}

			// 优先级加分
			if (result.memory.priority === MemoryPriority.CRITICAL) {
				score += 0.2
				reason += "，关键记忆"
			} else if (result.memory.priority === MemoryPriority.HIGH) {
				score += 0.1
			}

			// 访问频率加分
			if (result.memory.accessCount > 5) {
				score += 0.05
				reason += "，高频使用"
			}

			// 获取关联代码（如果需要）
			let relatedCode: CodeChunkAssociation[] | undefined
			if (options?.includeCodeAssociations) {
				try {
					const enhanced = await this.associateCodeWithMemory(result.memory, 2)
					relatedCode = enhanced.associatedCode
				} catch (error) {
					console.warn("Failed to associate code:", error)
				}
			}

			recommendations.push({
				memory: result.memory,
				score,
				reason,
				relatedCode,
			})
		}

		// 3. 按分数排序并返回前N个
		recommendations.sort((a, b) => b.score - a.score)
		return recommendations.slice(0, maxRecommendations)
	}

	/**
	 * 构建项目知识图谱
	 * 分析记忆之间的关联关系
	 */
	async buildKnowledgeGraph(): Promise<KnowledgeGraph> {
		// 获取所有项目记忆
		const allMemories: MemorySearchResult[] = await this.vectorMemoryStore.searchProjectMemories("", {
			minScore: 0, // 获取所有记忆
			maxResults: 1000,
		})

		const nodes: KnowledgeNode[] = []
		const edges: KnowledgeEdge[] = []

		// 创建节点
		const nodeMap = new Map<string, KnowledgeNode>()
		for (const result of allMemories) {
			const node: KnowledgeNode = {
				id: result.memory.id,
				type: result.memory.type,
				priority: result.memory.priority,
				content: result.memory.content.slice(0, 100), // 限制长度
				relatedFiles: result.memory.relatedFiles || [],
				relatedTech: result.memory.relatedTech || [],
				accessCount: result.memory.accessCount,
			}
			nodes.push(node)
			nodeMap.set(node.id, node)
		}

		// 分析记忆之间的关联（基于共享文件、技术栈等）
		for (let i = 0; i < nodes.length; i++) {
			for (let j = i + 1; j < nodes.length; j++) {
				const nodeA = nodes[i]
				const nodeB = nodes[j]

				let relationshipStrength = 0
				const relationshipTypes: string[] = []

				// 共享文件
				const sharedFiles = nodeA.relatedFiles.filter((file) => nodeB.relatedFiles.includes(file))
				if (sharedFiles.length > 0) {
					relationshipStrength += 0.3 * sharedFiles.length
					relationshipTypes.push("shared_file")
				}

				// 共享技术栈
				const sharedTech = nodeA.relatedTech.filter((tech) => nodeB.relatedTech.includes(tech))
				if (sharedTech.length > 0) {
					relationshipStrength += 0.2 * sharedTech.length
					relationshipTypes.push("shared_tech")
				}

				// 相同类型
				if (nodeA.type === nodeB.type) {
					relationshipStrength += 0.1
					relationshipTypes.push("same_type")
				}

				// 如果有关联，创建边
				if (relationshipStrength > 0.2) {
					edges.push({
						source: nodeA.id,
						target: nodeB.id,
						strength: relationshipStrength,
						types: relationshipTypes,
					})
				}
			}
		}

		return {
			nodes,
			edges,
			metadata: {
				totalNodes: nodes.length,
				totalEdges: edges.length,
				createdAt: Date.now(),
			},
		}
	}

	/**
	 * 查找记忆聚类
	 * 识别相关记忆的集合
	 */
	async findMemoryClusters(minClusterSize: number = 3): Promise<MemoryCluster[]> {
		const graph = await this.buildKnowledgeGraph()
		const clusters: MemoryCluster[] = []

		// 简单的连通分量算法
		const visited = new Set<string>()
		const adjacencyMap = new Map<string, Set<string>>()

		// 构建邻接表
		for (const edge of graph.edges) {
			if (!adjacencyMap.has(edge.source)) {
				adjacencyMap.set(edge.source, new Set())
			}
			if (!adjacencyMap.has(edge.target)) {
				adjacencyMap.set(edge.target, new Set())
			}
			adjacencyMap.get(edge.source)!.add(edge.target)
			adjacencyMap.get(edge.target)!.add(edge.source)
		}

		// DFS查找连通分量
		const dfs = (nodeId: string, cluster: Set<string>) => {
			visited.add(nodeId)
			cluster.add(nodeId)

			const neighbors = adjacencyMap.get(nodeId)
			if (neighbors) {
				for (const neighbor of neighbors) {
					if (!visited.has(neighbor)) {
						dfs(neighbor, cluster)
					}
				}
			}
		}

		// 找出所有聚类
		for (const node of graph.nodes) {
			if (!visited.has(node.id)) {
				const clusterNodes = new Set<string>()
				dfs(node.id, clusterNodes)

				if (clusterNodes.size >= minClusterSize) {
					const clusterMemories = Array.from(clusterNodes)
						.map((id) => graph.nodes.find((n) => n.id === id)!)
						.filter(Boolean)

					// 计算聚类主题（最常见的技术栈和类型）
					const techCount = new Map<string, number>()
					const typeCount = new Map<MemoryType, number>()

					for (const node of clusterMemories) {
						for (const tech of node.relatedTech) {
							techCount.set(tech, (techCount.get(tech) || 0) + 1)
						}
						typeCount.set(node.type, (typeCount.get(node.type) || 0) + 1)
					}

					const dominantTech = Array.from(techCount.entries())
						.sort((a, b) => b[1] - a[1])
						.slice(0, 3)
						.map((e) => e[0])

					const dominantType = Array.from(typeCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0]

					clusters.push({
						id: `cluster-${clusters.length}`,
						nodes: clusterMemories,
						size: clusterMemories.length,
						dominantTech,
						dominantType,
					})
				}
			}
		}

		return clusters
	}
}

/**
 * 知识图谱节点
 */
export interface KnowledgeNode {
	id: string
	type: MemoryType
	priority: MemoryPriority
	content: string
	relatedFiles: string[]
	relatedTech: string[]
	accessCount: number
}

/**
 * 知识图谱边
 */
export interface KnowledgeEdge {
	source: string
	target: string
	strength: number
	types: string[]
}

/**
 * 知识图谱
 */
export interface KnowledgeGraph {
	nodes: KnowledgeNode[]
	edges: KnowledgeEdge[]
	metadata: {
		totalNodes: number
		totalEdges: number
		createdAt: number
	}
}

/**
 * 记忆聚类
 */
export interface MemoryCluster {
	id: string
	nodes: KnowledgeNode[]
	size: number
	dominantTech: string[]
	dominantType?: MemoryType
}
