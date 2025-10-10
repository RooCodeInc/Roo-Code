# 内存溢出问题分析与优化建议

## 问题概述

在聊天记录过多的情况下，Roo-Code 项目存在内存溢出的风险。本文档详细分析了内存管理机制的现状，识别了潜在问题，并提供了具体的优化建议。

## 目录

1. [当前内存管理机制](#当前内存管理机制)
2. [核心问题分析](#核心问题分析)
3. [内存泄漏风险点](#内存泄漏风险点)
4. [优化建议](#优化建议)
5. [实施优先级](#实施优先级)
6. [监控和测试](#监控和测试)

---

## 当前内存管理机制

### 1. 消息存储结构

项目中存在两个主要的消息存储系统：

#### 1.1 UI 消息数组 (`clineMessages`)

- **位置**: `Task.ts` 第 254 行
- **类型**: `ClineMessage[]`
- **用途**: 存储在 WebView UI 中显示的消息
- **初始化**: 构造函数中设为空数组（第 1207 行）
- **持久化**: 每次添加/修改后保存到磁盘（`GlobalFileNames.uiMessages`）

**ClineMessage 结构**：

```typescript
interface ClineMessage {
	ts: number // 时间戳
	type: string // 消息类型
	say?: string // 消息动作
	text?: string // 文本内容
	partial?: boolean // 部分消息标记
	images?: string[] // 图片数据（Base64）
	checkpoint?: any // 检查点数据
	// ... 其他字段
}
```

#### 1.2 API 对话历史 (`apiConversationHistory`)

- **位置**: `Task.ts` 第 253 行
- **类型**: `ApiMessage[]`
- **用途**: 用于 API 调用的消息历史
- **同步**: 与 `clineMessages` 保持同步

**ApiMessage 结构**：

```typescript
interface ApiMessage {
	role: "user" | "assistant"
	content: string | ContentBlock[]
	ts: number
	isSummary?: boolean
}
```

### 2. 内存管理机制

#### 2.1 滑动窗口机制 (Sliding Window)

**文件**: `src/core/sliding-window/index.ts`

##### 核心函数 1: `truncateConversation()` (第 41-50 行)

**功能**: 截断对话历史

**策略**：

- 保留第一条消息（通常是任务描述）
- 移除中间的指定百分比消息（默认 50%）
- 确保移除偶数个消息以保持对话完整性
- 发送遥测事件

**计算方式**：

```typescript
const messagesToRemove = Math.floor((messages.length - 1) * fracToRemove)
// 确保为偶数
const evenMessagesToRemove = messagesToRemove % 2 === 0 ? messagesToRemove : messagesToRemove - 1
```

##### 核心函数 2: `truncateConversationIfNeeded()` (第 91-175 行)

**功能**: 根据 token 使用情况自动决定是否截断

**自动触发条件**：

1. **Token 总数超过允许阈值**：

    ```typescript
    const allowedTokens = contextWindow * (1 - TOKEN_BUFFER_PERCENTAGE) - reservedTokens
    // TOKEN_BUFFER_PERCENTAGE = 0.1 (10% 缓冲区)
    ```

2. **上下文百分比超过阈值**：
    ```typescript
    const contextPercent = (prevContextTokens / allowedTokens) * 100
    const effectiveThreshold = condenseThreshold >= 0 ? condenseThreshold : DEFAULT_CONDENSE_THRESHOLD // 70%
    ```

**两种处理策略**：

1. **自动压缩**（`autoCondenseContext = true`）：

    - 调用 LLM 生成对话摘要
    - 使用 `summarizeConversation()` 函数
    - 保留关键上下文信息

2. **滑动窗口**（`autoCondenseContext = false`）：
    - 直接删除 50% 的消息
    - 简单快速但会丢失上下文

**返回值**：

```typescript
interface TruncateResult {
	messages: ApiMessage[] // 截断后的消息数组
	prevContextTokens: number // 之前的 token 数量
	summary?: string // 摘要（如果使用压缩）
	cost?: number // 压缩成本
	newContextTokens?: number // 新的 token 数量
	error?: string // 错误信息
}
```

#### 2.2 消息压缩机制 (Condensation/Summarization)

**文件**: `src/core/condense/index.ts`

**核心常量**：

```typescript
export const N_MESSAGES_TO_KEEP = 3 // 保留最近 3 条消息
export const MIN_CONDENSE_THRESHOLD = 5
export const MAX_CONDENSE_THRESHOLD = 100
```

**核心函数**: `summarizeConversation()` (第 85-212 行)

**工作流程**：

1. **提取待压缩的消息**：

    ```typescript
    const firstMessage = messages[0] // 始终保留第一条消息
    const messagesToSummarize = getMessagesSinceLastSummary(messages.slice(0, -N_MESSAGES_TO_KEEP))
    const keepMessages = messages.slice(-N_MESSAGES_TO_KEEP)
    ```

2. **验证条件**：

    - 待压缩消息 > 1 条
    - 保留的消息中没有最近的摘要

3. **生成摘要**：

    - 使用自定义 prompt 或默认 `SUMMARY_PROMPT`
    - 使用压缩专用 API handler 或主 handler
    - 通过 LLM 生成详细摘要

4. **重建消息数组**：

    ```typescript
    const newMessages = [firstMessage, summaryMessage, ...keepMessages]
    ```

5. **验证压缩效果**：
    ```typescript
    if (newContextTokens >= prevContextTokens) {
    	return { error: "压缩后上下文反而增长" }
    }
    ```

**摘要提示词包含的内容**：

1. **Previous Conversation**: 整个对话的高层次细节
2. **Current Work**: 详细描述最近正在进行的工作
3. **Key Technical Concepts**: 技术概念、框架、编码约定
4. **Relevant Files and Code**: 相关文件和代码片段
5. **Problem Solving**: 已解决的问题和正在进行的排查
6. **Pending Tasks and Next Steps**: 待办任务和下一步计划（包含直接引用）

#### 2.3 Token 管理

**位置**: `Task.ts`

##### Token 使用统计 (第 2832-2834 行)

```typescript
public getTokenUsage(): TokenUsage {
    return getApiMetrics(this.clineMessages.slice(1))
}
```

- 计算当前任务的 token 使用情况
- 排除第一条消息（任务描述）

##### Token 缓存机制 (第 297-299 行)

```typescript
private tokenUsageSnapshot?: TokenUsage
private tokenUsageSnapshotAt?: number
```

- 缓存 token 计数，避免重复计算
- 仅在消息变化时重新计算

##### 上下文窗口超限处理 (第 2459-2517 行)

```typescript
async handleContextWindowExceededError(retryCount: number): Promise<void>
```

- 强制压缩到当前上下文的 75%
- 最多重试 3 次（`MAX_CONTEXT_WINDOW_RETRIES`）

#### 2.4 持久化机制

**文件**: `src/core/task-persistence/taskMessages.ts`

##### 读取消息 (第 17-30 行)

```typescript
export async function readTaskMessages({
	taskId,
	globalStoragePath,
}: ReadTaskMessagesOptions): Promise<ClineMessage[]> {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	const filePath = path.join(taskDir, GlobalFileNames.uiMessages)
	const fileExists = await fileExistsAtPath(filePath)

	if (fileExists) {
		return JSON.parse(await fs.readFile(filePath, "utf8"))
	}

	return []
}
```

##### 保存消息 (第 38-42 行)

```typescript
export async function saveTaskMessages({ messages, taskId, globalStoragePath }: SaveTaskMessagesOptions) {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	const filePath = path.join(taskDir, GlobalFileNames.uiMessages)
	await safeWriteJson(filePath, messages) // 原子写入
}
```

**保存触发点** (Task.ts):

- `addToClineMessages()` (第 615 行)：每次添加消息后
- `overwriteClineMessages()` (第 642 行)：每次覆盖消息后
- `updateClineMessage()` (第 647 行)：每次更新消息后
- `saveClineMessages()` (第 2272 行)：API 请求完成后

#### 2.5 消息操作方法

**Task.ts 中的关键方法**：

```typescript
// 添加新消息并保存
addToClineMessages(message: ClineMessage) (第 610-625 行)

// 覆盖消息数组并恢复 todoList
overwriteClineMessages(messages: ClineMessage[]) (第 627-643 行)

// 更新单个消息
updateClineMessage(index: number, updates: Partial<ClineMessage>) (第 645-658 行)

// 添加到 API 历史
addToApiConversationHistory(message: ApiMessage) (第 580-584 行)

// 覆盖 API 历史
overwriteApiConversationHistory(messages: ApiMessage[]) (第 586-589 行)
```

### 3. Provider 层面的管理

**文件**: `ClineProvider.ts`

#### 3.1 任务栈管理

```typescript
private clineStack: Task[] = []  // 第 130 行
```

**方法**：

- `addClineToStack()` (第 399-414 行)：添加任务到栈顶
- `removeClineFromStack()` (第 436-469 行)：移除栈顶任务并清理

支持父子任务嵌套。

#### 3.2 待处理操作管理 (第 107-115 行)

```typescript
interface PendingEditOperation {
    messageTs: number
    editedContent: string
    images?: string[]
    messageIndex: number
    apiConversationHistoryIndex: number
    timeoutId: NodeJS.Timeout
    createdAt: number
}

private pendingOperations: Map<string, PendingEditOperation> = new Map()
```

**特性**：

- 30 秒超时自动清理
- 防止内存泄漏

#### 3.3 事件监听器管理 (第 261-263, 458-462 行)

```typescript
private taskEventListeners: Map<Task, Array<() => void>> = new Map()

// 清理函数
const cleanupFunctions = this.taskEventListeners.get(task)
if

(cleanupFunctions) {
    cleanupFunctions.forEach((cleanup) => cleanup())
    this.taskEventListeners.delete(task)
}
```

#### 3.4 资源清理 (dispose 方法, 第 572-612 行)

**清理顺序**：

1. 中止当前任务
2. 清理所有待处理的编辑操作
3. 清理 webview 资源
4. 清理所有 disposables
5. 清理工作区追踪器
6. 清理 MCP Hub 和自定义模式管理器

```typescript
async dispose() {
    this.log("Disposing ClineProvider...")

    // 1. 中止当前任务
    await this.getCurrentTask()?.abortTask()

    // 2. 清理待处理操作
    this.clearAllPendingEditOperations()

    // 3-6. 清理其他资源
    if (this.view && "dispose" in this.view) {
        this.view.dispose()
    }
    this.disposables.forEach((x) => x?.dispose())
    this._workspaceTracker?.dispose()
    this.marketplaceManager?.cleanup()
    this.customModesManager?.dispose()
}
```

---

## 核心问题分析

### 问题 1: 双重消息存储导致内存翻倍 🔴

**问题描述**：

- `clineMessages` (UI 消息) 和 `apiConversationHistory` (API 消息) 同时存储完整的对话历史
- 两者内容高度重叠，造成不必要的内存浪费

**影响**：

- 长对话（例如 1000 条消息）会占用双倍内存
- 每条消息可能包含大量文本、代码片段、甚至 Base64 编码的图片

**代码位置**：

- `Task.ts` 第 253-254 行

**内存占用估算**：

```
场景: 1000 条消息的对话
- 平均每条消息: 2KB
- clineMessages: 1000 × 2KB = 2MB
- apiConversationHistory: 1000 × 2KB = 2MB
- 总计: 4MB (实际可能更高)
```

### 问题 2: Base64 图片数据未清理 🔴

**问题描述**：

- 图片以 Base64 编码存储在 `ClineMessage.images[]` 中
- 单张图片可能占用数 MB 内存
- 历史消息中的图片永不释放

**影响**：

```typescript
// 例如：一张 5MB 的图片编码后约 6.67MB
// 10 张图片 = 66.7MB
// 100 张图片 = 667MB
// 1000 张图片 = 6.67GB ❌
```

**代码位置**：

- `readFileTool.ts` 第 435-490 行（图片内存追踪器）
- `imageHelpers.ts` 第 11-186 行（图片验证和内存限制）

**当前限制**：

- 单次读取操作限制：20MB（`DEFAULT_MAX_TOTAL_IMAGE_SIZE`）
- 但历史消息中的图片不受此限制 ⚠️

**问题根源**：

```typescript
// imageHelpers.ts 中的 ImageMemoryTracker 只跟踪单次操作
class ImageMemoryTracker {
	private currentTotalMemoryUsed: number = 0

	// 问题：每次工具调用后会重置
	reset(): void {
		this.currentTotalMemoryUsed = 0 // ❌ 历史图片未计入
	}
}
```

### 问题 3: 消息持久化频繁触发 🟡

**问题描述**：

- 每次添加、更新、覆盖消息都会触发完整的文件写入
- 使用 `safeWriteJson` 虽然保证原子性，但涉及序列化整个消息数组

**影响**：

- 频繁的 I/O 操作
- 大型消息数组的序列化开销
- 可能导致 UI 卡顿

**代码位置**：

- `Task.ts` 第 615, 642, 647, 2272 行

**频率估算**：

```
假设一个复杂任务：
- 100 条消息
- 每条消息触发 1-2 次保存操作
- 总计 100-200 次完整数组序列化
- 每次序列化耗时: 10-50ms
- 总计: 1-10 秒的 CPU 时间
```

### 问题 4: 事件监听器未及时清理 🔴

**问题描述**：

- Task 实例上注册了多个事件监听器
- 如果 `dispose()` 未正确调用，监听器会持续引用 Task 对象
- 导致内存无法被垃圾回收

**风险点**：

1. **Task 事件监听** (ClineProvider.ts 第 261-263 行)：

    ```typescript
    this.taskEventListeners.set(instance, [
        instance.on("stateChanged", ...),
        instance.on("askResponse", ...),
        instance.on("stoppedStreaming", ...),
        // ... 更多监听器
    ])
    ```

2. **文件监听器** (FileContextTracker.ts 第 74-76 行)：

    ```typescript
    const watcher = vscode.workspace.createFileSystemWatcher(filePath)
    this.fileWatchers.set(filePath, watcher)
    // 如果未调用 watcher.dispose()，文件系统句柄不会释放
    ```

3. **RooIgnore 控制器** (Task.ts 第 1586-1593 行)：
    ```typescript
    this.rooIgnoreController = new RooIgnoreController(...)
    // 如果未 dispose，内部的 FileSystemWatcher 不会释放
    ```

**影响**：

- 内存泄漏
- 事件处理器持续运行
- 累积的监听器降低性能

### 问题 5: 消息压缩时机不当 🟡

**问题描述**：

- 默认阈值较高（70%）才触发自动压缩
- 在达到阈值前，内存持续增长
- 压缩失败时回退到简单截断，丢失上下文信息

**当前阈值**：

```typescript
DEFAULT_CONDENSE_THRESHOLD = 70 // 70% 上下文窗口使用率
TOKEN_BUFFER_PERCENTAGE = 0.1 // 10% 缓冲区
```

**问题场景**：

**场景 1: 缓慢接近阈值**

```
60% → 65% → 69% (未触发) → 71% (触发)
在 60-70% 之间持续消耗大量内存
```

**场景 2: 压缩失败**

```
1. 尝试 LLM 摘要生成
2. 失败（网络问题、API 限制等）
3. 回退到删除 50% 消息
4. 丢失重要上下文 ❌
```

**场景 3: 压缩后上下文反而增长**

```typescript
// condense/index.ts 第 207-210 行
if (newContextTokens >= prevContextTokens) {
	const error = t("common:errors.condense_context_grew")
	return { ...response, cost, error }
}
// 摘要太详细，反而占用更多 token
```

### 问题 6: 缺乏主动内存监控 🟡

**问题描述**：

- 没有实时内存使用监控
- 缺少内存压力告警机制
- 用户无法感知内存状态

**影响**：

- 内存溢出发生时已经太晚
- 难以定位具体原因
- 用户体验差

**当前状态**：

- ✅ 有 Token 计数（`getTokenUsage()`）
- ❌ 无内存占用统计
- ❌ 无内存告警
- ❌ 无内存可视化

### 问题 7: 待处理操作的内存累积 🟢

**问题描述**：

- `pendingOperations` Map 存储待处理的编辑操作
- 虽然有 30 秒超时，但在高频操作场景下可能累积

**代码位置**：

- `ClineProvider.ts` 第 107-115, 492-556 行

**风险场景**：

```typescript
// 用户快速编辑多条消息
Edit 1 → pendingOperations.set("1", {...})  // 包含完整消息内容
Edit 2 → pendingOperations.set("2", {...})
Edit 3 → pendingOperations.set("3", {...})
// 30 秒内未处理，累积多个操作
// 每个操作可能包含大量文本和图片
```

**评估**：

- 风险级别：🟢 低（有超时机制）
- 但在极端情况下仍需关注

### 问题 8: 消息数组的线性增长 🔴

**问题描述**：

- `clineMessages` 和 `apiConversationHistory` 都是简单数组
- 随着对话进行线性增长
- 数组操作（遍历、搜索）的时间复杂度 O(n)

**影响**：

- 长对话场景下性能下降
- 内存占用持续增加
- 搜索历史消息效率低

**数据示例**：

```
消息数量    内存占用(估算)      性能影响
100 条      ~1-5 MB           可接受
500 条      ~5-25 MB          边缘
1000 条     ~10-50 MB         风险
5000 条     ~50-250 MB        危险
10000 条    ~100-500 MB       严重 ❌
```

**操作复杂度**：

```typescript
// 搜索消息
findMessage(ts: number) {
    return this.clineMessages.find(m => m.ts === ts)  // O(n)
}

// 更新消息
updateMessage(ts: number, updates: Partial<ClineMessage>) {
    const index = this.clineMessages.findIndex(m => m.ts === ts)  // O(n)
    this.clineMessages[index] = { ...this.clineMessages[index], ...updates }
}

// 删除消息
deleteMessage(ts: number) {
    this.clineMessages = this.clineMessages.filter(m => m.ts !== ts)  // O(n)
}
```

---

## 内存泄漏风险点

### 1. Task 实例未正确清理

**风险级别**: 🔴 **高**

**位置**:

- `ClineProvider.ts` 第 436-469 行 (`removeClineFromStack`)
- `Task.ts` 第 1527-1597 行 (`dispose`)

**场景**：

- 创建子任务后未正确移除
- 异常退出时未调用 `dispose()`
- 事件监听器未清理

**检测方法**：

```typescript
// 在 Task 构造函数中添加
console.log(`[Task] Created: ${this.taskId}.${this.instanceId}`)

// 在 dispose 中添加
console.log(`[Task] Disposed: ${this.taskId}.${this.instanceId}`)

// 观察日志，确保每个 Created 都有对应的 Disposed
```

### 2. FileSystemWatcher 未释放

**风险级别**: 🔴 **高**

**位置**:

- `FileContextTracker.ts` 第 74-76, 220-226 行
- `RooIgnoreController.ts` 第 196-199 行

**影响**：

- 每个 watcher 持有文件系统句柄
- 累积过多导致系统资源耗尽

**正确模式**：

```typescript
// 创建
const watcher = vscode.workspace.createFileSystemWatcher(pattern)

// 使用
watcher.onDidChange(handler)

// 清理 (必须!)
watcher.dispose()
```

### 3. 循环引用

**风险级别**: 🟡 **中**

**可能位置**：

- `Task` ↔ `ClineProvider`
- `Task` ↔ `RooIgnoreController`
- `Task` ↔ `FileContextTracker`

**问题**：

- JavaScript 垃圾回收器可以处理循环引用
- 但如果涉及闭包或事件监听器，可能无法回收

**预防**：

```typescript
// 在 dispose 中显式断开引用
dispose() {
    this.provider = undefined
    this.rooIgnoreController = undefined
    this.fileContextTracker = undefined
}
```

### 4. 闭包捕获大对象

**风险级别**: 🟡 **中**

**危险模式**：

```typescript
// ❌ 错误：闭包捕获了整个数组
const allMessages = this.clineMessages // 大数组
someEmitter.on("event", () => {
	console.log(allMessages.length) // 整个数组无法被 GC
})
```

**安全模式**：

```typescript
// ✅ 正确：只捕获需要的数据
const messageCount = this.clineMessages.length
someEmitter.on("event", () => {
	console.log(messageCount)
})
```

### 5. Promise 未完成

**风险级别**: 🟡 **中**

**场景**：

- LLM API 调用超时或无响应
- Promise 永远不 resolve/reject
- 回调函数持有大量上下文

**预防**：

```typescript
// 添加超时机制
const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 30000))

await Promise.race([apiCall(), timeoutPromise])
```

---

## 优化建议

### 优先级 1: 🔴 必须实施（关键问题）

#### 1.1 实现图片数据的自动清理机制

**目标**: 解决 Base64 图片数据导致的内存溢出

**方案 A: 年龄基础的清理**

```typescript
// Task.ts 中添加
interface ClineMessageWithAge extends ClineMessage {
	addedAt: number // 添加时间戳
}

class Task {
	private readonly MAX_IMAGE_AGE_MS = 3600000 // 1小时

	// 定期清理旧图片
	private startImageCleanupTimer() {
		this.imageCleanupTimer = setInterval(() => {
			this.cleanupOldImages()
		}, 600000) // 每10分钟检查一次
	}

	private cleanupOldImages() {
		const now = Date.now()
		let cleanedCount = 0

		this.clineMessages = this.clineMessages.map((msg) => {
			if (msg.images && msg.images.length > 0) {
				const age = now - msg.ts
				if (age > this.MAX_IMAGE_AGE_MS) {
					cleanedCount += msg.images.length
					return { ...msg, images: undefined }
				}
			}
			return msg
		})

		if (cleanedCount > 0) {
			console.log(`Cleaned ${cleanedCount} old images`)
			this.saveClineMessages()
		}
	}
}
```

**方案 B: 基于内存压力的清理**

```typescript
class Task {
	private totalImageMemoryMB: number = 0
	private readonly MAX_TOTAL_IMAGE_MEMORY_MB = 100 // 100MB 限制

	addToClineMessages(message: ClineMessage) {
		// 计算新增图片占用
		if (message.images) {
			const newImageMemory = this.calculateImageMemory(message.images)
			this.totalImageMemoryMB += newImageMemory

			// 如果超过限制，清理最旧的图片
			if (this.totalImageMemoryMB > this.MAX_TOTAL_IMAGE_MEMORY_MB) {
				this.cleanupOldestImages()
			}
		}

		this.clineMessages.push(message)
		this.saveClineMessages()
	}

	private cleanupOldestImages() {
		// 按时间戳排序，清理最旧的图片
		for (const msg of this.clineMessages) {
			if (this.totalImageMemoryMB <= this.MAX_TOTAL_IMAGE_MEMORY_MB * 0.8) {
				break // 清理到 80% 为止
			}

			if (msg.images) {
				const memoryFreed = this.calculateImageMemory(msg.images)
				msg.images = undefined
				this.totalImageMemoryMB -= memoryFreed
			}
		}
	}
}
```

**方案 C: 图片外部化存储（推荐）**

```typescript
// 新建 src/core/image-storage/ImageManager.ts
class ImageManager {
	private imageDir: string

	async saveImage(taskId: string, imageData: string): Promise<string> {
		const imageId = `${Date.now()}_${Math.random().toString(36)}`
		const imagePath = path.join(this.imageDir, taskId, `${imageId}.jpg`)

		// 解码 Base64 并保存到磁盘
		const buffer = Buffer.from(imageData.split(",")[1], "base64")
		await fs.writeFile(imagePath, buffer)

		return imageId // 返回图片 ID 而非数据
	}

	async loadImage(taskId: string, imageId: string): Promise<string> {
		const imagePath = path.join(this.imageDir, taskId, `${imageId}.jpg`)
		const buffer = await fs.readFile(imagePath)
		return `data:image/jpeg;base64,${buffer.toString("base64")}`
	}

	async cleanupTaskImages(taskId: string) {
		const taskImageDir = path.join(this.imageDir, taskId)
		await fs.rm(taskImageDir, { recursive: true, force: true })
	}
}

// 修改 ClineMessage 结构
interface ClineMessage {
	// images?: string[]  // 旧：存储 Base64 数据
	imageIds?: string[] // 新：只存储图片 ID
}
```

**效果对比**：

```
方案 A: 定期清理
- 优点: 实现简单
- 缺点: 可能清理仍在使用的图片

方案 B: 内存压力清理
- 优点: 动态响应内存压力
- 缺点: 需要准确跟踪内存使用

方案 C: 外部化存储 ⭐ 推荐
- 优点: 内存占用最小，图片可持久化
- 缺点: 需要磁盘 I/O，实现复杂
```

#### 1.2 优化消息持久化策略

**目标**: 减少频繁的文件写入操作

**方案: 批量写入 + 防抖**

```typescript
// Task.ts 中添加
class Task {
	private saveDebounceTimer?: NodeJS.Timeout
	private pendingSave: boolean = false
	private readonly SAVE_DEBOUNCE_MS = 1000 // 1秒防抖

	// 替换所有直接保存调用
	private scheduleSave() {
		this.pendingSave = true

		if (this.saveDebounceTimer) {
			clearTimeout(this.saveDebounceTimer)
		}

		this.saveDebounceTimer = setTimeout(() => {
			if (this.pendingSave) {
				this.saveClineMessages()
				this.pendingSave = false
			}
		}, this.SAVE_DEBOUNCE_MS)
	}

	// 修改现有方法
	addToClineMessages(message: ClineMessage) {
		this.clineMessages.push(message)
		this.scheduleSave() // 替代直接保存
	}

	updateClineMessage(index: number, updates: Partial<ClineMessage>) {
		this.clineMessages[index] = { ...this.clineMessages[index], ...updates }
		this.scheduleSave() // 替代直接保存
	}

	// 在关键时刻强制保存
	async beforeApiCall() {
		if (this.pendingSave) {
			await this.saveClineMessages()
			this.pendingSave = false
		}
	}
}
```

**效果**：

```
优化前: 100 次操作 = 100 次文件写入
优化后: 100 次操作 = 10-20 次文件写入（减少 80-90%）
```

#### 1.3 确保资源清理的完整性

**目标**: 防止事件监听器和文件监听器泄漏

**方案: 强化 dispose 机制**

```typescript
// Task.ts 中增强
class Task {
	private disposables: vscode.Disposable[] = []

	constructor() {
		// 所有创建的 disposable 对象都注册到数组
		const watcher = vscode.workspace.createFileSystemWatcher(pattern)
		this.disposables.push(watcher)

		const subscription = someEmitter.on("event", handler)
		this.disposables.push({ dispose: () => subscription.unsubscribe() })
	}

	dispose() {
		console.log(`[Task#dispose] disposing task ${this.taskId}.${this.instanceId}`)

		// 1. 移除所有事件监听器 (最优先!)
		this.removeAllListeners()

		// 2. 清理所有 disposables
		for (const disposable of this.disposables) {
			try {
				disposable?.dispose()
			} catch (error) {
				console.error(`Failed to dispose resource:`, error)
			}
		}
		this.disposables = []

		// 3. 断开循环引用
		this.provider = undefined
		this.rooIgnoreController = undefined
		this.fileContextTracker = undefined

		// 4. 清理定时器
		if (this.saveDebounceTimer) {
			clearTimeout(this.saveDebounceTimer)
		}
		if (this.imageCleanupTimer) {
			clearInterval(this.imageCleanupTimer)
		}

		// 5. 清理大对象
		this.clineMessages = []
		this.apiConversationHistory = []
	}
}
```

**添加 dispose 验证测试**：

```typescript
// Task.dispose.test.ts
describe("Task disposal", () => {
	it("should clean up all resources", async () => {
		const task = new Task(options)

		// 模拟正常使用
		await task.say("user", "Hello")
		await task.addToClineMessages({ ts: Date.now(), type: "say", say: "user" })

		// Dispose
		task.dispose()

		// 验证清理
		expect(task.clineMessages).toHaveLength(0)
		expect(task.apiConversationHistory).toHaveLength(0)
		expect(task.disposables).toHaveLength(0)
	})
})
```

### 优先级 2: 🟡 应当实施（性能优化）

#### 2.1 降低压缩阈值

**目标**: 更早触发压缩，避免内存累积

**方案**：

```typescript
// 修改默认阈值
// sliding-window/index.ts
export const DEFAULT_CONDENSE_THRESHOLD = 50 // 从 70% 降到 50%

// 或者基于消息数量触发
class Task {
	private readonly MAX_MESSAGES_BEFORE_CONDENSE = 200

	async addToClineMessages(message: ClineMessage) {
		this.clineMessages.push(message)

		// 检查是否需要压缩
		if (this.clineMessages.length > this.MAX_MESSAGES_BEFORE_CONDENSE) {
			await this.condenseContext()
		}

		this.scheduleSave()
	}
}
```

#### 2.2 实现消息分页加载

**目标**: UI 不一次性加载所有历史消息

**方案**：

```typescript
// 修改消息加载逻辑
class Task {
	private readonly MESSAGES_PER_PAGE = 50
	private currentPage: number = 0

	// 只加载最近的消息
	getVisibleMessages(): ClineMessage[] {
		const start = Math.max(0, this.clineMessages.length - this.MESSAGES_PER_PAGE)
		return this.clineMessages.slice(start)
	}

	// 按需加载更多历史
	loadMoreMessages(page: number): ClineMessage[] {
		const end = this.clineMessages.length - page * this.MESSAGES_PER_PAGE
		const start = Math.max(0, end - this.MESSAGES_PER_PAGE)
		return this.clineMessages.slice(start, end)
	}
}
```

#### 2.3 优化消息索引

**目标**: 提高消息查找效率

**方案: 添加 Map 索引**

```typescript
class Task {
	private messageIndex: Map<number, ClineMessage> = new Map()

	// 添加消息时同步更新索引
	addToClineMessages(message: ClineMessage) {
		this.clineMessages.push(message)
		this.messageIndex.set(message.ts, message)
		this.scheduleSave()
	}

	// O(1) 查找，替代 O(n) 的 find
	findMessageByTimestamp(ts: number): ClineMessage | undefined {
		return this.messageIndex.get(ts)
	}

	// 删除时同步更新索引
	deleteMessage(ts: number) {
		this.messageIndex.delete(ts)
		this.clineMessages = this.clineMessages.filter((m) => m.ts !== ts)
	}
}
```

**效果**：

- 查找性能：O(n) → O(1)
- 对于 1000 条消息：~1000x 性能提升

### 优先级 3: 🟢 可以实施（增强功能）

#### 3.1 添加内存监控和告警

**目标**: 实时监控内存使用，提前预警

**方案**：

```typescript
// 新建 src/core/memory/MemoryMonitor.ts
class MemoryMonitor {
	private readonly MEMORY_CHECK_INTERVAL_MS = 30000 // 30秒
	private readonly WARNING_THRESHOLD_MB = 500
	private readonly CRITICAL_THRESHOLD_MB = 1000

	startMonitoring(task: Task) {
		setInterval(() => {
			const usage = this.getMemoryUsage(task)

			if (usage.totalMB > this.CRITICAL_THRESHOLD_MB) {
				this.emitCriticalWarning(usage)
				task.forceCleanup()
			} else if (usage.totalMB > this.WARNING_THRESHOLD_MB) {
				this.emitWarning(usage)
			}
		}, this.MEMORY_CHECK_INTERVAL_MS)
	}

	getMemoryUsage(task: Task): MemoryUsage {
		return {
			messages: this.estimateMessagesSize(task.clineMessages),
			images: this.estimateImagesSize(task.clineMessages),
			apiHistory: this.estimateMessagesSize(task.apiConversationHistory),
			totalMB: 0, // 计算总和
		}
	}

	private estimateMessagesSize(messages: any[]): number {
		// 粗略估算：JSON 序列化后的大小
		const jsonStr = JSON.stringify(messages)
		return jsonStr.length / (1024 * 1024) // 转换为 MB
	}
}
```

#### 3.2 实现消息归档机制

**目标**: 将旧消息归档到磁盘，减少内存占用

**方案**：

```typescript
// 新建 src/core/archive/MessageArchiver.ts
class MessageArchiver {
	async archiveOldMessages(task: Task, threshold: number = 500) {
		if (task.clineMessages.length <= threshold) {
			return
		}

		// 归档前 N-threshold 条消息
		const toArchive = task.clineMessages.slice(0, -threshold)
		const toKeep = task.clineMessages.slice(-threshold)

		// 保存到归档文件
		const archivePath = this.getArchivePath(task.taskId)
		await this.appendToArchive(archivePath, toArchive)

		// 更新内存中的消息
		task.overwriteClineMessages(toKeep)

		console.log(`Archived ${toArchive.length} messages`)
	}

	async loadArchivedMessages(taskId: string, page: number = 0): Promise<ClineMessage[]> {
		const archivePath = this.getArchivePath(taskId)
		// 分页加载归档消息
		return this.readArchivePage(archivePath, page)
	}
}
```

#### 3.3 优化双重存储

**目标**: 减少 clineMessages 和 apiConversationHistory 的冗余

**方案 A: 按需转换**

```typescript
class Task {
	// 只保留一份完整数据
	private messages: ClineMessage[] = []

	// 按需生成 API 格式
	get apiConversationHistory(): ApiMessage[] {
		return this.messages
			.filter((msg) => msg.type === "say" && (msg.say === "user" || msg.say === "assistant"))
			.map((msg) => this.convertToApiMessage(msg))
	}

	private convertToApiMessage(clineMsg: ClineMessage): ApiMessage {
		return {
			role: clineMsg.say === "user" ? "user" : "assistant",
			content: clineMsg.text || "",
			ts: clineMsg.ts,
		}
	}
}
```

**方案 B: 使用弱引用（高级）**

```typescript
class Task {
	private messages: ClineMessage[] = []
	private apiHistoryCache: WeakMap<ClineMessage, ApiMessage> = new WeakMap()

	getApiMessage(clineMsg: ClineMessage): ApiMessage {
		if (!this.apiHistoryCache.has(clineMsg)) {
			this.apiHistoryCache.set(clineMsg, this.convertToApiMessage(clineMsg))
		}
		return this.apiHistoryCache.get(clineMsg)!
	}
}
```

---

## 实施优先级

### 阶段 1: 紧急修复（1-2 周）

**必须完成**：

1. ✅ **图片数据清理机制**

    - 实施方案 C（外部化存储）
    - 预计工作量: 3-5 天
    - 影响: 解决最严重的内存问题

2. ✅ **强化资源清理**

    - 增强 `dispose()` 方法
    - 添加清理验证测试
    - 预计工作量: 2-3 天
    - 影响: 防止内存泄漏

3. ✅ **优化持久化策略**
    - 实施防抖机制
    - 预计工作量: 1-2 天
    - 影响: 减少 I/O 压力

**验收标准**：

- 1000 条消息的对话内存占用 < 100MB
- 无明显的内存泄漏
- 文件写入次数减少 80%

### 阶段 2: 性能优化（2-4 周）

**应当完成**：

1. ✅ **降低压缩阈值**

    - 从 70% 降到 50%
    - 预计工作量: 0.5 天
    - 影响: 更早触发压缩

2. ✅ **消息分页加载**

    - 实施分页机制
    - 预计工作量: 3-4 天
    - 影响: 减少 UI 内存占用

3. ✅ **优化消息索引**
    - 添加 Map 索引
    - 预计工作量: 1-2 天
    - 影响: 提升查找性能

**验收标准**：

- 5000 条消息的对话内存占用 < 200MB
- UI 响应时间 < 100ms
- 消息查找性能提升 10x

### 阶段 3: 增强功能（可选，4-6 周后）

**可以完成**：

1. ⭐ **内存监控和告警**

    - 实时监控
    - 可视化展示
    - 预计工作量: 2-3 天

2. ⭐ **消息归档机制**

    - 自动归档
    - 按需加载
    - 预计工作量: 3-5 天

3. ⭐ **优化双重存储**
    - 减少冗余
    - 预计工作量: 2-3 天

**验收标准**：

- 10000 条消息的对话内存占用 < 300MB
- 提供内存使用可视化
- 支持无限长度对话

---

## 监控和测试

### 1. 内存监控指标

**需要跟踪的指标**：

```typescript
interface MemoryMetrics {
	// 消息相关
	messageCount: number
	messagesMemoryMB: number

	// 图片相关
	imageCount: number
	imagesMemoryMB: number

	// API 历史
	apiHistoryCount: number
	apiHistoryMemoryMB: number

	// 总计
	totalMemoryMB: number
	heapUsedMB: number // Node.js 进程堆内存

	// 压缩统计
	lastCondenseAt: number
	condenseCount: number

	// 性能指标
	avgSaveTimeMs: number
	avgSearchTimeMs: number
}
```

### 2. 压力测试场景

**测试场景 1: 长对话**

```typescript
describe("Long conversation memory test", () => {
	it("should handle 10000 messages without OOM", async () => {
		const task = new Task(options)

		for (let i = 0; i < 10000; i++) {
			await task.say("user", `Message ${i}`)

			// 每 100 条检查内存
			if (i % 100 === 0) {
				const memory = process.memoryUsage()
				expect(memory.heapUsed / 1024 / 1024).toBeLessThan(500) // < 500MB
			}
		}
	})
})
```

**测试场景 2: 大量图片**

```typescript
describe("Image memory test", () => {
	it("should handle 100 images without OOM", async () => {
		const task = new Task(options)
		const base64Image = generateBase64Image(5 * 1024 * 1024) // 5MB

		for (let i = 0; i < 100; i++) {
			await task.say("user", "Image", [base64Image])
		}

		const memory = task.getMemoryUsage()
		expect(memory.totalMB).toBeLessThan(200) // 应该已清理旧图片
	})
})
```

**测试场景 3: 资源泄漏检测**

```typescript
describe("Memory leak detection", () => {
	it("should not leak memory after dispose", async () => {
		const initialMemory = process.memoryUsage().heapUsed

		for (let i = 0; i < 100; i++) {
			const task = new Task(options)
			await task.say("user", "Test")
			task.dispose()
		}

		global.gc() // 强制垃圾回收
		await new Promise((resolve) => setTimeout(resolve, 1000))

		const finalMemory = process.memoryUsage().heapUsed
		const leakedMB = (finalMemory - initialMemory) / 1024 / 1024

		expect(leakedMB).toBeLessThan(10) // 泄漏 < 10MB
	})
})
```

### 3. 生产环境监控

**建议添加的遥测事件**：

```typescript
// TelemetryService 中添加
class TelemetryService {
	captureMemoryUsage(metrics: MemoryMetrics) {
		this.capture("memory_usage", {
			message_count: metrics.messageCount,
			total_memory_mb: metrics.totalMemoryMB,
			image_memory_mb: metrics.imagesMemoryMB,
			heap_used_mb: metrics.heapUsedMB,
		})
	}

	captureMemoryWarning(level: "warning" | "critical", metrics: MemoryMetrics) {
		this.capture("memory_warning", {
			level,
			...metrics,
		})
	}

	captureImageCleanup(cleanedCount: number, freedMB: number) {
		this.capture("image_cleanup", {
			cleaned_count: cleanedCount,
			freed_mb: freedMB,
		})
	}
}
```

---

## 总结

### 当前状态

✅ **已有机制**：

- 滑动窗口截断
- 消息压缩（LLM 摘要）
- 持久化存储
- 基本的资源清理

❌ **主要问题**：

- 双重消息存储
- Base64 图片未清理
- 频繁的文件写入
- 事件监听器泄漏风险
- 缺乏内存监控

### 预期效果

实施所有优化后：

| 场景         | 当前内存占用 | 优化后内存占用 | 改善率 |
| ------------ | ------------ | -------------- | ------ |
| 1000 条消息  | ~100-200 MB  | ~50-80 MB      | 50% ↓  |
| 5000 条消息  | ~500-1000 MB | ~150-250 MB    | 70% ↓  |
| 10000 条消息 | ~1-2 GB ❌   | ~200-400 MB ✅ | 80% ↓  |
| 100 张图片   | ~667 MB      | ~50 MB         | 92% ↓  |

### 关键建议

1. **立即实施**: 图片外部化存储（解决最大问题）
2. **高优先级**: 强化资源清理（防止泄漏）
3. **中优先级**: 优化持久化策略（提升性能）
4. **长期优化**: 消息归档机制（支持超长对话）

### 风险提示

⚠️ **兼容性风险**：

- 修改消息结构可能影响现有任务
- 需要数据迁移方案

⚠️ **性能风险**：

- 外部化存储增加磁盘 I/O
- 需要权衡内存和 I/O

⚠️ **测试风险**：

- 需要充分的压力测试
- 生产环境监控必不可少

---

**文档版本**: 1.0  
**创建日期**: 2025-10-10  
**最后更新**: 2025-10-10  
**作者**: Roo Code 开发团队
