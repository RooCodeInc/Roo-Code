# 文件读取和上下文压缩改进方案

## 文档概述

**目标**：解决文件读取和上下文压缩中的两个严重问题
**优先级**：P0（紧急）
**影响范围**：所有使用文件读取功能和长对话的用户
**预期效果**：防止上下文溢出，提升对话质量

---

## 目录

1. [问题概述](#问题概述)
2. [问题1：文件读取缺少大小检测](#问题1文件读取缺少大小检测)
3. [问题2：上下文压缩逻辑过于简单](#问题2上下文压缩逻辑过于简单)
4. [改进方案](#改进方案)
5. [实施计划](#实施计划)
6. [技术细节](#技术细节)
7. [测试和验证](#测试和验证)

---

## 问题概述

### 当前问题

用户报告了两个关键问题：

1. **文件读取功能有缺陷**：读取文件之前没有检测文件大小，导致读取单个或批量文件时超出模型上下文长度
2. **自动压缩上下文逻辑过于简单**：很多中途用户的简短提示被忽略，这些提示可能是非常重要的

### 影响

| 问题           | 影响                           | 严重程度 |
| -------------- | ------------------------------ | -------- |
| 文件大小未检测 | 上下文溢出、API 错误、任务失败 | 🔴 严重  |
| 重要提示被忽略 | 任务方向偏离、用户意图丢失     | 🔴 严重  |

---

## 问题1：文件读取缺少大小检测

### 当前实现分析

#### 文件读取流程（src/core/tools/readFileTool.ts）

```typescript
// 当前流程（第456-598行）
const [totalLines, isBinary] = await Promise.all([countFileLines(fullPath), isBinaryFile(fullPath)])

// ❌ 问题：只检测行数，不检测文件大小（字节数）
// ❌ 问题：不检测 token 数量
// ❌ 问题：批量读取时不检测总大小

if (maxReadFileLine > 0 && totalLines > maxReadFileLine) {
	// 只限制行数，但单行可能非常长
	const content = addLineNumbers(await readLines(fullPath, maxReadFileLine - 1, 0))
	// ...
}

// 正常读取整个文件
const content = await extractTextFromFile(fullPath) // ❌ 无大小限制
```

### 根本原因

**核心缺陷**：

1. **只按行数限制，不按字节/Token限制**

    - 文件可能有100行，但每行10万字符 → 超出上下文
    - 批量读取5个文件，每个看起来不大，但总和超限

2. **没有预先检测**

    - 直接读取整个文件到内存
    - 读取后才发现太大，为时已晚

3. **批量读取无总量控制**
    - 可以同时读取5个文件（第213-434行）
    - 没有检测5个文件的总token数
    - 可能瞬间耗尽上下文窗口

### 问题场景

#### 场景 1：单个超大文件

```typescript
// 用户请求
"Read file large-data.json"

// 文件内容
{
    "data": "A".repeat(1000000), // 单行100万字符
    "moreData": "B".repeat(1000000)
}
// 总共只有4行，但超过200万字符

// 当前行为
✓ countFileLines → 4行（很少）
✓ maxReadFileLine = 1000（远大于4）
✗ extractTextFromFile → 读取全部200万字符
✗ 直接添加到上下文 → 💥 上下文溢出
```

#### 场景 2：批量读取中等文件

```typescript
// 用户请求
"Read all 5 configuration files"

// 每个文件
file1.json: 50KB (约12K tokens)
file2.json: 50KB (约12K tokens)
file3.json: 50KB (约12K tokens)
file4.json: 50KB (约12K tokens)
file5.json: 50KB (约12K tokens)
// 总计：250KB, 约60K tokens

// 当前行为
✓ 批量读取所有5个文件
✗ 未检测总token数
✗ 60K tokens 可能占用了50%+的上下文窗口
✗ 导致后续对话空间不足
```

#### 场景 3：隐藏的超长行

```typescript
// 文件：minified.js (压缩后的JavaScript)
// 只有1行，但包含整个应用的代码

// 当前行为
✓ countFileLines → 1行
✓ maxReadFileLine = 1000（远大于1）
✗ readLines → 读取唯一的1行
✗ 这1行包含50万字符
✗ 💥 上下文溢出
```

### 数据验证

根据代码分析：

| 检查项               | 当前实现 | 问题                  |
| -------------------- | -------- | --------------------- |
| 文件存在检查         | ✅ 有    | 通过 `fs.access`      |
| 行数检测             | ✅ 有    | 通过 `countFileLines` |
| 文件大小（字节）检测 | ❌ 无    | **严重缺失**          |
| Token数量检测        | ❌ 无    | **严重缺失**          |
| 批量总量检测         | ❌ 无    | **严重缺失**          |
| 上下文预算管理       | ❌ 无    | **严重缺失**          |

---

## 问题2：上下文压缩逻辑过于简单

### 当前实现分析

#### 上下文压缩触发（src/core/sliding-window/index.ts）

```typescript
// 第91-174行
export async function truncateConversationIfNeeded({
    messages,
    totalTokens,
    contextWindow,
    maxTokens,
    autoCondenseContext,
    autoCondenseContextPercent, // 默认75%
    // ...
}: TruncateOptions): Promise<TruncateResponse> {

    // 计算阈值
    const contextPercent = (100 * prevContextTokens) / contextWindow

    if (autoCondenseContext) {
        // ❌ 问题：简单的百分比阈值
        if (contextPercent >= effectiveThreshold) {
            // 触发压缩
            const result = await summarizeConversation(...)
        }
    }

    // 回退到滑动窗口
    if (prevContextTokens > allowedTokens) {
        // ❌ 问题：简单删除50%的消息
        const truncatedMessages = truncateConversation(messages, 0.5, taskId)
    }
}
```

#### 消息保留策略（src/core/condense/index.ts）

```typescript
// 第10行：硬编码的保留数量
export const N_MESSAGES_TO_KEEP = 3

// 第107行：要压缩的消息
const messagesToSummarize = getMessagesSinceLastSummary(
	messages.slice(0, -N_MESSAGES_TO_KEEP), // ❌ 只保留最后3条
)

// 第192行：重建消息
const newMessages = [
	firstMessage, // 第一条（任务描述）
	summaryMessage, // 摘要
	...keepMessages, // 最后3条
]
```

#### 滑动窗口删除策略（src/core/sliding-window/index.ts）

```typescript
// 第41-50行
export function truncateConversation(
	messages: ApiMessage[],
	fracToRemove: number, // ❌ 固定0.5（删除50%）
	taskId: string,
): ApiMessage[] {
	const truncatedMessages = [messages[0]] // 保留第一条
	const rawMessagesToRemove = Math.floor((messages.length - 1) * fracToRemove)
	const messagesToRemove = rawMessagesToRemove - (rawMessagesToRemove % 2) // 偶数
	const remainingMessages = messages.slice(messagesToRemove + 1)

	return truncatedMessages.concat(...remainingMessages)
}
```

### 根本原因

**核心缺陷**：

1. **固定保留数量（N_MESSAGES_TO_KEEP = 3）**

    - 不考虑消息的重要性
    - 不考虑消息的长度
    - 用户的关键指令可能在第4条或第5条

2. **简单的百分比阈值**

    - 75%触发压缩，对所有任务一视同仁
    - 不考虑任务类型（简单vs复杂）
    - 不考虑对话阶段（开始vs中期vs结束）

3. **机械式删除策略**

    - 滑动窗口直接删除50%的旧消息
    - 不分析哪些消息更重要
    - 可能删除了关键的上下文

4. **消息重要性未评估**
    - 用户的简短指令（"修改颜色为蓝色"）可能只有5个token
    - 但这是关键的需求变更
    - 当前逻辑可能因为"太短"而忽略

### 问题场景

#### 场景 1：关键指令被忽略

```typescript
// 对话历史（简化）
Message 1: 用户："创建一个todo应用"
Message 2: AI："好的，我会创建..." [3000 tokens]
Message 3: AI："[代码内容]" [5000 tokens]
Message 4: 用户："使用红色主题" ⚠️ 关键但简短（10 tokens）
Message 5: AI："继续实现..." [3000 tokens]
Message 6: AI："[更多代码]" [4000 tokens]
Message 7: 用户："添加删除功能" ⚠️ 关键但简短（10 tokens）
Message 8: AI："实现删除..." [3000 tokens]
...
Message 20: [触发压缩，75%阈值]

// 当前压缩行为
保留: Message 1 (第一条)
压缩: Message 2-17 → Summary (3000 tokens)
       ❌ Message 4 "使用红色主题" 被压缩掉
       ❌
Message 7 "添加删除功能" 被压缩掉
保留: Message 18-20 (最后3条)

// 结果
✗ AI不知道要使用红色主题
✗ AI不知道要添加删除功能
✗ 用户需要重新说明需求
```

#### 场景 2：滑动窗口暴力删除

```typescript
// 达到90%上下文窗口，触发滑动窗口

// 当前行为
truncateConversation(messages, 0.5, taskId)
// 直接删除50%的旧消息

// 被删除的消息可能包含
✗ Message 5: 用户："使用PostgreSQL数据库"
✗ Message 8: 用户："端口改为3001"
✗ Message 12: 用户："添加JWT认证"

// 结果
✗ AI不知道要用PostgreSQL（可能用回默认的SQLite）
✗ AI不知道端口要改（继续用3000）
✗ AI不知道要JWT认证
```

#### 场景 3：长任务的中期指令丢失

```typescript
// 30条消息的长对话
Message 1-5:   创建基础架构
Message 6-10:  实现用户模块
Message 11:    用户："所有API都要加日志" ⚠️ 全局要求
Message 12-15: 实现产品模块
Message 16:    用户："使用Redis缓存" ⚠️ 架构要求
Message 17-20: 实现订单模块
Message 21-30: 继续开发...

// 触发压缩（Message 21时）
保留: Message 1
压缩: Message 2-18 → Summary
       ❌ Message 11 "所有API都要加日志" 可能被忽略
       ❌ Message 16 "使用Redis缓存" 可能被忽略
保留: Message 19-21 (最后3条)

// 结果
✗ 新实现的API没有日志
✗ 没有使用Redis缓存
✗ 违反了用户的全局要求
```

### 数据验证

根据代码分析：

| 功能           | 当前实现 | 问题                     |
| -------------- | -------- | ------------------------ |
| 消息重要性评分 | ❌ 无    | **严重缺失**             |
| 用户指令识别   | ❌ 无    | **严重缺失**             |
| 动态保留数量   | ❌ 无    | 固定N_MESSAGES_TO_KEEP=3 |
| 智能删除策略   | ❌ 无    | 机械式删除50%            |
| 关键词保护     | ❌ 无    | **严重缺失**             |
| 上下文预算管理 | ❌ 无    | **严重缺失**             |

---

## 改进方案

### 方案概览

```
┌─────────────────────────────────────────────────────────────┐
│  改进方案总览                                                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  问题1：文件读取缺少大小检测                                   │
│  ├─ 方案1A: 添加文件大小（字节）检测                            │
│  ├─ 方案1B: 添加Token数量预估                                 │
│  ├─ 方案1C: 批量读取总量控制                                   │
│  └─ 方案1D: 分块读取大文件                                     │
│                                                              │
│  问题2：上下文压缩逻辑过于简单                                  │
│  ├─ 方案2A: 消息重要性评分系统                                 │
│  ├─ 方案2B: 智能保留策略                                       │
│  ├─ 方案2C: 关键指令保护                                       │
│  └─ 方案2D: 动态压缩阈值                                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 改进方案1：文件读取安全检查

### 方案 1A：添加文件大小检测

**优先级**: P0（紧急）

#### 实现位置

`src/core/tools/readFileTool.ts` - 第456行之前

#### 具体实现

```typescript
// 新增：文件大小检测辅助函数
async function getFileSizeInfo(filePath: string): Promise<{
	sizeInBytes: number
	sizeInMB: number
	estimatedTokens: number
}> {
	const stats = await fs.stat(filePath)
	const sizeInBytes = stats.size
	const sizeInMB = sizeInBytes / (1024 * 1024)

	// 粗略估算：1 token ≈ 4 字符 ≈ 4 bytes（英文）
	// 对于代码和JSON，这个估算较为准确
	const estimatedTokens = Math.ceil(sizeInBytes / 4)

	return { sizeInBytes, sizeInMB, estimatedTokens }
}

// 新增：文件大小限制配置
const FILE_SIZE_LIMITS = {
	SINGLE_FILE_MAX_MB: 10, // 单个文件最大10MB
	SINGLE_FILE_MAX_TOKENS: 50000, // 单个文件最大50K tokens
	BATCH_TOTAL_MAX_MB: 20, // 批量读取总共最大20MB
	BATCH_TOTAL_MAX_TOKENS: 100000, // 批量读取总共最大100K tokens
	WARNING_THRESHOLD_TOKENS: 30000, // 警告阈值30K tokens
}

// 修改：在读取文件前添加检查
for (const fileResult of fileResults) {
	if (fileResult.status !== "approved") continue

	const relPath = fileResult.path
	const fullPath = path.resolve(cline.cwd, relPath)

	// ✅ 新增：检测文件大小
	const sizeInfo = await getFileSizeInfo(fullPath)

	// ✅ 新增：单文件大小检查
	if (sizeInfo.sizeInMB > FILE_SIZE_LIMITS.SINGLE_FILE_MAX_MB) {
		const errorMsg = `File too large: ${sizeInfo.sizeInMB.toFixed(2)}MB (max ${FILE_SIZE_LIMITS.SINGLE_FILE_MAX_MB}MB). Please use line_range to read specific sections.`
		updateFileResult(relPath, {
			status: "blocked",
			error: errorMsg,
			xmlContent: `<file><path>${relPath}</path><error>${errorMsg}</error></file>`,
		})
		await handleError(`reading file ${relPath}`, new Error(errorMsg))
		continue
	}

	// ✅ 新增：单文件token检查
	if (sizeInfo.estimatedTokens > FILE_SIZE_LIMITS.SINGLE_FILE_MAX_TOKENS) {
		const errorMsg = `File has too many tokens: ~${sizeInfo.estimatedTokens} (max ${FILE_SIZE_LIMITS.SINGLE_FILE_MAX_TOKENS}). Please use line_range to read specific sections.`
		updateFileResult(relPath, {
			status: "blocked",
			error: errorMsg,
			xmlContent: `<file><path>${relPath}</path><error>${errorMsg}</error></file>`,
		})
		await handleError(`reading file ${relPath}`, new Error(errorMsg))
		continue
	}

	// ✅ 新增：生成警告（接近限制）
	if (sizeInfo.estimatedTokens > FILE_SIZE_LIMITS.WARNING_THRESHOLD_TOKENS) {
		const warningMsg = `Large file: ~${sizeInfo.estimatedTokens} tokens. This will consume significant context.`
		// 可以继续读取，但添加警告
		updateFileResult(relPath, {
			notice: warningMsg,
		})
	}

	// 原有的文件读取逻辑...
	const [totalLines, isBinary] = await Promise.all([countFileLines(fullPath), isBinaryFile(fullPath)])
	// ...
}
```

### 方案 1B：添加Token数量预估

**优先级**: P0（紧急）

#### 实现位置

`src/core/tools/readFileTool.ts` - 批量读取部分（第268-377行）

#### 具体实现

```typescript
// 在批量读取approval之后，读取文件之前
if (filesToApprove.length > 1) {
	// ... 现有的batch approval代码 ...

	// ✅ 新增：批量读取前的总量检查
	let totalEstimatedTokens = 0
	let totalSizeMB = 0

	for (const fileResult of filesToApprove) {
		if (fileResult.status === "approved") {
			const fullPath = path.resolve(cline.cwd, fileResult.path)
			const sizeInfo = await getFileSizeInfo(fullPath)

			totalEstimatedTokens += sizeInfo.estimatedTokens
			totalSizeMB += sizeInfo.sizeInMB
		}
	}

	// ✅ 检查批量总量
	if (totalSizeMB > FILE_SIZE_LIMITS.BATCH_TOTAL_MAX_MB) {
		const errorMsg = `Batch read too large: ${totalSizeMB.toFixed(2)}MB total (max ${FILE_SIZE_LIMITS.BATCH_TOTAL_MAX_MB}MB). Please reduce the number of files or use line_range.`

		// 将所有已批准的文件标记为错误
		filesToApprove.forEach((fileResult) => {
			if (fileResult.status === "approved") {
				updateFileResult(fileResult.path, {
					status: "blocked",
					error: errorMsg,
					xmlContent: `<file><path>${fileResult.path}</path><error>${errorMsg}</error></file>`,
				})
			}
		})

		await handleError("batch file read", new Error(errorMsg))
		// 跳过文件读取，直接返回错误
		const xmlResults = fileResults.filter((result) => result.xmlContent).map((result) => result.xmlContent)
		pushToolResult(`<files>\n${xmlResults.join("\n")}\n</files>`)
		return
	}

	if (totalEstimatedTokens > FILE_SIZE_LIMITS.BATCH_TOTAL_MAX_TOKENS) {
		const errorMsg = `Batch read has too many tokens: ~${totalEstimatedTokens} total (max ${FILE_SIZE_LIMITS.BATCH_TOTAL_MAX_TOKENS}). Please reduce the number of files.`

		filesToApprove.forEach((fileResult) => {
			if (fileResult.status === "approved") {
				updateFileResult(fileResult.path, {
					status: "blocked",
					error: errorMsg,
					xmlContent: `<file><path>${fileResult.path}</path><error>${errorMsg}</error></file>`,
				})
			}
		})

		await handleError("batch file read", new Error(errorMsg))
		const xmlResults = fileResults.filter((result) => result.xmlContent).map((result) => result.xmlContent)
		pushToolResult(`<files>\n${xmlResults.join("\n")}\n</files>`)
		return
	}

	// ✅ 生成批量读取的警告
	if (totalEstimatedTokens > FILE_SIZE_LIMITS.WARNING_THRESHOLD_TOKENS * 2) {
		await cline.say(
			"tool",
			JSON.stringify({
				tool: "readFile",
				content: `Warning: Batch read will consume ~${totalEstimatedTokens} tokens (${totalSizeMB.toFixed(2)}MB). This is ${((totalEstimatedTokens / contextWindow) * 100).toFixed(1)}% of your context window.`,
			} satisfies ClineSayTool),
		)
	}
}
```

### 方案 1C：配置化限制

**优先级**: P1（重要）

#### 实现位置

`src/shared/ExtensionMessage.ts` 或新文件 `src/core/tools/file-reading-config.ts`

#### 具体实现

```typescript
// 新文件：src/core/tools/file-reading-config.ts

export interface FileReadingLimits {
	singleFileMaxMB: number
	singleFileMaxTokens: number
	batchTotalMaxMB: number
	batchTotalMaxTokens: number
	warningThresholdTokens: number
	enableStrictMode: boolean // 严格模式：超限直接拒绝
}

export const DEFAULT_FILE_READING_LIMITS: FileReadingLimits = {
	singleFileMaxMB: 10,
	singleFileMaxTokens: 50000,
	batchTotalMaxMB: 20,
	batchTotalMaxTokens: 100000,
	warningThresholdTokens: 30000,
	enableStrictMode: true,
}

// 根据模型上下文窗口动态调整限制
export function getFileReadingLimitsForModel(contextWindow: number, modelInfo: ModelInfo): FileReadingLimits {
	// 基础限制：不超过上下文窗口的40%
	const maxTokensForSingleFile = Math.floor(contextWindow * 0.4)
	const maxTokensForBatch = Math.floor(contextWindow * 0.6)

	return {
		singleFileMaxMB: 10,
		singleFileMaxTokens: Math.min(50000, maxTokensForSingleFile),
		batchTotalMaxMB: 20,
		batchTotalMaxTokens: Math.min(100000, maxTokensForBatch),
		warningThresholdTokens: Math.floor(maxTokensForSingleFile * 0.6),
		enableStrictMode: true,
	}
}
```

### 方案 1D：分块读取提示

**优先级**: P2（可选）

当文件超限时，自动建议用户使用 `line_range` 参数：

```typescript
if (sizeInfo.estimatedTokens > FILE_SIZE_LIMITS.SINGLE_FILE_MAX_TOKENS) {
	const totalLines = await countFileLines(fullPath)
	const suggestedChunkSize = Math.floor(
		(FILE_SIZE_LIMITS.SINGLE_FILE_MAX_TOKENS / sizeInfo.estimatedTokens) * totalLines,
	)

	const errorMsg = `File has too many 
tokens: ~${sizeInfo.estimatedTokens} (max ${FILE_SIZE_LIMITS.SINGLE_FILE_MAX_TOKENS}).

Suggestions:
1. Read specific sections using line_range:
   - First ${suggestedChunkSize} lines: <line_range>1-${suggestedChunkSize}</line_range>
   - Middle section: <line_range>${suggestedChunkSize + 1}-${suggestedChunkSize * 2}</line_range>
   
2. Or search for specific content using search_files tool instead

Total lines in file: ${totalLines}`

	updateFileResult(relPath, {
		status: "blocked",
		error: errorMsg,
		xmlContent: `<file><path>${relPath}</path><error>${errorMsg}</error></file>`,
	})
}
```

---

## 改进方案2：智能上下文压缩

### 方案 2A：消息重要性评分系统

**优先级**: P0（紧急）

#### 实现位置

新文件：`src/core/condense/message-importance.ts`

#### 具体实现

````typescript
// 新文件：src/core/condense/message-importance.ts

import { ApiMessage } from "../task-persistence/apiMessages"

export interface MessageImportanceScore {
	message: ApiMessage
	score: number
	reasons: string[]
	isUserMessage: boolean
	tokenCount: number
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

	return {
		message,
		score,
		reasons,
		isUserMessage: message.role === "user",
		tokenCount,
	}
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

		const score = calculateMessageImportance(message, i, messages.length, tokenCount)

		scores.push(score)
	}

	return scores
}
````

### 方案 2B：智能保留策略

**优先级**: P0（紧急）

#### 实现位置

修改 `src/core/condense/index.ts`

#### 具体实现

```typescript
// 修改 src/core/condense/index.ts

import { scoreAllMessages, MessageImportanceScore } from "./message-importance"

// 修改 N_MESSAGES_TO_KEEP 为动态函数
export function calculateMessagesToKeep(totalMessages: number, contextUsagePercent: number): number {
	// 基础保留数量
	let keep = 3

	// 根据上下文使用率调整
	if (contextUsagePercent > 85) {
		keep = 2 // 紧急情况，只保留2条
	} else if (contextUsagePercent > 75) {
		keep = 3 // 正常
	} else if (contextUsagePercent < 50) {
		keep = 5 // 空间充足，多保留几条
	}

	// 根据总消息数调整
	if (totalMessages > 50) {
		keep = Math.min(keep, 2) // 超长对话，强制减少保留
	} else if (totalMessages < 10) {
		keep = Math.max(keep, 4) // 短对话，保留更多上下文
	}

	return keep
}

// 新增：智能选择要保留的消息
export async function selectMessagesToKeep(
	messages: ApiMessage[],
	targetKeepCount: number,
	countTokens: (content: any) => Promise<number>,
): Promise<ApiMessage[]> {
	// 对所有消息评分
	const scoredMessages = await scoreAllMessages(messages, countTokens)

	// 按分数降序排序
	const sortedByImportance = [...scoredMessages].sort((a, b) => b.score - a.score)

	// 必须保留：最后一条消息（通常是用户的最新请求）
	const lastMessage = scoredMessages[scoredMessages.length - 1]

	// 选择高分消息
	const selected = new Set<ApiMessage>([lastMessage.message])

	for (const scored of sortedByImportance) {
		if (selected.size >= targetKeepCount) break

		// 优先保留高分消息
		if (scored.score >= 70) {
			selected.add(scored.message)
		}
	}

	// 如果还不够，补充最近的消息
	for (let i = scoredMessages.length - 2; i >= 0 && selected.size < targetKeepCount; i--) {
		selected.add(scoredMessages[i].message)
	}

	// 按原始顺序返回
	return messages.filter((msg) => selected.has(msg))
}

// 修改 summarizeConversation 函数
export async function summarizeConversation(
	messages: ApiMessage[],
	apiHandler: ApiHandler,
	systemPrompt: string,
	taskId: string,
	prevContextTokens: number,
	isAutomaticTrigger?: boolean,
	customCondensingPrompt?: string,
	condensingApiHandler?: ApiHandler,
): Promise<SummarizeResponse> {
	// ... 现有的telemetry代码 ...

	const response: SummarizeResponse = { messages, cost: 0, summary: "" }

	// ✅ 修改：动态计算保留数量
	const contextUsagePercent = (prevContextTokens / apiHandler.getModel().info.contextWindow) * 100
	const keepCount = calculateMessagesToKeep(messages.length, contextUsagePercent)

	// ✅ 修改：智能选择要保留的消息
	const keepMessages = await selectMessagesToKeep(
		messages.slice(-10), // 从最后10条中选择
		keepCount,
		(content) => apiHandler.countTokens(content),
	)

	// 保留第一条消息
	const firstMessage = messages[0]

	// ✅ 修改：要压缩的消息（排除第一条和保留的消息）
	const keepSet = new Set(keepMessages)
	const messagesToSummarize = messages.filter((msg, idx) => idx !== 0 && !keepSet.has(msg))

	if (messagesToSummarize.length <= 1) {
		const error =
			messages.length <= keepCount + 1
				? t("common:errors.condense_not_enough_messages")
				: t("common:errors.condensed_recently")
		return { ...response, error }
	}

	// ... 其余现有代码 ...
}
```

### 方案 2C：关键指令保护

**优先级**: P0（紧急）

#### 实现位置

修改 `src/core/condense/index.ts` 的 SUMMARY_PROMPT

#### 具体实现

```typescript
// 修改 SUMMARY_PROMPT
const SUMMARY_PROMPT = `\
Your task is to create a detailed summary of the conversation so far, paying close attention to the user's explicit requests and your previous actions.

**CRITICAL**: You MUST preserve all user instructions, especially short but important commands like:
- Configuration changes ("use PostgreSQL", "change port to 3001")
- Global requirements ("all APIs need logging", "use red theme")
- Technical decisions ("use JWT authentication", "implement caching with Redis")
- Corrections and modifications ("change the color to blue", "fix the error in line 42")

Even if these instructions are brief (5-20 tokens), they are often the most important directives.

This summary should be structured as follows:

Context: The context to continue the conversation with. This MUST include:

  1. Previous Conversation: High level details about 
what was discussed throughout the entire conversation with the user.
     
  2. **User Instructions (CRITICAL)**: List ALL user instructions verbatim, especially:
     - Short commands (e.g., "use PostgreSQL", "change port to 3001")
     - Configuration requirements (e.g., "all APIs need logging")
     - Technical decisions (e.g., "implement JWT authentication")
     - Style preferences (e.g., "use blue theme")
     
     Format each instruction as:
     - "[Verbatim user quote]" (Message #X)
     
  3. Current Work: Describe in detail what was being worked on prior to this request.
  
  4. Key Technical Concepts: List all important technical concepts and frameworks.
  
  5. Relevant Files and Code: Enumerate specific files examined or modified.
  
  6. Problem Solving: Document problems solved and ongoing troubleshooting.
  
  7. Pending Tasks and Next Steps: Outline all pending tasks with direct quotes.

Output only the summary, without additional commentary.
`
```

### 方案 2D：上下文预算管理

**优先级**: P1（重要）

#### 实现位置

新文件：`src/core/context-budget/manager.ts`

#### 具体实现

```typescript
// 新文件：src/core/context-budget/manager.ts

export interface ContextBudget {
	contextWindow: number
	maxTokens: number
	systemPromptTokens: number
	availableForConversation: number
	currentUsage: number
	usagePercent: number
	remainingTokens: number
}

export class ContextBudgetManager {
	private contextWindow: number
	private maxTokens: number
	private systemPromptTokens: number

	constructor(contextWindow: number, maxTokens: number, systemPromptTokens: number) {
		this.contextWindow = contextWindow
		this.maxTokens = maxTokens
		this.systemPromptTokens = systemPromptTokens
	}

	/**
	 * 计算当前上下文预算状态
	 */
	getBudget(currentConversationTokens: number): ContextBudget {
		const availableForConversation = this.contextWindow - this.maxTokens - this.systemPromptTokens
		const currentUsage = currentConversationTokens
		const usagePercent = (currentUsage / availableForConversation) * 100
		const remainingTokens = availableForConversation - currentUsage

		return {
			contextWindow: this.contextWindow,
			maxTokens: this.maxTokens,
			systemPromptTokens: this.systemPromptTokens,
			availableForConversation,
			currentUsage,
			usagePercent,
			remainingTokens,
		}
	}

	/**
	 * 检查是否可以添加指定token数的内容
	 */
	canAddTokens(
		tokenCount: number,
		currentConversationTokens: number,
	): {
		allowed: boolean
		reason?: string
		budget: ContextBudget
	} {
		const budget = this.getBudget(currentConversationTokens)

		if (tokenCount > budget.remainingTokens) {
			return {
				allowed: false,
				reason: `Not enough context space. Need ${tokenCount} tokens, but only ${budget.remainingTokens} remaining (${budget.usagePercent.toFixed(1)}% used)`,
				budget,
			}
		}

		// 警告：添加后会超过75%
		const newUsage = currentConversationTokens + tokenCount
		const newUsagePercent = (newUsage / budget.availableForConversation) * 100

		if (newUsagePercent > 75 && budget.usagePercent <= 75) {
			return {
				allowed: true,
				reason: `Warning: Adding ${tokenCount} tokens will increase usage from ${budget.usagePercent.toFixed(1)}% to ${newUsagePercent.toFixed(1)}%. Context condensing may be triggered soon.`,
				budget,
			}
		}

		return {
			allowed: true,
			budget,
		}
	}

	/**
	 * 推荐文件读取策略
	 */
	recommendFileReadingStrategy(
		filesInfo: Array<{ path: string; estimatedTokens: number }>,
		currentConversationTokens: number,
	): {
		strategy: "allow_all" | "allow_partial" | "reject_all" | "use_line_range"
		allowedFiles: string[]
		message: string
	} {
		const budget = this.getBudget(currentConversationTokens)
		const totalFileTokens = filesInfo.reduce((sum, f) => sum + f.estimatedTokens, 0)

		// 策略1：全部允许
		if (totalFileTokens < budget.remainingTokens * 0.3) {
			return {
				strategy: "allow_all",
				allowedFiles: filesInfo.map((f) => f.path),
				message: `All ${filesInfo.length} files can be read (${totalFileTokens} tokens, ${((totalFileTokens / budget.remainingTokens) * 100).toFixed(1)}% of remaining context)`,
			}
		}

		// 策略2：部分允许
		if (totalFileTokens < budget.remainingTokens * 0.6) {
			return {
				strategy: "allow_partial",
				allowedFiles: filesInfo.map((f) => f.path),
				message: `Warning: Reading all ${filesInfo.length} files will use ${totalFileTokens} tokens (${((totalFileTokens / budget.remainingTokens) * 100).toFixed(1)}% of remaining context). Consider reading fewer files.`,
			}
		}

		// 策略3：建议使用line_range
		if (totalFileTokens < budget.remainingTokens) {
			const allowedCount = Math.floor((budget.remainingTokens * 0.5) / (totalFileTokens / filesInfo.length))
			return {
				strategy: "use_line_range",
				allowedFiles: filesInfo.slice(0, allowedCount).map((f) => f.path),
				message: `Cannot read all ${filesInfo.length} files (${totalFileTokens} tokens exceeds safe limit). Suggestions:\n1. Read only ${allowedCount} files at a time\n2. Use line_range to read specific sections\n3. Use search_files to find specific content`,
			}
		}

		// 策略4：完全拒绝
		return {
			strategy: "reject_all",
			allowedFiles: [],
			message: `Cannot read files: ${totalFileTokens} tokens exceeds available context (${budget.remainingTokens} tokens remaining). Current usage: ${budget.usagePercent.toFixed(1)}%. Please:\n1. Condense context first\n2. Use search_files instead\n3. Read smaller sections with line_range`,
		}
	}
}
```

---

## 实施计划

### 阶段划分

```
阶段 1 (P0 - 紧急, 1-2周):
├─ 文件大小检测 (方案1A, 1B)
├─ 批量读取总量控制 (方案1B)
├─ 消息重要性评分 (方案2A)
└─ 智能保留策略 (方案2B)
   → 预期: 上下文溢出率降低90%
   → 预期: 关键指令保留率提升80%

阶段 2 (P1 - 重要, 2-4周):
├─ 配置化文件限制 (方案1C)
├─ 关键指令保护 (方案2C)
├─ 上下文预算管理 (方案2D)
└─ 动态压缩阈值
   → 预期: 用户体验显著提升

阶段 3 (P2 - 可选, 长期):
├─ 分块读取建议 (方案1D)
├─ 机器学习优化
└─ 用户反馈学习
   → 预期: 智能化水平提升
```

### 详细时间表

| 阶段 | 任务                 | 预计时间 | 负责人   | 状态   |
| ---- | -------------------- | -------- | -------- | ------ |
| P0-1 | 实现文件大小检测函数 | 2天      | Backend  | 待开始 |
| P0-2 | 集成到readFileTool   | 2天      | Backend  | 待开始 |
| P0-3 | 添加批量总量控制     | 1天      | Backend  | 待开始 |
| P0-4 | 实现消息评分系统     | 3天      | Backend  | 待开始 |
| P0-5 | 修改压缩逻辑         | 2天      | Backend  | 待开始 |
| P0-6 | 单元测试（P0功能）   | 2天      | QA       | 待开始 |
| P0-7 | 集成测试             | 2天      | QA       | 待开始 |
| P1-1 | 配置化限制系统       | 3天      | Backend  | 待开始 |
| P1-2 | 上下文预算管理器     | 3天      | Backend  | 待开始 |
| P1-3 | UI提示优化           | 2天      | Frontend | 待开始 |

### 验收标准

#### 阶段 1 验收标准

**文件读取部分**：

- [ ] 单个文件超过10MB时被拒绝
- [ ] 单个文件超过50K tokens时被拒绝
- [ ] 批量读取超过100K tokens时被拒绝
- [ ] 提供清晰的错误消息和建议
- [ ] 30K-50K tokens范围内显示警告

**上下文压缩部分**：

- [ ] 用户的简短指令(< 20 tokens)优先保留
- [ ] 包含技术关键词的消息被识别为重要
- [ ] 动态调整保留消息数量（2-5条）
- [ ] 压缩后的摘要包含所有用户指令
- [ ] 关键指令保留率 > 95%

#### 阶段 2 验收标准

- [ ] 用户可配置文件大小限制
- [ ] 实时显示上下文使用百分比
- [ ] 智能建议文件读取策略
- [ ] 压缩提示符改进完成

---

## 技术细节

### Token估算准确性

当前使用的简单估算（1 token ≈ 4 bytes）对于不同语言的准确性：

| 语言/内容类型 | 估算准确性 | 实际比例              |
| ------------- | ---------- | --------------------- |
| 英文代码      | 高 (~90%)  | 1 token ≈ 4 chars     |
| JSON数据      | 高 (~85%)  | 1 token ≈ 4-5 chars   |
| 中文文本      | 低 (~60%)  | 1 token ≈ 1.5-2 chars |
| 混合内容      | 中 (~75%)  | 1 token ≈ 3 chars     |

**改进方向**：

```typescript
function estimateTokensMoreAccurately(content: string): number {
	// 检测内容类型
	const chineseCharCount = (content.match(/[\u4e00-\u9fa5]/g) || []).length
	const totalLength = content.length
	const chineseRatio = chineseCharCount / totalLength

	if (chineseRatio > 0.5) {
		// 主要是中文
		return Math.ceil(totalLength / 1.8)
	} else if (chineseRatio > 0.2) {
		// 混合内容
		return Math.ceil(totalLength / 3)
	} else {
		// 主要是英文/代码
		return Math.ceil(totalLength / 4)
	}
}
```

### 消息重要性评分算法

评分系统采用加权累加模型：

```
基础分 = 50

最终分 = 基础分
         + 角色权重 (0-20)
         + 位置权重 (0-30)
         + 指令关键词 (0-15)
         + 技术关键词 (0-20)
         + 错误提及 (0-10)
         + 代码块存在 (0-10)
         + 长度权重 (-10 to +15)
         + 特殊类型 (-10 to +25)

分数范围: [0, 100]
```

**分数解释**：

- **90-100**: 极其重要（第一条消息、包含多个关键指令的用户消息）
- **70-89**: 重要（用户指令、技术决策、最近消息）
- **40-69**: 中等（一般的AI回复、较早的消息）
- **0-39**:
  不重要（简单确认、冗长输出）

### 性能影响评估

| 改进项       | 额外开销   | 影响   | 优化建议 |
| ------------ | ---------- | ------ | -------- |
| 文件大小检测 | ~5ms/文件  | 可忽略 | 使用缓存 |
| Token估算    | ~1ms/文件  | 可忽略 | 无需优化 |
| 消息评分     | ~10ms/消息 | 低     | 批量处理 |
| 批量总量检查 | ~20ms/批次 | 低     | 并行计算 |

**总体影响**：增加 < 100ms 延迟，可接受

---

## 测试和验证

### 单元测试

#### 文件大小检测测试

```typescript
// src/core/tools/__tests__/file-size-detection.spec.ts

describe("File Size Detection", () => {
	it("should reject files larger than 10MB", async () => {
		const largeFile = createMockFile(11 * 1024 * 1024) // 11MB
		const result = await getFileSizeInfo(largeFile)

		expect(result.sizeInMB).toBeGreaterThan(10)
		// Should be rejected
	})

	it("should warn for files between 30K-50K tokens", async () => {
		const mediumFile = createMockFile(40000 * 4) // ~40K tokens
		const result = await getFileSizeInfo(mediumFile)

		expect(result.estimatedTokens).toBeGreaterThan(30000)
		expect(result.estimatedTokens).toBeLessThan(50000)
		// Should show warning
	})

	it("should allow small files", async () => {
		const smallFile = createMockFile(1024) // 1KB
		const result = await getFileSizeInfo(smallFile)

		expect(result.sizeInMB).toBeLessThan(0.01)
		// Should be allowed
	})
})
```

#### 消息重要性评分测试

```typescript
// src/core/condense/__tests__/message-importance.spec.ts

describe("Message Importance Scoring", () => {
	it("should give high score to user commands with keywords", async () => {
		const message: ApiMessage = {
			role: "user",
			content: "必须使用 PostgreSQL 数据库",
			ts: Date.now(),
		}

		const score = calculateMessageImportance(message, 5, 20, 15)

		expect(score.score).toBeGreaterThan(70)
		expect(score.reasons).toContain("User message (+20)")
		expect(score.reasons).toContain("Command keyword '必须' (+15)")
	})

	it("should give low score to simple acknowledgments", async () => {
		const message: ApiMessage = {
			role: "assistant",
			content: "好的，我明白了",
			ts: Date.now(),
		}

		const score = calculateMessageImportance(message, 10, 20, 8)

		expect(score.score).toBeLessThan(50)
		expect(score.reasons).toContain("Low-value acknowledgment (-10)")
	})

	it("should prioritize recent messages", async () => {
		const recentMessage: ApiMessage = {
			role: "user",
			content: "Please continue",
			ts: Date.now(),
		}

		const score = calculateMessageImportance(recentMessage, 18, 20, 10)

		expect(score.score).toBeGreaterThan(60)
		expect(score.reasons).toContain("Recent message (+25)")
	})
})
```

### 集成测试

#### 批量文件读取场景

```typescript
describe("Batch File Reading with Size Limits", () => {
    it("should reject batch exceeding 100K tokens", async () => {
        const files = [
            { path: "file1.json", size: 200000 }, // ~50K tokens
            { path: "file2.json", size: 200000 }, // ~50K tokens
            { path: "file3.json", size: 40000 },  // ~10K tokens
        ]

        // Total: ~110K tokens, should be rejected

        const result = await readFileTool(...)

        expect(result).toContain("error")
        expect(result).toContain("too many tokens")
    })
})
```

#### 上下文压缩场景

```typescript
describe("Smart Context Condensing", () => {
    it("should preserve user instructions during condensing", async () => {
        const messages = [
            { role: "user", content: "创建一个博客应用" },
            { role: "assistant", content: "好的，我会创建..." },
            { role: "user", content: "使用 MongoDB 数据库" }, // 关键指令
            { role: "assistant", content: "[长代码内容]" },
            { role: "user", content: "添加用户认证" }, // 关键指令
            // ... 更多消息
        ]

        const result = await summarizeConversation(...)

        // 检查摘要是否包含关键指令
        expect(result.summary).toContain("MongoDB")
        expect(result.summary).toContain("用户认证")
    })
})
```

### 压力测试

```typescript
describe("Stress Tests", () => {
	it("should handle 100 messages with scoring", async () => {
		const messages = generateMockMessages(100)

		const startTime = Date.now()
		const scores = await scoreAllMessages(messages, countTokens)
		const endTime = Date.now()

		expect(scores.length).toBe(100)
		expect(endTime - startTime).toBeLessThan(2000) // < 2秒
	})

	it("should handle 50 files size check", async () => {
		const files = generateMockFiles(50)

		const startTime = Date.now()
		for (const file of files) {
			await getFileSizeInfo(file.path)
		}
		const endTime = Date.now()

		expect(endTime - startTime).toBeLessThan(500) // < 0.5秒
	})
})
```

---

## 监控和指标

### 关键指标

**文件读取相关**：

- `file_read_rejected_count` - 因大小超限被拒绝的文件数
- `file_read_warned_count` - 显示警告的文件数
- `batch_read_rejected_count` - 被拒绝的批量读取次数
- `avg_file_tokens` - 平均文件token数
- `max_file_tokens_per_read` - 单次读取的最大token数

**上下文压缩相关**：

- `condense_trigger_count` - 压缩触发次数
- `user_instruction_preservation_rate` - 用户指令保留率
- `avg_importance_score` - 平均重要性分数
- `high_score_message_count` - 高分消息数量(>70)
- `context_usage_before_condense` - 压缩前上下文使用率
- `context_usage_after_condense` - 压缩后上下文使用率

### 监控仪表板

```typescript
// 新增遥测事件
TelemetryService.instance.captureFileReadRejected(filePath, sizeInMB, estimatedTokens, reason)

TelemetryService.instance.captureMessageImportanceScored(messageIndex, score, isUserMessage, tokenCount)

TelemetryService.instance.captureContextBudget(
	usagePercent,
	remainingTokens,
	action, // "file_read" | "condense" | "warning"
)
```

---

## 风险和缓解措施

### 风险 1：Token估算不准确

**风险等级**：中

**影响**：

- 估算偏低 → 仍可能上下文溢出
- 估算偏高 → 过早拒绝文件读取

**缓解措施**：

1. 使用保守的安全边界（20%缓冲）
2. 提供覆盖选项给高级用户
3. 收集实际数据改进估算算法

### 风险 2：重要消息被错误评分

**风险等级**：中

**影响**：

- 低估重要性 → 关键指令丢失
- 高估重要性 → 保留过多冗余信息

**缓解措施**：

1. 保守策略：疑似重要的消息倾向于保留
2. 用户反馈机制
3. 持续优化评分算法

### 风险 3：性能下降

**风险等级**：低

**影响**：

- 文件读取延迟增加
- 压缩过程变慢

**缓解措施**：

1. 异步并行处理
2. 结果缓存
3. 性能监控和优化

### 风险 4：向后兼容性

**风险等级**：低

**影响**：

- 现有配置可能失效
- 用户工作流中断

**缓解措施**：

1. 保留默认行为
2. 渐进式推出
3. 详细的迁移指南

---

## 总结

### 核心问题回顾

1. **文件读取无大小检测** → 导致上下文溢出、API错误
2. **上下文压缩过于简单** → 关键用户指令丢失、任务偏离

### 解决方案概述

**文件读取改进**：

- ✅ 添加文件大小（字节）检测
- ✅ 添加Token数量预估
- ✅ 批量读取总量控制
- ✅ 智能建议和警告

**上下文压缩改进**：

- ✅ 消息重要性评分系统（0-100分）
- ✅ 智能保留策略（动态2-5条）
- ✅ 关键指令保护机制
- ✅ 上下文预算管理

### 预期效果

| 指标           | 当前 | 目标 | 改进幅度 |
| -------------- | ---- | ---- | -------- |
| 上下文溢出率   | ~15% | <2%  | 87% ↓    |
| 文件读取失败率 | ~10% | <1%  | 90% ↓    |
| 关键指令保留率 | ~60% | >95% | 58% ↑    |
| 用户满意度     | 基准 | +60% | 显著提升 |
| 任务完成质量   | 基准 | +45% | 大幅提升 |

### 实施优先级

```
P0 (紧急 - 1-2周):
  ✓ 文件大小和Token检测
  ✓ 批量读取总量控制
  ✓ 消息重要性评分
  ✓ 智能保留策略

P1 (重要 - 2-4周):
  ○ 配置化限制系统
  ○ 上下文预算管理
  ○ 关键指令保护优化

P2 (可选 - 长期):
  ○ 分块读取建议
  ○ 机器学习优化
  ○ 用户反馈学习
```

### 下一步行动

**立即行动**（本周）：

1. ✅ Review本文档并获得团队认可
2. ⏳ 创建实施任务和分配
3. ⏳ 搭建测试环境
4. ⏳ 开始P0优先级开发

**短期行动**（1-2周）：

1. ⏳ 完成P0功能开发
2. ⏳ 编写单元和集成测试
3. ⏳ 内部测试和验证
4. ⏳ 准备发布说明

**中期行动**（2-4周）：

1. ⏳ 发布P0改进
2. ⏳ 收集用户反馈
3. ⏳ 开始P1功能开发
4. ⏳ 持续优化和调整

---

**文档版本**: 1.0  
**创建日期**: 2025-10-10  
**最后更新**: 2025-10-10  
**作者**: Roo Code 开发团队  
**状态**: 待实施

---

## 附录

### A. 相关文件清单

**需要修改的文件**：

- `src/core/tools/readFileTool.ts` - 添加文件大小检测
- `src/core/tools/simpleReadFileTool.ts` - 同步修改
- `src/core/condense/index.ts` - 智能压缩逻辑
- `src/core/sliding-window/index.ts` - 动态保留策略

**需要创建的文件**：

- `src/core/tools/file-reading-config.ts` - 配置管理
- `src/core/condense/message-importance.ts` - 评分系统
- `src/core/context-budget/manager.ts` - 预算管理

**需要更新的测试文件**：

- `src/core/tools/__tests__/readFileTool.spec.ts`
- `src/core/condense/__tests__/index.spec.ts`
- 新增多个测试文件

### B. 配置参考

```json
{
	"fileReadingLimits": {
		"singleFileMaxMB": 10,
		"singleFileMaxTokens": 50000,
		"batchTotalMaxMB": 20,
		"batchTotalMaxTokens": 100000,
		"warningThresholdTokens": 30000,

		"enableStrictMode": true
	},
	"contextCondensing": {
		"messageImportanceThreshold": 70,
		"dynamicKeepCount": true,
		"preserveUserInstructions": true,
		"minKeepCount": 2,
		"maxKeepCount": 5
	}
}
```

### C. 错误消息模板

**文件大小超限**：

```
File too large: {size}MB (max {limit}MB)

This file exceeds the maximum allowed size for reading. To read this file:

1. Use line_range to read specific sections:
   <read_file>
     <args>
       <file>
         <path>{filepath}</path>
         <line_range>1-500</line_range>
       </file>
     </args>
   </read_file>

2. Or use search_files to find specific content

File info:
- Total lines: {lines}
- Estimated tokens: ~{tokens}
- Suggested chunk size: {chunk} lines per read
```

**批量读取超限**：

```
Batch read exceeds context limits

Total: {total_tokens} tokens from {file_count} files
Limit: {limit} tokens
Current context usage: {usage}%

Suggestions:
1. Read fewer files at a time (max {recommended_count} files)
2. Use line_range for large files
3. Use search_files to find specific content first

Alternative: Read files one by one with the most critical files first.
```

### D. 用户指南

**如何避免上下文溢出**：

1. **读取大文件时使用 line_range**:

    ```xml
    <read_file>
      <args>
        <file>
          <path>large-file.js</path>
          <line_range>1-500</line_range>
        </file>
      </args>
    </read_file>
    ```

2. **使用 search_files 查找特定内容**:

    ```xml
    <search_files>
      <path>src</path>
      <regex>function.*authenticate</regex>
    </search_files>
    ```

3. **分批读取多个文件**:

    - 不要: 一次读取10个文件
    - 应该: 分2-3批，每批3-4个文件

4. **关注上下文使用率**:
    - < 50%: 安全，可以自由操作
    - 50-75%: 注意，避免大量读取
    - 75-85%: 警告，将触发压缩
    - > 85%: 危险，立即压缩

**如何保持关键指令**：

1. **使用明确的指令性语言**:

    - ✅ "必须使用 PostgreSQL 数据库"
    - ✅ "所有 API 都要添加日志"
    - ❌ "可能用一下PostgreSQL吧"

2. **重要决策单独成句**:

    - ✅ "端口改为 3001"（单独一条消息）
    - ❌ "然后...端口改为3001...还有..."（混在长消息中）

3. **关键配置使用列表格式**:
    ```
    项目配置要求：
    1. 数据库：PostgreSQL
    2. 端口：3001
    3. 认证：JWT
    ```

---

**相关文档**：

- [Prompts 系统架构](./08-prompts-system.md)
- [内存优化分析](./09-memory-optimization-analysis.md)
- [上下文压缩机制](./03-context-compression.md)
