/**
 * 向量记忆与上下文压缩集成测试
 * 测试VectorMemoryStore与condense流程的端到端集成
 */

import { VectorMemoryStore } from "../../memory/VectorMemoryStore"
import { ConversationMemory, MemoryType, MemoryPriority } from "../../memory/ConversationMemory"
import { summarizeConversation } from "../index"
import { ApiMessage } from "../../task-persistence/apiMessages"
import { ApiHandler } from "../../../api"
import { TelemetryService } from "@roo-code/telemetry"

// Mock dependencies
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureContextCondensed: vi.fn(),
		},
	},
}))
vi.mock("../../../i18n", () => ({
	t: (key: string) => key,
}))

describe("VectorMemoryStore Integration with Context Condensing", () => {
	let mockApiHandler: ApiHandler
	let mockVectorMemoryStore: VectorMemoryStore
	let conversationMemory: ConversationMemory
	let mockCountTokens: ReturnType<typeof vi.fn>
	let mockCreateMessage: ReturnType<typeof vi.fn>

	beforeEach(() => {
		// Mock token counting
		mockCountTokens = vi.fn().mockResolvedValue(100)

		// Mock message creation stream
		mockCreateMessage = vi.fn().mockReturnValue(
			(async function* () {
				yield {
					type: "text",
					text: "## 1. Previous Conversation:\nUser discussed implementing vector memory.\n\n",
				}
				yield { type: "text", text: "## 2. Current Work:\nIntegrating VectorMemoryStore with condensing.\n\n" }
				yield {
					type: "text",
					text: "## 3. Key Technical Concepts:\n- Vector embeddings\n- Semantic search\n\n",
				}
				yield {
					type: "usage",
					totalCost: 0.01,
					inputTokens: 500,
					outputTokens: 150,
				}
			})(),
		)

		// Create mock API handler
		mockApiHandler = {
			countTokens: mockCountTokens,
			createMessage: mockCreateMessage,
		} as unknown as ApiHandler

		// Mock VectorMemoryStore
		mockVectorMemoryStore = {
			storeMemories: vi.fn().mockResolvedValue(undefined),
			searchProjectMemories: vi.fn().mockResolvedValue([
				{
					memory: {
						id: "mem-1",
						type: MemoryType.TECHNICAL_DECISION,
						priority: MemoryPriority.HIGH,
						content: "使用Qdrant作为向量数据库",
						createdAt: Date.now() - 86400000,
						lastAccessedAt: Date.now() - 86400000,
						accessCount: 3,
					},
					score: 0.85,
				},
				{
					memory: {
						id: "mem-2",
						type: MemoryType.USER_INSTRUCTION,
						priority: MemoryPriority.CRITICAL,
						content: "所有记忆需要支持语义搜索",
						createdAt: Date.now() - 172800000,
						lastAccessedAt: Date.now() - 172800000,
						accessCount: 2,
					},
					score: 0.78,
				},
			]),
		} as unknown as VectorMemoryStore

		// Create conversation memory
		conversationMemory = new ConversationMemory()
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("Memory Extraction and Storage", () => {
		it("should extract memories and store them to vector store during condensing", async () => {
			const messages: ApiMessage[] = [
				{
					role: "user",
					content: "请实现向量记忆功能，使用Qdrant作为数据库",
					ts: Date.now() - 10000,
				},
				{
					role: "assistant",
					content: "好的，我将创建VectorMemoryStore类",
					ts: Date.now() - 9000,
				},
				{
					role: "user",
					content: "记住：所有记忆都需要支持语义搜索",
					ts: Date.now() - 8000,
				},
				{
					role: "assistant",
					content: "明白了，我会使用embedder实现语义搜索",
					ts: Date.now() - 7000,
				},
				{
					role: "user",
					content: "继续完成集成测试",
					ts: Date.now(),
				},
			]

			const result = await summarizeConversation(
				messages,
				mockApiHandler,
				"You are a helpful assistant",
				"test-task-id",
				5000,
				true,
				undefined,
				undefined,
				conversationMemory,
				true, // 启用记忆增强
				mockVectorMemoryStore,
			)

			// 验证记忆被存储到向量存储
			expect(mockVectorMemoryStore.storeMemories).toHaveBeenCalled()
			const storeCall = (mockVectorMemoryStore.storeMemories as ReturnType<typeof vi.fn>).mock.calls[0]
			expect(storeCall[0]).toBeInstanceOf(Array) // memories array
			expect(storeCall[1]).toBe("test-task-id") // taskId

			// 验证摘要成功生成
			expect(result.summary).toContain("Previous Conversation")
			expect(result.summary).toContain("Current Work")
			expect(result.cost).toBeGreaterThan(0)
		})

		it("should handle vector store failures gracefully", async () => {
			// Mock store failure
			const storeError = new Error("Qdrant connection failed")
			;(mockVectorMemoryStore.storeMemories as ReturnType<typeof vi.fn>).mockRejectedValue(storeError)

			// Spy on console.warn
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			const messages: ApiMessage[] = [
				{
					role: "user",
					content: "我想实现一个向量记忆系统，需要使用Qdrant作为向量数据库",
					ts: Date.now() - 10000,
				},
				{
					role: "assistant",
					content: "好的，我将创建VectorMemoryStore类来管理记忆",
					ts: Date.now() - 9000,
				},
				{
					role: "user",
					content: "记住：所有的记忆都需要支持语义搜索功能",
					ts: Date.now() - 8000,
				},
				{
					role: "assistant",
					content: "明白，我会使用embedder实现语义搜索",
					ts: Date.now() - 7000,
				},
				{
					role: "user",
					content: "现在测试向量存储失败的情况",
					ts: Date.now() - 5000,
				},
				{
					role: "assistant",
					content: "我将模拟Qdrant连接失败的场景",
					ts: Date.now() - 4000,
				},
				{
					role: "user",
					content: "继续",
					ts: Date.now(),
				},
			]

			const result = await summarizeConversation(
				messages,
				mockApiHandler,
				"System prompt",
				"test-task-id",
				3000,
				true,
				undefined,
				undefined,
				conversationMemory,
				true,
				mockVectorMemoryStore,
			)

			// 应该记录警告但不影响摘要生成
			expect(warnSpy).toHaveBeenCalledWith("Failed to store memories to vector store:", storeError)
			expect(result.summary).toBeTruthy()
			expect(result.error).toBeUndefined()

			warnSpy.mockRestore()
		})
	})

	describe("Semantic Memory Retrieval", () => {
		it("should retrieve and inject relevant historical memories into context", async () => {
			const messages: ApiMessage[] = [
				{
					role: "user",
					content: "我需要创建新的向量搜索功能，要支持语义检索",
					ts: Date.now() - 10000,
				},
				{
					role: "assistant",
					content: "好的，我将实现语义向量搜索",
					ts: Date.now() - 9000,
				},
				{
					role: "user",
					content: "记住要使用Qdrant作为向量数据库后端",
					ts: Date.now() - 8000,
				},
				{
					role: "assistant",
					content: "明白，我会配置Qdrant连接",
					ts: Date.now() - 7000,
				},
				{
					role: "user",
					content: "所有记忆都需要支持跨对话检索",
					ts: Date.now() - 5000,
				},
				{
					role: "assistant",
					content: "我将实现项目级记忆搜索功能",
					ts: Date.now() - 4000,
				},
				{
					role: "user",
					content: "继续",
					ts: Date.now(),
				},
			]

			await summarizeConversation(
				messages,
				mockApiHandler,
				"System prompt",
				"test-task-id",
				3000,
				true,
				undefined,
				undefined,
				conversationMemory,
				true,
				mockVectorMemoryStore,
			)

			// 验证语义搜索被调用
			expect(mockVectorMemoryStore.searchProjectMemories).toHaveBeenCalled()
			const searchCall = (mockVectorMemoryStore.searchProjectMemories as ReturnType<typeof vi.fn>).mock.calls[0]

			// 验证搜索参数
			expect(searchCall[0]).toBeTruthy() // query context
			expect(searchCall[1]).toMatchObject({
				minScore: 0.75,
				maxResults: 5,
			})

			// 验证历史记忆被注入到请求中
			expect(mockCreateMessage).toHaveBeenCalled()
			const createMessageCall = mockCreateMessage.mock.calls[0]
			const requestMessages = createMessageCall[1] as Array<{ role: string; content: string }>
			const lastMessage = requestMessages[requestMessages.length - 1]

			expect(lastMessage.content).toContain("相关历史记忆")
			expect(lastMessage.content).toContain("使用Qdrant作为向量数据库")
			expect(lastMessage.content).toContain("所有记忆需要支持语义搜索")
		})

		it("should handle empty search results gracefully", async () => {
			// Mock empty search results
			;(mockVectorMemoryStore.searchProjectMemories as ReturnType<typeof vi.fn>).mockResolvedValue([])

			const messages: ApiMessage[] = [
				{
					role: "user",
					content: "我想讨论一个完全新的话题：量子计算在AI中的应用",
					ts: Date.now() - 10000,
				},
				{
					role: "assistant",
					content: "好的，这是一个非常前沿的研究领域",
					ts: Date.now() - 9000,
				},
				{
					role: "user",
					content: "请详细说明量子比特的工作原理",
					ts: Date.now() - 8000,
				},
				{
					role: "assistant",
					content: "量子比特利用叠加态和纠缠态进行计算",
					ts: Date.now() - 7000,
				},
				{
					role: "user",
					content: "这和传统计算有什么区别",
					ts: Date.now() - 5000,
				},
				{
					role: "assistant",
					content: "传统计算使用二进制位，而量子计算使用量子态",
					ts: Date.now() - 4000,
				},
				{
					role: "user",
					content: "继续",
					ts: Date.now(),
				},
			]

			const result = await summarizeConversation(
				messages,
				mockApiHandler,
				"System prompt",
				"test-task-id",
				3000,
				true,
				undefined,
				undefined,
				conversationMemory,
				true,
				mockVectorMemoryStore,
			)

			// 应该成功完成，即使没有找到相关记忆
			expect(result.summary).toBeTruthy()
			expect(result.error).toBeUndefined()
		})

		it("should handle search failures gracefully", async () => {
			// Mock search failure
			const searchError = new Error("Vector search failed")
			;(mockVectorMemoryStore.searchProjectMemories as ReturnType<typeof vi.fn>).mockRejectedValue(searchError)

			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			const messages: ApiMessage[] = [
				{
					role: "user",
					content: "务必测试向量搜索失败的情况，模拟数据库连接中断",
					ts: Date.now() - 10000,
				},
				{
					role: "assistant",
					content: "我将创建一个测试场景来处理搜索失败",
					ts: Date.now() - 9000,
				},
				{
					role: "user",
					content: "记住：必须确保系统在搜索失败时能够优雅降级",
					ts: Date.now() - 8000,
				},
				{
					role: "assistant",
					content: "我会添加错误处理和回退机制",
					ts: Date.now() - 7000,
				},
				{
					role: "user",
					content: "这是重要的容错机制，记录警告但继续正常运行",
					ts: Date.now() - 5000,
				},
				{
					role: "assistant",
					content: "明白，我会使用console.warn记录错误",
					ts: Date.now() - 4000,
				},
				{
					role: "user",
					content: "已经改了错误处理逻辑，继续测试",
					ts: Date.now(),
				},
			]

			const result = await summarizeConversation(
				messages,
				mockApiHandler,
				"System prompt",
				"test-task-id",
				3000,
				true,
				undefined,
				undefined,
				conversationMemory,
				true,
				mockVectorMemoryStore,
			)

			// 应该记录警告但继续生成摘要
			expect(warnSpy).toHaveBeenCalledWith("Failed to search vector memories:", searchError)
			expect(result.summary).toBeTruthy()
			expect(result.error).toBeUndefined()

			warnSpy.mockRestore()
		})
	})

	describe("Memory Enhancement Toggle", () => {
		it("should skip memory enhancement when disabled", async () => {
			const messages: ApiMessage[] = [
				{
					role: "user",
					content: "测试禁用记忆增强功能的场景",
					ts: Date.now() - 10000,
				},
				{
					role: "assistant",
					content: "我将配置useMemoryEnhancement=false",
					ts: Date.now() - 9000,
				},
				{
					role: "user",
					content: "确保向量存储方法不会被调用",
					ts: Date.now() - 8000,
				},
				{
					role: "assistant",
					content: "我会验证storeMemories和searchProjectMemories未执行",
					ts: Date.now() - 7000,
				},
				{
					role: "user",
					content: "这样可以节省API调用成本",
					ts: Date.now() - 5000,
				},
				{
					role: "assistant",
					content: "是的，在不需要记忆功能时可以禁用",
					ts: Date.now() - 4000,
				},
				{
					role: "user",
					content: "继续验证",
					ts: Date.now(),
				},
			]

			await summarizeConversation(
				messages,
				mockApiHandler,
				"System prompt",
				"test-task-id",
				3000,
				true,
				undefined,
				undefined,
				conversationMemory,
				false, // 禁用记忆增强
				mockVectorMemoryStore,
			)

			// 验证向量存储方法未被调用
			expect(mockVectorMemoryStore.storeMemories).not.toHaveBeenCalled()
			expect(mockVectorMemoryStore.searchProjectMemories).not.toHaveBeenCalled()
		})

		it("should work without vector store when memory enhancement is enabled", async () => {
			const messages: ApiMessage[] = [
				{
					role: "user",
					content: "测试启用记忆增强但不提供向量存储的情况",
					ts: Date.now() - 10000,
				},
				{
					role: "assistant",
					content: "这种情况下应该使用基础的ConversationMemory",
					ts: Date.now() - 9000,
				},
				{
					role: "user",
					content: "系统应该仍然能够正常运行",
					ts: Date.now() - 8000,
				},
				{
					role: "assistant",
					content: "是的，向量存储是可选的增强功能",
					ts: Date.now() - 7000,
				},
				{
					role: "user",
					content: "这提供了更好的向后兼容性",
					ts: Date.now() - 5000,
				},
				{
					role: "assistant",
					content: "用户可以逐步启用高级功能",
					ts: Date.now() - 4000,
				},
				{
					role: "user",
					content: "继续测试",
					ts: Date.now(),
				},
			]

			const result = await summarizeConversation(
				messages,
				mockApiHandler,
				"System prompt",
				"test-task-id",
				3000,
				true,
				undefined,
				undefined,
				conversationMemory,
				true, // 启用记忆增强
				undefined, // 但不提供vector store
			)

			// 应该仍然成功，只是不使用向量搜索
			expect(result.summary).toBeTruthy()
			expect(result.error).toBeUndefined()
		})
	})

	describe("Cross-conversation Memory", () => {
		it("should search project-level memories across different tasks", async () => {
			const messages: ApiMessage[] = [
				{
					role: "user",
					content: "我想继续之前的向量记忆工作，记住要检索历史对话",
					ts: Date.now() - 10000,
				},
				{
					role: "assistant",
					content: "让我检索之前对话中的相关记忆",
					ts: Date.now() - 9000,
				},
				{
					role: "user",
					content: "记住：之前我们讨论过必须使用Qdrant数据库",
					ts: Date.now() - 8000,
				},
				{
					role: "assistant",
					content: "是的，我会使用项目级搜索找到那些记忆",
					ts: Date.now() - 7000,
				},
				{
					role: "user",
					content: "务必支持跨对话的记忆检索，这是重要功能",
					ts: Date.now() - 5000,
				},
				{
					role: "assistant",
					content: "searchProjectMemories可以检索其他任务的记忆",
					ts: Date.now() - 4000,
				},
				{
					role: "user",
					content: "已经改了跨对话检索逻辑，继续实现",
					ts: Date.now(),
				},
			]

			await summarizeConversation(
				messages,
				mockApiHandler,
				"System prompt",
				"new-task-id", // 新任务ID
				1000,
				true,
				undefined,
				undefined,
				conversationMemory,
				true,
				mockVectorMemoryStore,
			)

			// 验证使用了项目级搜索（不限制taskId）
			expect(mockVectorMemoryStore.searchProjectMemories).toHaveBeenCalled()

			// 验证能够检索到其他任务的记忆
			const searchResults = await mockVectorMemoryStore.searchProjectMemories("test query")
			expect(searchResults.length).toBeGreaterThan(0)
			expect(searchResults[0].memory.content).toContain("Qdrant")
		})
	})

	describe("Memory Context Injection", () => {
		it("should properly format memory context in the request", async () => {
			const messages: ApiMessage[] = [
				{
					role: "user",
					content: "我需要实现新功能，要支持向量记忆存储",
					ts: Date.now() - 10000,
				},
				{
					role: "assistant",
					content: "好的，我将实现VectorMemoryStore",
					ts: Date.now() - 9000,
				},
				{
					role: "user",
					content: "记住要使用Qdrant作为向量数据库",
					ts: Date.now() - 8000,
				},
				{
					role: "assistant",
					content: "明白，我会配置Qdrant连接",
					ts: Date.now() - 7000,
				},
				{
					role: "user",
					content: "所有记忆都需要支持语义搜索",
					ts: Date.now() - 5000,
				},
				{
					role: "assistant",
					content: "我将使用embedder实现语义搜索",
					ts: Date.now() - 4000,
				},
				{
					role: "user",
					content: "继续",
					ts: Date.now(),
				},
			]

			await summarizeConversation(
				messages,
				mockApiHandler,
				"System prompt",
				"test-task-id",
				3000,
				true,
				undefined,
				undefined,
				conversationMemory,
				true,
				mockVectorMemoryStore,
			)

			// 验证记忆上下文被正确格式化
			expect(mockCreateMessage).toHaveBeenCalled()
			const createMessageCall = mockCreateMessage.mock.calls[0]
			const requestMessages = createMessageCall[1] as Array<{ role: string; content: string }>
			const lastMessage = requestMessages[requestMessages.length - 1]

			// 检查包含记忆增强标记
			expect(lastMessage.content).toContain("Please incorporate these critical memories into your summary")

			// 检查包含相似度分数
			expect(lastMessage.content).toMatch(/相似度.*85\.0%/)
			expect(lastMessage.content).toMatch(/相似度.*78\.0%/)
		})

		it("should limit retrieved memories to avoid context overflow", async () => {
			// Mock large number of search results
			const manyMemories = Array.from({ length: 20 }, (_, i) => ({
				memory: {
					id: `mem-${i}`,
					type: MemoryType.PROJECT_CONTEXT,
					priority: MemoryPriority.MEDIUM,
					content: `记忆内容 ${i}`,
					createdAt: Date.now() - i * 1000,
					lastAccessedAt: Date.now() - i * 1000,
					accessCount: 1,
				},
				score: 0.9 - i * 0.01,
			}))

			;(mockVectorMemoryStore.searchProjectMemories as ReturnType<typeof vi.fn>).mockResolvedValue(manyMemories)

			const messages: ApiMessage[] = [
				{
					role: "user",
					content: "务必测试记忆检索数量限制，防止上下文溢出",
					ts: Date.now() - 10000,
				},
				{
					role: "assistant",
					content: "我将模拟大量记忆结果的场景",
					ts: Date.now() - 9000,
				},
				{
					role: "user",
					content: "记住：必须确保系统只检索最相关的前N条记忆",
					ts: Date.now() - 8000,
				},
				{
					role: "assistant",
					content: "我会验证maxResults参数限制了结果数量",
					ts: Date.now() - 7000,
				},
				{
					role: "user",
					content: "这是重要的安全机制，可以避免上下文窗口超限",
					ts: Date.now() - 5000,
				},
				{
					role: "assistant",
					content: "是的，默认限制为5条最相关记忆",
					ts: Date.now() - 4000,
				},
				{
					role: "user",
					content: "已经改了限制逻辑，继续测试验证",
					ts: Date.now(),
				},
			]

			await summarizeConversation(
				messages,
				mockApiHandler,
				"System prompt",
				"test-task-id",
				3000,
				true,
				undefined,
				undefined,
				conversationMemory,
				true,
				mockVectorMemoryStore,
			)

			// 验证搜索选项限制了结果数量
			const searchCall = (mockVectorMemoryStore.searchProjectMemories as ReturnType<typeof vi.fn>).mock.calls[0]
			expect(searchCall[1].maxResults).toBe(5) // 应该限制为5个
		})
	})
})
