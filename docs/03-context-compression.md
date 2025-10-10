# 上下文压缩机制详解

## 概述

Roo-Code 实现了智能的上下文管理机制,能够在对话历史接近模型上下文窗口限制时自动触发压缩,确保对话可以持续进行而不会因为 token 超限而中断。

## 核心概念

### 上下文窗口 (Context Window)

- 每个 AI 模型都有固定的上下文窗口大小
- 例如: Claude 3.5 Sonnet 的上下文窗口是 200K tokens
- 对话历史 + 系统提示 + 当前输入不能超过这个限制

### Sliding Window (滑动窗口)

- 当对话历史过长时,只保留最近的部分
- 类似一个滑动窗口,始终保持在限制范围内
- 旧的消息会被截断或压缩

### Context Condensing (上下文压缩)

- 使用 LLM 智能总结旧的对话
- 保留关键信息,丢弃冗余内容
- 比简单截断更智能

## 核心文件

### 1. sliding-window/index.ts

**路径**: `src/core/sliding-window/index.ts` (175行)

**职责**:

- 判断是否需要截断对话
- 计算 token 使用百分比
- 触发压缩或截断操作

**关键函数**:

```typescript
export async function truncateConversationIfNeeded(
	messages: Anthropic.MessageParam[],
	contextWindow: number,
): Promise<Anthropic.MessageParam[]>
```

### 2. condense/index.ts

**路径**: `src/core/condense/index.ts` (246行)

**职责**:

- 实现智能压缩逻辑
- 调用 LLM 生成摘要
- 验证压缩效果

**关键函数**:

```typescript
export async function summarizeConversation(
	messages: Anthropic.MessageParam[],
	contextWindow: number,
): Promise<Anthropic.MessageParam[]>
```

## 触发条件

### 自动触发阈值

```typescript
// 当 token 使用率达到 75% 时触发
const percentage = (totalTokens / contextWindow) * 100
if (percentage >= 75) {
    await summarizeConversation(...)
}
```

**为什么是 75%?**

- 留出 25% 缓冲空间
- 避免突然触发导致对话中断
- 给 AI 响应留出足够空间

### 计算方式

```typescript
// 1. 计算所有消息的 token 总数
let totalTokens = 0
for (const message of messages) {
	totalTokens += countTokens(message)
}

// 2. 加上系统提示的 token
totalTokens += systemPromptTokens

// 3. 计算使用百分比
const percentage = (totalTokens / contextWindow) * 100
```

## 压缩策略

### 策略 1: Context Condensing (优先)

**保留最近的消息**:

```typescript
const N_MESSAGES_TO_KEEP = 3

// 保留最后 3 条消息
const recentMessages = messages.slice(-N_MESSAGES_TO_KEEP)
```

**压缩旧消息**:

```typescript
// 将旧消息发送给 LLM 进行总结
const oldMessages = messages.slice(0, -N_MESSAGES_TO_KEEP)
const summary = await llm.summarize(oldMessages)

// 构建新的消息列表
return [
	{ role: "user", content: summary }, // 总结
	...recentMessages, // 最近消息
]
```

**LLM 总结提示词**:

```
Please provide a concise summary of the conversation so far,
focusing on:
- The main task or goal
- Key decisions made
- Important context that should be retained
- Current state and next steps

Keep the summary brief but comprehensive.
```

**压缩效果验证**:

```typescript
// 必须至少减少 20% 的 token
const reduction = (oldTokens - newTokens) / oldTokens
if (reduction < 0.2) {
	// 压缩效果不够,使用降级策略
	fallbackToSlidingWindow()
}
```

### 策略 2: Sliding Window (降级)

当 Context Condensing 失败或效果不佳时使用:

```typescript
// 简单截断,只保留最近的消息
const MAX_MESSAGES = 20
return messages.slice(-MAX_MESSAGES)
```

## 完整工作流程

### 第一步: 检查是否需要压缩

```typescript
// 在每次 API 调用前检查
const needsTruncation = await checkIfNeedsTruncation(messages, contextWindow)
```

### 第二步: 计算 Token 使用情况

```typescript
// 使用 tiktoken 计算 token
import { encodingForModel } from "js-tiktoken"

const encoding = encodingForModel("gpt-4")
const tokens = encoding.encode(text).length
```

### 第三步: 触发压缩

```typescript
if (percentage >= 75) {
	console.log(`Context usage: ${percentage}%, triggering compression`)

	try {
		// 尝试智能压缩
		messages = await summarizeConversation(messages, contextWindow)
	} catch (error) {
		// 失败则使用简单截断
		messages = slidingWindowTruncate(messages)
	}
}
```

### 第四步: 验证压缩结果

```typescript
// 重新计算压缩后的 token 数
const newTokens = countTokens(messages)
const reduction = (oldTokens - newTokens) / oldTokens

if (reduction >= 0.2) {
	console.log(`Compression successful: ${reduction * 100}% reduction`)
} else {
	console.warn(`Compression insufficient: only ${reduction * 100}% reduction`)
}
```

### 第五步: 继续对话

```typescript
// 使用压缩后的消息继续对话
const response = await api.sendMessage(messages)
```

## 消息保留策略

### 始终保留的内容

1. **系统消息** (System Message)

    - 永远不会被压缩或删除
    - 包含模式定义、规则等关键信息

2. **最近 N 条消息** (默认 N=3)

    - 保持对话连贯性
    - 确保 AI 能理解当前上下文

3. **重要标记的消息**
    - 用户标记为重要的消息
    - 关键决策点的消息

### 可以压缩的内容

1. **工具调用历史**

    - 大量的文件读取结果
    - 重复的命令执行输出

2. **冗长的代码片段**

    - 只保留摘要或文件名
    - 具体内容可以重新读取

3. **中间对话**
    - 探索性的讨论
    - 已经完成的子任务

## 压缩示例

### 压缩前

```
消息历史 (共 50 条消息, 150K tokens):
1. User: 创建一个 React 应用
2. Assistant: 好的,我会...
3. [使用工具: execute_command]
4. [工具结果: npm create vite@latest...]
5. User: 添加路由功能
6. Assistant: 我会安装 react-router...
...
48. [使用工具: write_to_file]
49. [工具结果: 文件创建成功]
50. User: 现在添加样式
```

### 压缩后

```
消息历史 (共 4 条消息, 45K tokens):
1. User: [总结] 我们创建了一个 React 应用,
        添加了路由功能 (react-router-dom),
        创建了 Home、About 页面,
        当前准备添加样式。
2. [使用工具: write_to_file] (保留最近)
3. [工具结果: 文件创建成功]
4. User: 现在添加样式
```

**效果**:

- Token 减少: 150K → 45K (70% 减少)
- 保留关键信息
- 对话可以继续

## 性能优化

### 1. 批量计算 Token

```typescript
// 避免逐条消息计算
const allText = messages.map((m) => m.content).join("\n")
const totalTokens = encoding.encode(allText).length
```

### 2. 缓存 Encoding

```typescript
// 缓存编码器实例
const encodingCache = new Map()

function getEncoding(model: string) {
	if (!encodingCache.has(model)) {
		encodingCache.set(model, encodingForModel(model))
	}
	return encodingCache.get(model)
}
```

### 3. 延迟压缩

```typescript
// 只在真正需要时才压缩
// 不要过早压缩
if (percentage >= 75) {
	compress()
}
```

### 4. 异步压缩

```typescript
// 不阻塞主流程
const compressionPromise = compress()
// 继续其他操作
// 在需要时等待完成
await compressionPromise
```

## 特殊情况处理

### 1. 压缩失败

```typescript
try {
	messages = await summarizeConversation(messages)
} catch (error) {
	console.error("Compression failed:", error)
	// 降级到简单截断
	messages = messages.slice(-20)
}
```

### 2. 模型不支持

```typescript
// 某些小模型可能无法生成好的摘要
if (model.contextWindow < 8000) {
	// 直接使用 sliding window
	return slidingWindowTruncate(messages)
}
```

### 3. 压缩效果不佳

```typescript
if (reduction < 0.2) {
	// 尝试更激进的策略
	// 只保留最近 1 条消息
	return messages.slice(-1)
}
```

### 4. 关键上下文丢失

```typescript
// 用户可以手动重新加载上下文
// 通过重新读取文件或查看历史
```

## 用户控制

### 查看压缩状态

```typescript
// WebView 中显示压缩信息
{
    contextUsage: "75%",
    messagesCount: 50,
    compressionCount: 5,
    lastCompression: "2 minutes ago"
}
```

### 手动触发压缩

```typescript
// 用户可以手动触发压缩
// 在设置或命令面板中
vscode.commands.registerCommand("roo-code.compressContext")
```

### 调整阈值

```typescript
// settings.json
{
    "roo-code.contextCompressionThreshold": 75,  // 默认 75%
    "roo-code.messagesRetainCount": 3            // 默认保留 3 条
}
```

## 调试和监控

### 日志输出

```typescript
console.log(`Context check:
  Total tokens: ${totalTokens}
  Context window: ${contextWindow}
  Usage: ${percentage}%
  Messages: ${messages.length}
  Action: ${needsCompression ? "compress" : "none"}
`)
```

### 性能指标

```typescript
// 记录压缩性能
{
    compressionTime: 1500,      // ms
    tokensBefore: 150000,
    tokensAfter: 45000,
    reduction: 0.70,            // 70%
    messagesRemoved: 46
}
```

## 最佳实践

### 1. 定期检查

- 在每次 API 调用前检查
- 不要等到完全满才压缩

### 2. 智能保留

- 保留最近的对话
- 保留关键决策
- 压缩工具输出

### 3. 验证效果

- 确保压缩有效(至少 20%)
- 检查关键信息是否丢失

### 4. 降级策略

- 智能压缩失败时使用简单截断
- 确保对话始终可以继续

## 相关文档

- [项目概览](./01-project-overview.md)
- [完整工作流程](./04-complete-workflow.md)
- [命令执行流程](./02-command-execution-flow.md)

## 参考文件

- `src/core/sliding-window/index.ts`
- `src/core/condense/index.ts`
- `src/core/task/Task.ts` (调用压缩的地方)
- `src/api/providers/anthropic.ts` (token 计算)
