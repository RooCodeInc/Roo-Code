import { Anthropic } from "@anthropic-ai/sdk"
import * as vscode from "vscode"

import { ProviderSettings } from "@roo-code/types"
import { buildApiHandler, ApiHandler } from "../../api"

import { JudgeConfig, TaskContext, JudgeResult, JudgeResponseJson } from "./types"
import { buildJudgePrompt } from "./prompts"

/**
 * 裁判服务
 * 负责调用独立的模型来判断任务是否真正完成
 */
export class JudgeService {
	private config: JudgeConfig
	private apiHandler?: ApiHandler
	private context: vscode.ExtensionContext

	constructor(config: JudgeConfig, context: vscode.ExtensionContext) {
		this.config = config
		this.context = context

		// 如果有独立模型配置，创建专用的 ApiHandler
		if (config.modelConfig) {
			try {
				this.apiHandler = buildApiHandler(config.modelConfig)
			} catch (error) {
				console.error("[JudgeService] Failed to build API handler:", error)
				// 不抛出错误，允许回退到主模型
			}
		}
	}

	/**
	 * 判断任务是否真正完成
	 */
	async judgeCompletion(taskContext: TaskContext, attemptResult: string): Promise<JudgeResult> {
		try {
			// 构建裁判提示词
			const judgePrompt = buildJudgePrompt(taskContext, attemptResult, this.config.detailLevel)

			// 调用裁判模型
			const response = await this.callJudgeModel(judgePrompt)

			// 解析裁判结果
			return this.parseJudgeResponse(response)
		} catch (error) {
			console.error("[JudgeService] Error during judgment:", error)
			// 如果裁判失败，返回一个默认的批准结果，避免阻塞用户
			return {
				approved: true,
				reasoning: `裁判服务遇到错误，默认批准任务完成。错误信息: ${error instanceof Error ? error.message : String(error)}`,
				missingItems: [],
				suggestions: ["建议检查裁判服务配置"],
			}
		}
	}

	/**
	 * 调用裁判模型
	 */
	private async callJudgeModel(prompt: string): Promise<string> {
		if (!this.apiHandler) {
			throw new Error("No API handler available for judge service")
		}

		// 构建消息
		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: prompt,
			},
		]

		// 调用 API
		const stream = this.apiHandler.createMessage("You are a task completion judge.", messages, {
			taskId: "judge-task",
			mode: "judge",
		})

		// 收集流式响应
		let fullResponse = ""
		for await (const chunk of stream) {
			if (chunk.type === "text") {
				fullResponse += chunk.text
			}
		}

		return fullResponse
	}

	/**
	 * 解析裁判响应
	 */
	private parseJudgeResponse(response: string): JudgeResult {
		try {
			// 尝试提取 JSON 内容
			const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || response.match(/\{[\s\S]*\}/)

			if (!jsonMatch) {
				// 如果没有找到 JSON，尝试 Markdown 格式解析
				return this.parseMarkdownResponse(response)
			}

			const jsonStr = jsonMatch[1] || jsonMatch[0]
			const parsed: JudgeResponseJson = JSON.parse(jsonStr)

			return {
				approved: parsed.approved ?? false,
				reasoning: parsed.reasoning || "未提供理由",
				completenessScore: parsed.completeness_score,
				correctnessScore: parsed.correctness_score,
				qualityScore: parsed.quality_score,
				overallScore: parsed.overall_score,
				missingItems: parsed.missingItems || [],
				suggestions: parsed.suggestions || [],
				criticalIssues: parsed.criticalIssues,
			}
		} catch (error) {
			console.error("[JudgeService] Failed to parse judge response as JSON:", error)
			console.error("[JudgeService] Response was:", response)

			// 回退到 Markdown 格式解析
			return this.parseMarkdownResponse(response)
		}
	}

	/**
	 * 解析 Markdown 格式的裁判响应
	 * 支持类似以下格式：
	 * " Judge Approval
	 * Decision: Task completion approved
	 * Reasoning: ...
	 * Optional Suggestions for Future Improvements:
	 * ..."
	 */
	private parseMarkdownResponse(response: string): JudgeResult {
		// 判断是否批准
		let approved = false
		const decisionMatch = response.match(/Decision:\s*(.+?)(?:\n|$)/i)
		if (decisionMatch) {
			const decision = decisionMatch[1].toLowerCase()
			approved = decision.includes("approved") || decision.includes("批准")
		} else {
			// 如果没有明确的 Decision 字段，尝试从整体文本判断
			const lowerResponse = response.toLowerCase()
			approved =
				lowerResponse.includes("approved") ||
				lowerResponse.includes("批准") ||
				lowerResponse.includes("task completion approved") ||
				(!lowerResponse.includes("rejected") && !lowerResponse.includes("拒绝"))
		}

		// 提取理由
		let reasoning = ""
		const reasoningMatch = response.match(
			/Reasoning:\s*([\s\S]*?)(?:\n\n|\n(?:Optional Suggestions|Overall Score|$))/i,
		)
		if (reasoningMatch) {
			reasoning = reasoningMatch[1].trim()
		} else {
			// 如果没有明确的 Reasoning 字段，使用整个响应作为理由
			reasoning = response.trim()
		}

		// 提取评分
		let overallScore: number | undefined
		const scoreMatch = response.match(/Overall Score:\s*(\d+)\/10/i)
		if (scoreMatch) {
			overallScore = parseInt(scoreMatch[1], 10)
		}

		// 提取建议列表
		const suggestions: string[] = []
		const suggestionsSection = response.match(
			/(?:Optional Suggestions for Future Improvements|Suggestions):\s*([\s\S]*?)(?:\n\n|$)/i,
		)
		if (suggestionsSection) {
			// 提取编号列表项
			const suggestionMatches = suggestionsSection[1].matchAll(/(?:\d+\.|[-*])\s*(.+?)(?:\n|$)/g)
			for (const match of suggestionMatches) {
				const suggestion = match[1].trim()
				if (suggestion) {
					suggestions.push(suggestion)
				}
			}
		}

		// 提取缺失项
		const missingItems: string[] = []
		const missingSection = response.match(/(?:Missing Items|缺失项):\s*([\s\S]*?)(?:\n\n|$)/i)
		if (missingSection) {
			const missingMatches = missingSection[1].matchAll(/(?:\d+\.|[-*])\s*(.+?)(?:\n|$)/g)
			for (const match of missingMatches) {
				const item = match[1].trim()
				if (item) {
					missingItems.push(item)
				}
			}
		}

		console.log("[JudgeService] Parsed Markdown response:", {
			approved,
			reasoning: reasoning.substring(0, 100) + "...",
			overallScore,
			suggestionsCount: suggestions.length,
			missingItemsCount: missingItems.length,
		})

		return {
			approved,
			reasoning: reasoning || "未提供详细理由",
			overallScore,
			missingItems,
			suggestions,
		}
	}

	/**
	 * 更新配置
	 */
	updateConfig(config: JudgeConfig) {
		this.config = config

		// 如果模型配置改变，重新创建 ApiHandler
		if (config.modelConfig) {
			try {
				this.apiHandler = buildApiHandler(config.modelConfig)
			} catch (error) {
				console.error("[JudgeService] Failed to update API handler:", error)
			}
		} else {
			this.apiHandler = undefined
		}
	}

	/**
	 * 设置 API Handler（用于从外部注入）
	 */
	setApiHandler(handler: ApiHandler) {
		this.apiHandler = handler
	}

	/**
	 * 获取当前配置
	 */
	getConfig(): JudgeConfig {
		return { ...this.config }
	}
}
