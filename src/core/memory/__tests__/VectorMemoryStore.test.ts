import { describe, it, expect, beforeEach, vi } from "vitest"
import { VectorMemoryStore, VectorMemoryStoreConfig } from "../VectorMemoryStore"
import { MemoryEntry, MemoryType, MemoryPriority } from "../ConversationMemory"
import { IEmbedder, EmbeddingResponse } from "../../../services/code-index/interfaces/embedder"
import {
	IVectorStore,
	PointStruct,
	VectorStoreSearchResult,
} from "../../../services/code-index/interfaces/vector-store"

// Mock Embedder
class MockEmbedder implements IEmbedder {
	async createEmbeddings(texts: string[]): Promise<EmbeddingResponse> {
		// 返回简单的模拟向量（每个文本对应一个固定长度的向量）
		return {
			embeddings: texts.map(() => Array(128).fill(0.5)),
			usage: {
				promptTokens: texts.length * 10,
				totalTokens: texts.length * 10,
			},
		}
	}

	async validateConfiguration(): Promise<{ valid: boolean; error?: string }> {
		return { valid: true }
	}

	get embedderInfo() {
		return { name: "openai" as const }
	}
}

// Mock VectorStore
class MockVectorStore implements IVectorStore {
	private points: Map<string, PointStruct> = new Map()

	async initialize(): Promise<boolean> {
		return true
	}

	async upsertPoints(points: PointStruct[]): Promise<void> {
		for (const point of points) {
			this.points.set(point.id, point)
		}
	}

	async search(
		queryVector: number[],
		directoryPrefix?: string,
		minScore?: number,
		maxResults?: number,
	): Promise<VectorStoreSearchResult[]> {
		// 简单的模拟搜索：返回所有点并计算余弦相似度
		const results: VectorStoreSearchResult[] = []

		for (const [id, point] of this.points.entries()) {
			// 计算简单的余弦相似度
			const score = this.cosineSimilarity(queryVector, point.vector)

			if (score >= (minScore ?? 0)) {
				results.push({
					id,
					score,
					payload: point.payload as any,
				})
			}
		}

		// 按分数排序
		results.sort((a, b) => b.score - a.score)

		// 限制结果数量
		return results.slice(0, maxResults ?? 10)
	}

	private cosineSimilarity(a: number[], b: number[]): number {
		let dotProduct = 0
		let normA = 0
		let normB = 0

		for (let i = 0; i < a.length; i++) {
			dotProduct += a[i] * b[i]
			normA += a[i] * a[i]
			normB += b[i] * b[i]
		}

		return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
	}

	async deletePointsByFilePath(filePath: string): Promise<void> {
		// Not implemented for mock
	}

	async deletePointsByMultipleFilePaths(filePaths: string[]): Promise<void> {
		// Not implemented for mock
	}

	async clearCollection(): Promise<void> {
		this.points.clear()
	}

	async deleteCollection(): Promise<void> {
		this.points.clear()
	}

	async collectionExists(): Promise<boolean> {
		return true
	}
}

describe("VectorMemoryStore", () => {
	let vectorMemoryStore: VectorMemoryStore
	let mockEmbedder: MockEmbedder
	let mockVectorStore: MockVectorStore

	beforeEach(() => {
		mockEmbedder = new MockEmbedder()
		mockVectorStore = new MockVectorStore()

		const config: VectorMemoryStoreConfig = {
			qdrantUrl: "http://localhost:6333",
			vectorSize: 128,
			workspacePath: "/test/workspace",
			projectId: "test-project",
		}

		vectorMemoryStore = new VectorMemoryStore(mockEmbedder, config)

		// 替换内部的vectorStore为mock
		;(vectorMemoryStore as any).vectorStore = mockVectorStore
	})

	describe("initialize", () => {
		it("应该成功初始化向量存储", async () => {
			await expect(vectorMemoryStore.initialize()).resolves.toBeUndefined()
		})
	})

	describe("storeMemories", () => {
		it("应该成功存储记忆到向量数据库", async () => {
			const memories: MemoryEntry[] = [
				{
					id: "mem-1",
					type: MemoryType.USER_INSTRUCTION,
					priority: MemoryPriority.CRITICAL,
					content: "使用 PostgreSQL 作为数据库",
					createdAt: Date.now(),
					lastAccessedAt: Date.now(),
					accessCount: 0,
					relatedTech: ["postgresql"],
				},
				{
					id: "mem-2",
					type: MemoryType.TECHNICAL_DECISION,
					priority: MemoryPriority.HIGH,
					content: "端口设置为 3001",
					createdAt: Date.now(),
					lastAccessedAt: Date.now(),
					accessCount: 0,
					tags: ["configuration"],
				},
			]

			await vectorMemoryStore.storeMemories(memories, "task-123")

			// 验证记忆已存储
			const storedPoints = (mockVectorStore as any).points
			expect(storedPoints.size).toBe(2)
			expect(storedPoints.has("mem-1")).toBe(true)
			expect(storedPoints.has("mem-2")).toBe(true)
		})

		it("应该处理空记忆数组", async () => {
			await expect(vectorMemoryStore.storeMemories([], "task-123")).resolves.toBeUndefined()
		})
	})

	describe("searchRelevantMemories", () => {
		beforeEach(async () => {
			// 预存储一些记忆
			const memories: MemoryEntry[] = [
				{
					id: "mem-1",
					type: MemoryType.USER_INSTRUCTION,
					priority: MemoryPriority.CRITICAL,
					content: "使用 PostgreSQL 作为数据库",
					createdAt: Date.now(),
					lastAccessedAt: Date.now(),
					accessCount: 0,
					relatedTech: ["postgresql"],
				},
				{
					id: "mem-2",
					type: MemoryType.TECHNICAL_DECISION,
					priority: MemoryPriority.HIGH,
					content: "端口设置为 3001",
					createdAt: Date.now(),
					lastAccessedAt: Date.now(),
					accessCount: 0,
					tags: ["configuration"],
				},
				{
					id: "mem-3",
					type: MemoryType.CONFIGURATION,
					priority: MemoryPriority.MEDIUM,
					content: "API 端点: /api/users",
					createdAt: Date.now(),
					lastAccessedAt: Date.now(),
					accessCount: 0,
					tags: ["api"],
				},
			]

			await vectorMemoryStore.storeMemories(memories, "task-123")
		})

		it("应该搜索到相关记忆", async () => {
			const results = await vectorMemoryStore.searchRelevantMemories("数据库配置", {
				minScore: 0.5,
				maxResults: 5,
			})

			expect(results).toBeDefined()
			expect(Array.isArray(results)).toBe(true)
			expect(results.length).toBeGreaterThan(0)

			// 验证结果结构
			const firstResult = results[0]
			expect(firstResult).toHaveProperty("memory")
			expect(firstResult).toHaveProperty("score")
			expect(firstResult.memory).toHaveProperty("id")
			expect(firstResult.memory).toHaveProperty("content")
		})

		it("应该按类型过滤记忆", async () => {
			const results = await vectorMemoryStore.searchRelevantMemories("配置", {
				types: [MemoryType.USER_INSTRUCTION],
				maxResults: 10,
			})

			// 所有结果应该是USER_INSTRUCTION类型
			for (const result of results) {
				expect(result.memory.type).toBe(MemoryType.USER_INSTRUCTION)
			}
		})

		it("应该按优先级过滤记忆", async () => {
			const results = await vectorMemoryStore.searchRelevantMemories("配置", {
				priorities: [MemoryPriority.CRITICAL],
				maxResults: 10,
			})

			// 所有结果应该是CRITICAL优先级
			for (const result of results) {
				expect(result.memory.priority).toBe(MemoryPriority.CRITICAL)
			}
		})

		it("应该限制返回结果数量", async () => {
			const results = await vectorMemoryStore.searchRelevantMemories("配置", {
				maxResults: 2,
			})

			expect(results.length).toBeLessThanOrEqual(2)
		})
	})

	describe("searchProjectMemories", () => {
		it("应该搜索项目级别记忆", async () => {
			const memories: MemoryEntry[] = [
				{
					id: "mem-1",
					type: MemoryType.PROJECT_CONTEXT,
					priority: MemoryPriority.HIGH,
					content: "项目使用 React 和 TypeScript",
					createdAt: Date.now(),
					lastAccessedAt: Date.now(),
					accessCount: 0,
					relatedTech: ["react", "typescript"],
				},
			]

			await vectorMemoryStore.storeMemories(memories, "task-123")

			const results = await vectorMemoryStore.searchProjectMemories("技术栈", {
				minScore: 0.5,
				maxResults: 5,
			})

			expect(results).toBeDefined()
			expect(Array.isArray(results)).toBe(true)
		})
	})

	describe("clearAllMemories", () => {
		it("应该清除所有记忆", async () => {
			const memories: MemoryEntry[] = [
				{
					id: "mem-1",
					type: MemoryType.USER_INSTRUCTION,
					priority: MemoryPriority.CRITICAL,
					content: "测试记忆",
					createdAt: Date.now(),
					lastAccessedAt: Date.now(),
					accessCount: 0,
				},
			]

			await vectorMemoryStore.storeMemories(memories, "task-123")
			await vectorMemoryStore.clearAllMemories()

			const storedPoints = (mockVectorStore as any).points
			expect(storedPoints.size).toBe(0)
		})
	})
})
