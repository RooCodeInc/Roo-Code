# 裁判判断格式解析修复

## 问题描述

用户报告在使用裁判模式时，遇到以下错误提示：

```
" Judge Approval
Decision: Task completion approved

Reasoning: 核心架构设计和实现已完成，完全符合原始任务的关键要求...

Optional Suggestions for Future Improvements:

裁判响应格式不正确，建议手动检查"
```

这导致系统无法正确解析裁判的判断结果，影响了任务的连续完成。

## 根本原因

1. **期望格式 vs 实际格式**

    - 裁判提示词（`src/core/judge/prompts.ts`）明确要求返回 JSON 格式
    - 但某些模型会返回 Markdown 格式的响应

2. **解析逻辑缺陷**
    - `parseJudgeResponse` 方法只能处理 JSON 格式
    - `fallbackParsing` 方法的回退逻辑不完善，无法正确解析 Markdown 格式
    - 当解析失败时，会添加误导性的建议："裁判响应格式不正确，建议手动检查"

## 解决方案

### 1. 改进解析逻辑

修改 `src/core/judge/JudgeService.ts` 中的 `parseJudgeResponse` 方法：

````typescript
private parseJudgeResponse(response: string): JudgeResult {
    try {
        // 尝试提取 JSON 内容
        const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || response.match(/\{[\s\S]*\}/)

        if (!jsonMatch) {
            // 如果没有找到 JSON，尝试 Markdown 格式解析
            return this.parseMarkdownResponse(response)
        }

        // JSON 解析逻辑...
    } catch (error) {
        // 回退到 Markdown 格式解析
        return this.parseMarkdownResponse(response)
    }
}
````

### 2. 新增 Markdown 解析方法

实现 `parseMarkdownResponse` 方法来处理 Markdown 格式的响应：

```typescript
private parseMarkdownResponse(response: string): JudgeResult {
    // 判断是否批准
    let approved = false
    const decisionMatch = response.match(/Decision:\s*(.+?)(?:\n|$)/i)
    if (decisionMatch) {
        const decision = decisionMatch[1].toLowerCase()
        approved = decision.includes("approved") || decision.includes("批准")
    }

    // 提取理由
    const reasoningMatch = response.match(/Reasoning:\s*([\s\S]*?)(?:\n\n|\n(?:Optional Suggestions|Overall Score|$))/i)
    let reasoning = reasoningMatch ? reasoningMatch[1].trim() : response.trim()

    // 提取评分
    const scoreMatch = response.match(/Overall Score:\s*(\d+)\/10/i)
    let overallScore = scoreMatch ? parseInt(scoreMatch[1], 10) : undefined

    // 提取建议列表
    const suggestions: string[] = []
    const suggestionsSection = response.match(/(?:Optional Suggestions for Future Improvements|Suggestions):\s*([\s\S]*?)(?:\n\n|$)/i)
    if (suggestionsSection) {
        const suggestionMatches = suggestionsSection[1].matchAll(/(?:\d+\.|[-*])\s*(.+?)(?:\n|$)/g)
        for (const match of suggestionMatches) {
            suggestions.push(match[1].trim())
        }
    }

    // 提取缺失项
    const missingItems: string[] = []
    const missingSection = response.match(/(?:Missing Items|缺失项):\s*([\s\S]*?)(?:\n\n|$)/i)
    if (missingSection) {
        const missingMatches = missingSection[1].matchAll(/(?:\d+\.|[-*])\s*(.+?)(?:\n|$)/g)
        for (const match of missingMatches) {
            missingItems.push(match[1].trim())
        }
    }

    return {
        approved,
        reasoning: reasoning || "未提供详细理由",
        overallScore,
        missingItems,
        suggestions,
    }
}
```

### 3. 支持的格式

修复后的解析器现在支持以下格式：

#### JSON 格式（推荐）

```json
{
	"approved": true,
	"reasoning": "任务已完成",
	"overall_score": 8,
	"suggestions": ["添加更多测试"]
}
```

#### Markdown 格式

```markdown
# Judge Approval

Decision: Task completion approved

Reasoning: 任务已完成，所有要求都已满足。

Overall Score: 8/10

Optional Suggestions for Future Improvements:

1. 添加更多单元测试
2. 完善错误处理
```

#### 纯文本格式（最基本）

```
Task completion approved. Everything looks good.
```

## 测试覆盖

在 `src/core/judge/__tests__/JudgeService.test.ts` 中添加了以下测试用例：

1. ✅ JSON 格式解析测试
2. ✅ Markdown 格式（带 Decision 和 Reasoning）解析测试
3. ✅ Markdown 格式拒绝场景测试
4. ✅ 无明确 Decision 字段的 Markdown 格式测试
5. ✅ 纯文本格式测试
6. ✅ 混合格式（JSON + Markdown）测试
7. ✅ 中文 Decision 字段测试

所有测试均已通过（24/24 通过）。

## 影响范围

- **文件修改**：`src/core/judge/JudgeService.ts`
- **测试修改**：`src/core/judge/__tests__/JudgeService.test.ts`
- **向后兼容性**：完全兼容，JSON 格式仍然是首选格式
- **用户体验**：消除了"裁判响应格式不正确"的误导性提示

## 验证方法

1. 启动带裁判模式的任务
2. 当裁判返回 Markdown 格式响应时，系统应能正确解析
3. 不再显示"建议手动检查"的错误提示
4. 任务可以连续完成，不会被错误解析阻塞

## 未来改进

1. 考虑在裁判提示词中更明确地要求返回纯 JSON，减少 Markdown 响应的情况
2. 可以添加配置选项让用户选择偏好的响应格式
3. 考虑支持更多的响应格式变体

## 相关文档

- [裁判模式需求文档](./12-judge-mode-requirements.md)
- [裁判模式 Bug 修复](./20-judge-mode-bug-fixes.md)
