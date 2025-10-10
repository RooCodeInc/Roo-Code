# 批量任务模式需求分析与技术设计

## 文档版本

- **创建时间**: 2025-10-10
- **最后更新**: 2025-10-10
- **状态**: 草案

---

## 1. 需求背景

### 1.1 问题描述

用户在使用 Roo-Code 时，经常需要对大量文件执行相似的操作，例如：

1. **格式转换**：将 `src` 目录下所有 `.js` 文件转换为 `.ts` 文件
2. **批量重构**：统一更新多个文件的 API 调用方式
3. **批量测试生成**：为多个模块文件生成对应的单元测试
4. **批量文档生成**：为多个文件添加 JSDoc 注释

**现有系统的局限性**：

1. **单任务单线程**：`Task` 类设计为顺序执行，无法并发处理多个文件
2. **输出截断问题**：批处理文件时，大模型容易输出较短内容就停止，导致文件不完整
3. **手动逐个处理**：用户需要手动为每个文件创建任务，效率低下
4. **缺乏进度跟踪**：无法实时查看批量任务的整体进度和状态
5. **错误隔离不足**：单个文件失败可能影响整个批量操作

### 1.2 用户场景

**场景 1：JS → TS 批量转换**

```
用户需求：将 src/ 目录下所有 .js 文件转换为 .ts
期望行为：
  - 自动识别所有匹配文件（如 src/**/*.js）
  - 并发处理（用户可设置并发数为 2、4、8 等）
  - 转换后保存到原目录（或指定的新目录）
  - 显示实时进度（已完成 3/10，成功 2，失败 1）
  - 单个文件失败不影响其他文件
```

**场景 2：API 批量迁移**

```
用户需求：将所有文件中的旧 API 调用更新为新 API
涉及文件：50+ 个组件文件
期望行为：
  - 批量扫描和修改文件
  - 保证每个文件修改完整（不截断）
  - 允许后台运行，不阻塞主对话
  - 生成修改摘要报告
```

**场景 3：测试批量生成**

```
用户需求：为 src/utils/ 下所有工具函数生成单元测试
期望行为：
  - 自动为每个文件创建对应的 .test.ts 文件
  - 并发生成多个测试文件
  - 保存到 tests/ 目录
  - 测试文件命名规范化
```

---

## 2. 技术架构设计

### 2.1 系统架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                      ClineProvider                           │
│  (管理批量任务的创建和生命周期)                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ 创建和管理
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   BatchTaskManager                           │
│  (批量任务调度和协调)                                        │
│  - 管理任务队列                                              │
│  - 协调任务执行顺序                                          │
│  - 聚合任务结果                                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ 使用
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   BatchProcessor                             │
│  (批量处理核心逻辑)                                          │
│  - 文件扫描和匹配                                            │
│  - 并发控制                                                  │
│  - 进度跟踪                                                  │
│  - 错误处理和重试                                            │
└─────┬───────────────────────────────────────────────────────┘
      │
      │ 创建和管理多个
      ▼
┌─────────────────────────────────────────────────────────────┐
│                        Task                                  │
│  (单个文件处理任务)                                          │
│  - 复用现有 Task 类                                          │
│  - 每个文件一个 Task 实例                                    │
│  - 独立的上下文和状态                                        │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 核心组件设计

#### 2.2.1 BatchConfig（批量任务配置）

```typescript
interface BatchConfig {
	// 文件选择
	filePattern: string // 文件匹配模式，如 "src/**/*.js"
	workingDirectory?: string // 工作目录（默认为当前工作区）
	excludePatterns?: string[] // 排除模式，如 ["node_modules/**"]

	// 执行配置
	concurrency: number // 并发数（1-8，默认 2）
	mode: string // 使用的模式（code, architect 等）
	backgroundExecution: boolean // 是否后台运行（默认 false）

	// 输出配置
	outputDirectory?: string // 输出目录（默认为原目录）
	outputPattern?: string // 输出文件名模式，如 "{name}.ts"
	preserveDirectory: boolean // 是否保留目录结构（默认 true）

	// 任务配置
	taskTemplate: string // 任务模板（描述对每个文件的操作）
	maxRetries: number // 最大重试次数（默认 1）
	timeoutPerFile: number // 单文件超时（毫秒，默认 300000）

	// 质量控制
	validateOutput: boolean // 是否验证输出（默认 true）
	outputValidator?: (content: string) => boolean // 自定义验证函数
	minOutputLines?: number // 最小输出行数（防止截断）

	// 用户交互
	confirmBeforeStart: boolean // 开始前确认（默认 true）
	progressNotification: boolean // 进度通知（默认 true）
}
```

#### 2.2.2 BatchProcessor（批量处理器）

**职责**：

- 扫描和匹配文件
- 管理并发队列
- 追踪任务进度
- 处理错误和重试

**关键方法**：

```typescript
class BatchProcessor {
	private config: BatchConfig
	private taskQueue: BatchTaskItem[]
	private runningTasks: Map<string, Task>
	private results: Map<string, BatchTaskResult>
	private progressTracker: ProgressTracker

	// 初始化批处理器
	constructor(config: BatchConfig, provider: ClineProvider)

	// 扫描匹配的文件
	async scanFiles(): Promise<string[]>

	// 开始批量处理
	async start(): Promise<BatchResult>

	// 暂停批量处理
	async pause(): Promise<void>

	// 恢复批量处理
	async resume(): Promise<void>

	// 取消批量处理
	async cancel(): Promise<void>

	// 获取当前进度
	getProgress(): BatchProgress

	// 处理单个文件
	private async processFile(filePath: string): Promise<BatchTaskResult>

	// 管理并发队列
	private async manageQueue(): Promise<void>

	// 验证输出
	private async validateOutput(filePath: string, content: string): Promise<ValidationResult>
}
```

#### 2.2.3 BatchTaskManager（批量任务管理器）

**职责**：

- 协调多个批量任务
- 管理任务生命周期
- 提供统一的状态接口

```typescript
class BatchTaskManager {
	private batchTasks: Map<string, BatchProcessor>
	private activeTaskId?: string

	// 创建新的批量任务
	async createBatchTask(config: BatchConfig): Promise<string>

	// 获取批量任务
	getBatchTask(taskId: string): BatchProcessor | undefined

	// 列出所有批量任务
	listBatchTasks(): BatchTaskInfo[]

	// 删除批量任务
	async deleteBatchTask(taskId: string): Promise<void>

	// 获取聚合状态
	getAggregatedStatus(): AggregatedBatchStatus
}
```

#### 2.2.4 ProgressTracker（进度跟踪器）

**职责**：

- 实时更新任务进度
- 生成进度报告
- 触发进度事件

```typescript
class ProgressTracker {
	private total: number
	private completed: number
	private failed: number
	private inProgress: number

	// 更新进度
	update(status: TaskStatus): void

	// 获取进度信息
	getProgress(): BatchProgress

	// 生成进度报告
	generateReport(): ProgressReport

	// 注册进度监听器
	onProgress(callback: (progress: BatchProgress) => void): void
}
```

### 2.3 数据结构定义

#### 批量任务项

```typescript
interface BatchTaskItem {
	id: string // 任务 ID
	filePath: string // 文件路径
	status: BatchTaskStatus // 任务状态
	task?: Task // Task 实例
	result?: BatchTaskResult // 任务结果
	retries: number // 重试次数
	startTime?: number // 开始时间
	endTime?: number // 结束时间
	error?: string // 错误信息
}

type BatchTaskStatus =
	| "pending" // 待处理
	| "queued" // 已入队
	| "running" // 运行中
	| "completed" // 已完成
	| "failed" // 失败
	| "retrying" // 重试中
	| "cancelled" // 已取消
```

#### 批量任务结果

```typescript
interface BatchTaskResult {
	success: boolean // 是否成功
	filePath: string // 文件路径
	outputPath?: string // 输出路径
	outputContent?: string // 输出内容
	error?: string // 错误信息
	tokenUsage?: TokenUsage // Token 使用情况
	duration: number // 执行时长（毫秒）
	retries: number // 重试次数
}

interface BatchResult {
	batchId: string // 批量任务 ID
	totalFiles: number // 总文件数
	successCount: number // 成功数
	failedCount: number // 失败数
	cancelledCount: number // 取消数
	results: BatchTaskResult[] // 详细结果
	totalDuration: number // 总耗时
	totalTokens: TokenUsage // 总 Token 使用
	summary: string // 摘要报告
}
```

#### 进度信息

```typescript
interface BatchProgress {
	total: number // 总任务数
	completed: number // 已完成
	failed: number // 已失败
	inProgress: number // 进行中
	pending: number // 待处理
	percentage: number // 完成百分比
	estimatedTimeRemaining?: number // 预计剩余时间（毫秒）
	currentFile?: string // 当前处理的文件
}
```

### 2.4 并发控制策略

#### 工作队列模式

```typescript
class ConcurrencyController {
	private maxConcurrency: number
	private queue: BatchTaskItem[]
	private running: Set<string>

	// 添加任务到队列
	enqueue(item: BatchTaskItem): void

	// 尝试启动下一个任务
	async tryStartNext(): Promise<boolean>

	// 任务完成回调
	onTaskComplete(taskId: string): void

	// 获取可用槽位数
	getAvailableSlots(): number
}
```

**执行流程**：

```
1. 初始化：创建任务队列，设置并发限制
2. 填充队列：将所有待处理文件加入队列
3. 启动任务：
   - 检查可用槽位（maxConcurrency - running.size）
   - 从队列取出任务
   - 创建 Task 实例并启动
   - 将任务加入 running 集合
4. 任务完成：
   - 从 running 移除
   - 记录结果
   -
   - 尝试启动下一个任务
5. 重复步骤 3-4，直到队列为空
```

**并发控制参数**：

- **推荐值**：2-4 个并发任务（平衡速度和 API 限制）
- **最大值**：8 个并发任务（避免过度消耗资源）
- **动态调整**：根据 API 速率限制和错误率自动调整

### 2.5 输出截断问题解决方案

#### 问题分析

大模型在批量处理时容易出现输出截断，主要原因：

1. **Token 限制**：输出 token 达到上限
2. **上下文过长**：批处理文件内容占用过多上下文
3. **模型判断完成**：模型误认为任务已完成
4. **流式输出中断**：网络或其他原因导致流中断

#### 解决策略

**策略 1：单文件独立上下文**

```typescript
// 每个文件使用独立的 Task 实例和上下文
// 避免上下文累积导致的截断
class BatchProcessor {
	private async processFile(filePath: string): Promise<BatchTaskResult> {
		// 创建独立的 Task 实例
		const task = new Task({
			// ... 配置
			// 清空历史上下文，只保留当前文件信息
		})

		// 构建精简的任务描述
		const message = this.buildTaskMessage(filePath)

		// 执行任务
		await task.startTask(message)

		return this.extractResult(task)
	}
}
```

**策略 2：强制完整输出验证**

```typescript
interface OutputValidator {
	// 验证输出是否完整
	validate(content: string, originalFile?: string): ValidationResult

	// 检测截断标记
	detectTruncation(content: string): boolean

	// 估计预期长度
	estimateExpectedLength(originalFile: string): number
}

class TruncationDetector implements OutputValidator {
	validate(content: string, originalFile?: string): ValidationResult {
		const issues: string[] = []

		// 检查 1：是否包含截断注释
		if (this.hasTruncationComments(content)) {
			issues.push('Found truncation comments like "// rest of code unchanged"')
		}

		// 检查 2：语法完整性
		if (!this.isSyntaxComplete(content)) {
			issues.push("Incomplete syntax detected (unclosed brackets, etc.)")
		}

		// 检查 3：长度合理性
		if (originalFile && this.isUnreasonablyShort(content, originalFile)) {
			issues.push("Output is significantly shorter than input")
		}

		// 检查 4：是否突然结束
		if (this.hasAbruptEnding(content)) {
			issues.push("Content appears to end abruptly")
		}

		return {
			isValid: issues.length === 0,
			issues,
			confidence: this.calculateConfidence(issues),
		}
	}

	private hasTruncationComments(content: string): boolean {
		const patterns = [
			/\/\/\s*rest of.*unchanged/i,
			/\/\/\s*\.\.\./,
			/\/\*\s*previous.*code\s*\*\//i,
			/\/\*\s*\.\.\.\s*\*\//,
		]
		return patterns.some((pattern) => pattern.test(content))
	}

	private isSyntaxComplete(content: string): boolean {
		// 简单的括号匹配检查
		const openBrackets = (content.match(/[{[(]/g) || []).length
		const closeBrackets = (content.match(/[}\])]/g) || []).length
		return openBrackets === closeBrackets
	}

	private isUnreasonablyShort(content: string, original: string): boolean {
		const contentLines = content.split("\n").length
		const originalLines = original.split("\n").length
		// 如果输出少于原始文件的 50%，认为可能被截断
		return contentLines < originalLines * 0.5
	}

	private hasAbruptEnding(content: string): boolean {
		// 检查是否以不完整的语句结束
		const lastNonEmptyLine = content.trim().split("\n").pop() || ""
		// 如果最后一行不是完整语句（缺少分号、括号等），可能被截断
		return !/[;}\])]$/.test(lastNonEmptyLine.trim())
	}
}
```

**策略 3：分块处理大文件**

```typescript
class LargeFileProcessor {
	async processLargeFile(filePath: string, maxChunkSize: number = 500): Promise<string> {
		const content = await fs.readFile(filePath, "utf-8")
		const lines = content.split("\n")

		if (lines.length <= maxChunkSize) {
			// 文件较小，直接处理
			return this.processSingleChunk(filePath, content)
		}

		// 大文件分块处理
		const chunks = this.splitIntoChunks(lines, maxChunkSize)
		const processedChunks: string[] = []

		for (const chunk of chunks) {
			const result = await this.processSingleChunk(filePath, chunk.join("\n"), { isPartial: true })
			processedChunks.push(result)
		}

		// 合并结果
		return this.mergeChunks(processedChunks)
	}

	private splitIntoChunks(lines: string[], maxSize: number): string[][] {
		// 智能分块，尊重函数/类边界
		// ...
	}
}
```

**策略 4：重试机制**

```typescript
class RetryStrategy {
	async executeWithRetry<T>(
		operation: () => Promise<T>,
		validator: (result: T) => boolean,
		maxRetries: number = 2,
	): Promise<T> {
		let lastError: Error | undefined

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				const result = await operation()

				// 验证结果
				if (validator(result)) {
					return result
				}

				// 结果无效，准备重试
				console.warn(`Attempt ${attempt + 1} produced invalid result, retrying...`)
			} catch (error) {
				lastError = error as Error
				console.error(`Attempt ${attempt + 1} failed:`, error)
			}

			// 指数退避
			if (attempt < maxRetries) {
				await this.sleep(Math.pow(2, attempt) * 1000)
			}
		}

		throw new Error(`Operation failed after ${maxRetries + 1} attempts: ${lastError?.message}`)
	}
}
```

### 2.6 后台运行机制

#### 设计目标

- 批量任务可在后台运行，不阻塞主对话
- 用户可随时查看后台任务进度
- 后台任务完成后发送通知
- 支持多个后台任务同时运行

#### 实现方案

**方案 1：独立任务管理器**

```typescript
class BackgroundTaskManager {
	private backgroundTasks: Map<string, BatchProcessor>

	// 启动后台任务
	async startBackground(config: BatchConfig): Promise<string> {
		const taskId = this.generateTaskId()
		const processor = new BatchProcessor(config, this.provider)

		this.backgroundTasks.set(taskId, processor)

		// 异步执行，不阻塞
		this.executeInBackground(taskId, processor)

		return taskId
	}

	private async executeInBackground(taskId: string, processor: BatchProcessor): Promise<void> {
		try {
			const result = await processor.start()

			// 任务完成通知
			await this.notifyCompletion(taskId, result)
		} catch (error) {
			// 错误通知
			await this.notifyError(taskId, error)
		} finally {
			// 清理（可选，也可保留供用户查看）
			// this.backgroundTasks.delete(taskId)
		}
	}

	// 查看后台任务状态
	getBackgroundTaskStatus(taskId: string): BatchProgress | undefined {
		const processor = this.backgroundTasks.get(taskId)
		return processor?.getProgress()
	}

	// 列出所有后台任务
	listBackgroundTasks(): BackgroundTaskInfo[] {
		return Array.from(this.backgroundTasks.entries()).map(([id, processor]) => ({
			id,
			progress: processor.getProgress(),
			config: processor.config,
			startTime: processor.startTime,
		}))
	}

	// 取消后台任务
	async cancelBackgroundTask(taskId: string): Promise<void> {
		const processor = this.backgroundTasks.get(taskId)
		if (processor) {
			await processor.cancel()
			this.backgroundTasks.delete(taskId)
		}
	}
}
```

**方案 2：VSCode Task API 集成**（可选，更原生的体验）

```typescript
class VSCodeTaskIntegration {
	// 使用 VSCode 的 Task API 运行后台任务
	async startAsVSCodeTask(config: BatchConfig): Promise<vscode.Task> {
		const task = new vscode.Task(
			{ type: "roo-batch", config },
			vscode.TaskScope.Workspace,
			"Batch Processing",
			"Roo-Code",
		)

		// 配置任务执行
		task.execution = new vscode.CustomExecution(async () => {
			return this.createTaskTerminal(config)
		})

		// 启动任务
		await vscode.tasks.executeTask(task)

		return task
	}
}
```

---

## 3. 批量模式（Batch Mode）设计

### 3.1 模式定义

在现有模式系统基础上，添加 `batch` 模式：

```typescript
const BATCH_MODE: ModeConfig = {
	slug: "batch",
	name: "📦 Batch",
	roleDefinition: `You are a batch processing specialist. Your role is to:
1. Process multiple files efficiently using the same operation
2. Maintain consistency across all files
3. Handle errors gracefully without stopping the entire batch
4. Provide clear progress updates and summaries

Key principles:
- Each file should be processed independently
- Always produce complete, valid output (no truncation)
- Report progress regularly
- If a file fails, continue with others and report the failure`,

	groups: ["read", "edit", "command"],

	customInstructions: `
# Batch Processing Guidelines

## Output Completeness
- ALWAYS provide complete file content
- NEVER use placeholders like "// rest of code unchanged"
- If output is too long, ask to split the operation

## Error Handling
- If a file fails, log the error and continue
- Provide a summary of successes and failures at the end

## Progress Reporting
- Report progress after every N files (configurable)
- Include current file being processed

## Quality Assurance
- Validate each output before moving to next file
- Ensure syntax is complete and valid
  `,
}
```

### 3.2 用户交互流程

#### 启动批量任务

```
用户: @batch 将 src/**/*.js 转换为 TypeScript，并发数设为 4

系统响应:
┌─────────────────────────────────────────────────────┐
│ 📦 批量任务配置                                      │
├─────────────────────────────────────────────────────┤
│ 文件模式: src/**/*.js                               │
│ 匹配文件: 23 个文件                                 │
│ 输出目录: 原目录（.ts 扩展名）                      │
│ 并发数: 4                                           │
│ 模式: batch                                         │
│ 后台运行: 否                                        │
├─────────────────────────────────────────────────────┤
│ 预计 Token 消耗: ~50,000 tokens                     │
│ 预计耗时: 5-10 分钟                                 │
└─────────────────────────────────────────────────────┘

是否开始处理？[确认] [取消] [修改配置]
```

#### 执行过程

```
┌─────────────────────────────────────────────────────┐
│ 📦 批量处理进度                                      │
├─────────────────────────────────────────────────────┤
│ ████████████░░░░░░░░░░░░  52% (12/23)              │
├─────────────────────────────────────────────────────┤
│ ✓ 成功: 10 个文件                                   │
│ ✗ 失败: 2 个文件                                    │
│ ⏳ 进行中: 4 个文件                                  │
│ ⏸ 待处理: 7 个文件                                  │
├─────────────────────────────────────────────────────┤
│ 当前处理:                                           │
│   • src/utils/helper.js                             │
│   • src/components/Button.js
│   • src/components/Card.js                          │
│   • src/hooks/useData.js                            │
├─────────────────────────────────────────────────────┤
│ 预计剩余时间: 3 分钟                                │
└─────────────────────────────────────────────────────┘

失败的文件:
  ✗ src/utils/legacy.js - 语法错误（将重试）
  ✗ src/api/old-client.js - 依赖缺失

[暂停] [取消] [查看详情]
```

#### 完成报告

```
┌─────────────────────────────────────────────────────┐
│ 📦 批量处理完成                                      │
├─────────────────────────────────────────────────────┤
│ 总文件数: 23                                        │
│ ✓ 成功: 21 (91%)                                   │
│ ✗ 失败: 2 (9%)                                     │
├─────────────────────────────────────────────────────┤
│ 总耗时: 8 分 32 秒                                  │
│ Token 消耗: 48,234 tokens                           │
│ 平均速度: 22 秒/文件                                │
└─────────────────────────────────────────────────────┘

成功转换的文件 (21):
  ✓ src/utils/helper.js → helper.ts
  ✓ src/components/Button.js → Button.ts
  ✓ src/components/Card.js → Card.ts
  ... (展开全部)

失败的文件 (2):
  ✗ src/utils/legacy.js
    原因: 包含不支持的 JSX 语法
    建议: 手动处理或使用 jsx 转换工具

  ✗ src/api/old-client.js
    原因: 依赖未安装的包 'request'
    建议: 先安装依赖或更新代码

[生成详细报告] [重试失败文件] [关闭]
```

### 3.3 命令和工具设计

#### 新增工具：`start_batch_task`

```xml
<start_batch_task>
  <file_pattern>src/**/*.js</file_pattern>
  <task_template>
    Convert this JavaScript file to TypeScript:
    - Add proper type annotations
    - Replace 'var' with 'const'/'let'
    - Update file extension to .ts
  </task_template>
  <concurrency>4</concurrency>
  <output_directory>same</output_directory>
  <background>false</background>
</start_batch_task>
```

**参数说明**：

- `file_pattern`：文件匹配模式（glob 语法）
- `task_template`：应用于每个文件的任务模板
- `concurrency`：并发数（1-8）
- `output_directory`：输出目录（'same' = 原目录，或指定路径）
- `background`：是否后台运行

#### 新增工具：`batch_status`

```xml
<batch_status>
  <task_id>batch_20251010_001</task_id>
</batch_status>
```

查看指定批量任务的状态。

#### 新增工具：`batch_control`

```xml
<batch_control>
  <task_id>batch_20251010_001</task_id>
  <action>pause|resume|cancel</action>
</batch_control>
```

控制批量任务的执行（暂停/恢复/取消）。

---

## 4. UI/UX 设计

### 4.1 进度面板设计

#### 主进度面板

```typescript
interface BatchProgressPanel {
	// 整体进度条
	progressBar: {
		percentage: number
		color: "blue" | "yellow" | "red" | "green" // 根据状态变化
	}

	// 统计信息
	stats: {
		total: number
		completed: number
		failed: number
		inProgress: number
		pending: number
	}

	// 当前任务列表
	currentTasks: {
		fileName: string
		status: "processing" | "validating" | "writing"
		progress?: number
	}[]

	// 失败列表
	failures: {
		fileName: string
		error: string
		canRetry: boolean
	}[]

	// 操作按钮
	actions: {
		pause: boolean
		resume: boolean
		cancel: boolean
		viewDetails: boolean
	}
}
```

#### VSCode Webview 实现

```tsx
// webview-ui/src/components/BatchProgress.tsx
import React from "react"
import { ProgressBar } from "./ui/ProgressBar"
import { FileStatusList } from "./ui/FileStatusList"

export const BatchProgress: React.FC<BatchProgressProps> = ({ batchId, progress }) => {
	return (
		<div className="batch-progress-panel">
			<div className="header">
				<h3>📦 批量处理进度</h3>
				<span className="batch-id">{batchId}</span>
			</div>

			<ProgressBar percentage={progress.percentage} status={getProgressStatus(progress)} />

			<div className="stats-grid">
				<StatCard label="总计" value={progress.total} />
				<StatCard label="成功" value={progress.completed} color="green" />
				<StatCard label="失败" value={progress.failed} color="red" />
				<StatCard label="进行中" value={progress.inProgress} color="blue" />
			</div>

			{progress.currentTasks.length > 0 && (
				<FileStatusList title="当前处理" files={progress.currentTasks} icon="⏳" />
			)}

			{progress.failures.length > 0 && (
				<FileStatusList title="失败文件" files={progress.failures} icon="✗" expandable />
			)}

			<div className="actions">
				<button onClick={handlePause}>暂停</button>
				<button onClick={handleCancel} className="danger">
					取消
				</button>
				<button onClick={handleViewDetails}>查看详情</button>
			</div>

			{progress.estimatedTimeRemaining && (
				<div className="time-estimate">预计剩余时间: {formatDuration(progress.estimatedTimeRemaining)}</div>
			)}
		</div>
	)
}
```

### 4.2 通知设计

#### 进度通知

```typescript
interface BatchNotification {
	// 开始通知
	onStart: () => {
		title: "批量任务已开始"
		message: `正在处理 ${totalFiles} 个文件`
		buttons: ["查看进度", "后台运行"]
	}

	// 进度更新（每 N 个文件）
	onProgress: (
		completed: number,
		total: number,
	) => {
		title: "批量任务进度"
		message: `已完成 ${completed}/${total} (${percentage}%)`
		silent: true // 不打扰用户
	}

	// 完成通知
	onComplete: (result: BatchResult) => {
		title: "批量任务完成"
		message: `成功: ${result.successCount}, 失败: ${result.failedCount}`
		buttons: ["查看报告", "关闭"]
	}

	// 错误通知
	onError: (error: string) => {
		title: "批量任务失败"
		message: error
		buttons: ["查看详情", "重试"]
	}
}
```

#### VSCode 通知实现

```typescript
class BatchNotificationService {
	async notifyStart(batchId: string, totalFiles: number): Promise<void> {
		const action = await vscode.window.showInformationMessage(
			`批量任务已开始，正在处理 ${totalFiles} 个文件`,
			"查看进度",
			"后台运行",
		)

		if (action === "查看进度") {
			await this.showProgressPanel(batchId)
		}
	}

	async notifyProgress(batchId: string, completed: number, total: number): Promise<void> {
		// 使用状态栏显示进度，避免频繁弹窗
		this.updateStatusBar(batchId, completed, total)
	}

	async notifyComplete(result: BatchResult): Promise<void> {
		const message =
			result.failedCount === 0
				? `✓ 批量任务完成！成功处理 ${result.successCount} 个文件`
				: `批量任务完成：成功 ${result.successCount}，失败 ${result.failedCount}`

		const action = await vscode.window.showInformationMessage(message, "查看报告", "关闭")

		if (action === "查看报告") {
			await this.showDetailedReport(result)
		}
	}
}
```

---

## 5. 开发计划

### 5.1 开发阶段

#### 第一阶段：核心功能（2 周）

**目标**：实现基本的批量处理功能

**任务清单**：

- [ ] 实现 `BatchConfig` 接口和配置验证
- [ ] 实现 `BatchProcessor` 核心逻辑
- [ ] 实现并发控制器 `ConcurrencyController`
- [ ] 实现进度跟踪器 `ProgressTracker`
- [ ] 集成文件扫描和匹配（使用 glob）
- [ ] 实现基本的错误处理和重试机制
- [ ] 添加单元测试（覆盖率 > 80%）

**交付成果**：

- 可以批量处理文件的基本功能
- 简单的进度显示
- 基本的错误处理

#### 第二阶段：质量保证（1.5 周）

**目标**：解决输出截断问题，提升处理质量

**任务清单**：

- [ ] 实现 `TruncationDetector` 输出验证器
- [ ] 实现智能重试策略
- [ ] 实现大文件分块处理
- [ ] 添加输出完整性检查
- [ ] 实现任务结果验证
- [ ] 完善错误处理和日志记录
- [ ] 添加集成测试

**交付成果**：

- 可靠的输出验证机制
- 智能的重试和错误处理
- 提高批处理成功率

#### 第三阶段：后台运行（1 周）

**目标**：支持后台执行，不阻塞主对话

**任务清单**：

- [ ] 实现 `BackgroundTaskManager`
- [ ] 实现任务持久化（保存/恢复）
- [ ] 添加后台任务列表管理
- [ ] 实现任务取消和暂停功能
- [ ] 集成通知系统
- [ ] 添加后台任务测试

**交付成果**：

- 完整的后台任务管理
- 可恢复的任务状态
- 用户友好的通知

#### 第四阶段：UI/UX（1.5 周）

**目标**：提供优秀的用户体验

**任务清单**：

- [ ] 设计和实现进度面板 UI
- [ ] 实现实时进度更新
- [ ] 添加详细报告页面
- [ ] 实现任务控制界面（暂停/恢复/取消）
- [ ] 优化通知体验
- [ ] 添加配置向导
- [ ] 进行用户测试和反馈收集

**交付成果**：

- 完整的 UI 界面
- 流畅的用户体验
- 直观的进度展示

#### 第五阶段：优化和文档（1 周）

**目标**：性能优化和完善文档

**任务清单**：

- [ ] 性能优化（内存、速度）
- [ ] 添加性能监控和指标
- [ ] 编写用户文档
- [ ] 编写开发者文档
- [ ] 创建使用示例
- [ ] 完成 E2E 测试
- [ ] 准备发布

**交付成果**：

- 优化的性能表现
- 完整的文档
- 可发布的版本

### 5.2 技术债务和风险

#### 技术债务

1. **现有 Task 类的局限性**

    - 问题：Task 类设计为单任务执行，需要适配批量场景
    - 解决：创建轻量级的 Task 封装，复用核心逻辑

2. **上下文管理复杂度**

    - 问题：批量任务的上下文管理比单任务更复杂
    - 解决：为每个文件创建独立上下文，避免污染

3. **错误传播**
    - 问题：单个文件错误可能影响整体流程
    - 解决：实现完善的错误隔离机制

#### 风险评估

| 风险           | 影响 | 概率 | 缓解措施                               |
| -------------- | ---- | ---- | -------------------------------------- |
| API 速率限制   | 高   | 高   | 实现智能速率控制，动态调整并发数       |
| 内存占用过高   | 中   | 中   | 限制同时加载的文件数，使用流式处理     |
| 输出截断       | 高   | 高   | 多重验证机制，智能重试                 |
| 用户体验复杂   | 中   | 低   | 提供简单的默认配置，渐进式暴露高级选项 |
| 并发冲突       | 低   | 低   |
| 使用文件锁机制 |

### 5.3 成本估算

#### Token 消耗

假设场景：转换 50 个 JS 文件为 TS，每个文件平均 200 行

**单文件 Token 消耗估算**：

- 系统提示词：~2,000 tokens
- 文件内容：~800 tokens（200 行 × 4 tokens/行）
- 任务描述：~200 tokens
- 输出内容：~1,000 tokens（包含类型注解后稍大）
- **单文件总计**：~4,000 tokens

**批量任务总消耗**：

- 50 个文件 × 4,000 tokens = 200,000 tokens
- 使用 Claude Sonnet 4.5：约 $1.00（输入）+ $3.00（输出）= **$4.00**

**优化后**（独立上下文，减少系统提示）：

- 单文件：~3,000 tokens
- 50 个文件：150,000 tokens
- 成本：约 **$3.00**

#### 时间消耗

- 单文件平均处理时间：20-30 秒
- 串行处理 50 个文件：17-25 分钟
- 并发 4 处理：5-7 分钟
- 并发 8 处理：3-4 分钟

#### 资源占用

- 内存占用（4 并发）：约 500MB - 1GB
- 网络带宽：中等（流式 API 调用）
- CPU 使用：低（主要等待 API 响应）

---

## 6. 使用示例

### 6.1 基本用例

#### 示例 1：JS → TS 转换

```
用户: @batch 将 src 目录下所有 .js 文件转换为 TypeScript

系统:
扫描到 23 个文件。
配置:
- 并发数: 2（默认）
- 输出: 原目录，扩展名改为 .ts
- 模式: batch

确认开始？

用户: 确认

系统: [启动批量处理，显示进度]
```

#### 示例 2：批量添加注释

```
用户: @batch 为 src/utils/*.ts 中的所有导出函数添加 JSDoc 注释

系统配置:
文件模式: src/utils/*.ts
任务: 添加 JSDoc 注释
匹配文件: 15 个
并发数: 4

用户: 开始，并且后台运行

系统:
✓ 批量任务已在后台启动
任务 ID: batch_20251010_001
可以继续其他对话，完成后会通知您
```

#### 示例 3：批量测试生成

```
用户: @batch
文件模式: src/services/*.ts
任务: 为每个服务文件生成对应的单元测试
输出目录: tests/services/
文件名模式: {name}.test.ts
并发: 3

系统: [执行并生成测试文件]
```

### 6.2 高级用例

#### 示例 4：条件批量处理

```
用户: @batch
文件: src/**/*.tsx
任务: 将所有使用 class component 的文件重构为 functional component
排除: src/legacy/**
验证: 确保 hooks 使用正确
并发: 2
最大重试: 3

系统: [智能检测 class component 并重构]
```

#### 示例 5：批量国际化

```
用户: @batch
文件: src/components/**/*.tsx
任务:
  1. 提取所有硬编码的中文字符串
  2. 替换为 i18n.t() 调用
  3. 生成对应的翻译 key
输出翻译文件: locales/zh-CN/components.json
并发: 4

系统: [提取并替换字符串，生成翻译文件]
```

#### 示例 6：增量批处理

```
用户: @batch
文件: src/**/*.ts
任务: 添加 ESLint 自动修复
仅处理: 有 lint 错误的文件
并发: 6
跳过成功文件: true

系统:
扫描中...
发现 12 个文件有 lint 错误
[仅处理这 12 个文件]
```

### 6.3 与其他功能集成

#### 与 Codebase Search 集成

```
用户: 先搜索所有使用旧 API 的文件，然后批量更新

系统:
1. [执行 codebase_search，找到 34 个文件]
2. 是否对这 34 个文件执行批量更新？

用户: 是，并发 4

系统: [批量更新]
```

#### 与 Git 集成

```
用户: @batch
文件: [git diff --name-only main...feature]
任务: 格式化所有修改过的文件
自动提交: true
提交信息: "chore: format modified files"

系统: [批量格式化并提交]
```

---

## 7. 配置和自定义

### 7.1 用户设置

在 VSCode 设置中添加批量模式配置：

```json
{
	"roo-code.batch": {
		"defaultConcurrency": 2,
		"maxConcurrency": 8,
		"enableBackgroundExecution": true,
		"progressNotificationInterval": 5,
		"autoRetryOnFailure": true,
		"maxRetries": 2,
		"validateOutput": true,
		"minOutputLinesRatio": 0.5,
		"saveReportsTo": ".roo/batch-reports/",
		"enableVerboseLogging": false
	}
}
```

### 7.2 批量任务模板

用户可以保存常用的批量任务配置为模板：

```json
// .roo/batch-templates/js-to-ts.json
{
	"name": "JS to TypeScript",
	"description": "Convert JavaScript files to TypeScript",
	"filePattern": "src/**/*.js",
	"excludePatterns": ["node_modules/**", "dist/**"],
	"taskTemplate": "Convert this JavaScript file to TypeScript:\n- Add type annotations\n- Replace var with const/let\n- Update imports",
	"concurrency": 4,
	"outputPattern": "{name}.ts",
	"validateOutput": true,
	"minOutputLines": 10
}
```

使用模板：

```
用户: @batch --template js-to-ts

系统: [加载模板配置并执行]
```

### 7.3 钩子和扩展点

提供扩展点供高级用户自定义：

```typescript
// 批量处理生命周期钩子
interface BatchLifecycleHooks {
	// 任务开始前
	beforeBatch?: (config: BatchConfig) => Promise<void>

	// 单个文件处理前
	beforeFile?: (filePath: string) => Promise<void>

	// 单个文件处理后
	afterFile?: (filePath: string, result: BatchTaskResult) => Promise<void>

	// 输出验证
	validateOutput?: (content: string, filePath: string) => Promise<ValidationResult>

	// 任务完成后
	afterBatch?: (result: BatchResult) => Promise<void>

	// 错误处理
	onError?: (error: Error, filePath: string) => Promise<"retry" | "skip" | "abort">
}
```

---

## 8. 测试策略

### 8.1 单元测试

**核心组件测试**：

```typescript
describe("BatchProcessor", () => {
	describe("scanFiles", () => {
		it("should match files using glob pattern", async () => {
			// ...
		})

		it("should respect exclude patterns", async () => {
			// ...
		})
	})

	describe("processFile", () => {
		it("should process a single file successfully", async () => {
			// ...
		})

		it("should handle file processing errors", async () => {
			// ...
		})

		it("should retry on validation failure", async () => {
			// ...
		})
	})

	describe("concurrency control", () => {
		it("should respect concurrency limit", async () => {
			// ...
		})

		it("should process files in queue", async () => {
			// ...
		})
	})
})

describe("TruncationDetector", () => {
	it("should detect truncation comments", () => {
		const content = "function foo() {\n  // rest of code unchanged\n}"
		expect(detector.hasTruncationComments(content)).toBe(true)
	})

	it("should detect incomplete syntax", () => {
		const content = "function foo() {\n  const x = 1"
		expect(detector.isSyntaxComplete(content)).toBe(false)
	})
})
```

### 8.2 集成测试

**端到端批量处理测试**：

```typescript
describe("Batch Processing E2E", () => {
	it("should convert multiple JS files to TS", async () => {
		// 准备测试文件
		await createTestFiles(["test1.js", "test2.js", "test3.js"])

		// 执行批量处理
		const result = await batchProcessor.start({
			filePattern: "*.js",
			taskTemplate: "Convert to TypeScript",
			concurrency: 2,
		})

		// 验证结果
		expect(result.successCount).toBe(3)
		expect(await fileExists("test1.ts")).toBe(true)
		expect(await fileExists("test2.ts")).toBe(true)
		expect(await fileExists("test3.ts")).toBe(true)
	})

	it("should handle partial failures gracefully", async () => {
		// 创建一个会失败的文件
		await createTestFiles([
			"valid1.js",
			"invalid.js", // 包含语法错误
			"valid2.js",
		])

		const result = await batchProcessor.start(config)

		expect(result.successCount).toBe(2)
		expect(result.failedCount).toBe(1)
	})
})
```

### 8.3 性能测试

```typescript
describe("Batch Processing Performance", () => {
	it("should handle 100 files efficiently", async () => {
		await createTestFiles(100)

		const startTime = Date.now()
		const result = await batchProcessor.start({
			filePattern: "*.js",
			concurrency: 4,
		})
		const duration = Date.now() - startTime

		// 应该在合理时间内完成（例如 10 分钟）
		expect(duration).toBeLessThan(10 * 60 * 1000)
		expect(result.successCount).toBe(100)
	})

	it("should not exceed memory limits", async () => {
		const initialMemory = process.memoryUsage().heapUsed

		await batchProcessor.start({
			filePattern: "*.js",
			concurrency: 8,
		})

		const finalMemory = process.memoryUsage().heapUsed
		const memoryIncrease = finalMemory - initialMemory

		// 内存增长应控制在合理范围（例如 2GB）
		expect(memoryIncrease).toBeLessThan(2 * 1024 * 1024 * 1024)
	})
})
```

---

## 9. 成功指标

### 9.1 功能指标

- ✅ 支持至少 5 种常见批量处理场景
- ✅ 并发处理速度提升 3-5 倍（相比串行）
- ✅ 输出完整性达到 95%（无截断）
- ✅ 错误隔离率 100%（单文件失败不影响其他）
- ✅ 支持后台运行和任务恢复

### 9.2 质量指标

- ✅ 代码覆盖率 > 85%
- ✅ 所有 E2E 测试通过
- ✅ 无严重性能问题（内存泄漏、CPU 100%）
- ✅ 用户可中断和恢复任务
- ✅ 详细的错误报告和日志

### 9.3 用户体验指标

- ✅
  平均启动时间 < 3 秒
- ✅ 进度更新延迟 < 1 秒
- ✅ UI 响应流畅，无卡顿
- ✅ 通知及时且不打扰
- ✅ 配置简单，默认值合理

### 9.4 采用指标

- 📊 30% 的活跃用户使用批量模式（3 个月内）
- 📊 批量任务平均成功率 > 90%
- 📊 用户满意度 > 4.0/5.0
- 📊 批量任务占总任务量的 15-20%

---

## 10. 未来扩展

### 10.1 短期扩展（6 个月内）

1. **智能任务分组**

    - 自动识别相似文件并分组处理
    - 为不同组使用不同的处理策略

2. **增量处理**

    - 仅处理修改过的文件
    - 支持 Git 集成，基于 commit/branch 差异

3. **任务调度**

    - 支持定时批量任务
    - 支持条件触发（如文件变化时）

4. **更丰富的输出格式**
    - 导出 CSV/JSON 格式的处理报告
    - 生成可视化的处理统计图表

### 10.2 中期扩展（12 个月内）

1. **分布式处理**

    - 支持跨机器的批量处理
    - 利用云 API 并发限制的多账户支持

2. **AI 辅助优化**

    - 根据历史数据优化并发数
    - 预测任务失败并提前调整策略

3. **协作功能**

    - 团队共享批量任务模板
    - 批量任务审批流程

4. **更多集成**
    - CI/CD 管道集成
    - Webhook 通知
    - Slack/Teams 集成

### 10.3 长期愿景（18+ 个月）

1. **批量任务市场**

    - 社区贡献的批量任务模板
    - 付费高级模板

2. **可视化编排**

    - 拖拽式批量任务编排器
    - 复杂的批量工作流设计

3. **智能学习**
    - 从用户行为学习最佳实践
    - 自动推荐批量处理方案

---

## 11. 参考资料

### 11.1 相关技术

- **并发控制**：Promise.all、p-limit、async-pool
- **文件匹配**：globby、fast-glob
- **输出验证**：acorn（JS 语法解析）、typescript（TS 类型检查）
- **进度追踪**：progress、cli-progress
- **任务队列**：bull、bee-queue

### 11.2 类似产品

- **Cursor AI**：批量重构功能
- **GitHub Copilot Workspace**：多文件编辑
- **Aider**：批量代码修改
- **Codemod**：大规模代码转换工具

### 11.3 设计参考

- **VSCode Tasks**：任务执行和进度显示
- **ESLint CLI**：并发处理和进度报告
- **Jest**：测试并发执行和结果汇总
- **Webpack**：编译进度和错误报告

---

## 12. 总结

### 12.1 核心价值

批量任务模式为 Roo-Code 带来以下核心价值：

1. **效率提升**：并发处理大幅缩短批量操作时间
2. **可靠性保证**：完善的验证和重试机制确保输出质量
3. **用户体验**：直观的进度展示和后台运行支持
4. **灵活性**：高度可配置，支持多种使用场景

### 12.2 关键创新点

1. **输出完整性保证**：多重验证机制解决大模型输出截断问题
2. **独立上下文设计**：每个文件独立处理，避免上下文污染
3. **智能错误隔离**：单文件失败不影响整体批量任务
4. **后台运行支持**：不阻塞主对话，提升用户体验

### 12.3 实施建议

**优先级排序**：

1. 🔴 **P0**：核心批量处理功能、输出验证、错误处理
2. 🟡 **P1**：后台运行、进度 UI、通知系统
3. 🟢 **P2**：高级配置、模板系统、性能优化

**风险控制**：

- 从小规模测试开始（5-10 个文件）
- 逐步增加并发数和文件数
- 收集用户反馈并快速迭代

**成功关键**：

- 可靠的输出验证机制（防止截断）
- 优秀的用户体验（进度展示、错误提示）
- 合理的默认配置（降低使用门槛）

---

## 附录 A：配置示例

### 完整配置示例

```json
{
	"batchId": "batch_20251010_001",
	"name": "JS to TypeScript Conversion",
	"filePattern": "src/**/*.js",
	"excludePatterns": ["node_modules/**", "dist/**", "*.test.js"],
	"workingDirectory": "/project/root",
	"concurrency": 4,
	"mode": "batch",
	"backgroundExecution": false,
	"outputDirectory": "same",
	"outputPattern": "{name}.ts",
	"preserveDirectory": true,
	"taskTemplate": "Convert this JavaScript file to TypeScript:\n- Add type annotations for all functions and variables\n- Replace 'var' with 'const' or 'let'\n- Update imports to use ES6 syntax\n- Ensure all exports are typed",
	"maxRetries": 2,
	"timeoutPerFile": 300000,
	"validateOutput": true,
	"minOutputLines": null,
	"confirmBeforeStart": true,
	"progressNotification": true,
	"hooks": {
		"beforeFile": "validateJavaScriptSyntax",
		"afterFile": "formatTypeScriptCode",
		"validateOutput": "checkTypeScriptTypes"
	}
}
```

---

## 附录 B：错误代码

### 批量任务错误代码表

| 错误码    | 描述           | 处理方式                       |
| --------- | -------------- | ------------------------------ |
| BATCH_001 | 文件模式无匹配 | 检查 filePattern 是否正确      |
| BATCH_002 | 并发数超出限制 | 调整 concurrency 到 1-8        |
| BATCH_003 | 输出目录不存在 | 自动创建或提示用户             |
| BATCH_004 | 单文件处理超时 | 增加 timeoutPerFile 或分块处理 |
| BATCH_005 | 输出验证失败   | 重试或跳过该文件               |
| BATCH_006 | 输出截断检测   | 自动重试，提示用户             |
| BATCH_007 | API 速率限制   | 降低并发数，延迟重试           |
| BATCH_008 | 内存不足       | 降低并发数，释放资源           |
| BATCH_009 | 任务被取消     | 清理中间文件，保存进度         |
| BATCH_010 | 文件写入失败   | 检查权限，重试写入             |

---

## 附录 C：常见问题 (FAQ)

### Q1: 批量任务会消耗多少 Token？

**A:** Token 消耗取决于文件数量和文件大小。一般来说：

- 小文件（< 100 行）：约 2,000-3,000 tokens/文件
- 中等文件（100-500 行）：约 3,000-6,000 tokens/文件
- 大文件（> 500 行）：建议分块处理

示例：50 个中等文件 ≈ 200,000 tokens ≈ $3-4（Claude Sonnet 4.5）

### Q2: 如何避免输出被截断？

**A:** 系统提供多重保护：

1. 独立上下文：每个文件单独处理
2. 输出验证：自动检测截断标记
3. 智能重试：验证失败自动重试
4. 分块处理：大文件自动分块

### Q3: 可以处理多少个文件？

**A:** 理论上无限制，但建议：

- 小批量（< 20 文件）：直接处理
- 中批量（20-100 文件）：推荐并发 4-6
- 大批量（> 100 文件）：建议后台运行，并发 4-8

### Q4: 批量任务失败后可以恢复吗？

**A:** 可以。系统会保存任务状态，支持：

- 暂停和恢复
- 仅重试失败的文件
- 从中断点继续

### Q5: 后台运行会影响其他任务吗？

**A:** 不会。后台任务独立运行，不阻塞主对话。你可以：

- 继续与 Roo 对话
- 启动新的任务
- 随时查看后台任务进度

### Q6: 如何处理大文件（> 1000 行）？

**A:** 系统会自动检测并：

1. 分块处理大文件
2. 分别转换每个块
3. 合并处理结果
4. 验证完整性

### Q7: 支持哪些文件类型？

**A:** 支持所有文本文件，包括：

- 代码文件：.js, .ts, .jsx, .tsx, .py, .java, .go, etc.
- 配置文件：.json, .yaml, .xml, .toml, etc.
- 文档文件：.md, .txt, .rst, etc.

二进制文件不支持。

### Q8: 可以自定义验证规则吗？

**A:** 可以。通过配置提供自定义验证函数：

```typescript
validateOutput: (content: string, filePath: string) => {
	// 自定义验证逻辑
	return { isValid: true, issues: [] }
}
```

---

## 附录 D：更新日志

### v1.0.0（计划中）

**新功能**：

- ✨ 批量任务核心功能
- ✨ 并发控制（1-8 个任务）
- ✨ 输出验证和截断检测
- ✨ 进度跟踪和实时更新
- ✨ 错误隔离和重试机制

**UI/UX**：

- 🎨 批量进度面板
- 🎨 详细报告页面
- 🎨 通知系统

**文档**：

- 📚 完整的需求文档
- 📚 API 文档
- 📚 用户指南

---

## 文档结束

**编写者**: Roo AI Assistant  
**审核者**: 待审核  
**批准者**: 待批准  
**最后更新**: 2025-10-10
