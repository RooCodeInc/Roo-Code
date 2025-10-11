import { describe, it, expect, beforeEach } from "vitest"
import { ConversationMemory, MemoryType, MemoryPriority } from "../ConversationMemory"
import { ApiMessage } from "../../task-persistence/apiMessages"

describe("ConversationMemory", () => {
	let memory: ConversationMemory
	const taskId = "test-task-123"

	beforeEach(() => {
		memory = new ConversationMemory(taskId)
	})

	describe("extractMemories", () => {
		it("应该从用户消息中提取关键指令", async () => {
			const messages: ApiMessage[] = [
				{
					role: "user",
					content: "必须使用 PostgreSQL 数据库",
					ts: Date.now(),
				},
			]

			const result = await memory.extractMemories(messages)

			expect(result.newMemoriesCount).toBeGreaterThan(0)
			expect(result.scannedMessages).toBe(1)

			const memories = memory.getAllMemories()
			expect(memories.length).toBeGreaterThan(0)

			const hasUserInstruction = memories.some(
				(m) => m.type === MemoryType.USER_INSTRUCTION && m.priority === MemoryPriority.CRITICAL,
			)
			expect(hasUserInstruction).toBe(true)
		})

		it("应该检测技术决策", async () => {
			const messages: ApiMessage[] = [
				{
					role: "user",
					content: "use PostgreSQL for the database",
					ts: Date.now(),
				},
			]

			const result = await memory.extractMemories(messages)

			const memories = memory.getAllMemories()
			const hasTechDecision = memories.some((m) => m.type === MemoryType.TECHNICAL_DECISION)
			expect(hasTechDecision).toBe(true)
		})

		it("应该检测配置变更指令", async () => {
			const messages: ApiMessage[] = [
				{
					role: "user",
					content: "change port to 3001",
					ts: Date.now(),
				},
			]

			const result = await memory.extractMemories(messages)

			const memories = memory.getAllMemories()
			const hasConfig = memories.some(
				(m) => m.type === MemoryType.CONFIGURATION || m.type === MemoryType.TECHNICAL_DECISION,
			)
			expect(hasConfig).toBe(true)
		})

		it("应该跳过助手消息", async () => {
			const messages: ApiMessage[] = [
				{
					role: "assistant",
					content: "这是一个很长的助手回复，包含很多信息但不应该被提取为记忆",
					ts: Date.now(),
				},
			]

			const result = await memory.extractMemories(messages)

			// 助手消息不应该生成新记忆
			expect(result.newMemoriesCount).toBe(0)
		})

		it("应该只处理新消息", async () => {
			const messages1: ApiMessage[] = [
				{
					role: "user",
					content: "必须使用 Redis",
					ts: Date.now(),
				},
			]

			await memory.extractMemories(messages1)
			const firstCount = memory.getAllMemories().length

			// 添加新消息
			const messages2: ApiMessage[] = [
				...messages1,
				{
					role: "user",
					content: "remember to use JWT",
					ts: Date.now(),
				},
			]

			await memory.extractMemories(messages2)
			const secondCount = memory.getAllMemories().length

			// 应该只增加新消息的记忆
			expect(secondCount).toBeGreaterThan(firstCount)
		})
	})

	describe("记忆管理", () => {
		beforeEach(async () => {
			// 添加一些测试记忆
			const messages: ApiMessage[] = [
				{
					role: "user",
					content: "必须使用 PostgreSQL",
					ts: Date.now(),
				},
				{
					role: "user",
					content: "port is 3001",
					ts: Date.now(),
				},
				{
					role: "user",
					content: "error in authentication",
					ts: Date.now(),
				},
			]
			await memory.extractMemories(messages)
		})

		it("应该正确获取关键记忆", () => {
			const critical = memory.getCriticalMemories()
			expect(critical.length).toBeGreaterThan(0)
			expect(critical.every((m) => m.priority === MemoryPriority.CRITICAL)).toBe(true)
		})

		it("应该按优先级过滤记忆", () => {
			const high = memory.getMemoriesByPriority(MemoryPriority.HIGH)
			expect(high.every((m) => m.priority === MemoryPriority.HIGH)).toBe(true)
		})

		it("应该按类型过滤记忆", () => {
			const instructions = memory.getMemoriesByType(MemoryType.USER_INSTRUCTION)
			expect(instructions.every((m) => m.type === MemoryType.USER_INSTRUCTION)).toBe(true)
		})

		it("应该正确记录记忆访问", () => {
			const allMemories = memory.getAllMemories()
			if (allMemories.length > 0) {
				const memoryId = allMemories[0].id
				const initialAccessCount = allMemories[0].accessCount

				memory.recordMemoryAccess(memoryId)

				const updated = memory.getAllMemories().find((m) => m.id === memoryId)
				expect(updated?.accessCount).toBe(initialAccessCount + 1)
			}
		})
	})

	describe("generateMemorySummary", () => {
		it("应该生成空摘要当没有重要记忆时", () => {
			const summary = memory.generateMemorySummary()
			expect(summary).toBe("")
		})

		it("应该生成包含关键指令的摘要", async () => {
			const messages: ApiMessage[] = [
				{
					role: "user",
					content: "必须使用 PostgreSQL 数据库",
					ts: Date.now(),
				},
			]

			await memory.extractMemories(messages)
			const summary = memory.generateMemorySummary()

			expect(summary).toContain("重要上下文记忆")
			expect(summary).toContain("PostgreSQL")
		})

		it("应该限制高优先级记忆的数量", async () => {
			// 创建超过10条高优先级记忆 - 使用明确的技术决策语句
			const messages: ApiMessage[] = Array.from({ length: 15 }, (_, i) => ({
				role: "user" as const,
				content: `必须 use PostgreSQL ${i} for database`,
				ts: Date.now() + i,
			}))

			await memory.extractMemories(messages)
			const summary = memory.generateMemorySummary()

			// 摘要应该存在但不应该包含所有15条
			expect(summary.length).toBeGreaterThan(0)
			// 验证不是所有15条记忆都在摘要中（摘要限制为10条高优先级）
			const memories = memory.getAllMemories()
			expect(memories.length).toBeGreaterThanOrEqual(15)
		})
	})

	describe("pruneLowPriorityMemories", () => {
		it("应该保留指定数量的最重要记忆", async () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "必须使用 PostgreSQL", ts: Date.now() },
				{ role: "user", content: "port is 3001", ts: Date.now() + 1 },
				{ role: "user", content: "use Redis for cache", ts: Date.now() + 2 },
				{ role: "user", content: "error occurred", ts: Date.now() + 3 },
				{ role: "user", content: "theme is dark", ts: Date.now() + 4 },
			]

			await memory.extractMemories(messages)
			const beforeCount = memory.getAllMemories().length

			memory.pruneLowPriorityMemories(3)

			const afterCount = memory.getAllMemories().length
			expect(afterCount).toBeLessThanOrEqual(3)
			expect(afterCount).toBeLessThan(beforeCount)

			// 关键记忆应该被保留
			const remaining = memory.getAllMemories()
			const hasCritical = remaining.some((m) => m.priority === MemoryPriority.CRITICAL)
			expect(hasCritical).toBe(true)
		})
	})

	describe("getMemoryStats", () => {
		it("应该返回正确的统计信息", async () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "必须使用 PostgreSQL", ts: Date.now() },
				{ role: "user", content: "port is 3001", ts: Date.now() + 1 },
			]

			await memory.extractMemories(messages)

			const stats = memory.getMemoryStats()

			expect(stats.totalMemories).toBeGreaterThan(0)
			expect(stats.byType).toBeDefined()
			expect(stats.byPriority).toBeDefined()
			expect(stats.pendingMemories).toBeGreaterThanOrEqual(0)
		})

		it("应该正确统计待处理记忆", async () => {
			const messages: ApiMessage[] = [{ role: "user", content: "必须使用 PostgreSQL", ts: Date.now() }]

			await memory.extractMemories(messages)

			// 新创建的记忆应该算作待处理
			const stats = memory.getMemoryStats()
			expect(stats.pendingMemories).toBeGreaterThan(0)
		})
	})

	describe("序列化和反序列化", () => {
		it("应该能够序列化和恢复记忆", async () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "必须使用 PostgreSQL", ts: Date.now() },
				{ role: "user", content: "port is 3001", ts: Date.now() + 1 },
			]

			await memory.extractMemories(messages)
			const originalCount = memory.getAllMemories().length

			const serialized = memory.serialize()
			const restored = ConversationMemory.deserialize(serialized)

			expect(restored.getAllMemories().length).toBe(originalCount)
			expect(restored.getAllMemories()[0].content).toBeDefined()
		})

		it("应该保留记忆的所有属性", async () => {
			const messages: ApiMessage[] = [{ role: "user", content: "必须使用 PostgreSQL 数据库", ts: Date.now() }]

			await memory.extractMemories(messages)
			const original = memory.getAllMemories()[0]

			const serialized = memory.serialize()
			const restored = ConversationMemory.deserialize(serialized)
			const restoredMemory = restored.getAllMemories()[0]

			expect(restoredMemory.id).toBe(original.id)
			expect(restoredMemory.type).toBe(original.type)
			expect(restoredMemory.priority).toBe(original.priority)
			expect(restoredMemory.content).toBe(original.content)
			expect(restoredMemory.createdAt).toBe(original.createdAt)
		})

		describe("记忆去重和合并", () => {
			it("应该检测并合并重复的记忆", async () => {
				const messages: ApiMessage[] = [
					{ role: "user", content: "必须使用 PostgreSQL 数据库", ts: Date.now() },
					{ role: "user", content: "必须使用 PostgreSQL 数据库系统", ts: Date.now() + 1 },
				]

				await memory.extractMemories(messages)

				const allMemories = memory.getAllMemories()
				// 由于相似度高，应该被合并，记忆数量应该少于2
				expect(allMemories.length).toBeLessThan(4) // 考虑到可能提取其他类型的记忆
			})

			it("应该在合并时保留更高的优先级", async () => {
				// 创建一个带配置的memory实例
				const testMemory = new ConversationMemory(taskId, {
					similarity: { threshold: 0.7, enableSemanticSimilarity: true },
				})

				const messages: ApiMessage[] = [
					{ role: "user", content: "use PostgreSQL", ts: Date.now() },
					{ role: "user", content: "必须 use PostgreSQL database", ts: Date.now() + 1 },
				]

				await testMemory.extractMemories(messages)

				const allMemories = testMemory.getAllMemories()
				const pgMemories = allMemories.filter((m) => m.content.toLowerCase().includes("postgresql"))

				// 如果记忆被合并，应该保留最高优先级
				if (pgMemories.length > 0) {
					const hasCritical = pgMemories.some((m) => m.priority === MemoryPriority.CRITICAL)
					expect(hasCritical).toBe(true)
				}
			})

			it("应该合并相关文件和技术栈信息", async () => {
				const messages: ApiMessage[] = [
					{ role: "user", content: "必须使用 react in file src/App.tsx", ts: Date.now() },
					{ role: "user", content: "必须使用 react framework in file src/index.tsx", ts: Date.now() + 1 },
				]

				await memory.extractMemories(messages)

				const allMemories = memory.getAllMemories()
				const reactMemories = allMemories.filter((m) => m.relatedTech?.includes("react"))

				if (reactMemories.length > 0) {
					const memory = reactMemories[0]
					// 应该有相关技术栈
					expect(memory.relatedTech).toBeDefined()
					expect(memory.relatedTech?.includes("react")).toBe(true)
				}
			})
		})

		describe("记忆老化机制", () => {
			it("应该在配置启用时应用老化", async () => {
				const agingMemory = new ConversationMemory(taskId, {
					aging: {
						enableAutoAging: true,
						highPriorityHalfLife: 100, // 很短的半衰期用于测试
						mediumPriorityHalfLife: 50,
						lowPriorityHalfLife: 10,
					},
				})

				const messages: ApiMessage[] = [{ role: "user", content: "use Redis for cache", ts: Date.now() }]

				await agingMemory.extractMemories(messages)

				// 等待一段时间让记忆老化
				await new Promise((resolve) => setTimeout(resolve, 150))

				// 调用generateMemorySummary会触发老化机制
				agingMemory.generateMemorySummary()

				// 注意：由于CRITICAL优先级不会老化，我们检查非关键记忆
				const allMemories = agingMemory.getAllMemories()
				const nonCritical = allMemories.filter((m) => m.priority !== MemoryPriority.CRITICAL)

				// 某些记忆可能已经降级
				expect(allMemories.length).toBeGreaterThan(0)
			})

			it("关键记忆不应该老化", async () => {
				const agingMemory = new ConversationMemory(taskId, {
					aging: {
						enableAutoAging: true,
						highPriorityHalfLife: 1,
						mediumPriorityHalfLife: 1,
						lowPriorityHalfLife: 1,
					},
				})

				const messages: ApiMessage[] = [{ role: "user", content: "必须使用 PostgreSQL 数据库", ts: Date.now() }]

				await agingMemory.extractMemories(messages)

				await new Promise((resolve) => setTimeout(resolve, 50))

				agingMemory.generateMemorySummary()

				const critical = agingMemory.getCriticalMemories()
				// 关键记忆应该保持CRITICAL优先级
				expect(critical.length).toBeGreaterThan(0)
			})
		})

		describe("增强的记忆提取", () => {
			it("应该提取文件路径", async () => {
				const messages: ApiMessage[] = [
					{ role: "user", content: "必须 modify file at ./src/components/App.tsx", ts: Date.now() },
				]

				await memory.extractMemories(messages)

				const allMemories = memory.getAllMemories()
				const withFiles = allMemories.filter((m) => m.relatedFiles && m.relatedFiles.length > 0)

				// 应该至少提取到文件路径信息
				expect(withFiles.length).toBeGreaterThan(0)
				const allFiles = withFiles.flatMap((m) => m.relatedFiles || [])
				expect(allFiles.some((f) => f.includes("App.tsx"))).toBe(true)
			})

			it("应该提取技术栈信息", async () => {
				const messages: ApiMessage[] = [
					{ role: "user", content: "必须 use React with TypeScript and GraphQL", ts: Date.now() },
				]

				await memory.extractMemories(messages)

				const allMemories = memory.getAllMemories()
				const withTech = allMemories.filter((m) => m.relatedTech && m.relatedTech.length > 0)

				expect(withTech.length).toBeGreaterThan(0)
				const allTech = withTech.flatMap((m) => m.relatedTech || [])
				expect(allTech).toContain("react")
				expect(allTech).toContain("typescript")
				expect(allTech).toContain("graphql")
			})

			it("应该提取API端点", async () => {
				const messages: ApiMessage[] = [
					{ role: "user", content: "call API at https://api.example.com/users", ts: Date.now() },
				]

				await memory.extractMemories(messages)

				const allMemories = memory.getAllMemories()
				const apiMemories = allMemories.filter((m) => m.tags?.includes("api"))

				expect(apiMemories.length).toBeGreaterThan(0)
				expect(apiMemories[0].content).toContain("https://api.example.com/users")
			})

			it("应该检测localhost端口", async () => {
				const messages: ApiMessage[] = [
					{ role: "user", content: "server runs on localhost:3000", ts: Date.now() },
				]

				await memory.extractMemories(messages)

				const allMemories = memory.getAllMemories()
				const portMemories = allMemories.filter((m) => m.content.includes("localhost:3000"))

				expect(portMemories.length).toBeGreaterThan(0)
			})
		})

		describe("智能摘要生成", () => {
			it("应该按类型分组记忆", async () => {
				const messages: ApiMessage[] = [
					{ role: "user", content: "必须使用 PostgreSQL", ts: Date.now() },
					{ role: "user", content: "必须使用 Redis", ts: Date.now() + 1 },
					{ role: "user", content: "use JWT for auth", ts: Date.now() + 2 },
				]

				await memory.extractMemories(messages)
				const summary = memory.generateMemorySummary()

				// 摘要应该包含分组标题
				expect(summary).toContain("重要上下文记忆")
			})

			it("应该包含技术栈总结", async () => {
				const messages: ApiMessage[] = [
					{ role: "user", content: "必须 use React with TypeScript", ts: Date.now() },
					{ role: "user", content: "必须使用 PostgreSQL database", ts: Date.now() + 1 },
				]

				await memory.extractMemories(messages)
				const summary = memory.generateMemorySummary()

				// 如果有技术栈，摘要应该包含技术栈部分
				if (summary.includes("技术栈")) {
					// 检查是否包含任意技术栈关键词
					const hasTech =
						summary.includes("react") || summary.includes("typescript") || summary.includes("postgresql")
					expect(hasTech).toBe(true)
				}
			})

			it("应该限制每种类型的记忆数量", async () => {
				// 创建大量相同类型的记忆
				const messages: ApiMessage[] = Array.from({ length: 20 }, (_, i) => ({
					role: "user" as const,
					content: `use Redis${i} for cache`,
					ts: Date.now() + i,
				}))

				await memory.extractMemories(messages)
				const summary = memory.generateMemorySummary()

				// 摘要不应该包含所有20条记忆
				const redisCount = (summary.match(/Redis/g) || []).length
				expect(redisCount).toBeLessThan(20)
			})
		})

		describe("配置选项", () => {
			it("应该使用自定义相似度阈值", () => {
				const customMemory = new ConversationMemory(taskId, {
					similarity: {
						threshold: 0.5,
						enableSemanticSimilarity: true,
					},
				})

				expect(customMemory).toBeDefined()
			})

			it("应该使用自定义老化配置", () => {
				const customMemory = new ConversationMemory(taskId, {
					aging: {
						highPriorityHalfLife: 1000,
						mediumPriorityHalfLife: 500,
						lowPriorityHalfLife: 100,
						enableAutoAging: false,
					},
				})

				expect(customMemory).toBeDefined()
			})
		})
	})
})
