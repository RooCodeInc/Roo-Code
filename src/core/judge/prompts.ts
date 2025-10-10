import { TaskContext, JudgeDetailLevel } from "./types"

/**
 * 构建裁判提示词
 */
export function buildJudgePrompt(
	taskContext: TaskContext,
	attemptResult: string,
	detailLevel: JudgeDetailLevel,
): string {
	const { originalTask, conversationHistory, toolCalls, fileChanges, currentMode } = taskContext

	// 提取对话历史的摘要
	const conversationSummary = summarizeConversationHistory(conversationHistory)

	// 提取工具调用摘要
	const toolCallsSummary = summarizeToolCalls(toolCalls)

	// 提取文件修改摘要
	const fileChangesSummary = summarizeFileChanges(fileChanges)

	const detailInstructions =
		detailLevel === "detailed"
			? `请提供详细的判断理由，逐项检查并提供改进建议。`
			: `请提供简洁的判断理由，只指出主要问题。`

	return `你是一个严格的任务审查员（Judge）。请根据以下信息判断任务是否真正完成。

## 原始任务

${originalTask}

## 当前模式

${currentMode}

## 执行历史摘要

### 对话轮数
${conversationSummary.rounds} 轮对话

### 工具调用
${toolCallsSummary}

### 文件修改
${fileChangesSummary}

## 模型声称的完成结果

${attemptResult}

## 评判标准

请根据以下标准逐项评估：

### 1. 完整性 (Completeness)
- 原始任务的所有要求是否都被满足？
- 是否有明显的遗漏？
- 所有提到的功能是否都已实现？

### 2. 正确性 (Correctness)
- 实现是否正确无误？
- 是否有明显的逻辑错误或bug？
- 代码是否能正常运行？

### 3. 质量 (Quality)
- 代码质量是否符合基本标准？
- 是否有测试覆盖（如果要求）？
- 是否有适当的错误处理？
- 是否遵循了最佳实践？

### 4. 文档 (Documentation)
- 是否有必要的注释和文档？
- 是否更新了相关的 README 或文档文件（如果需要）？

### 5. 特殊要求 (Special Requirements)
- 用户的任何特殊要求是否被遵守？
- 是否遵循了项目的编码规范？

## 输出格式

${detailInstructions}

请以 JSON 格式回复，结构如下（请确保返回有效的JSON，不要包含任何其他文本）：

\`\`\`json
{
  "approved": false,
  "reasoning": "详细的判断理由，说明为什么批准或拒绝",
  "completeness_score": 7,
  "correctness_score": 8,
  "quality_score": 6,
  "overall_score": 7,
  "missingItems": ["缺少单元测试", "README 未更新", "错误处理不完整"],
  "suggestions": [
    "添加至少3个单元测试覆盖核心功能",
    "更新 README.md 中的使用说明",
    "在 API 调用处添加 try-catch 错误处理"
  ],
  "criticalIssues": ["可能存在内存泄漏风险"]
}
\`\`\`

## 注意事项

1. 如果任务基本完成但有小问题，可以批准并在 suggestions 中提出改进建议
2. 如果有严重问题或明显遗漏，必须拒绝（approved: false）
3. 不要过于吹毛求疵，关注核心要求
4. 提供可操作的具体建议，而非笼统的评价
5. 评分范围为 0-10，其中：
   - 0-3: 严重不足
   - 4-6: 有明显问题
   - 7-8: 基本合格但有改进空间
   - 9-10: 优秀

请现在开始评判。`
}

/**
 * 总结对话历史
 */
function summarizeConversationHistory(conversationHistory: ClineMessage[]): {
	rounds: number
	summary: string
} {
	const rounds = conversationHistory.length
	return {
		rounds,
		summary: `共 ${rounds} 条消息`,
	}
}

/**
 * 总结工具调用
 */
function summarizeToolCalls(toolCalls: string[]): string {
	if (toolCalls.length === 0) {
		return "无工具调用"
	}

	// 统计不同类型的工具调用
	const toolStats: Record<string, number> = {}
	for (const tool of toolCalls) {
		toolStats[tool] = (toolStats[tool] || 0) + 1
	}

	const lines = Object.entries(toolStats)
		.map(([tool, count]) => `- ${tool}: ${count} 次`)
		.join("\n")

	return `总计 ${toolCalls.length} 次工具调用：\n${lines}`
}

/**
 * 总结文件修改
 */
function summarizeFileChanges(fileChanges: string[]): string {
	if (fileChanges.length === 0) {
		return "无文件修改"
	}

	const lines = fileChanges.map((file) => `- ${file}`).join("\n")
	return `修改了 ${fileChanges.length} 个文件：\n${lines}`
}

/**
 * 构建简化的裁判提示词（用于快速检查）
 */
export function buildSimpleJudgePrompt(originalTask: string, attemptResult: string): string {
	return `你是一个任务审查员。请判断以下任务是否完成：

## 原始任务
${originalTask}

## 完成声明
${attemptResult}

请以JSON格式回复：
{
  "approved": true/false,
  "reasoning": "简短理由"
}

只需返回JSON，不要其他内容。`
}
