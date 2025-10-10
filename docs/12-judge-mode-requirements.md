# 裁判模式（Judge Mode）需求分析与设计方案

## 文档信息

- **文档版本**: 1.0.0
- **创建日期**: 2025-10-10
- **适用版本**: Roo-Code 3.28+
- **状态**: 需求分析与设计阶段

---

## 1. 需求概述

### 1.1 用户原始需求

用户希望在现有模式系统基础上增加一个**裁判模式（Judge Mode）**，具有以下特性：

1. **基于 CODE 模式**：继承 Code 模式的所有能力（读、写、编辑、命令执行等）
2. **自动任务验证**：每次模型认为任务完成后，裁判会根据上下文判断任务是否真正完成
3. **自动继续对话**：如果裁判判断任务未完成，会指出未完成的部分，并让模型继续工作
4. **独立配置**：裁判模式可以在设置中使用单独的模型配置（与工作模式分离）

### 1.2 需求完善性分析

经过分析，原始需求存在以下需要明确的点：

#### ✅ 已明确的需求

- 裁判的触发时机：模型调用 `attempt_completion` 工具时
- 裁判的基础能力：基于 CODE 模式
- 裁判的独立配置：单独的 API 配置

#### ⚠️ 需要明确的需求

**A. 裁判模式的激活方式**

- **选项1**：作为一个独立模式，用户手动切换（如切换到 Architect、Code、Ask）
- **选项2**：作为一个全局开关，可以在任何模式下启用
- **选项3**：作为特定模式（如 Code 模式）的增强选项
- **推荐**：选项2（全局开关），更灵活且符合"裁判"的监督性质

**B. 裁判判断失败后的行为**

- **选项1**：自动拒绝 `attempt_completion`，将裁判的反馈作为新的用户消息继续对话
- **选项2**：询问用户是否接受裁判的判断（用户可以选择忽略）
- **选项3**：提供详细报告，但仍允许用户手动完成任务
- **推荐**：选项1（自动继续）+ 选项2（用户可以介入），提供最大的灵活性

**C. 裁判的评判标准**

- **当前上下文**：所有对话历史、工具调用记录、文件修改记录
- **评判维度**：
    1. 原始任务需求是否完全满足
    2. 是否有明显的遗漏或错误
    3. 代码质量是否符合基本标准（如有测试要求是否已完成）
    4. 用户的特殊要求是否被遵守
- **推荐**：使用结构化的评判提示词，确保裁判考虑所有关键维度

**D. 裁判成本控制**

- **问题**：裁判会增加额外的 API 调用成本
- **选项1**：每次 `attempt_completion` 都调用裁判
- **选项2**：用户可以配置裁判调用频率（如：总是、有时、从不）
- **选项3**：基于任务复杂度自动决定是否调用裁判
- **推荐**：选项2（用户控制）+ 提供成本估算

**E. 裁判模型的选择**

- **选项1**：必须与工作模型不同（避免盲点）
- **选项2**：可以使用相同或不同的模型
- **选项3**：推荐使用更强大的模型作为裁判（如 GPT-4、Claude Opus）
- **推荐**：选项2（允许相同），但 UI 提示推荐使用不同/更强模型

**F. 裁判反馈的详细程度**

- **选项1**：简洁反馈（仅指出主要问题）
- **选项2**：详细反馈（逐项检查并提供改进建议）
- **选项3**：可配置详细程度
- **推荐**：选项2（默认详细）+ 选项3（用户可调整）

---

## 2. 技术架构设计

### 2.1 系统架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                        User Input                            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                     Task Execution                           │
│                  (Current Mode: Code/Ask/etc)                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ Model calls attempt_completion
                         ▼
                 ┌───────────────┐
                 │  Judge Mode   │ ◄── If enabled
                 │   Enabled?    │
                 └───────┬───────┘
                         │
              ┌──────────┴──────────┐
              │                     │
           Yes│                     │No
              ▼                     ▼
    ┌──────────────────┐   ┌─────────────────┐
    │  Call Judge API  │   │  Accept Result  │
    │  (Separate Model)│   │  Complete Task  │
    └────────┬─────────┘   └─────────────────┘
             │
             │ Judge Response
             ▼
      ┌──────────────┐
      │  Is Complete?│
      └──────┬───────┘
             │
    ┌────────┴────────┐
    │                 │
Approved│             │Rejected
    ▼                 ▼
┌─────────┐   ┌──────────────────┐
│Complete │   │  Inject Feedback │
│  Task   │   │  Continue Dialog │
└─────────┘   └──────────────────┘
```

### 2.2 核心组件设计

#### A. JudgeMode 配置（新增）

**位置**：`src/core/judge/JudgeConfig.ts`

```typescript
export interface JudgeConfig {
	enabled: boolean // 是否启用裁判模式
	mode: "always" | "ask" | "never" // 裁判调用策略
	modelConfig?: ProviderSettings // 裁判使用的独立模型配置
	detailLevel: "concise" | "detailed" // 反馈详细程度
	allowUserOverride: boolean // 是否允许用户忽略裁判判断
}

export const DEFAULT_JUDGE_CONFIG: JudgeConfig = {
	enabled: false,
	mode: "always",
	detailLevel: "detailed",
	allowUserOverride: true,
}
```

#### B. JudgeService（新增核心服务）

**位置**：`src/core/judge/JudgeService.ts`

```typescript
export class JudgeService {
  private config: JudgeConfig
  private apiHandler?: ApiHandler  // 裁判专用的 API Handler

  constructor(config: JudgeConfig, context: vscode.ExtensionContext) {
    this.config = config
    // 如果有独立模型配置，创建专用的 ApiHandler
    if (config.modelConfig) {
      this.apiHandler = buildApiHandler(config.modelConfig)
    }
  }

  /**
   * 判断任务是否真正完成
   */
  async judgeCompletion(
    taskContext: TaskContext,
    attemptResult: string,
  ): Promise<JudgeResult> {
    // 构建裁判提示词
    const judgePrompt = this.buildJudgePrompt(taskContext, attemptResult)

    // 调用裁判模型
    const response = await this.callJudgeModel(judgePrompt)

    // 解析裁判结果
    return this.parseJudgeResponse(response)
  }

  private buildJudgePrompt(
    taskContext: TaskContext,
    attemptResult: string,
  ): string {
    return `你是一个严格的任务审查员。请根据以下信息判断任务是否真正完成：

## 原始任务
${taskContext.originalTask}

## 执行历史
${this.summarizeExecutionHistory(taskContext)}

## 模型声称的完成结果
${attemptResult}

## 评判标准
1. 原始需求是否完全满足
2. 是否有明显的遗漏或错误
3. 代码质量是否符合基本标准
4. 测试是否按要求完成
5. 用户的特殊要求是否被遵守

请以 JSON 格式回复：
{
  "approved": true/false,
  "reasoning": "详细的判断理由",
  "missingItems": ["未完成项1", "未完成项2"],
  "suggestions": ["改进建议1", "建议2"]
}`
  }

  private async callJudgeModel(prompt: string): Promise<string> {
    // 使用专用 ApiHandler 或回退到主 ApiHandler
    const handler = this.apiHandler || /* fallback */

    // 调用模型API
    const response = await handler.createMessage(/* ... */)
    return response.content
  }

  private parseJudgeResponse(response: string): JudgeResult {
    // 解析 JSON 响应
    try {
      const parsed = JSON.parse(response)
      return {
        approved: parsed.approved,
        reasoning: parsed.reasoning,
        missingItems: parsed.missingItems || [],
        suggestions: parsed.suggestions || [],
      }
    } catch (error) {
      // 处理解析错误
      return this.fallbackParsing(response)
    }
  }
}

export interface TaskContext {
  originalTask: string
  conversationHistory: ClineMessage[]
  toolCalls: ToolUsage[]
  fileChanges: string[]
  currentMode: string
}

export interface JudgeResult {
  approved: boolean
  reasoning: string
  missingItems: string[]
  suggestions: string[]
}
```

#### C. 集成到 Task.ts

**修改位置**：`src/core/task/Task.ts`

在 `attempt_completion` 工具处理中添加裁判逻辑：

```typescript
// 原有的 attemptCompletionTool 函数
export async function attemptCompletionTool(
	cline: Task,
	block: ToolUse,
	// ... 其他参数
) {
	// ... 原有逻辑 ...

	// 新增：裁判模式检查
	if (shouldInvokeJudge(cline)) {
		const judgeResult = await invokeJudge(cline, result)

		if (!judgeResult.approved) {
			// 裁判拒绝，继续对话
			await handleJudgeRejection(cline, judgeResult)
			return // 不完成任务，继续对话
		}

		// 裁判批准，继续原有完成流程
	}

	// ... 原有的完成逻辑 ...
}

async function shouldInvokeJudge(cline: Task): Promise<boolean> {
	const judgeConfig = await cline.getJudgeConfig()

	if (!judgeConfig.enabled) {
		return false
	}

	if (judgeConfig.mode === "always") {
		return true
	}

	if (judgeConfig.mode === "ask") {
		// 询问用户是否调用裁判
		const response = await cline.ask("judge_mode", "Do you want to invoke the judge to verify task completion?")
		return response === "yes"
	}

	return false
}

async function invokeJudge(cline: Task, attemptResult: string): Promise<JudgeResult> {
	const judgeService = cline.getJudgeService()

	const taskContext: TaskContext = {
		originalTask: cline.getOriginalTask(),
		conversationHistory: cline.clineMessages,
		toolCalls: cline.getToolUsageHistory(),
		fileChanges: cline.getFileChanges(),
		currentMode: cline.getTaskMode(),
	}

	return await judgeService.judgeCompletion(taskContext, attemptResult)
}

async function handleJudgeRejection(cline: Task, judgeResult: JudgeResult): Promise<void> {
	const config = await cline.getJudgeConfig()

	// 构建裁判反馈消息
	const feedback = formatJudgeFeedback(judgeResult)

	if (config.allowUserOverride) {
		// 询问用户是否接受裁判的判断
		const response = await cline.ask(
			"judge_feedback",
			feedback + "\n\nDo you want to continue working on this task?",
		)

		if (response === "no") {
			// 用户选择忽略裁判，完成任务
			return
		}
	}

	// 将裁判反馈作为新的用户消息注入对话
	cline.say("judge_feedback", feedback)

	// 重置 attempt_completion 标志，继续对话
	cline.resetCompletionAttempt()
}

function formatJudgeFeedback(judgeResult: JudgeResult): string {
	let feedback = `## 🧑‍⚖️ 裁判反馈\n\n`
	feedback += `**判定结果**: 任务未完成\n\n`
	feedback += `**理由**: ${judgeResult.reasoning}\n\n`

	if (judgeResult.missingItems.length > 0) {
		feedback += `**未完成项**:\n`
		judgeResult.missingItems.forEach((item, i) => {
			feedback += `${i + 1}. ${item}\n`
		})
		feedback += `\n`
	}

	if (judgeResult.suggestions.length > 0) {
		feedback += `**改进建议**:\n`
		judgeResult.suggestions.forEach((suggestion, i) => {
			feedback += `${i + 1}. ${suggestion}\n`
		})
	}

	return feedback
}
```

#### D. UI 配置界面（新增）

**位置**：`webview-ui/src/components/settings/JudgeSettings.tsx`

需要添加以下配置项：

1. **启用裁判模式**（Toggle）
2. **裁判调用策略**（下拉选择：always / ask / never）
3. **裁判模型配置**（独立的 API 配置选择器）
4. **反馈详细程度**（选择：concise / detailed）
5. **允许用户覆盖**（Toggle）
6. **成本估算**（显示启用裁判的额外成本）

#### E. 配置存储

**修改位置**：`src/core/config/ProviderSettingsManager.ts`

添加裁判配置的存储和管理：

```typescript
interface ProviderProfiles {
	// ... 现有字段 ...
	judgeConfig?: JudgeConfig
}
```

---

## 3. 实施计划

### 3.1 开发阶段

#### 阶段 1：核心服务开发（2-3天）

- [ ] 创建 `JudgeConfig` 类型定义
- [ ] 实现 `JudgeService` 核心逻辑
- [ ] 编写裁判提示词模板
- [ ] 实现 JSON 响应解析

#### 阶段 2：Task 集成（2-3天）

- [ ] 修改 `attemptCompletionTool` 添加裁判检查点
- [ ] 实现裁判结果处理逻辑
- [ ] 实现用户覆盖机制
- [ ] 添加裁判反馈消息格式化

#### 阶段 3：配置管理（1-2天）

- [ ] 扩展 `ProviderSettingsManager` 支持裁判配置
- [ ] 实现裁判模型配置的独立管理
- [ ] 添加配置验证逻辑

#### 阶段 4：UI 开发（2-3天）

- [ ] 创建裁判设置面板
- [ ] 实现模型选择器
- [ ] 添加成本估算显示
- [ ] 实现裁判反馈UI展示

#### 阶段 5：测试与优化（2-3天）

- [ ] 单元测试（`JudgeService`、配置管理）
- [ ] 集成测试（完整的裁判流程）
- [ ] 性能测试（裁判调用的延迟和成本）
- [ ] 用户体验测试

**总计**: 约 9-14 天

### 3.2 里程碑

- **M1** (Day 5): 核心裁判逻辑可用
- **M2** (Day 8): Task 集成完成
- **M3** (Day 11): UI 配置完成
- **M4** (Day 14): 测试完成，可发布

---

## 4. 风险与挑战

### 4.1 技术风险

| 风险             | 影响 | 缓解措施                                                                |
| ---------------- | ---- | ----------------------------------------------------------------------- |
| **裁判模型误判** | 高   | 1. 使用结构化提示词<br>2. 提供用户覆盖选项<br>3. 记录误判案例优化提示词 |
| **成本增加**     | 中   | 1. 提供调用策略配置<br>2. 显示成本估算<br>3. 允许用户禁用               |
| **延迟增加**     | 中   | 1. 异步调用裁判<br>2. 提供进度反馈<br>3. 优化提示词长度                 |
| **上下文溢出**   | 低   | 1. 只传递关键信息给裁判<br>2. 使用摘要而非完整历史                      |

### 4.2 用户体验风险

| 风险           | 影响 | 缓解措施                                                    |
| -------------- | ---- | ----------------------------------------------------------- |
| **过度干预**   | 中   | 1. 默认关闭裁判模式<br>2. 提供"从不"选项<br>3. 清晰的开关UI |
| **反馈不清晰** | 中   | 1. 结构化反馈格式<br>2. 高亮未完成项<br>3. 提供可操作建议   |
| **配置复杂**   | 低   | 1. 提供默认配置<br>2. 简化UI设计<br>3. 提供配置向导         |

---

## 5. 成本效益分析

### 5.1 开发成本

- **人力成本**: 1名开发者，约2周
- **测试成本**: 测试覆盖率 >80%
- **维护成本**: 低（基于现有架构）

### 5.2 用户收益

**正面影响**：

1. ✅ **减少过早完成问题**：自动检测并修正未完成的任务
2. ✅ **提高输出质量**：通过二次审查提升代码质量
3. ✅ **减少用户干预**：自动化质量检查流程
4. ✅ **灵活可控**：用户完全控制裁判行为

**负面影响**：

1. ⚠️ **API 成本增加**：每次裁判调用约增加 10-30% 成本
2. ⚠️ **响应延迟**：每次裁判增加 3-10 秒延迟
3. ⚠️ **可能误判**：裁判可能过于严格或宽松

### 5.3 成本估算示例

假设：

- 主模型：Claude Sonnet 4.5（$3/MTok输入，$15/MTok输出）
- 裁判模型：Claude Sonnet 4.5（相同）
- 平均任务：20轮对话，5次 attempt_completion

**无裁判模式**：

- 主模型成本：$0.50

**有裁判模式（always）**：

- 主模型成本：$0.50
- 裁判成本：5次 × $0.05 = $0.25
- **总成本**：$0.75（+50%）

**有裁判模式（ask）**：

- 假设用户选择2次调用
- 裁判成本：2次 × $0.05 = $0.10
- **总成本**：$0.60（+20%）

---

## 6. 替代方案

### 方案 A：增强 attempt_completion 提示词（低成本）

**描述**：不引入裁判，而是改进 `attempt_completion` 工具的描述和规则

**优点**：

- 零额外成本
- 零额外延迟
- 实施简单

**缺点**：

- 效果有限（已有相关规则但仍存在问题）
- 依赖主模型自身能力
- 无法进行独立审查

**适用场景**：作为补充措施，与裁判模式并行实施

### 方案 B：用户手动审查（零成本）

**描述**：每次 `attempt_completion` 时强制显示检查清单给用户

**优点**：

- 零 API 成本
- 用户完全控制
- 实施非常简单

**缺点**：

- 需要用户手动介入
- 用户可能疏忽
- 无法自动化

**适用场景**：作为备选方案，或与裁判模式结合使用

### 方案 C：基于规则的静态检查（低成本）

**描述**：使用静态规则检查（如：是否有文件修改、是否运行测试等）

**优点**：

- 成本极低
- 延迟极低
- 完全可预测

**缺点**：

- 无法理解语义
- 规则难以覆盖所有场景
- 易产生误报

**适用场景**：作为第一道门槛，在调用裁判前先过滤

---

## 7. 推荐方案

### 7.1 混合方案（推荐）

结合多种方法，提供最佳用户体验：

#### 第一层：静态规则检查（免费，即时）

在 `attempt_completion` 时立即检查：

- [ ] 是否有文件被修改
- [ ] 原始任务中的关键词是否被提及
- [ ] 是否有明显的 TODO 或 FIXME 注释
- [ ] 如果要求测试，是否有测试文件

#### 第二层：增强提示词（免费，主模型内处理）

改进 `attempt_completion` 工具描述：

- 明确要求模型在调用前自我检查
- 提供检查清单
- 强调不完整的后果

#### 第三层：裁判模式（可选，独立审查）

提供本文档设计的完整裁判功能：

- 用户可选启用/禁用
- 灵活的调用策略
- 独立模型配置

### 7.2 配置建议

**新用户默认配置**：

```json
{
	"judgeMode": {
		"enabled": false, // 默认关闭
		"mode": "ask", // 启用时询问
		"detailLevel": "detailed",
		"allowUserOverride": true
	}
}
```

**高级用户推荐配置**：

```json
{
	"judgeMode": {
		"enabled": true,
		"mode": "always",
		"detailLevel": "detailed",
		"allowUserOverride": true,
		"modelConfig": {
			// 使用不同于主模型的配置
			"apiProvider": "anthropic",
			"modelId": "claude-opus-4" // 更强的模型
		}
	}
}
```

---

## 8. 需求验收标准

### 8.1 功能验收

| 编号 | 验收标准                                         | 验证方法                         |
| ---- | ------------------------------------------------ | -------------------------------- |
| F1   | 用户可以在设置中启用/禁用裁判模式                | UI测试：切换开关并验证配置保存   |
| F2   | 用户可以为裁判配置独立的 API 模型                | 功能测试：配置不同模型并验证调用 |
| F3   | 当模型调用 `attempt_completion` 时，裁判自动触发 | 集成测试：监控 API 调用日志      |
| F4   | 裁判判断任务未完成时，自动继续对话               | 端到端测试：模拟未完成任务       |
| F5   | 裁判反馈清晰显示未完成项和建议                   | UI测试：验证反馈格式和内容       |
| F6   | 用户可以选择忽略裁判判断                         | 功能测试：测试覆盖机制           |
| F7   | 裁判调用策略（always/ask/never）正常工作         | 功能测试：测试三种策略           |
| F8   | 显示准确的成本估算                               | 单元测试：验证成本计算逻辑       |

### 8.2 性能验收

| 指标         | 目标值                    | 验证方法                 |
| ------------ | ------------------------- | ------------------------ |
| 裁判响应延迟 | < 10秒（95th percentile） | 性能测试：100次调用统计  |
| 成本增加     | < 50%（always模式）       | 成本分析：对比启用前后   |
| 误判率       | < 10%（基于测试集）       | 准确性测试：人工标注对比 |
| UI 响应性    | < 300ms（配置界面）       | UI性能测试               |

### 8.3 质量验收

| 类型           | 标准  | 验证方法               |
| -------------- | ----- | ---------------------- |
| 单元测试覆盖率 | ≥ 80% | Jest/Vitest 覆盖率报告 |
| 集成测试通过率 | 100%  | 自动化测试套件         |
| 代码审查       | 通过  | PR Review              |
| 文档完整性     | 100%  | 文档审查               |

---

## 9. 开放问题（待讨论）

### Q1: 裁判是否应该有工具调用能力？

**问题**：裁判是否应该能够调用工具（如读取文件、运行测试）来验证任务完成？

**选项**：

- **A**: 裁判只基于上下文判断，不调用工具（简单、快速、成本低）
- **B**: 裁判可以调用只读工具验证（更准确，但成本高、延迟大）
- **C**: 裁判可以运行特定验证工具（如测试、linter）

**当前建议**：选项 A（仅基于上下文），可在未来版本中扩展

### Q2: 是否应该记录裁判历史？

**问题**：是否应该记录每次裁判的判断结果，用于分析和改进？

**选项**：

- **A**: 不记录（隐私优先）
- **B**: 本地记录（用于用户分析）
- **C**: 可选上传（用于模型改进）

**当前建议**：选项 B（本地记录），遵守隐私政策

### Q3: 裁判失败的重试机制？

**问题**：如果裁判 API 调用失败，应该如何处理？

**选项**：

- **A**: 直接通过任务（失败开放）
- **B**: 询问用户
- **C**: 自动重试一次

**当前建议**：选项 C + B（重试一次，失败后询问用户）

### Q4: 是否支持自定义裁判提示词？

**问题**：是否允许高级用户自定义裁判的评判标准？

**选项**：

- **A**: 不支持（保持简单）
- **B**: 支持全局自定义提示词
- **C**: 支持按模式定制评判标准

**当前建议**：选项 A（V1不支持），可在 V2 考虑

---

## 10. 相关文档

- [过早完成问题分析](./10-premature-completion-analysis.md)
- [Prompts 系统架构](./08-prompts-system.md)
- [任务生命周期管理](./07-task-lifecycle.md)
- [内存优化分析](./09-memory-optimization-analysis.md)

---

## 11. 附录

### A. 裁判提示词模板示例

````markdown
# 任务完成审查

你是一个严格的任务审查员。请仔细审查以下任务的完成情况。

## 原始任务

{original_task}

## 用户的特殊要求

{user_requirements}

## 执行历史摘要

- 对话轮数：{conversation_rounds}
- 文件修改：{modified_files}
- 命令执行：{executed_commands}
- 工具调用：{tool_calls}

## 模型声称的完成结果

{completion_result}

## 评判标准

请根据以下标准逐项评估：

### 1. 完整性 (Completeness)

- [ ] 原始任务的所有要求是否都被满足？
- [ ] 是否有明显的遗漏？

### 2. 正确性 (Correctness)

- [ ] 实现是否正确无误？
- [ ] 是否有明显的逻辑错误或bug？

### 3. 质量 (Quality)

- [ ] 代码质量是否符合基本标准？
- [ ] 是否有测试覆盖（如果要求）？
- [ ] 是否有适当的错误处理？

### 4. 文档 (Documentation)

- [ ] 是否有必要的注释和文档？
- [ ] 是否更新了相关的 README 或文档文件？

### 5. 特殊要求 (Special Requirements)

- [ ] 用户的任何特殊要求是否被遵守？
- [ ] 是否遵循了项目的编码规范？

## 输出格式

请以 JSON 格式回复，结构如下：

```json
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
	"criticalIssues": ["可能存在内存泄漏风险（第45行）"]
}
```
````

## 注意事项

1. 如果任务基本完成但有小问题，可以批准并在 suggestions 中提出改进建议
2. 如果有严重问题或明显遗漏，必须拒绝
3. 不要过于吹毛求疵，关注核心要求
4. 提供可操作的具体建议，而非笼统的评价

````

### B. 成本计算公式

```typescript
function estimateJudgeCost(
  config: JudgeConfig,
  avgAttempts: number,
  tokensPerJudge: number = 2000,
): number {
  const modelCost = getModelCost(config.modelConfig)

  let judgeCallCount = 0

  switch (config.mode) {
    case 'always':
      judgeCallCount = avgAttempts
      break
    case 'ask':
      judgeCallCount = avgAttempts * 0.5 // 假设50%接受
      break
    case 'never':
      judgeCallCount = 0
      break
  }

  const inputTokens = tokensPerJudge * judgeCallCount
  const outputTokens = 500 * judgeCallCount // 假设平均500 tokens输出

  const cost =
    (inputTokens / 1_000_000) * modelCost.inputPrice +
    (outputTokens / 1_000_000) * modelCost.outputPrice

  return cost
}
````

### C. 实现检查清单

**后端实现**：

- [ ] `src/core/judge/JudgeConfig.ts` - 配置类型定义
- [ ] `src/core/judge/JudgeService.ts` - 核心服务
- [ ] `src/core/judge/prompts.ts` - 裁判提示词模板
- [ ] `src/core/judge/index.ts` - 导出接口
- [ ] `src/core/tools/attemptCompletionTool.ts` - 集成裁判检查
- [ ] `src/core/config/ProviderSettingsManager.ts` - 配置管理扩展
- [ ] `src/shared/ExtensionMessage.ts` - 添加裁判相关消息类型
- [ ] `src/shared/WebviewMessage.ts` - 添加裁判相关消息类型

**前端实现**：

- [ ] `webview-ui/src/components/settings/JudgeSettings.tsx` - 配置UI
- [ ] `webview-ui/src/components/chat/JudgeFeedback.tsx` - 反馈显示
- [ ] `webview-ui/src/types/index.ts` - 类型定义
- [ ] `webview-ui/src/context/ExtensionStateContext.tsx` - 状态管理

**测试**：

- [ ] `src/core/judge/__tests__/JudgeService.spec.ts` - 服务测试
- [ ] `src/core/judge/__tests__/prompts.spec.ts` - 提示词测试
- [ ] `src/core/tools/__tests__/attemptCompletionTool.spec.ts` - 集成测试
- [ ] `apps/vscode-e2e/src/suite/judge.test.ts` - 端到端测试

**文档**：

- [ ] `docs/12-judge-mode-requirements.md` - 需求文档（本文档）
- [ ] `README.md` - 更新功能说明
- [ ] 用户文档 - 使用指南

---

## 12. 版本历史

| 版本  | 日期       | 作者 | 变更说明                           |
| ----- | ---------- | ---- | ---------------------------------- |
| 1.0.0 | 2025-10-10 | Roo  | 初始版本，完整的需求分析和设计方案 |

---

## 13. 总结

裁判模式是一个创新性的功能，旨在通过独立的模型审查来减少"过早完成"问题。本文档提供了完整的需求分析、技术设计、实施计划和风险评估。

**核心价值**：

1. ✅ 自动化质量检查，减少人工干预
2. ✅ 提供独立视角，发现主模型的盲点
3. ✅ 灵活可控，用户完全掌控行为

**关键决策**：

- 采用混合方案（静态检查 + 增强提示词 + 裁判模式）
- 裁判作为全局开关而非独立模式
- 提供多级调用策略（always/ask/never）
- 允许用户覆盖裁判判断

**下一步行动**：

1. 与产品团队讨论开放问题（第9节）
2. 获得用户反馈并确认关键决策
3. 开始阶段1开发（核心服务）
4. 持续迭代并收集反馈

**期待反馈**：请对本需求文档提供反馈，特别是：

- 开放问题（第9节）的决策偏好
- 成本效益是否可接受
- 是否有遗漏的用例或风险
