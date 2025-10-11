# 自动压缩记忆系统集成修复

## 修复日期

2025-10-11

## 问题描述

### 核心问题

用户报告："多轮对话后，用户特意指定某些内容，但到达上下文上限的自动压缩后，还是忘记"

### 根本原因

虽然在之前的会话中已经实现了完整的 `ConversationMemory` 系统，但该系统**仅在手动压缩时生效**。当达到上下文上限触发自动压缩时，记忆系统被完全忽略，导致关键用户指令在压缩后丢失。

### 问题定位

#### 1. 手动压缩路径（✅ 正常工作）

```typescript
// src/core/task/Task.ts 第 1028 行
const result = await summarizeConversation(
    this.apiConversationHistory,
    // ... 其他参数
    this.conversationMemory,  // ✅ 传递了记忆实例
    useMemoryEnhancement: true, // ✅ 启用了记忆增强
)
```

#### 2. 自动压缩路径（❌ 未生效）

**问题1：`truncateConversationIfNeeded` 不接受记忆参数**

```typescript
// src/core/sliding-window/index.ts
export async function truncateConversationIfNeeded(options: TruncateOptions): Promise<TruncateResult> {
	// ... 逻辑
	const result =
		await summarizeConversation()
		// ... 其他参数
		// ❌ 没有 conversationMemory 参数
		// ❌ 没有 useMemoryEnhancement 参数
}
```

**问题2：Task 调用时未传递记忆参数**

```typescript
// src/core/task/Task.ts 第 2498 行和第 2613 行
const truncateResult = await truncateConversationIfNeeded({
	messages: this.apiConversationHistory,
	// ... 其他参数
	// ❌ 缺少 conversationMemory
	// ❌ 缺少 useMemoryEnhancement
})
```

## 修复方案

### 修复步骤

#### 步骤 1：扩展 `TruncateOptions` 类型

**文件**: `src/core/sliding-window/index.ts`

```typescript
import { ConversationMemory } from "../memory/ConversationMemory"

export interface TruncateOptions {
	// ... 现有字段
	conversationMemory?: ConversationMemory // ✅ 新增
	useMemoryEnhancement?: boolean // ✅ 新增
}
```

#### 步骤 2：更新 `truncateConversationIfNeeded` 函数签名

**文件**: `src/core/sliding-window/index.ts`

```typescript
export async function truncateConversationIfNeeded({
	// ... 现有参数
	conversationMemory,
	useMemoryEnhancement = true, // ✅ 默认启用
}: TruncateOptions): Promise<TruncateResult> {
	// ... 逻辑

	// 调用 summarizeConversation 时传递记忆参数
	const result = await summarizeConversation(
		messages,
		apiHandler,
		systemPrompt,
		taskId,
		prevContextTokens,
		true, // automatic trigger
		customCondensingPrompt,
		condensingApiHandler,
		conversationMemory, // ✅ 传递记忆实例
		useMemoryEnhancement, // ✅ 传递启用标志
	)
}
```

#### 步骤 3：Task.ts 中传递记忆参数

**文件**: `src/core/task/Task.ts`

**位置1：handleContextWindowExceededError()（第 2498 行）**

```typescript
const truncateResult = await truncateConversationIfNeeded({
	messages: this.apiConversationHistory,
	// ... 其他参数
	conversationMemory: this.conversationMemory, // ✅ 新增
	useMemoryEnhancement: true, // ✅ 新增
})
```

**位置2：attemptApiRequest()（第 2613 行）**

```typescript
const truncateResult = await truncateConversationIfNeeded({
	messages: this.apiConversationHistory,
	// ... 其他参数
	conversationMemory: this.conversationMemory, // ✅ 新增
	useMemoryEnhancement: true, // ✅ 新增
})
```

#### 步骤 4：更新测试用例

**文件**: `src/core/sliding-window/__tests__/sliding-window.spec.ts`

更新两个测试用例的期望值，添加新的参数：

```typescript
// 测试1：第 588 行
expect(summarizeSpy).toHaveBeenCalledWith(
	messagesWithSmallContent,
	mockApiHandler,
	"System prompt",
	taskId,
	70001,
	true,
	undefined, // customCondensingPrompt
	undefined, // condensingApiHandler
	undefined, // conversationMemory  ✅ 新增
	true, // useMemoryEnhancement ✅ 新增
)

// 测试2：第 759 行（类似）
```

## 技术细节

### 参数传递链

```
Task.conversationMemory (实例创建于 Task 构造函数)
    ↓
truncateConversationIfNeeded({ conversationMemory, useMemoryEnhancement })
    ↓
summarizeConversation(conversationMemory, useMemoryEnhancement)
    ↓
conversationMemory.extractMemories() + generateMemorySummary()
    ↓
记忆注入到 LLM 提示词中
```

### 记忆保护机制

当 `useMemoryEnhancement = true` 且 `conversationMemory` 存在时：

1. **提取记忆**：扫描对话历史，提取关键信息

    - 用户指令（CRITICAL 优先级）
    - 配置变更
    - 技术决策
    - 文件操作
    - 错误解决方案

2. **生成记忆摘要**：

    ```
    ## 关键记忆 (Critical Memories)

    ### 用户指令 (User Instructions)
    - Use PostgreSQL for the database
    - API endpoint should be /api/v2

    ### 技术决策 (Technical Decisions)
    - Selected React for frontend framework

    ### 相关文件
    - src/database/config.ts
    - src/api/routes.ts
    ```

3. **注入提示词**：将记忆摘要添加到压缩请求中
    ```typescript
    let finalContent = "Summarize the conversation so far..."
    if (memoryContext) {
    	finalContent += "\n\n" + memoryContext + "\n\n**Please incorporate these critical memories into your summary.**"
    }
    ```

### 向后兼容性

所有新参数都是**可选的**：

- `conversationMemory?: ConversationMemory`
- `useMemoryEnhancement?: boolean`（默认 `true`）

这确保：

- 现有调用无需修改即可继续工作
- 测试中未传递这些参数时使用 `undefined`，系统正常降级

## 测试验证

### 测试结果

#### Sliding Window 测试

```bash
cd src && npx vitest run core/sliding-window/__tests__/sliding-window.spec.ts
```

**结果**: ✅ 全部通过 (30/30 测试)

#### ConversationMemory 测试

```bash
cd src && npx vitest run core/memory/__tests__/ConversationMemory.test.ts
```

**结果**: ✅ 全部通过 (31/31 测试)

### 测试覆盖的场景

1. ✅ 手动压缩（已有功能，继续正常工作）
2. ✅ 自动压缩 - 达到 token 上限
3. ✅ 自动压缩 - 达到百分比阈值
4. ✅ 错误恢复压缩
5. ✅ 记忆提取和去重
6. ✅ 记忆老化机制
7. ✅ 智能摘要生成

## 修复效果

### 修复前

```
用户: "Use PostgreSQL for the database"
... (多轮对话)
[达到上下文上限，触发自动压缩]
AI: 忘记了用户关于 PostgreSQL 的指令 ❌
```

### 修复后

```
用户: "Use PostgreSQL for the database"
... (多轮对话)
[达到上下文上限，触发自动压缩]
↓ 提取关键记忆
↓ 生成记忆摘要
↓ 注入到压缩提示词
AI: 记住用户要求使用 PostgreSQL ✅
```

## 相关文档

- [上下文压缩系统](./03-context-compression.md)
- [对话记忆增强系统](./23-conversation-memory-enhancement.md)
- [ConversationMemory 实现](../src/core/memory/ConversationMemory.ts)
- [Sliding Window 实现](../src/core/sliding-window/index.ts)

## 参考资料

用户提供的 Augment Code 参考实现启发了这个修复：

- `TurnSummary` 组件：显示每轮对话创建的记忆数量
- `isMemoryRelated()` 函数：识别 `remember` 工具调用
- `pendingMemoriesCount` 和 `conversationMemoryCount` 统计

这些设计理念在 Roo-Code 中体现为：

- `ConversationMemory` 类：完整的记忆管理系统
- 6 种记忆类型和 4 级优先级
- Jaccard 相似度去重
- 半衰期老化机制

## 总结

这次修复解决了记忆系统"最后一公里"的问题：

- ✅ 记忆系统已完整实现
- ✅ 手动压缩正常工作
- ❌ **自动压缩缺失集成** ← 本次修复的核心
- ✅ 现已完全集成

**影响范围**：

- 修改了 3 个核心文件
- 更新了 2 个测试用例
- 所有 61 个相关测试全部通过
- 向后兼容，不破坏现有功能

**用户体验改善**：

- 关键用户指令不再在自动压缩后丢失
- 技术决策和配置在整个会话中保持一致
- 文件路径、API 端点等重要信息得到保护
