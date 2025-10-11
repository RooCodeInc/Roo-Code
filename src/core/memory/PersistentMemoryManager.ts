import * as path from "path"
import * as fs from "fs/promises"
import { ConversationMemory, MemoryEntry, MemoryType, MemoryPriority } from "./ConversationMemory"
import { VectorMemoryStore, VectorMemoryStoreConfig } from "./VectorMemoryStore"
import { IEmbedder } from "../../services/code-index/interfaces/embedder"
import { safeWriteJson } from "../../utils/safeWriteJson"

/**
 * 项目记忆元数据
 */
export interface ProjectMemoryMetadata {
	/** 项目ID */
	projectId: string
	/** 项目路径 */
	projectPath: string
	/** 创建时间 */
	createdAt: number
	/** 最后更新时间 */
	lastUpdatedAt: number
	/** 总记忆数 */
	totalMemories: number
	/** 活跃对话数 */
	activeConversations: number
}

/**
 * 对话记忆快照（用于持久化）
 */
export interface ConversationMemorySnapshot {
	/** 任务ID */
	taskId: string
	/** 记忆数据（序列化） */
	memoryData: string
	/** 创建时间 */
	createdAt: number
	/** 最后访问时间 */
	lastAccessedAt: number
}

/**
 * 持久化记忆管理器
 * 负责项目级别的记忆持久化和跨对话管理
 */
export class PersistentMemoryManager {
	private projectId: string
	private projectPath: string
	private storageDir: string
	private vectorMemoryStore?: VectorMemoryStore
	private metadata?: ProjectMemoryMetadata
	private conversationSnapshots: Map<string, ConversationMemorySnapshot> = new Map()

	/**
	 * 创建持久化记忆管理器
	 * @param projectPath 项目根路径
	 * @param embedder 可选的Embedder实例（用于向量记忆）
	 * @param vectorStoreConfig 可选的向量存储配置
	 */
	constructor(
		projectPath: string,
		private embedder?: IEmbedder,
		private vectorStoreConfig?: Omit<VectorMemoryStoreConfig, "projectId">,
	) {
		this.projectPath = projectPath
		this.projectId = this.generateProjectId(projectPath)
		this.storageDir = path.join(projectPath, ".roo", "memories")
	}

	/**
	 * 从项目路径生成唯一的项目ID
	 */
	private generateProjectId(projectPath: string): string {
		// 使用路径的最后两个部分作为可读ID
		const pathParts = projectPath.split(path.sep).filter(Boolean)
		const readablePart = pathParts
			.slice(-2)
			.join("-")
			.toLowerCase()
			.replace(/[^a-z0-9-]/g, "")
		return readablePart || "default-project"
	}

	/**
	 * 初始化持久化存储
	 */
	async initialize(): Promise<void> {
		// 创建存储目录
		await fs.mkdir(this.storageDir, { recursive: true })

		// 加载或创建元数据
		await this.loadMetadata()

		// 初始化向量记忆存储（如果配置了）
		if (this.embedder && this.vectorStoreConfig) {
			const config: VectorMemoryStoreConfig = {
				...this.vectorStoreConfig,
				projectId: this.projectId,
			}
			this.vectorMemoryStore = new VectorMemoryStore(this.embedder, config)
			await this.vectorMemoryStore.initialize()
		}

		// 加载现有的对话快照索引
		await this.loadConversationSnapshots()
	}

	/**
	 * 加载项目元数据
	 */
	private async loadMetadata(): Promise<void> {
		const metadataPath = path.join(this.storageDir, "metadata.json")
		try {
			const data = await fs.readFile(metadataPath, "utf-8")
			this.metadata = JSON.parse(data)
		} catch (error) {
			// 元数据不存在，创建新的
			this.metadata = {
				projectId: this.projectId,
				projectPath: this.projectPath,
				createdAt: Date.now(),
				lastUpdatedAt: Date.now(),
				totalMemories: 0,
				activeConversations: 0,
			}
			await this.saveMetadata()
		}
	}

	/**
	 * 保存项目元数据
	 */
	private async saveMetadata(): Promise<void> {
		if (!this.metadata) return

		const metadataPath = path.join(this.storageDir, "metadata.json")
		this.metadata.lastUpdatedAt = Date.now()
		await safeWriteJson(metadataPath, this.metadata)
	}

	/**
	 * 加载对话快照索引
	 */
	private async loadConversationSnapshots(): Promise<void> {
		const snapshotsPath = path.join(this.storageDir, "conversations.json")
		try {
			const data = await fs.readFile(snapshotsPath, "utf-8")
			const snapshots: ConversationMemorySnapshot[] = JSON.parse(data)
			for (const snapshot of snapshots) {
				this.conversationSnapshots.set(snapshot.taskId, snapshot)
			}
		} catch (error) {
			// 快照索引不存在，初始化为空
			this.conversationSnapshots = new Map()
		}
	}

	/**
	 * 保存对话快照索引
	 */
	private async saveConversationSnapshots(): Promise<void> {
		const snapshotsPath = path.join(this.storageDir, "conversations.json")
		const snapshots = Array.from(this.conversationSnapshots.values())
		await safeWriteJson(snapshotsPath, snapshots)
	}

	/**
	 * 保存对话记忆
	 * @param taskId 任务ID
	 * @param conversationMemory 对话记忆实例
	 */
	async saveConversationMemory(taskId: string, conversationMemory: ConversationMemory): Promise<void> {
		const memoryData = conversationMemory.serialize()
		const memories = conversationMemory.getAllMemories()

		// 保存到本地快照
		const snapshot: ConversationMemorySnapshot = {
			taskId,
			memoryData,
			createdAt: this.conversationSnapshots.get(taskId)?.createdAt || Date.now(),
			lastAccessedAt: Date.now(),
		}
		this.conversationSnapshots.set(taskId, snapshot)
		await this.saveConversationSnapshots()

		// 如果配置了向量存储，同步到向量数据库
		if (this.vectorMemoryStore && memories.length > 0) {
			await this.vectorMemoryStore.storeMemories(memories, taskId)
		}

		// 更新元数据
		if (this.metadata) {
			this.metadata.totalMemories = Array.from(this.conversationSnapshots.values()).reduce((sum, snap) => {
				try {
					const parsed = JSON.parse(snap.memoryData)
					return sum + (parsed.memories?.length || 0)
				} catch {
					return sum
				}
			}, 0)
			this.metadata.activeConversations = this.conversationSnapshots.size
			await this.saveMetadata()
		}
	}

	/**
	 * 加载对话记忆
	 * @param taskId 任务ID
	 * @returns 恢复的对话记忆实例，如果不存在则返回null
	 */
	async loadConversationMemory(taskId: string): Promise<ConversationMemory | null> {
		const snapshot = this.conversationSnapshots.get(taskId)
		if (!snapshot) {
			return null
		}

		try {
			const memory = ConversationMemory.deserialize(snapshot.memoryData)
			// 更新访问时间
			snapshot.lastAccessedAt = Date.now()
			await this.saveConversationSnapshots()
			return memory
		} catch (error) {
			console.error(`Failed to deserialize conversation memory for task ${taskId}:`, error)
			return null
		}
	}

	/**
	 * 删除对话记忆
	 * @param taskId 任务ID
	 */
	async deleteConversationMemory(taskId: string): Promise<void> {
		this.conversationSnapshots.delete(taskId)
		await this.saveConversationSnapshots()

		// 从向量存储中删除（如果支持）
		if (this.vectorMemoryStore) {
			try {
				await this.vectorMemoryStore.clearTaskMemories(taskId)
			} catch (error) {
				console.warn(`Failed to clear task memories from vector store: ${error}`)
			}
		}

		// 更新元数据
		if (this.metadata) {
			this.metadata.activeConversations = this.conversationSnapshots.size
			await this.saveMetadata()
		}
	}

	/**
	 * 获取所有对话记忆的摘要
	 */
	async getAllConversationSummaries(): Promise<
		Array<{
			taskId: string
			createdAt: number
			lastAccessedAt: number
			memoryCount: number
		}>
	> {
		const summaries = []
		for (const [taskId, snapshot] of this.conversationSnapshots.entries()) {
			try {
				const parsed = JSON.parse(snapshot.memoryData)
				summaries.push({
					taskId,
					createdAt: snapshot.createdAt,
					lastAccessedAt: snapshot.lastAccessedAt,
					memoryCount: parsed.memories?.length || 0,
				})
			} catch (error) {
				console.warn(`Failed to parse snapshot for task ${taskId}`)
			}
		}
		return summaries
	}

	/**
	 * 清理旧的对话记忆
	 * @param maxAge 最大保留时间（毫秒）
	 */
	async pruneOldConversations(maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<number> {
		const now = Date.now()
		let prunedCount = 0

		for (const [taskId, snapshot] of this.conversationSnapshots.entries()) {
			if (now - snapshot.lastAccessedAt > maxAge) {
				await this.deleteConversationMemory(taskId)
				prunedCount++
			}
		}

		return prunedCount
	}

	/**
	 * 获取向量记忆存储实例
	 */
	getVectorMemoryStore(): VectorMemoryStore | undefined {
		return this.vectorMemoryStore
	}

	/**
	 * 获取项目元数据
	 */
	getMetadata(): ProjectMemoryMetadata | undefined {
		return this.metadata
	}

	/**
	 * 导出所有记忆为JSON
	 */
	async exportMemories(): Promise<{
		metadata: ProjectMemoryMetadata
		conversations: ConversationMemorySnapshot[]
	}> {
		return {
			metadata: this.metadata!,
			conversations: Array.from(this.conversationSnapshots.values()),
		}
	}

	/**
	 * 从JSON导入记忆
	 */
	async importMemories(data: {
		metadata: ProjectMemoryMetadata
		conversations: ConversationMemorySnapshot[]
	}): Promise<void> {
		this.metadata = data.metadata
		await this.saveMetadata()

		this.conversationSnapshots.clear()
		for (const snapshot of data.conversations) {
			this.conversationSnapshots.set(snapshot.taskId, snapshot)
		}
		await this.saveConversationSnapshots()
	}
}
