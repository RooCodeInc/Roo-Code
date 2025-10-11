import { ApiMessage } from "../task-persistence/apiMessages"

export interface MessageImportanceScore {
	message: ApiMessage
	score: number
	reasons: string[]
	isUserMessage: boolean
	tokenCount: number
	/** 标记为记忆相关（类似 Augment 的 isMemoryRelated） */
	isMemoryRelated?: boolean
	/** 记忆类型标签 */
	memoryTags?: string[]
}

/**
 * 评估消息的重要性
 * 分数范围：0-100
 * - 90-100: 极其重要（必须保留）
 * - 70-89:  重要（优先保留）
 * - 40-69:  中等（可以压缩）
 * - 0-39:   不重要（可以删除）
 */
export function calculateMessageImportance(
	message: ApiMessage,
	index: number,
	totalMessages: number,
	tokenCount: number,
): MessageImportanceScore {
	let score = 50 // 基础分数
	const reasons: string[] = []

	const content =
		typeof message.content === "string"
			? message.content
			: message.content.map((block) => (block.type === "text" ? block.text : "")).join(" ")

	const contentLower = content.toLowerCase()

	// ===== 角色权重 =====
	if (message.role === "user") {
		score += 20
		reasons.push("User message (+20)")
	}

	// ===== 位置权重 =====
	if (index === 0) {
		score += 30
		reasons.push("First message (+30)")
	} else if (index >= totalMessages - 3) {
		score += 25
		reasons.push("Recent message (+25)")
	} else if (index < 5) {
		score += 10
		reasons.push("Early message (+10)")
	}

	// ===== 内容分析 =====

	// 1. 指令性关键词（高优先级）
	const commandKeywords = [
		// 需求关键词
		"必须",
		"一定要",
		"务必",
		"require",
		"must",
		"need to",
		"important",
		"critical",
		"essential",
		// 修改关键词
		"改为",
		"改成",
		"修改",
		"change to",
		"update to",
		"switch to",
		// 全局关键词
		"所有",
		"全部",
		"都要",
		"all",
		"every",
		"always",
		// 配置关键词
		"使用",
		"采用",
		"选择",
		"use",
		"with",
		"using",
	]

	for (const keyword of commandKeywords) {
		if (contentLower.includes(keyword)) {
			score += 15
			reasons.push(`Command keyword '${keyword}' (+15)`)
			break // 只加一次
		}
	}

	// 2. 技术决策关键词
	const technicalKeywords = [
		// 技术栈
		"postgresql",
		"redis",
		"mongodb",
		"mysql",
		"react",
		"vue",
		"angular",
		"typescript",
		"python",
		"java",
		// 架构
		"architecture",
		"design pattern",
		"microservice",
		"api",
		"rest",
		"graphql",
		// 配置
		"port",
		"端口",
		"database",
		"数据库",
		"authentication",
		"认证",
		"authorization",
		"授权",
	]

	let technicalCount = 0
	for (const keyword of technicalKeywords) {
		if (contentLower.includes(keyword)) {
			technicalCount++
		}
	}

	if (technicalCount > 0) {
		const techScore = Math.min(technicalCount * 5, 20)
		score += techScore
		reasons.push(`Technical decisions (${technicalCount} keywords, +${techScore})`)
	}

	// 3. 错误和问题
	const errorKeywords = ["error", "错误", "bug", "问题", "失败", "failed", "不工作", "not working", "doesn't work"]

	for (const keyword of errorKeywords) {
		if (contentLower.includes(keyword)) {
			score += 10
			reasons.push(`Error/problem mention (+10)`)
			break
		}
	}

	// 4. 代码块存在
	if (content.includes("```")) {
		score += 10
		reasons.push("Contains code block (+10)")
	}

	// ===== 长度权重 =====

	// 非常短的用户消息通常是关键指令
	if (message.role === "user" && tokenCount < 20) {
		score += 15
		reasons.push("Short user command (+15)")
	}

	// 中等长度的用户消息
	if (message.role === "user" && tokenCount >= 20 && tokenCount < 100) {
		score += 10
		reasons.push("Medium user message (+10)")
	}

	// 非常长的消息（可能是冗长的输出）
	if (tokenCount > 5000) {
		score -= 10
		reasons.push("Very long message (-10)")
	}

	// ===== 特殊消息类型 =====

	// 摘要消息
	if (message.isSummary) {
		score += 25
		reasons.push("Summary message (+25)")
	}

	// 工具使用确认等低价值内容
	const lowValuePatterns = [/^(好的|ok|sure|yes|understood)/i, /^(继续|continue|proceeding)/i]

	for (const pattern of lowValuePatterns) {
		if (pattern.test(content.trim())) {
			score -= 10
			reasons.push("Low-value acknowledgment (-10)")
			break
		}
	}

	// 确保分数在0-100范围内
	score = Math.max(0, Math.min(100, score))

	// ===== 记忆相关标记（参考 Augment 的 isMemoryRelated） =====
	const isMemoryRelated = checkIfMemoryRelated(message, content, score)
	const memoryTags = extractMemoryTags(content)

	return {
		message,
		score,
		reasons,
		isUserMessage: message.role === "user",
		tokenCount,
		isMemoryRelated,
		memoryTags: memoryTags.length > 0 ? memoryTags : undefined,
	}
}

/**
 * 检查消息是否与记忆相关（类似 Augment 的 isMemoryRelated 函数）
 *
 * 在 Augment 中，isMemoryRelated 检查：
 * 1. 节点类型是否为 AGENT_MEMORY
 * 2. 工具调用是否为 'remember'
 *
 * 在我们的系统中，我们检查：
 * 1. 用户消息中包含关键指令模式
 * 2. 消息重要性评分高
 * 3. 包含配置或技术决策关键词
 */
function checkIfMemoryRelated(message: ApiMessage, content: string, score: number): boolean {
	// 1. 高分消息通常是重要的
	if (score >= 80) {
		return true
	}

	// 2. 摘要消息始终是记忆相关的
	if (message.isSummary) {
		return true
	}

	// 3. 用户消息中包含显式记忆关键词
	if (message.role === "user") {
		const memoryKeywords = [
			/(?:记住|remember|note|重要|important|关键|critical|必须|must)/i,
			/(?:所有|all|每个|every|总是|always)\s+.{5,50}\s+(?:需要|need|应该|should|必须|must)/i,
			/(?:使用|use|采用|with)\s+(?:postgresql|redis|mongodb|mysql|jwt|oauth|port\s+\d+)/i,
		]

		for (const pattern of memoryKeywords) {
			if (pattern.test(content)) {
				return true
			}
		}
	}

	return false
}

/**
 * 提取记忆标签
 */
function extractMemoryTags(content: string): string[] {
	const tags: string[] = []
	const contentLower = content.toLowerCase()

	// 技术栈标签
	const techStack = ["postgresql", "redis", "mongodb", "mysql", "react", "vue", "typescript", "python"]
	for (const tech of techStack) {
		if (contentLower.includes(tech)) {
			tags.push(tech)
		}
	}

	// 配置类标签
	if (/port|端口/.test(contentLower)) {
		tags.push("configuration:port")
	}
	if (/database|数据库/.test(contentLower)) {
		tags.push("configuration:database")
	}
	if (/auth|认证|authorization|授权/.test(contentLower)) {
		tags.push("configuration:auth")
	}

	return tags
}

/**
 * 为所有消息计算重要性分数
 */
export async function scoreAllMessages(
	messages: ApiMessage[],
	countTokens: (content: any) => Promise<number>,
): Promise<MessageImportanceScore[]> {
	const scores: MessageImportanceScore[] = []

	for (let i = 0; i < messages.length; i++) {
		const message = messages[i]
		const content =
			typeof message.content === "string" ? [{ type: "text" as const, text: message.content }] : message.content

		const tokenCount = await countTokens(content)

		const scoreResult = calculateMessageImportance(message, i, messages.length, tokenCount)

		scores.push(scoreResult)
	}

	return scores
}
