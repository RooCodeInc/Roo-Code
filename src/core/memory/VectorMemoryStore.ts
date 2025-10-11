import { IEmbedder, EmbeddingResponse } from "../../services/code-index/interfaces/embedder"
import { IVectorStore, PointStruct, VectorStoreSearchResult } from "../../services/code-index/interfaces/vector-store"
import { QdrantVectorStore } from "../../services/code-index/vector-store/qdrant-client"
import { MemoryEntry, MemoryPriority, MemoryType } from "./ConversationMemory"
import { createHash } from "crypto"

/**
 * 向量化记忆的Payload结构
 */
export interface VectorMemoryPayload {
	/** 记忆ID */
	memoryId: string
	/** 记忆类型 */
	type: MemoryType
	/** 优先级 */
	priority: MemoryPriority
	/** 记忆内容 */
	content: string
	/** 创建时间戳 */
	createdAt: number
	/** 最后访问时间 */
	lastAccessedAt: number
	/** 访问次数 */
	accessCount: number
	/** 项目ID（用于跨对话检索） */
	projectId?: string
	/** 任务ID（用于单对话检索） */
	taskId?: string
	/** 关联文件路径 */
	relatedFiles?: string[]
	/** 相关技术栈 */
	relatedTech?: string[]
	/** 标签 */
	tags?: string[]
}

/**
 * 记忆搜索结果
 */
export interface MemorySearchResult {
	/** 记忆条目 */
	memory: MemoryEntry
	/** 相似度分数 */
	score: number
}

/**
 * VectorMemoryStore配置
 */
export interface VectorMemoryStoreConfig {
	/** Qdrant服务器URL */
	qdrantUrl: string
	/** Qdrant API Key（可选） */
	qdrantApiKey?: string
	/** 向量维度（由embedder决定） */
	vectorSize: number
	/** 工作空间路径 */
	workspacePath: string
	/** 项目ID（用于跨对话记忆） */
	projectId?: string
}

/**
 * 向量化记忆存储
 * 使用Qdrant向量数据库和Embedder服务实现语义搜索
 */
export class VectorMemoryStore {
	private vectorStore: IVectorStore
	private embedder: IEmbedder
	private collectionName: string = "roo-memories"
	private projectId?: string

	/**
	 * 创建VectorMemoryStore实例
	 * @param embedder 嵌入模型服务（复用代码索引的Embedder）
	 * @param config 配置选项
	 */
	constructor(embedder: IEmbedder, config: VectorMemoryStoreConfig) {
		this.embedder = embedder
		this.projectId = config.projectId

		// 为记忆创建独立的Qdrant collection
		// 使用项目级别的collection名称以支持跨对话记忆
		if (config.projectId) {
			const hash = createHash("sha256").update(config.projectId).digest("hex")
			this.collectionName = `roo-memories-${hash.substring(0, 16)}`
		}

		// 使用QdrantVectorStore，但指向独立的collection
		this.vectorStore = new QdrantVectorStore(
			config.workspacePath,
			config.qdrantUrl,
			config.vectorSize,
			config.qdrantApiKey,
		)
	}

	/**
	 * 初始化向量存储
	 */
	async initialize(): Promise<void> {
		await this.vectorStore.initialize()
	}

	/**
	 * 存储记忆到向量数据库
	 * @param memories 要存储的记忆条目数组
	 * @param taskId 当前任务ID
	 */
	async storeMemories(memories: MemoryEntry[], taskId?: string): Promise<void> {
		if (memories.length === 0) {
			return
		}

		// 1. 提取记忆内容用于嵌入
		const texts = memories.map((m) => this.prepareMemoryTextForEmbedding(m))

		// 2. 创建嵌入向量
		const embeddingResponse: EmbeddingResponse = await this.embedder.createEmbeddings(texts)

		// 3. 构建向量点
		const points: PointStruct[] = memories.map((memory, index) => {
			const payload: VectorMemoryPayload = {
				memoryId: memory.id,
				type: memory.type,
				priority: memory.priority,
				content: memory.content,
				createdAt: memory.createdAt,
				lastAccessedAt: memory.lastAccessedAt,
				accessCount: memory.accessCount,
				projectId: this.projectId,
				taskId: taskId,
				relatedFiles: memory.relatedFiles,
				relatedTech: memory.relatedTech,
				tags: memory.tags,
			}

			return {
				id: memory.id,
				vector: embeddingResponse.embeddings[index],
				payload: payload as Record<string, any>,
			}
		})

		// 4. 存储到向量数据库
		await this.vectorStore.upsertPoints(points)
	}

	/**
	 * 准备记忆文本用于嵌入
	 * 组合多个字段以提高语义搜索质量
	 */
	private prepareMemoryTextForEmbedding(memory: MemoryEntry): string {
		const parts: string[] = [memory.content]

		// 添加类型和优先级作为上下文
		parts.push(`[Type: ${memory.type}]`)
		parts.push(`[Priority: ${memory.priority}]`)

		// 添加关联技术栈
		if (memory.relatedTech && memory.relatedTech.length > 0) {
			parts.push(`[Tech: ${memory.relatedTech.join(", ")}]`)
		}

		// 添加标签
		if (memory.tags && memory.tags.length > 0) {
			parts.push(`[Tags: ${memory.tags.join(", ")}]`)
		}

		return parts.join(" ")
	}

	/**
	 * 语义搜索相关记忆
	 * @param query 查询文本（用户当前任务或上下文）
	 * @param options 搜索选项
	 * @returns 相关记忆列表
	 */
	async searchRelevantMemories(
		query: string,
		options?: {
			/** 最小相似度分数 (0-1) */
			minScore?: number
			/** 最大返回结果数 */
			maxResults?: number
			/** 按任务ID过滤 */
			taskId?: string
			/** 按记忆类型过滤 */
			types?: MemoryType[]
			/** 按优先级过滤 */
			priorities?: MemoryPriority[]
		},
	): Promise<MemorySearchResult[]> {
		// 1. 为查询创建嵌入向量
		const embeddingResponse = await this.embedder.createEmbeddings([query])
		const queryVector = embeddingResponse.embeddings[0]

		// 2. 执行向量搜索
		const searchResults: VectorStoreSearchResult[] = await this.vectorStore.search(
			queryVector,
			undefined, // 不使用目录前缀过滤
			options?.minScore ?? 0.7, // 默认最小分数
			options?.maxResults ?? 10, // 默认返回10条
		)

		// 3. 转换结果并应用过滤
		const memoryResults: MemorySearchResult[] = []

		for (const result of searchResults) {
			const payload = result.payload as unknown as VectorMemoryPayload
			if (!payload) continue

			// 应用任务ID过滤
			if (options?.taskId && payload.taskId !== options.taskId) {
				continue
			}

			// 应用类型过滤
			if (options?.types && !options.types.includes(payload.type)) {
				continue
			}

			// 应用优先级过滤
			if (options?.priorities && !options.priorities.includes(payload.priority)) {
				continue
			}

			// 转换为MemoryEntry
			const memory: MemoryEntry = {
				id: payload.memoryId,
				type: payload.type,
				priority: payload.priority,
				content: payload.content,
				createdAt: payload.createdAt,
				lastAccessedAt: payload.lastAccessedAt,
				accessCount: payload.accessCount,
				relatedFiles: payload.relatedFiles,
				relatedTech: payload.relatedTech,
				tags: payload.tags,
			}

			memoryResults.push({
				memory,
				score: result.score,
			})
		}

		return memoryResults
	}

	/**
	 * 搜索跨对话的项目级记忆
	 * @param query 查询文本
	 * @param options 搜索选项
	 * @returns 相关记忆列表
	 */
	async searchProjectMemories(
		query: string,
		options?: {
			minScore?: number
			maxResults?: number
			types?: MemoryType[]
			priorities?: MemoryPriority[]
		},
	): Promise<MemorySearchResult[]> {
		// 项目级记忆搜索不限制taskId
		return this.searchRelevantMemories(query, {
			...options,
			taskId: undefined, // 不按任务过滤
		})
	}

	/**
	 * 根据记忆ID删除记忆
	 * @param memoryIds 要删除的记忆ID列表
	 */
	async deleteMemories(memoryIds: string[]): Promise<void> {
		if (memoryIds.length === 0) {
			return
		}

		try {
			// 使用Qdrant的client delete API按ID删除点
			const client = (this.vectorStore as any).client
			if (!client) {
				throw new Error("Qdrant client not available")
			}

			await client.delete(this.collectionName, {
				points: memoryIds,
				wait: true,
			})
		} catch (error) {
			console.error("[VectorMemoryStore] Failed to delete memories:", error)
			throw error
		}
	}

	/**
	 * 清除特定任务的所有记忆
	 * @param taskId 任务ID
	 */
	async clearTaskMemories(taskId: string): Promise<void> {
		try {
			// 使用Qdrant的filter删除特定任务的所有记忆
			const client = (this.vectorStore as any).client
			if (!client) {
				throw new Error("Qdrant client not available")
			}

			await client.delete(this.collectionName, {
				filter: {
					must: [
						{
							key: "taskId",
							match: { value: taskId },
						},
					],
				},
				wait: true,
			})
		} catch (error) {
			console.error("[VectorMemoryStore] Failed to clear task memories:", error)
			throw error
		}
	}

	/**
	 * 清除所有记忆
	 */
	async clearAllMemories(): Promise<void> {
		await this.vectorStore.clearCollection()
	}

	/**
	 * 更新记忆的访问信息
	 * @param memoryId 记忆ID
	 */
	async updateMemoryAccess(memoryId: string): Promise<void> {
		try {
			// 使用Qdrant的setPayload API更新特定点的payload
			const client = (this.vectorStore as any).client
			if (!client) {
				throw new Error("Qdrant client not available")
			}

			const now = Date.now()

			// 先获取现有的点以获取当前accessCount
			const points = await client.retrieve(this.collectionName, {
				ids: [memoryId],
				with_payload: true,
			})

			if (points.length === 0) {
				console.warn(`[VectorMemoryStore] Memory ${memoryId} not found for access update`)
				return
			}

			const currentPayload = points[0].payload as VectorMemoryPayload
			const newAccessCount = (currentPayload.accessCount || 0) + 1

			// 更新payload
			await client.setPayload(this.collectionName, {
				points: [memoryId],
				payload: {
					lastAccessedAt: now,
					accessCount: newAccessCount,
				},
				wait: true,
			})
		} catch (error) {
			console.error("[VectorMemoryStore] Failed to update memory access:", error)
			// 不抛出错误，因为这不是关键操作
		}
	}

	/**
	 * 获取记忆统计信息
	 */
	async getMemoryStats(): Promise<{
		totalMemories: number
		byType: Record<MemoryType, number>
		byPriority: Record<MemoryPriority, number>
	}> {
		try {
			const client = (this.vectorStore as any).client
			if (!client) {
				throw new Error("Qdrant client not available")
			}

			// 初始化统计对象
			const stats = {
				totalMemories: 0,
				byType: {
					[MemoryType.USER_INSTRUCTION]: 0,
					[MemoryType.TECHNICAL_DECISION]: 0,
					[MemoryType.CONFIGURATION]: 0,
					[MemoryType.IMPORTANT_ERROR]: 0,
					[MemoryType.PROJECT_CONTEXT]: 0,
					[MemoryType.WORKFLOW_PATTERN]: 0,
				} as Record<MemoryType, number>,
				byPriority: {
					[MemoryPriority.CRITICAL]: 0,
					[MemoryPriority.HIGH]: 0,
					[MemoryPriority.MEDIUM]: 0,
					[MemoryPriority.LOW]: 0,
				} as Record<MemoryPriority, number>,
			}

			// 使用scroll API获取所有记忆点（仅获取payload，不获取向量）
			const scrollResult = await client.scroll(this.collectionName, {
				limit: 1000, // 每批次最多1000个
				with_payload: true,
				with_vector: false, // 不需要向量数据
			})

			if (!scrollResult || !scrollResult.points) {
				return stats
			}

			// 统计第一批
			for (const point of scrollResult.points) {
				const payload = point.payload as unknown as VectorMemoryPayload
				if (payload) {
					stats.totalMemories++
					if (payload.type) {
						stats.byType[payload.type] = (stats.byType[payload.type] || 0) + 1
					}
					if (payload.priority) {
						stats.byPriority[payload.priority] = (stats.byPriority[payload.priority] || 0) + 1
					}
				}
			}

			// 如果有更多数据，继续滚动获取
			let nextPageOffset = scrollResult.next_page_offset
			while (nextPageOffset) {
				const nextScroll = await client.scroll(this.collectionName, {
					offset: nextPageOffset,
					limit: 1000,
					with_payload: true,
					with_vector: false,
				})

				if (!nextScroll || !nextScroll.points) {
					break
				}

				for (const point of nextScroll.points) {
					const payload = point.payload as unknown as VectorMemoryPayload
					if (payload) {
						stats.totalMemories++
						if (payload.type) {
							stats.byType[payload.type] = (stats.byType[payload.type] || 0) + 1
						}
						if (payload.priority) {
							stats.byPriority[payload.priority] = (stats.byPriority[payload.priority] || 0) + 1
						}
					}
				}

				nextPageOffset = nextScroll.next_page_offset
			}

			return stats
		} catch (error) {
			console.error("[VectorMemoryStore] Failed to get memory stats:", error)
			// 返回空统计而不是抛出错误
			return {
				totalMemories: 0,
				byType: {
					[MemoryType.USER_INSTRUCTION]: 0,
					[MemoryType.TECHNICAL_DECISION]: 0,
					[MemoryType.CONFIGURATION]: 0,
					[MemoryType.IMPORTANT_ERROR]: 0,
					[MemoryType.PROJECT_CONTEXT]: 0,
					[MemoryType.WORKFLOW_PATTERN]: 0,
				},
				byPriority: {
					[MemoryPriority.CRITICAL]: 0,
					[MemoryPriority.HIGH]: 0,
					[MemoryPriority.MEDIUM]: 0,
					[MemoryPriority.LOW]: 0,
				},
			}
		}
	}
}
