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
				throw new Error("No JSON found in response")
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
			console.error("[JudgeService] Failed to parse judge response:", error)
			console.error("[JudgeService] Response was:", response)

			// 回退解析：尝试从文本中提取关键信息
			return this.fallbackParsing(response)
		}
	}

	/**
	 * 回退解析：当 JSON 解析失败时使用
	 */
	private fallbackParsing(response: string): JudgeResult {
		// 尝试通过关键词判断是否批准
		const lowerResponse = response.toLowerCase()
		const approved =
			lowerResponse.includes('"approved": true') ||
			lowerResponse.includes("approved") ||
			(!lowerResponse.includes("not complete") && !lowerResponse.includes("incomplete"))

		// 尝试提取理由
		let reasoning = "无法解析裁判响应"
		const reasoningMatch = response.match(/"reasoning":\s*"([^"]+)"/)
		if (reasoningMatch) {
			reasoning = reasoningMatch[1]
		} else {
			// 使用整个响应的前200个字符作为理由
			reasoning = response.substring(0, 200) + (response.length > 200 ? "..." : "")
		}

		return {
			approved,
			reasoning,
			missingItems: [],
			suggestions: ["裁判响应格式不正确，建议手动检查"],
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
