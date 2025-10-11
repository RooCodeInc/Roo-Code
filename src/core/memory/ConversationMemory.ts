import { ApiMessage } from "../task-persistence/apiMessages"

/**
 * 记忆相似度计算配置
 */
interface SimilarityConfig {
	/** 相似度阈值（0-1） */
	threshold: number
	/** 是否启用语义相似度检测 */
	enableSemanticSimilarity: boolean
}

/**
 * 记忆老化配置
 */
interface AgingConfig {
	/** 高优先级记忆的半衰期（毫秒） */
	highPriorityHalfLife: number
	/** 中等优先级记忆的半衰期（毫秒） */
	mediumPriorityHalfLife: number
	/** 低优先级记忆的半衰期（毫秒） */
	lowPriorityHalfLife: number
	/** 是否启用自动老化 */
	enableAutoAging: boolean
}

/**
 * 记忆类型枚举
 */
export enum MemoryType {
	/** 用户的显式指令 */
	USER_INSTRUCTION = "user_instruction",
	/** 技术决策 */
	TECHNICAL_DECISION = "technical_decision",
	/** 配置要求 */
	CONFIGURATION = "configuration",
	/** 重要的错误或问题 */
	IMPORTANT_ERROR = "important_error",
	/** 项目上下文 */
	PROJECT_CONTEXT = "project_context",
	/** 工作流程或模式 */
	WORKFLOW_PATTERN = "workflow_pattern",
}

/**
 * 记忆优先级
 */
export enum MemoryPriority {
	/** 关键 - 绝对不能丢失 */
	CRITICAL = "critical",
	/** 高优先级 - 应该保留 */
	HIGH = "high",
	/** 中等优先级 - 可以在必要时压缩 */
	MEDIUM = "medium",
	/** 低优先级 - 可以删除 */
	LOW = "low",
}

/**
 * 记忆条目接口
 */
export interface MemoryEntry {
	/** 唯一ID */
	id: string
	/** 记忆类型 */
	type: MemoryType
	/** 优先级 */
	priority: MemoryPriority
	/** 记忆内容（原始用户指令或总结） */
	content: string
	/** 创建时间戳 */
	createdAt: number
	/** 最后访问时间 */
	lastAccessedAt: number
	/** 访问次数 */
	accessCount: number
	/** 关联的消息索引 */
	messageIndex?: number
	/** 相关文件路径 */
	relatedFiles?: string[]
	/** 相关技术栈 */
	relatedTech?: string[]
	/** 标签 */
	tags?: string[]
}

/**
 * 记忆提取结果
 */
export interface MemoryExtractionResult {
	/** 提取的记忆条目 */
	memories: MemoryEntry[]
	/** 本次扫描的消息数 */
	scannedMessages: number
	/** 新发现的记忆数 */
	newMemoriesCount: number
}

/**
 * 记忆管理器接口
 */
export interface ConversationMemoryManager {
	/** 从消息中提取记忆 */
	extractMemories(messages: ApiMessage[]): Promise<MemoryExtractionResult>

	/** 获取所有记忆 */
	getAllMemories(): MemoryEntry[]

	/** 获取关键记忆（用于压缩时保留） */
	getCriticalMemories(): MemoryEntry[]

	/** 根据优先级获取记忆 */
	getMemoriesByPriority(priority: MemoryPriority): MemoryEntry[]

	/** 根据类型获取记忆 */
	getMemoriesByType(type: MemoryType): MemoryEntry[]

	/** 更新记忆访问时间 */
	recordMemoryAccess(memoryId: string): void

	/** 生成记忆摘要（用于压缩后的上下文） */
	generateMemorySummary(): string

	/** 清除低优先级记忆 */
	pruneLowPriorityMemories(maxCount: number): void

	/** 获取记忆统计 */
	getMemoryStats(): MemoryStats
}

/**
 * 记忆统计
 */
export interface MemoryStats {
	/** 总记忆数 */
	totalMemories: number
	/** 按类型分组的统计 */
	byType: Record<MemoryType, number>
	/** 按优先级分组的统计 */
	byPriority: Record<MemoryPriority, number>
	/** 待处理记忆数（最近创建但未被压缩保留的） */
	pendingMemories: number
	/** 已持久化的记忆数 */
	persistedMemories: number
}

/**
 * 对话记忆管理器实现
 */
export class ConversationMemory implements ConversationMemoryManager {
	private memories: Map<string, MemoryEntry> = new Map()
	private lastExtractedIndex: number = 0
	private similarityConfig: SimilarityConfig
	private agingConfig: AgingConfig

	constructor(
		private taskId: string,
		config?: {
			similarity?: Partial<SimilarityConfig>
			aging?: Partial<AgingConfig>
		},
	) {
		// 默认配置
		this.similarityConfig = {
			threshold: 0.75,
			enableSemanticSimilarity: true,
			...config?.similarity,
		}

		this.agingConfig = {
			highPriorityHalfLife: 7 * 24 * 60 * 60 * 1000, // 7天
			mediumPriorityHalfLife: 3 * 24 * 60 * 60 * 1000, // 3天
			lowPriorityHalfLife: 24 * 60 * 60 * 1000, // 1天
			enableAutoAging: true,
			...config?.aging,
		}
	}

	/**
	 * 从消息中提取记忆
	 */
	async extractMemories(messages: ApiMessage[]): Promise<MemoryExtractionResult> {
		const newMemories: MemoryEntry[] = []
		let scannedCount = 0

		// 只处理新消息
		for (let i = this.lastExtractedIndex; i < messages.length; i++) {
			const message = messages[i]
			scannedCount++

			// 跳过助手的长回复（通常不包含用户指令）
			if (message.role === "assistant") {
				continue
			}

			const extractedMemories = await this.extractMemoriesFromMessage(message, i)

			// 去重和合并
			for (const memory of extractedMemories) {
				const duplicate = this.findDuplicateMemory(memory)
				if (duplicate) {
					// 合并记忆
					this.mergeMemories(duplicate, memory)
				} else {
					this.memories.set(memory.id, memory)
					newMemories.push(memory)
				}
			}
		}

		this.lastExtractedIndex = messages.length

		return {
			memories: newMemories,
			scannedMessages: scannedCount,
			newMemoriesCount: newMemories.length,
		}
	}

	/**
	 * 从单条消息中提取记忆
	 */
	private async extractMemoriesFromMessage(message: ApiMessage, index: number): Promise<MemoryEntry[]> {
		const memories: MemoryEntry[] = []
		const content =
			typeof message.content === "string"
				? message.content
				: message.content.map((block) => (block.type === "text" ? block.text : "")).join(" ")

		const contentLower = content.toLowerCase()

		// 1. 检测显式指令
		const instructionPatterns = [
			/(?:必须|一定要|务必|记住|注意|重要|关键)\s*[:：]?\s*(.{10,200})/gi,
			/(?:require|must|need to|important|critical|remember|note)\s*[:：]?\s*(.{10,200})/gi,
		]

		for (const pattern of instructionPatterns) {
			const matches = content.matchAll(pattern)
			for (const match of matches) {
				memories.push(
					this.createMemory({
						type: MemoryType.USER_INSTRUCTION,
						priority: MemoryPriority.CRITICAL,
						content: match[0].trim(),
						messageIndex: index,
					}),
				)
			}
		}

		// 2. 检测文件路径和技术栈
		const filePathPattern = /(?:in|at|file|文件|路径)\s*[:：]?\s*((?:\.?\.?\/)?[\w\-\/\\\.]+\.\w+)/gi
		const fileMatches = content.matchAll(filePathPattern)
		const relatedFiles: string[] = []
		for (const match of fileMatches) {
			relatedFiles.push(match[1])
		}

		const techStackPattern =
			/\b(react|vue|angular|express|fastapi|django|postgresql|mongodb|redis|jwt|oauth|graphql|rest\s*api|typescript|javascript|python|java|go|rust)\b/gi
		const techMatches = content.matchAll(techStackPattern)
		const relatedTech: string[] = []
		for (const match of techMatches) {
			relatedTech.push(match[1].toLowerCase())
		}

		// 3. 检测技术决策关键词
		const techDecisions = [
			{ pattern: /(?:use|使用|采用)\s+(postgresql|redis|mongodb|mysql|jwt|oauth)/gi, type: "auth/db" },
			{
				pattern: /(?:port|端口)\s*(?:is|为|设置为|change\s+to|to)?\s*(\d{2,5})/gi,
				type: "configuration",
			},
			{
				pattern:
					/(?:theme|主题|color|颜色|style|样式)\s*(?:is|为|设置为|change to)?\s*([a-zA-Z]+|#[0-9a-fA-F]{3,6})/gi,
				type: "styling",
			},
		]

		for (const { pattern, type: techType } of techDecisions) {
			const matches = content.matchAll(pattern)
			for (const match of matches) {
				memories.push(
					this.createMemory({
						type: MemoryType.TECHNICAL_DECISION,
						priority: MemoryPriority.HIGH,
						content: match[0].trim(),
						messageIndex: index,
						tags: [techType],
					}),
				)
			}
		}

		// 4. 为提取的记忆添加文件和技术栈关联
		if (relatedFiles.length > 0 || relatedTech.length > 0) {
			for (const memory of memories) {
				if (relatedFiles.length > 0) {
					memory.relatedFiles = [...new Set([...(memory.relatedFiles || []), ...relatedFiles])]
				}
				if (relatedTech.length > 0) {
					memory.relatedTech = [...new Set([...(memory.relatedTech || []), ...relatedTech])]
				}
			}
		}

		// 5. 检测配置变更指令（简短但关键）
		if (message.role === "user" && content.length < 100) {
			const configPatterns = [
				/(?:change|改|修改|update|switch)\s+(?:.*?\s+)?(?:to|为|成)\s+(.+)/gi,
				/(?:all|所有|全部)\s+(.+?)\s+(?:need|需要|must|应该)/gi,
			]

			for (const pattern of configPatterns) {
				const matches = content.matchAll(pattern)
				for (const match of matches) {
					const matchedContent = match[0].trim()
					// 避免重复
					if (!memories.some((m) => m.content === matchedContent)) {
						memories.push(
							this.createMemory({
								type: MemoryType.CONFIGURATION,
								priority: MemoryPriority.HIGH,
								content: matchedContent,
								messageIndex: index,
							}),
						)
					}
				}
			}
		}

		// 6. 检测API端点和URL
		const apiPattern = /(https?:\/\/[^\s]+|\/api\/[\w\-\/]+|localhost:\d+)/gi
		const apiMatches = content.matchAll(apiPattern)
		for (const match of apiMatches) {
			memories.push(
				this.createMemory({
					type: MemoryType.CONFIGURATION,
					priority: MemoryPriority.HIGH,
					content: `API端点: ${match[0]}`,
					messageIndex: index,
					tags: ["api", "endpoint"],
				}),
			)
		}

		// 7. 检测错误和问题
		if (contentLower.includes("error") || contentLower.includes("错误") || contentLower.includes("问题")) {
			// 只保存简短的错误描述
			if (content.length < 300) {
				memories.push(
					this.createMemory({
						type: MemoryType.IMPORTANT_ERROR,
						priority: MemoryPriority.MEDIUM,
						content: content.trim(),
						messageIndex: index,
					}),
				)
			}
		}

		return memories
	}

	/**
	 * 创建记忆条目
	 */
	private createMemory(
		partial: Omit<MemoryEntry, "id" | "createdAt" | "lastAccessedAt" | "accessCount">,
	): MemoryEntry {
		const now = Date.now()
		return {
			...partial,
			id: `${this.taskId}-${now}-${Math.random().toString(36).substr(2, 9)}`,
			createdAt: now,
			lastAccessedAt: now,
			accessCount: 0,
		}
	}

	/**
	 * 查找重复的记忆
	 */
	private findDuplicateMemory(newMemory: MemoryEntry): MemoryEntry | null {
		for (const existingMemory of this.memories.values()) {
			// 类型必须相同
			if (existingMemory.type !== newMemory.type) {
				continue
			}

			// 计算文本相似度
			const similarity = this.calculateTextSimilarity(existingMemory.content, newMemory.content)

			if (similarity >= this.similarityConfig.threshold) {
				return existingMemory
			}
		}
		return null
	}

	/**
	 * 计算两个文本
	/**
	 * 计算两个文本的相似度（Jaccard相似度）
	 */
	private calculateTextSimilarity(text1: string, text2: string): number {
		const words1 = new Set(text1.toLowerCase().split(/\s+/))
		const words2 = new Set(text2.toLowerCase().split(/\s+/))

		const intersection = new Set([...words1].filter((word) => words2.has(word)))
		const union = new Set([...words1, ...words2])

		return intersection.size / union.size
	}

	/**
	 * 合并两个记忆
	 */
	private mergeMemories(existing: MemoryEntry, incoming: MemoryEntry): void {
		// 更新访问时间
		existing.lastAccessedAt = Date.now()
		existing.accessCount++

		// 如果新记忆优先级更高，升级现有记忆
		const priorityOrder = [MemoryPriority.LOW, MemoryPriority.MEDIUM, MemoryPriority.HIGH, MemoryPriority.CRITICAL]
		if (priorityOrder.indexOf(incoming.priority) > priorityOrder.indexOf(existing.priority)) {
			existing.priority = incoming.priority
		}

		// 合并标签
		if (incoming.tags) {
			existing.tags = [...new Set([...(existing.tags || []), ...incoming.tags])]
		}

		// 合并文件关联
		if (incoming.relatedFiles) {
			existing.relatedFiles = [...new Set([...(existing.relatedFiles || []), ...incoming.relatedFiles])]
		}

		// 合并技术栈关联
		if (incoming.relatedTech) {
			existing.relatedTech = [...new Set([...(existing.relatedTech || []), ...incoming.relatedTech])]
		}

		// 如果新内容更长或更详细，更新内容
		if (incoming.content.length > existing.content.length) {
			existing.content = incoming.content
		}
	}

	/**
	 * 应用记忆老化机制
	 */
	private applyMemoryAging(): void {
		if (!this.agingConfig.enableAutoAging) {
			return
		}

		const now = Date.now()
		const priorityOrder = [MemoryPriority.LOW, MemoryPriority.MEDIUM, MemoryPriority.HIGH, MemoryPriority.CRITICAL]

		for (const memory of this.memories.values()) {
			// 跳过关键记忆
			if (memory.priority === MemoryPriority.CRITICAL) {
				continue
			}

			// 计算记忆年龄
			const age = now - memory.lastAccessedAt
			let halfLife: number

			switch (memory.priority) {
				case MemoryPriority.HIGH:
					halfLife = this.agingConfig.highPriorityHalfLife
					break
				case MemoryPriority.MEDIUM:
					halfLife = this.agingConfig.mediumPriorityHalfLife
					break
				case MemoryPriority.LOW:
					halfLife = this.agingConfig.lowPriorityHalfLife
					break
				default:
					continue
			}

			// 如果年龄超过半衰期，降级优先级
			if (age > halfLife) {
				const currentIndex = priorityOrder.indexOf(memory.priority)
				if (currentIndex > 0) {
					memory.priority = priorityOrder[currentIndex - 1]
				}
			}
		}
	}

	/**
	 * 获取所有记忆
	 */
	getAllMemories(): MemoryEntry[] {
		return Array.from(this.memories.values())
	}

	/**
	 * 获取关键记忆
	 */
	getCriticalMemories(): MemoryEntry[] {
		return this.getAllMemories().filter((m) => m.priority === MemoryPriority.CRITICAL)
	}

	/**
	 * 根据优先级获取记忆
	 */
	getMemoriesByPriority(priority: MemoryPriority): MemoryEntry[] {
		return this.getAllMemories().filter((m) => m.priority === priority)
	}

	/**
	 * 根据类型获取记忆
	 */
	getMemoriesByType(type: MemoryType): MemoryEntry[] {
		return this.getAllMemories().filter((m) => m.type === type)
	}

	/**
	 * 记录记忆访问
	 */
	recordMemoryAccess(memoryId: string): void {
		const memory = this.memories.get(memoryId)
		if (memory) {
			memory.lastAccessedAt = Date.now()
			memory.accessCount++
		}
	}

	/**
	 * 生成记忆摘要（智能分组）
	 */
	generateMemorySummary(): string {
		// 先应用老化机制
		this.applyMemoryAging()

		const criticalMemories = this.getCriticalMemories()
		const highPriorityMemories = this.getMemoriesByPriority(MemoryPriority.HIGH)

		if (criticalMemories.length === 0 && highPriorityMemories.length === 0) {
			return ""
		}

		const lines: string[] = ["## 重要上下文记忆", ""]

		// 按类型分组
		if (criticalMemories.length > 0) {
			lines.push("### 关键指令：")
			const grouped = this.groupMemoriesByType(criticalMemories)
			for (const [type, memories] of Object.entries(grouped)) {
				if (memories.length === 0) continue
				lines.push(`**${this.getMemoryTypeLabel(type as MemoryType)}**:`)
				for (const memory of memories) {
					lines.push(`  - ${memory.content}`)
				}
			}
			lines.push("")
		}

		if (highPriorityMemories.length > 0) {
			lines.push("### 重要决策：")
			const grouped = this.groupMemoriesByType(highPriorityMemories.slice(0, 15))
			for (const [type, memories] of Object.entries(grouped)) {
				if (memories.length === 0) continue
				for (const memory of memories.slice(0, 5)) {
					// 每种类型最多5条
					lines.push(`  - ${memory.content}`)
				}
			}
			lines.push("")
		}

		// 添加技术栈总结
		const techStack = this.getTechStackSummary()
		if (techStack) {
			lines.push("### 技术栈：")
			lines.push(techStack)
			lines.push("")
		}

		return lines.join("\n")
	}

	/**
	 * 按类型分组记忆
	 */
	private groupMemoriesByType(memories: MemoryEntry[]): Record<string, MemoryEntry[]> {
		const grouped: Record<string, MemoryEntry[]> = {}
		for (const memory of memories) {
			if (!grouped[memory.type]) {
				grouped[memory.type] = []
			}
			grouped[memory.type].push(memory)
		}
		return grouped
	}

	/**
	 * 获取技术栈摘要
	 */
	private getTechStackSummary(): string {
		const allTech = new Set<string>()
		for (const memory of this.memories.values()) {
			if (memory.relatedTech) {
				memory.relatedTech.forEach((tech) => allTech.add(tech))
			}
		}

		if (allTech.size === 0) {
			return ""
		}

		return Array.from(allTech).join(", ")
	}

	/**
	 * 获取记忆类型标签
	 */
	private getMemoryTypeLabel(type: MemoryType): string {
		const labels: Record<MemoryType, string> = {
			[MemoryType.USER_INSTRUCTION]: "用户指令",
			[MemoryType.TECHNICAL_DECISION]: "技术决策",
			[MemoryType.CONFIGURATION]: "配置",
			[MemoryType.IMPORTANT_ERROR]: "重要错误",
			[MemoryType.PROJECT_CONTEXT]: "项目上下文",
			[MemoryType.WORKFLOW_PATTERN]: "工作流程",
		}
		return labels[type] || type
	}

	/**
	 * 清除低优先级记忆
	 */
	pruneLowPriorityMemories(maxCount: number): void {
		const allMemories = this.getAllMemories()
		if (allMemories.length <= maxCount) {
			return
		}

		// 按优先级和访问时间排序
		const sorted = allMemories.sort((a, b) => {
			// 优先级权重
			const priorityWeight: Record<MemoryPriority, number> = {
				[MemoryPriority.CRITICAL]: 1000,
				[MemoryPriority.HIGH]: 100,
				[MemoryPriority.MEDIUM]: 10,
				[MemoryPriority.LOW]: 1,
			}

			const scoreA = priorityWeight[a.priority] + a.accessCount
			const scoreB = priorityWeight[b.priority] + b.accessCount

			return scoreB - scoreA
		})

		// 保留前 maxCount 个，删除其余
		const toKeep = new Set(sorted.slice(0, maxCount).map((m) => m.id))
		for (const [id] of this.memories.entries()) {
			if (!toKeep.has(id)) {
				this.memories.delete(id)
			}
		}
	}

	/**
	 * 获取记忆统计
	 */
	getMemoryStats(): MemoryStats {
		const allMemories = this.getAllMemories()

		const byType: Record<MemoryType, number> = {
			[MemoryType.USER_INSTRUCTION]: 0,
			[MemoryType.TECHNICAL_DECISION]: 0,
			[MemoryType.CONFIGURATION]: 0,
			[MemoryType.IMPORTANT_ERROR]: 0,
			[MemoryType.PROJECT_CONTEXT]: 0,
			[MemoryType.WORKFLOW_PATTERN]: 0,
		}

		const byPriority: Record<MemoryPriority, number> = {
			[MemoryPriority.CRITICAL]: 0,
			[MemoryPriority.HIGH]: 0,
			[MemoryPriority.MEDIUM]: 0,
			[MemoryPriority.LOW]: 0,
		}

		let pendingMemories = 0
		const now = Date.now()
		const recentThreshold = 5 * 60 * 1000 // 5分钟内的记忆算作待处理

		for (const memory of allMemories) {
			byType[memory.type]++
			byPriority[memory.priority]++

			if (now - memory.createdAt < recentThreshold && memory.accessCount === 0) {
				pendingMemories++
			}
		}

		return {
			totalMemories: allMemories.length,
			byType,
			byPriority,
			pendingMemories,
			persistedMemories: allMemories.length, // 目前所有记忆都在内存中
		}
	}

	/**
	 * 序列化记忆用于持久化
	 */
	serialize(): string {
		const memories = this.getAllMemories()
		return JSON.stringify({
			taskId: this.taskId,
			memories,
			lastExtractedIndex: this.lastExtractedIndex,
		})
	}

	/**
	 * 从序列化数据恢复
	 */
	static deserialize(data: string): ConversationMemory {
		const parsed = JSON.parse(data)
		const memory = new ConversationMemory(parsed.taskId)

		for (const m of parsed.memories) {
			memory.memories.set(m.id, m)
		}

		memory.lastExtractedIndex = parsed.lastExtractedIndex || 0
		return memory
	}

	/**
	 * 清理资源（目前为空实现，保留用于未来扩展）
	 */
	async dispose(): Promise<void> {
		// 清理内存中的记忆数据
		this.memories.clear()
		this.lastExtractedIndex = 0
	}
}
