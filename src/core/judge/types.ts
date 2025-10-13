import { ProviderSettings, ClineMessage } from "@roo-code/types"

/**
 * 裁判调用策略
 * - always: 每次 attempt_completion 都调用裁判
 * - ask: 询问用户是否调用裁判
 * - never: 从不调用裁判
 */
export type JudgeMode = "always" | "ask" | "never"

/**
 * 反馈详细程度
 * - concise: 简洁反馈
 * - detailed: 详细反馈
 */
export type JudgeDetailLevel = "concise" | "detailed"

/**
 * 裁判配置
 */
export interface JudgeConfig {
	/** 是否启用裁判模式 */
	enabled: boolean
	/** 裁判调用策略 */
	mode: JudgeMode
	/** 裁判使用的独立模型配置（可选，不配置则使用主模型） */
	modelConfig?: ProviderSettings
	/** 反馈详细程度 */
	detailLevel: JudgeDetailLevel
	/** 是否允许用户覆盖裁判判断 */
	allowUserOverride: boolean
	/** 当存在严重问题时，是否强制禁止用户覆盖（即使allowUserOverride为true） */
	blockOnCriticalIssues: boolean
}

/**
 * 默认裁判配置
 */
export const DEFAULT_JUDGE_CONFIG: JudgeConfig = {
	enabled: true,
	mode: "always",
	detailLevel: "detailed",
	allowUserOverride: true,
	blockOnCriticalIssues: true, // 默认启用严重问题强制拦截
}

/**
 * 任务上下文
 */
export interface TaskContext {
	/** 原始任务描述 */
	originalTask: string
	/** 对话历史 */
	conversationHistory: ClineMessage[]
	/** 工具调用记录 */
	toolCalls: string[]
	/** 文件修改记录 */
	fileChanges: string[]
	/** 当前模式 */
	currentMode: string
}

/**
 * 裁判结果
 */
export interface JudgeResult {
	/** 是否批准任务完成 */
	approved: boolean
	/** 判断理由 */
	reasoning: string
	/** 完整性评分 (0-10) */
	completenessScore?: number
	/** 正确性评分 (0-10) */
	correctnessScore?: number
	/** 质量评分 (0-10) */
	qualityScore?: number
	/** 总体评分 (0-10) */
	overallScore?: number
	/** 未完成项列表 */
	missingItems: string[]
	/** 改进建议列表 */
	suggestions: string[]
	/** 严重问题列表 - 如果有严重问题，将强制要求修复 */
	criticalIssues?: string[]
	/** 是否存在严重问题（由criticalIssues自动计算） */
	hasCriticalIssues: boolean
}

/**
 * 裁判响应的JSON格式
 */
export interface JudgeResponseJson {
	approved: boolean
	reasoning: string
	completeness_score?: number
	correctness_score?: number
	quality_score?: number
	overall_score?: number
	missingItems?: string[]
	suggestions?: string[]
	criticalIssues?: string[]
}
