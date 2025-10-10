# Prompts 系统深度分析

> **文档版本**: 1.0.0  
> **创建时间**: 2025-10-10  
> **作者**: AI 系统分析  
> **目标读者**: 开发者、架构师、技术文档维护者

## 📋 目录

1. [系统概述](#系统概述)
2. [核心架构](#核心架构)
3. [关键文件详解](#关键文件详解)
4. [工具系统](#工具系统)
5. [提示词构建流程](#提示词构建流程)
6. [attempt_completion 机制](#attempt_completion-机制)
7. [问题与改进建议](#问题与改进建议)

---

## 系统概述

### 1.1 系统定位

`src/core/prompts` 系统是 Roo-Code 项目的**核心提示词生成引擎**，负责：

- **系统提示词构建**：生成发送给 LLM 的完整系统提示
- **工具描述生成**：为 AI 提供可用工具的详细说明
- **响应格式化**：标准化工具执行结果和错误信息
- **任务完成控制**：通过 `attempt_completion` 管理任务生命周期

### 1.2 设计哲学

```
用户任务 → 系统提示词 → LLM 推理 → 工具调用 → 结果反馈 → 任务完成
    ↑                                                          ↓
    └──────────────────── attempt_completion ─────────────────┘
```

**核心理念**：

- **声明式工具定义**：工具功能通过自然语言描述，而非代码接口
- **迭代式任务执行**：工具使用 → 等待确认 → 下一步
- **显式任务完成**：必须调用 `attempt_completion` 明确结束任务

---

## 核心架构

### 2.1 目录结构

```
src/core/prompts/
├── system.ts                 # 系统提示词入口 (SYSTEM_PROMPT)
├── responses.ts              # 响应格式化工具
├── sections/                 # 提示词各部分
│   ├── capabilities.ts       # 能力说明
│   ├── objective.ts          # 任务目标
│   ├── rules.ts             # 规则约束
│   ├── tool-use-guidelines.ts  # 工具使用指南
│   ├── modes.ts             # 模式说明
│   ├── system-info.ts       # 系统信息
│   └── markdown-formatting.ts  # Markdown 格式要求
├── tools/                    # 工具描述生成器
│   ├── index.ts             # 工具注册表
│   ├── attempt-completion.ts   # 任务完成工具 ⭐
│   ├── read-file.ts         # 文件读取
│   ├── write-to-file.ts     # 文件写入
│   ├── apply-diff.ts        # 差异应用
│   ├── execute-command.ts   # 命令执行
│   ├── search-files.ts      # 文件搜索
│   └── ... (其他工具)
└── instructions/             # 特殊任务指令
    ├── create-mcp-server.ts
    └── create-mode.ts
```

### 2.2 数据流

```typescript
// 1. 系统提示词生成
SYSTEM_PROMPT(context, cwd, supportsComputerUse, ...)
  → sections/* (组装各部分)
  → tools/* (生成工具描述)
  → 完整系统提示词字符串

// 2. 工具执行流程
用户请求
  → Task.recursivelyMakeClineRequests()
  → attemptApiRequest()
  → LLM 返回工具调用
  → presentAssistantMessage()
  → 执行具体工具 (attemptCompletionTool, etc.)
  → 等待用户确认
  → 添加结果到 userMessageContent
  → 下一轮 API 请求
```

---

## 关键文件详解

### 3.1 system.ts - 系统提示词构建器

**核心函数**：`SYSTEM_PROMPT()`

```typescript
export async function SYSTEM_PROMPT(
	context: vscode.ExtensionContext,
	cwd: string,
	supportsComputerUse: boolean,
	mcpHub?: McpHub,
	diffStrategy?: DiffStrategy,
	browserViewportSize?: string,
	mode?: string,
	customModePrompts?: Record<string, string>,
	// ... 更多参数
): Promise<string>
```

**构建逻辑**：

1. **获取模式配置**：

    ```typescript
    const modeDefinition = getModeDefinition(mode, customModes, customModePrompts)
    const customModeSystemPrompt = modeDefinition?.customSystemPrompt
    ```

2. **组装各部分**：

    ```typescript
    const sections = [
      getRoleAndGoalSection(modeDefinition),           // 角色与目标
      getMarkdownFormattingSection(),                  // Markdown 格式要求
      getToolUseGuidelinesSection(),                   // 工具使用指南
      getCapabilitiesSection(...),                     // 能力说明
      getModesSection(...),                            // 模式说明
      getSystemInfoSection(cwd, supportsComputerUse),  // 系统信息
      getRulesSection(...),                            // 规则约束
      getObjectiveSection(...),                        // 任务目标
      customInstructions ? `====\n\nUSER'S CUSTOM INSTRUCTIONS\n\n${customInstructions}` : ""
    ].filter(Boolean).join("\n\n")
    ```

3. **返回完整提示词**：
    ```typescript
    return customModeSystemPrompt || sections
    ```

**关键特性**：

- ✅ **模块化设计**：每个部分独立维护
- ✅ **条件组装**：根据配置动态包含/排除部分
- ✅ **自定义覆盖**：模式可以完全替换系统提示词
- ⚠️ **顺序敏感**：sections 数组的顺序会影响 LLM 理解

### 3.2 responses.ts - 响应格式化

**核心功能**：

```typescript
export const formatResponse = {
	// 工具结果格式化
	toolResult(result: string): string {
		return `<feedback>${result}</feedback>`
	},

	// 错误信息格式化
	toolError(error: string): string {
		return `<feedback type="error">${error}</feedback>`
	},

	// 缺失参数错误
	missingToolParameterError(paramName: string): string {
		return `Error: Missing required parameter '${paramName}'`
	},

	// 未使用工具提示
	noToolsUsed(): string {
		return `You must use a tool to proceed. Either use a relevant tool or attempt_completion if the task is complete.`
	},

	// 图片块格式化
	imageBlocks(images?: string[]): Anthropic.ImageBlockParam[] {
		// 将图片转换为 Anthropic 格式
	},
}
```

**设计模式**：

- **工厂模式**：统一创建标准化响应
- **类型安全**：返回类型与 Anthropic SDK 匹配
- **错误分类**：区分工具错误、系统错误、用户错误

### 3.3 sections/rules.ts - 规则约束

**关键规则**：

```typescript
export function getRulesSection(
	cwd: string,
	supportsComputerUse: boolean,
	diffStrategy?: DiffStrategy,
	codeIndexManager?: CodeIndexManager,
): string
```

**核心约束**：

1. **工作目录限制**：

    ```
    - The project base directory is: ${cwd.toPosix()}
    - You cannot `cd` into a different directory
    ```

2. **工具使用要求**：

    ```
    - You must use the attempt_completion tool to present the result
    - It is critical you wait for the user's response after each tool use
    ```

3. **禁止对话式结束**：

    ```
    - NEVER end attempt_completion result with a question!
    - You are STRICTLY FORBIDDEN from starting with "Great", "Certainly"
    ```

4. **代码搜索优先级** (第 60-62 行)：
    ```typescript
    const codebaseSearchRule = isCodebaseSearchAvailable
    	? "- **CRITICAL: For ANY exploration of code you haven't examined yet in this conversation, you MUST use the `codebase_search` tool FIRST before using search_files or other file exploration tools.**"
    	: ""
    ```

**改进建议**：

- ⚠️ **规则过多**：95 行文本可能超出 LLM 注意力范围
- 💡 **需要分层**：核心规则 vs 辅助规则
- 💡 **需要强调**：关键规则应重复出现

### 3.4 sections/objective.ts - 任务目标

**核心逻辑**：

```typescript
export function getObjectiveSection(
	codeIndexManager?: CodeIndexManager,
	experimentsConfig?: Record<string, boolean>,
): string {
	const codebaseSearchInstruction = isCodebaseSearchAvailable
		? "First, for ANY exploration of code you haven't examined yet in this conversation, you MUST use the `codebase_search` tool to search for relevant code based on the task's intent BEFORE using any other search or file exploration tools."
		: "First, "

	return `====

OBJECTIVE

You accomplish a given task iteratively, breaking it down into clear steps and working through them methodically.

1. Analyze the user's task and set clear, achievable goals
2. Work through these goals sequentially, utilizing available tools one at a time
3. Remember, you have extensive capabilities with access to a wide range of tools
   ${codebaseSearchInstruction}analyze the file structure...
4. Once you've completed the user's task, you must use the attempt_completion tool
5. The user may provide feedback, which you can use to make improvements`
}
```

**关键点**：

- ✅ **明确步骤**：5 步任务执行流程
- ✅ **工具优先级**：强调 codebase_search 优先
- ⚠️ **缺少检查点**：第 4 步"任务完成"条件不明确

---

## 工具系统

### 4.1 工具注册表 (tools/index.ts)

```typescript
export const toolDescriptions: Record<string, (args?: ToolArgs) => string> = {
	read_file: (args) => getReadFileDescription(args),
	write_to_file: (args) => getWriteToFileDescription(args),
	apply_diff: (args) => getApplyDiffDescription(args),
	execute_command: (args) => getExecuteCommandDescription(args),
	search_files: (args) => getSearchFilesDescription(args),
	list_files: (args) => getListFilesDescription(args),
	list_code_definition_names: (args) => getListCodeDefinitionNamesDescription(args),
	codebase_search: (args) => getCodebaseSearchDescription(args),
	ask_followup_question: () => getAskFollowupQuestionDescription(),
	attempt_completion: (args) => getAttemptCompletionDescription(args), // ⭐ 核心
	use_mcp_tool: (args) => getUseMcpToolDescription(args),
}
```

**设计特点**：

- ✅ **统一接口**：所有工具描述生成器遵循相同签名
- ✅ **按需生成**：根据 `ToolArgs` 动态调整描述
- ✅ **可扩展性**：添加新工具只需注册到此对象

### 4.2 attempt_completion 核心机制分析

**工具描述特征**：

```typescript
// tools/attempt-completion.ts (第 3-21 行)
export function getAttemptCompletionDescription(args?: ToolArgs): string {
	return `## attempt_completion
Description: After each tool use, the user will respond with the result...
IMPORTANT NOTE: This tool CANNOT be used until you've confirmed from the user 
that any previous tool uses were successful. Failure to do so will result in 
code corruption and system failure.
Parameters:
- result: (required) The result of the task. Formulate this result in a way 
  that is final and does not require further input from the user.
`
}
```

**工具实现关键点**：

```typescript
// core/tools/attemptCompletionTool.ts
export async function attemptCompletionTool(cline: Task, block: ToolUse, ...) {
  // 1. TODO 列表检查 (第 35-53 行)
  const hasIncompleteTodos = cline.todoList?.some(todo => todo.status !== "completed")
  if (preventCompletionWithOpenTodos && hasIncompleteTodos) {
    return formatResponse.toolError("Cannot complete task while there are incomplete todos")
  }

  // 2. 参数验证 (第 83-88 行)
  if (!result) {
    cline.consecutiveMistakeCount++
    pushToolResult(await cline.sayAndCreateMissingParamError("attempt_completion", "result"))
    return
  }

  // 3. 展示结果 (第 94-96 行)
  await cline.say("completion_result", result, undefined, false)
  TelemetryService.instance.captureTaskCompleted(cline.taskId)

  // 4. 等待用户反馈 (第 113 行)
  const { response, text, images } = await cline.ask("completion_result", "", false)

  // 5. 处理反馈循环 (第 123-134 行)
  if (response !== "yesButtonClicked") {
    toolResults.push({
      type: "text",
      text: `The user has provided feedback. Consider their input to continue
             the task, and then attempt completion again.`
    })
    // 将反馈添加到 userMessageContent，触发下一轮迭代
  }
}
```

**执行流程**：

```
attempt_completion 被调用
    ↓
【检查 1】TODO 列表完成度
    ↓ 通过
【检查 2】result 参数存在性
    ↓ 通过
【步骤 3】展示完成结果到 UI
    ↓
【步骤 4】等待用户响应
    ↓
用户点击 "是" ──→ 任务真正结束 (pushToolResult(""))
    ↓
用户提供反馈 ──→ 添加到 userMessageContent
    ↓
【步骤 5】下一轮 API 请求，LLM 看到反馈后继续改进
```

### 4.3 工具描述的问题分析

**当前问题**：

1. **描述过于宽泛** (attempt-completion.ts 第 5-6 行)：

    ```
    "Once you've received the results of tool uses and can confirm
     that the task is complete, use this tool..."
    ```

    - ⚠️ "can confirm" 太主观，没有明确的检查清单
    - ⚠️ 缺少"什么算完成"的具体标准

2. **警告位置不当** (第 6 行)：

    ```
    "IMPORTANT NOTE: This tool CANNOT be used until you've confirmed..."
    ```

    - ⚠️ 警告在描述中间，可能被 LLM 忽略
    - 💡 应该放在最开头或最末尾，并重复强调

3. **缺少前置条件检查** (attemptCompletionTool.ts)：
    - ✅ 有 TODO 列表检查（第 42 行）
    - ❌ **没有检查是否有待处理的工具调用**
    - ❌ **没有检查文件操作是否成功**
    - ❌ **没有检查命令是否执行完成**

---

## 提示词构建流程

### 5.1 系统提示词生成

```typescript
// Task.ts 第 2372-2449 行
private async getSystemPrompt(): Promise<string> {
  // 1. MCP 服务初始化
  let mcpHub: McpHub | undefined
  if (mcpEnabled ?? true) {
    mcpHub = await McpServerManager.getInstance(provider.context, provider)
    await pWaitFor(() => !mcpHub!.isConnecting, { timeout: 10_000 })
  }

  // 2. 获取 .rooignore 指令
  const rooIgnoreInstructions = this.rooIgnoreController?.getInstructions()

  // 3. 获取用户配置
  const state = await this.providerRef.deref()?.getState()

  // 4. 调用 SYSTEM_PROMPT 生成完整提示词
  return await SYSTEM_PROMPT(
    provider.context,
    this.cwd,
    this.api.getModel().info.supportsComputerUse ?? false,
    mcpHub,
    this.diffStrategy,
    browserViewportSize,
    mode,
    customModePrompts,
    customModes,
    customInstructions,
    this.diffEnabled,
    experiments,
    enableMcpServerCreation,
    language,
    rooIgnoreInstructions,
    maxReadFileLine !== -1,
    {
      maxConcurrentFileReads: maxConcurrentFileReads ?? 5,
      todoListEnabled: apiConfiguration?.todoListEnabled ?? true,
      useAgentRules: true,
      newTaskRequireTodos: false,
    },
    undefined, // todoList (不在系统提示词中包含)
    this.api.getModel().id,
  )
}
```

### 5.2 API 请求构建

```typescript
// Task.ts 第 2698 行
const stream = this.api.createMessage(systemPrompt, cleanConversationHistory, metadata)
```

**完整流程**：

```
用户输入任务
    ↓
Task.startTask()
    ↓
initiateTaskLoop(userContent)
    ↓
recursivelyMakeClineRequests(userContent, includeFileDetails=true)
    ↓
【构建环境上下文】
    ├─ processUserContentMentions() - 处理 @mentions
    ├─ getEnvironmentDetails() - 获取文件列表、终端状态等
    └─ 组合为 finalUserContent
    ↓
addToApiConversationHistory({ role: "user", content: finalUserContent })
    ↓
【生成系统提示词】
systemPrompt = await getSystemPrompt()
    ↓
【发送 API 请求】
stream = api.createMessage(systemPrompt, apiConversationHistory, metadata)
    ↓
【流式处理响应】
for await (chunk of stream) {
  - 解析文本和工具调用
  - presentAssistantMessage() 展示到 UI
  - 执行工具
  - 等待用户确认
  - 收集 userMessageContent
}
    ↓
【下一轮迭代】
if (userMessageContent.length > 0) {
  recursivelyMakeClineRequests(userMessageContent, includeFileDetails=false)
}
```

---

## attempt_completion 深度分析

### 6.1 当前实现的问题

**问题 1：缺少前置条件验证**

```typescript
// attemptCompletionTool.ts 第 83-88 行
if (!result) {
	cline.consecutiveMistakeCount++
	cline.recordToolError("attempt_completion")
	pushToolResult(await cline.sayAndCreateMissingParamError("attempt_completion", "result"))
	return
}
```

**分析**：

- ✅ 检查了 `result` 参数
- ❌ **没有检查工具执行状态**
- ❌ **没有检查文件操作是否成功**
- ❌ **没有检查命令是否仍在运行**

**问题 2：提示词不够明确**

```typescript
// tools/attempt-completion.ts 第 5 行
"Once you've received the results of tool uses and can confirm that
 the task is complete, use this tool to present the result..."
```

**分析**：

- ⚠️ "can confirm" 过于主观
- ⚠️ 没有具体的检查清单
- ⚠️ 没有强制等待工具结果

**问题 3：Task.ts 中缺少拦截**

```typescript
// Task.ts 第 2320-2327 行
const didToolUse = this.assistantMessageContent.some((block) => block.type === "tool_use")

if (!didToolUse) {
	this.userMessageContent.push({ type: "text", text: formatResponse.noToolsUsed() })
	this.consecutiveMistakeCount++
}
```

**分析**：

- ✅ 检测到没有工具使用会报错
- ❌ **没有检测过早的 attempt_completion**
- ❌ **没有验证工具结果是否已收到**

### 6.2 根本原因

**系统设计缺陷**：

1. ## **信任 LLM 自律**：
