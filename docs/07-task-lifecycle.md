# Task.ts 生命周期详解

> 本文档深入剖析 Task.ts 的完整生命周期,包括任务如何开始、运行时检查机制以及如何判断任务结束。

## 目录

1. [Task 类核心概念](#task-类核心概念)
2. [任务启动流程](#任务启动流程)
3. [任务状态机制](#任务状态机制)
4. [运行时检查机制](#运行时检查机制)
5. [任务循环核心](#任务循环核心)
6. [任务结束判断](#任务结束判断)
7. [任务中止与清理](#任务中止与清理)
8. [子任务机制](#子任务机制)

---

## Task 类核心概念

### 1. Task 类的职责

`Task` 类是整个 Roo-Code 项目的核心,负责管理一个完整的任务生命周期:

```typescript
export class Task extends EventEmitter<TaskEvents> implements TaskLike {
	// 任务标识
	readonly taskId: string // 唯一任务 ID
	readonly instanceId: string // 实例 ID (用于调试)
	readonly rootTaskId?: string // 根任务 ID (子任务场景)
	readonly parentTaskId?: string // 父任务 ID (子任务场景)

	// 任务状态
	abort: boolean = false // 中止标志
	abandoned: boolean = false // 废弃标志
	isInitialized: boolean = false // 初始化标志
	isPaused: boolean = false // 暂停标志 (等待子任务)

	// 状态相关
	idleAsk?: ClineMessage // 空闲状态消息
	resumableAsk?: ClineMessage // 可恢复状态消息
	interactiveAsk?: ClineMessage // 交互状态消息

	// API 相关
	apiConversationHistory: ApiMessage[] // API 对话历史
	clineMessages: ClineMessage[] // UI 消息历史

	// 流式处理状态
	isStreaming: boolean = false // 是否正在流式处理
	isWaitingForFirstChunk: boolean // 是否等待首个响应块
	assistantMessageContent: AssistantMessageContent[] // 助手消息内容
}
```

### 2. 关键状态标志

**核心标志位:**

- `abort`: 任务中止标志,一旦为 true,所有循环和 Promise 都会抛出错误
- `abandoned`: 任务被废弃标志,用于区分正常中止和异常废弃
- `isInitialized`: 任务初始化完成标志
- `isPaused`: 任务暂停标志 (用于等待子任务完成)

**消息状态:**

- `idleAsk`: 任务处于空闲状态,等待用户操作
- `resumableAsk`: 任务可恢复状态,用户可选择继续
- `interactiveAsk`: 任务需要用户交互

---

## 任务启动流程

### 1. 构造函数初始化

```typescript
constructor({
    provider,
    apiConfiguration,
    task,
    images,
    historyItem,
    startTask = true,
    ...
}: TaskOptions) {
    super()

    // 1. 生成任务 ID
    this.taskId = historyItem ? historyItem.id : crypto.randomUUID()

    // 2. 初始化核心服务
    this.rooIgnoreController = new RooIgnoreController(this.cwd)
    this.fileContextTracker = new FileContextTracker(provider, this.taskId)
    this.api = buildApiHandler(apiConfiguration)
    this.diffViewProvider = new DiffViewProvider(this.cwd, this)

    // 3. 初始化模式 (异步)
    if (historyItem) {
        this._taskMode = historyItem.mode || defaultModeSlug
        this.taskModeReady = Promise.resolve()
    } else {
        this._taskMode = undefined
        this.taskModeReady = this.initializeTaskMode(provider)
    }

    // 4. 启动任务
    if (startTask) {
        if (task || images) {
            this.startTask(task, images)
        } else if (historyItem) {
            this.resumeTaskFromHistory()
        }
    }
}
```

**初始化步骤:**

1. **生成唯一标识**: 创建 `taskId` 和 `instanceId`
2. **初始化控制器**:
    - `RooIgnoreController`: 管理忽略文件
    - `RooProtectedController`: 管理受保护文件
    - `FileContextTracker`: 跟踪文件上下文
3. **创建 API 处理器**: 根据配置构建 API Handler
4. **初始化编辑器**: DiffViewProvider 用于文件对比编辑
5. **异步加载模式**: 从 provider 获取当前模式
6. **启动任务**: 调用 `startTask()` 或 `resumeTaskFromHistory()`

### 2. 启动新任务 (`startTask()`)

```typescript
private async startTask(task?: string, images?: string[]): Promise<void> {
    // 1. 订阅 Bridge (如果启用)
    if (this.enableBridge) {
        await BridgeOrchestrator.subscribeToTask(this)
    }

    // 2. 重置对话历史
    this.clineMessages = []
    this.apiConversationHistory = []

    // 3. 显示初始任务消息
    await this.say("text", task, images)
    this.isInitialized = true

    // 4. 构建初始用户内容
    let imageBlocks: Anthropic.ImageBlockParam[] = formatResponse.imageBlocks(images)

    // 5. 启动任务循环
    await this.initiateTaskLoop([
        {
            type: "text",
            text: `<task>\n${task}\n</task>`,
        },
        ...imageBlocks,
    ])
}
```

**启动流程:**

1. **Bridge 订阅**: 如果启用了任务桥接,订阅到 BridgeOrchestrator
2. **清空历史**: 重置 `clineMessages` 和 `apiConversationHistory`
3. **显示任务**: 调用 `say()` 在 UI 显示用户输入的任务
4. **构建内容**: 将任务文本包装为 `<task>` XML 标签,附加图片
5. **启动循环**: 调用 `initiateTaskLoop()` 进入主循环

### 3. 从历史恢复任务 (`resumeTaskFromHistory()`)

```typescript
private async resumeTaskFromHistory() {
    // 1. 加载保存的消息
    const modifiedClineMessages = await this.getSavedClineMessages()

    // 2. 清理消息 (移除 resume 消息、reasoning 消息等)
    const lastRelevantMessageIndex = findLastIndex(
        modifiedClineMessages,
        (m) => !(m.ask === "resume_task" || m.ask === "resume_completed_task")
    )
    if (lastRelevantMessageIndex !== -1) {
        modifiedClineMessages.splice(lastRelevantMessageIndex + 1)
    }

    // 3. 移除尾部 reasoning 消息
    while (modifiedClineMessages.length > 0) {
        const last = modifiedClineMessages[modifiedClineMessages.length - 1]
        if (last.type === "say" && last.say === "reasoning") {
            modifiedClineMessages.pop()
        } else {
            break
        }
    }

    // 4. 加载 API 对话历史
    this.apiConversationHistory = await this.getSavedApiConversationHistory()

    // 5. 询问用户是否继续
    const { response, text, images } = await this.ask("resume_task")

    // 6. 处理工具使用中断
    let modifiedOldUserContent = [...existingUserContent]
    // ... 处理未完成的工具调用

    // 7. 构建恢复消息
    let newUserContent: Anthropic.Messages.ContentBlockParam[] = [
        ...modifiedOldUserContent
    ]

    if (responseText) {
        newUserContent.push({
            type: "text",
            text: `\n\nNew instructions for task continuation:\n<user_message>\n${responseText}\n</user_message>`,
        })
    }

    // 8. 启动任务循环
    await this.initiateTaskLoop(newUserContent)
}
```

**恢复流程:**

1. **加载消息**: 从磁盘读取保存的 `clineMessages` 和 `apiConversationHistory`
2. **清理消息**: 移除之前的 resume 消息、reasoning 消息等
3. **检查工具调用**: 如果有未完成的工具调用,添加 "interrupted" 响应
4. **询问用户**: 显示 "resume_task" 询问,用户可添加新指令
5. **构建上下文**: 将用户的新指令包装为 `<user_message>` 标签
6. **启动循环**: 调用 `initiateTaskLoop()` 继续任务

---

## 任务状态机制

### 1. TaskStatus 枚举

```typescript
export enum TaskStatus {
	Running = "running", // 正在运行
	Idle = "idle", // 空闲,等待用户
	Resumable = "resumable", // 可恢复 (如 attempt_completion)
	Interactive = "interactive", // 需要交互 (如工具执行审批)
}
```

### 2. 状态判断逻辑

```typescript
public get taskStatus(): TaskStatus {
    // 优先级: Interactive > Resumable > Idle > Running

    if (this.interactiveAsk) {
        return TaskStatus.Interactive  // 需要用户审批工具执行
    }

    if (this.resumableAsk) {
        return TaskStatus.Resumable    // 任务完成,可恢复
    }

    if (this.idleAsk) {
        return TaskStatus.Idle         // 空闲,等待用户输入
    }

    return TaskStatus.Running          // 默认运行状态
}
```

### 3. 状态转换机制

状态通过 `ask()` 方法设置:

```typescript
async ask(type: ClineAsk, text?: string, partial?: boolean): Promise<...> {
    // 1. 保存消息
    await this.addToClineMessages({ ts: askTs, type: "ask", ask: type, text })

    // 2. 设置状态超时 (1秒后)
    const isBlocking = !(this.askResponse !== undefined || this.lastMessageTs !== askTs)

    if (isBlocking) {
        if (isInteractiveAsk(type)) {
            setTimeout(() => {
                this.interactiveAsk = message
                this.emit(RooCodeEventName.TaskInteractive, this.taskId)
            }, 1_000)
        } else if (isResumableAsk(type)) {
            setTimeout(() => {
                this.resumableAsk = message
                this.emit(RooCodeEventName.TaskResumable, this.taskId)
            }, 1_000)
        } else if (isIdleAsk(type)) {
            setTimeout(() => {
                this.idleAsk = message
                this.emit(RooCodeEventName.TaskIdle, this.taskId)
            }, 1_000)
        }
    }

    // 3. 等待用户响应
    await pWaitFor(() => this.askResponse !== undefined || this.lastMessageTs !== askTs)

    // 4. 清除状态
    this.idleAsk = undefined
    this.resumableAsk = undefined
    this.interactiveAsk = undefined
    this.emit(RooCodeEventName.TaskActive, this.taskId)

    return result
}
```

**状态转换时机:**

- **等待 1 秒**: 防止快速响应导致状态闪烁
- **用户响应**: 状态立即切换回 `Running`
- **消息队列**: 如果有排队消息,直接处理,不设置状态

---

## 运行时检查机制

### 1. Abort 检查

**内容解析**: `AssistantMessageParser` 解析工具调用7. **内容展示**: `presentAssistantMessage()` 向用户展示并执行工具8. **工具检查**: 如果没用工具,提示模型使用工具或完成任务9. **栈推送**: 如果有待处理内容,推入栈继续处理

### 3. presentAssistantMessage() - 内容展示与工具执行

这个函数在 `src/core/assistant-message/index.ts` 中,负责展示助手消息并执行工具:

```typescript
export async function presentAssistantMessage(cline: Task) {
	// 防止重入
	if (cline.presentAssistantMessageLocked) {
		cline.presentAssistantMessageHasPendingUpdates = true
		return
	}

	cline.presentAssistantMessageLocked = true

	try {
		// 遍历所有内容块
		for (; cline.currentStreamingContentIndex < cline.assistantMessageContent.length; ) {
			const block = cline.assistantMessageContent[cline.currentStreamingContentIndex]

			if (block.partial && !cline.didCompleteReadingStream) {
				// 部分块,等待完成
				break
			}

			switch (block.type) {
				case "text":
					await cline.say("text", block.content, undefined, block.partial)
					if (!block.partial) {
						cline.currentStreamingContentIndex++
					}
					break

				case "tool_use":
					// 执行工具
					const result = await executeToolUse(cline, block)

					if (result.userRejected) {
						cline.didRejectTool = true
					}

					cline.userMessageContent.push({
						type: "text",
						text: result.output,
					})

					cline.currentStreamingContentIndex++
					break
			}
		}

		// 所有内容处理完成
		if (cline.currentStreamingContentIndex >= cline.assistantMessageContent.length) {
			cline.userMessageContentReady = true
		}
	} finally {
		cline.presentAssistantMessageLocked = false

		// 处理待处理的更新
		if (cline.presentAssistantMessageHasPendingUpdates) {
			cline.presentAssistantMessageHasPendingUpdates = false
			await presentAssistantMessage(cline)
		}
	}
}
```

**展示流程:**

1. **锁机制**: 防止并发调用导致重复执行
2. **遍历内容块**: 按顺序处理文本和工具调用
3. **部分块等待**: 如果是部分内容且流未结束,等待
4. **文本展示**: 调用 `say()` 显示文本
5. **工具执行**: 调用具体工具的执行逻辑
6. **结果收集**: 将工具结果添加到 `userMessageContent`
7. **完成标记**: 所有内容处理完设置 `userMessageContentReady = true`

---

## 任务结束判断

### 1. 正常结束条件

任务正常结束有以下几种情况:

#### a) 用户主动中止

```typescript
// 用户点击停止按钮
await task.abortTask()

// 设置 abort 标志
this.abort = true
this.emit(RooCodeEventName.TaskAborted)

// 清理资源
this.dispose()
```

#### b) attempt_completion 工具调用

```typescript
// 模型调用 attempt_completion
<attempt_completion>
<result>
任务已完成,所有文件已修改...
</result>
</attempt_completion>

// 工具执行逻辑
const { response, text, images } = await this.ask(
    "completion_result",
    result
)

if (response === "yesButtonClicked") {
    // 用户确认完成
    // 任务进入 Resumable 状态
} else if (response === "messageResponse") {
    // 用户提供反馈,继续任务
    await this.say("user_feedback", text, images)
}
```

**完成流程:**

1. **模型判断**: 模型认为任务完成,调用 `attempt_completion`
2. **用户确认**: 向用户展示完成结果
3. **状态设置**: 设置 `resumableAsk` 状态
4. **等待反馈**: 用户可确认完成或提供反馈继续

#### c) 达到最大请求数

```typescript
// 在配置中设置最大请求数
const maxRequestsPerTask = state?.maxRequestsPerTask ?? 100

// 检查请求计数
if (this.apiConversationHistory.length / 2 >= maxRequestsPerTask) {
	const { response } = await this.ask("request_limit_reached", "Reached maximum requests per task")

	if (response !== "yesButtonClicked") {
		return true // 结束任务
	}

	// 用户选择继续,重置计数
}
```

### 2. 异常结束条件

#### a) API 错误无法恢复

```typescript
try {
	const stream = this.attemptApiRequest()
	// ... 处理流
} catch (error) {
	if (!this.abandoned) {
		const cancelReason = this.abort ? "user_cancelled" : "streaming_failed"
		await abortStream(cancelReason, error.message)
		this.abortReason = cancelReason
		await this.abortTask()
	}
}
```

**错误类型:**

- **首块失败**: 网络错误、认证失败、速率限制
- **流式失败**: 连接中断、超时
- **上下文窗口**: 超过模型上下文限制且无法压缩

#### b) 任务被废弃 (abandoned)

```typescript
// 当创建新任务时,旧任务被废弃
await task.abortTask(true) // isAbandoned = true

// 废弃的任务不会清理资源,只是停止执行
if (this.abandoned) {
	// 快速退出,不执行清理
	return
}
```

**废弃场景:**

- 用户创建新任务
- 扩展重新加载
- 工作区切换

### 3. 结束时的清理逻辑

```typescript
public dispose(): void {
    console.log(`[Task#dispose] disposing task ${this.taskId}.${this.instanceId}`)

    // 1. 清理消息队列
    if (this.messageQueueStateChangedHandler) {
        this.messageQueueService.removeListener("stateChanged", this.messageQueueStateChangedHandler)
        this.messageQueueStateChangedHandler = undefined
    }
    this.messageQueueService.dispose()

    // 2. 移除所有事件监听器
    this.removeAllListeners()

    // 3. 清理子任务等待
    if (this.pauseInterval) {
        clearInterval(this.pauseInterval)
        this.pauseInterval = undefined
    }

    // 4. 取消 Bridge 订阅
    if (this.enableBridge) {
        BridgeOrchestrator.getInstance()?.unsubscribeFromTask(this.taskId)
    }

    // 5. 释放终端
    TerminalRegistry.releaseTerminalsForTask(this.taskId)

    // 6. 关闭浏览器会话
    this.urlContentFetcher.closeBrowser()
    this.browserSession.closeBrowser()

    // 7. 清理文件控制器
    if (this.rooIgnoreController) {
        this.rooIgnoreController.dispose()
        this.rooIgnoreController = undefined
    }

    // 8. 清理文件上下文跟踪
    this.fileContextTracker.dispose()

    // 9. 恢复 Diff 更改
    if (this.isStreaming && this.diffViewProvider.isEditing) {
        this.diffViewProvider.revertChanges().catch(console.error)
    }
}
```

**清理步骤:**

1. **消息队列**: 停止监听并清理队列
2. **事件监听**: 移除所有 EventEmitter 监听器
3. **定时器**: 清除所有定时器和间隔
4. **外部订阅**: 取消 Bridge、MCP 等订阅
5. **终端**: 释放所有关联的终端实例
6. **浏览器**: 关闭 Puppeteer 浏览器会话
7. **文件监听**: 停止文件系统监听器
8. **Diff 视图**: 如果正在编辑,恢复更改

---

## 任务中止与清理

### 1. abortTask() 方法

```typescript
public async abortTask(isAbandoned = false) {
    // 1. 设置标志
    if (isAbandoned) {
        this.abandoned = true
    }
    this.abort = true

    // 2. 发送中止事件
    this.emit(RooCodeEventName.TaskAborted)

    // 3. 清理资源
    try {
        this.dispose()
    } catch (error) {
        console.error(`Error during task disposal:`, error)
    }

    // 4. 保存消息
    try {
        await this.saveClineMessages()
    } catch (error) {
        console.error(`Error saving messages during abort:`, error)
    }
}
```

**中止流程:**

1. **标志设置**: 设置 `abort` 和可选的 `abandoned` 标志
2. **事件通知**: 发送 `TaskAborted` 事件给 Provider
3. **资源清理**: 调用 `dispose()` 清理所有资源
4. **消息保存**: 保存当前消息到磁盘

### 2. 中止的传播

```typescript
// ask() 方法中
if (this.abort) {
	throw new Error(`task aborted`)
}

// say() 方法中
if (this.abort) {
	throw new Error(`task aborted`)
}

// 主循环中
while (!this.abort) {
	// ...
}

// 工具执行中
if (this.abort) {
	throw new Error("Task aborted")
}
```

**传播机制:**

- **同步检查**: 在关键方法入口检查 abort 标志
- **异步中断**: 在循环和异步操作中定期检查
- **异常抛出**: 通过抛出异常中断执行流
- **Promise 拒绝**: 所有 Promise 都会被拒绝

### 3. 流式中止

```typescript
const abortStream = async (cancelReason: ClineApiReqCancelReason, streamingFailedMessage?: string) => {
	// 1. 恢复 Diff 更改
	if (this.diffViewProvider.isEditing) {
		await this.diffViewProvider.revertChanges()
	}

	// 2. 完成部分消息
	const lastMessage = this.clineMessages.at(-1)
	if (lastMessage && lastMessage.partial) {
		lastMessage.partial = false
	}

	// 3. 更新 API 请求消息 (添加取消原因和成本)
	updateApiReqMsg(cancelReason, streamingFailedMessage)
	await this.saveClineMessages()

	// 4. 标记完成
	this.didFinishAbortingStream = true
}

// 在流处理中调用
if (this.abort) {
	if (!this.abandoned) {
		await abortStream("user_cancelled")
	}
	break
}
```

**流中止特殊处理:**

1. **Diff 恢复**: 如果正在编辑文件,恢复更改
2. **消息完成**: 将部分消息标记为完成
3. **原因记录**: 记录取消原因 (用户取消 vs 流失败)
4. **成本记录**: 记录已使用的 Token 和成本

---

## 子任务机制

### 1. 启动子任务

```typescript
public async startSubtask(
    message: string,
    initialTodos: TodoItem[],
    mode: string
) {
    const provider = this.providerRef.deref()

    if (!provider) {
        throw new Error("Provider not available")



    // 1. 创建新任务
    const newTask = await provider.createTask(message, undefined, this, { initialTodos })

    if (newTask) {
        // 2. 暂停父任务
        this.isPaused = true
        this.childTaskId = newTask.taskId

        // 3. 切换到子任务模式
        await provider.handleModeSwitch(mode)
        await delay(500) // 等待模式切换生效

        // 4. 发送事件
        this.emit(RooCodeEventName.TaskPaused, this.taskId)
        this.emit(RooCodeEventName.TaskSpawned, newTask.taskId)
    }

    return newTask
}
```

**启动步骤:**

1. **创建子任务**: 调用 `provider.createTask()` 创建新任务实例
2. **暂停父任务**: 设置 `isPaused = true`,记录子任务 ID
3. **模式切换**: 切换到子任务指定的模式
4. **事件通知**: 发送 `TaskPaused` 和 `TaskSpawned` 事件

### 2. 等待子任务完成

```typescript
public async waitForSubtask() {
    await new Promise<void>((resolve) => {
        this.pauseInterval = setInterval(() => {
            if (!this.isPaused) {
                clearInterval(this.pauseInterval)
                this.pauseInterval = undefined
                resolve()
            }
        }, 1000) // 每秒检查一次
    })
}
```

**等待机制:**

- **轮询检查**: 每秒检查 `isPaused` 标志
- **Promise 包装**: 将轮询包装为 Promise,便于 await
- **清理**: 子任务完成后清理定时器

### 3. 完成子任务

```typescript
public async completeSubtask(lastMessage: string) {
    // 1. 恢复父任务状态
    this.isPaused = false
    this.childTaskId = undefined

    // 2. 发送事件
    this.emit(RooCodeEventName.TaskUnpaused, this.taskId)

    // 3. 将子任务结果添加到对话
    try {
        await this.say("subtask_result", lastMessage)

        await this.addToApiConversationHistory({
            role: "user",
            content: [{
                type: "text",
                text: `[new_task completed] Result: ${lastMessage}`
            }],
        })

        // 4. 跳过下一次 previous_response_id
        // (因为对话上下文发生了变化)
        this.skipPrevResponseIdOnce = true

    } catch (error) {
        this.providerRef.deref()?.log(
            `Error adding subtask result to parent conversation: ${error}`
        )
        throw error
    }
}
```

**完成步骤:**

1. **恢复状态**: 清除 `isPaused` 和 `childTaskId`
2. **事件通知**: 发送 `TaskUnpaused` 事件
3. **结果注入**: 将子任务结果作为用户消息添加到父任务对话
4. **上下文标记**: 设置 `skipPrevResponseIdOnce`,确保下次 API 调用发送完整上下文

### 4. 子任务检查点

在主循环中每次迭代都会检查是否需要等待子任务:

```typescript
// 在 recursivelyMakeClineRequests() 中
if (this.isPaused && provider) {
	provider.log(`[subtasks] paused ${this.taskId}.${this.instanceId}`)

	// 等待子任务完成
	await this.waitForSubtask()

	provider.log(`[subtasks] resumed ${this.taskId}.${this.instanceId}`)

	// 检查模式是否需要切换回来
	const currentMode = (await provider.getState())?.mode ?? defaultModeSlug

	if (currentMode !== this.pausedModeSlug) {
		await provider.handleModeSwitch(this.pausedModeSlug)
		await delay(500)
		provider.log(`[subtasks] switched back to '${this.pausedModeSlug}'`)
	}
}
```

**检查点逻辑:**

1. **检测暂停**: 每次循环开始检查 `isPaused`
2. **等待完成**: 如果暂停,调用 `waitForSubtask()` 阻塞
3. **恢复模式**: 子任务可能改变了模式,需要切换回父任务模式
4. **继续执行**: 恢复后继续父任务的正常流程

---

## 总结与最佳实践

### 1. Task 生命周期总览

```
┌─────────────────────────────────────────────────────────────┐
│                     Task 生命周期                             │
└─────────────────────────────────────────────────────────────┘

1. 创建阶段 (Constructor)
   ├── 生成 taskId 和 instanceId
   ├── 初始化控制器 (RooIgnore, FileContext 等)
   ├── 创建 API Handler
   ├── 异步加载模式
   └── 调用 startTask() 或 resumeTaskFromHistory()

2. 启动阶段 (startTask / resumeTaskFromHistory)
   ├── 订阅 Bridge (可选)
   ├── 初始化或加载对话历史
   ├── 显示初始消息
   └── 调用 initiateTaskLoop()

3. 运行阶段 (initiateTaskLoop + recursivelyMakeClineRequests)
   ├── 主循环: while (!this.abort)
   │   ├── 检查错误限制
   │   ├── 检查暂停状态 (子任务)
   │   ├── 处理用户内容
   │   ├── 获取环境详情
   │   ├── 发起 API 请求
   │   ├── 处理流式响应
   │   │   ├── reasoning 块
   │   │   ├── usage 块
   │   │   └── text 块 (包含工具调用)
   │   ├── 展示并执行内容
   │   │   ├── presentAssistantMessage()
   │   │   ├── 显示文本
   │   │   └── 执行工具
   │   └── 收集工具结果
   └── 循环直到任务完成或中止

4. 结束阶段 (多种路径)
   ├── 正常完成
   │   ├── attempt_completion 工具
   │   └── 用户确认
   ├── 用户中止
   │   └── abortTask()
   ├── 达到限制
   │   ├── 最大请求数
   │   └── 连续错误数
   └── 异常终止
       ├── API 错误
       └── 流式失败

5. 清理阶段 (dispose)
   ├── 清理消息队列
   ├── 移除事件监听器
   ├── 取消外部订阅
   ├── 释放终端
   ├── 关闭浏览器
   └── 清理文件监听
```

### 2. 关键检查点

**在任务执行过程中,有多个关键检查点确保任务正确运行:**

| 检查点     | 位置                           | 作用             |
| ---------- | ------------------------------ | ---------------- |
| abort 检查 | ask(), say(), 循环中           | 立即终止任务     |
| 错误限制   | recursivelyMakeClineRequests() | 防止无限错误循环 |
| 暂停检查   | 每次循环开始                   | 支持子任务机制   |
| 上下文窗口 | attemptApiRequest()            | 自动压缩对话历史 |
| 工具重复   | ToolRepetitionDetector         | 检测工具重复使用 |
| Token 使用 | 每次 API 请求后                | 统计和显示成本   |

### 3. 状态转换图

```
                    ┌─────────┐
                    │  创建    │
                    └────┬────┘
                         │
                    ┌────▼────┐
                    │  初始化  │
                    └────┬────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
    │ Running │◄───│  Idle   │◄───│Resumable│
    └────┬────┘    └────┬────┘    └────┬────┘
         │               │               │
         │          ┌────▼────┐          │
         └─────────►│Interactive├────────┘
                    └────┬────┘
                         │
                    ┌────▼────┐
                    │  Aborted │
                    └────┬────┘
                         │
                    ┌────▼────┐
                    │ Disposed │
                    └─────────┘
```

**状态说明:**

- **Running**: 正在执行,处理 API 响应或工具
- **Idle**: 空闲,等待用户输入 (如 followup 问题)
- **Resumable**: 可恢复,等待用户确认 (如 attempt_completion)
- **Interactive**: 交互,等待用户审批 (如工具执行)
- **Aborted**: 已中止,准备清理
- **Disposed**: 已清理,对象可回收

### 4. 最佳实践

#### a) 任务创建

```typescript
// ✅ 推荐:使用 create() 静态方法
const [task, promise] = Task.create({
    provider,
    apiConfiguration,
    task: "实现登录功能",
    images: []
})

// 等待任务初始化完成
await promise

// ❌ 不推荐:直接 new Task() 且不等待
const task = new Task({ ... }) // 可能导致模式未初始化
```

#### b) 模式访问

```typescript
// ✅ 推荐:异步访问模式
const mode = await task.getTaskMode()

// ✅ 可选:等待初始化后同步访问
await task.waitForModeInitialization()
const mode = task.taskMode

// ❌ 错误:直接访问私有属性
const mode = task._taskMode // 编译错误
```

#### c) 状态检查

```typescript
// ✅ 推荐:使用 taskStatus getter
if (task.taskStatus === TaskStatus.Interactive) {
	// 需要用户交互
}

// ✅ 推荐:监听状态事件
task.on(RooCodeEventName.TaskInteractive, (taskId) => {
	console.log(`Task ${taskId} needs interaction`)
})

// ❌ 不推荐:直接检查内部状态
if (task.interactiveAsk) {
	// 实现细节,可能改变
	// ...
}
```

#### d) 任务清理

```typescript
// ✅ 推荐:正常中止
await task.abortTask()

// ✅ 推荐:废弃任务 (创建新任务时)
await oldTask.abortTask(true) // isAbandoned = true

// ❌ 错误:不调用 dispose()
task.abort = true // 不够,需要清理资源
```

### 5. 常见问题排查

#### Q1: 任务卡住不执行

**可能原因:**

- `isPaused = true` 但子任务未完成
- `isStreaming = true` 但流已中断
- 等待 `askResponse` 但 UI 未响应

**排查方法:**

```typescript
console.log("Task state:", {
	abort: task.abort,
	isPaused: task.isPaused,
	isStreaming: task.isStreaming,
	taskStatus: task.taskStatus,
	childTaskId: task.childTaskId,
	askResponse: task.askResponse !== undefined,
})
```

#### Q2: 任务无法正常结束

**可能原因:**

- `userMessageContentReady` 未设置为 true
- 部分内容块未完成
- 流处理未完成标记

**排查方法:**

```typescript
console.log("Content state:", {
	currentIndex: task.currentStreamingContentIndex,
	totalBlocks: task.assistantMessageContent.length,
	partialBlocks: task.assistantMessageContent.filter((b) => b.partial).length,
	didCompleteReading: task.didCompleteReadingStream,
	userContentReady: task.userMessageContentReady,
})
```

#### Q3: 子任务无法恢复父任务

**可能原因:**

- `isPaused` 未正确设置为 false
- `pauseInterval` 未清理
- 子任务未调用 `completeSubtask()`

**排查方法:**

```typescript
// 在父任务中
console.log("Parent task:", {
	isPaused: parentTask.isPaused,
	childTaskId: parentTask.childTaskId,
	pauseInterval: parentTask.pauseInterval !== undefined,
})

// 手动恢复 (临时方案)
parentTask.isPaused = false
parentTask.childTaskId = undefined
```

#### Q4: 内存泄漏

**可能原因:**

- 事件监听器未清理
- 定时器未清除
- 文件监听器未停止
- `RooIgnoreController` 未 dispose

**排查方法:**

```typescript
// 检查 EventEmitter 监听器
console.log("Event listeners:", task.listenerCount(RooCodeEventName.TaskAborted))

// 确保 dispose 被调用
task.on(RooCodeEventName.TaskAborted, () => {
	console.log("Task aborted, dispose should be called")
})
```

### 6. 性能优化建议

#### a) 减少文件系统操作

```typescript
// ✅ 推荐:只在首次请求包含文件详情
await this.initiateTaskLoop(userContent)
// includeFileDetails 自动设置为 false

// ❌ 不推荐:每次都包含
for (let i = 0; i < requests; i++) {
	await this.recursivelyMakeClineRequests(content, true) // 昂贵的操作
}
```

#### b) 批量保存消息

```typescript
// ✅ 推荐:使用内置的保存机制
await this.saveClineMessages() // 批量保存

// ❌ 不推荐:频繁保存
for (const msg of messages) {
	await this.addToClineMessages(msg) // 每次都写磁盘
}
```

#### c) 使用栈代替递归

```typescript
// ✅ 推荐:使用栈实现 (当前实现)
const stack: StackItem[] = [{ userContent, includeFileDetails }]
while (stack.length > 0) {
	const item = stack.pop()!
	// 处理...
	if (hasMore) {
		stack.push(nextItem)
	}
}

// ❌ 不推荐:真递归 (旧实现,已废弃)
async function recursive(content) {
	// 处理...
	if (hasMore) {
		return await recursive(nextContent) // 可能栈溢出
	}
}
```

### 7. 调试技巧

#### a) 启用详细日志

```typescript
// 在 Task 构造函数中
console.log(`[Task#${this.taskId}.${this.instanceId}] created`)

// 在关键方法中
console.log(`[Task#${this.taskId}] entering recursivelyMakeClineRequests`)
console.log(`[Task#${this.taskId}] API request started`)
console.log(`[Task#${this.taskId}] stream completed`)
```

#### b) 监听所有事件

```typescript
// 监听任务生命周期事件
const events = [
	RooCodeEventName.TaskStarted,
	RooCodeEventName.TaskActive,
	RooCodeEventName.TaskIdle,
	RooCodeEventName.TaskResumable,
	RooCodeEventName.TaskInteractive,
	RooCodeEventName.TaskPaused,
	RooCodeEventName.TaskUnpaused,
	RooCodeEventName.TaskAborted,
]

events.forEach((event) => {
	task.on(event, (taskId) => {
		console.log(`[Event] ${event} - ${taskId}`)
	})
})
```

#### c) 断点位置建议

**关键断点位置:**

1. `Task.constructor()` - 任务创建
2. `startTask()` / `resumeTaskFromHistory()` - 任务启动
3. `initiateTaskLoop()` - 主循环开始
4. `recursivelyMakeClineRequests()` - 请求循环
5. `attemptApiRequest()` - API 请求
6. `presentAssistantMessage()` - 内容展示
7. `ask()` - 用户交互
8. `abortTask()` - 任务中止
9. `dispose()` - 资源清理

### 8. 相关文档

- **[02-命令执行流程](./02-command-execution-flow.md)**: 了解工具如何执行系统命令
- **[03-上下文压缩机制](./03-context-compression.md)**: 深入理解自动压缩逻辑
- **[04-完整工作流程](./04-complete-workflow.md)**: 端到端任务执行流程
- **[05-目录结构详解](./05-directory-structure.md)**: Task.ts 所在的目录结构

---

## 附录: Task.ts 关键方法速查

| 方法                             | 作用                         | 返回值                           |
| -------------------------------- | ---------------------------- | -------------------------------- |
| `constructor()`                  | 创建并初始化任务             | Task 实例                        |
| `static create()`                | 创建任务并返回初始化 Promise | `[Task, Promise<void>]`          |
| `startTask()`                    | 启动新任务                   | `Promise<void>`                  |
| `resumeTaskFromHistory()`        | 从历史恢复任务               | `Promise<void>`                  |
| `initiateTaskLoop()`             | 启动主任务循环               | `Promise<void>`                  |
| `recursivelyMakeClineRequests()` | 递归处理请求                 | `Promise<boolean>`               |
| `attemptApiRequest()`            | 发起 API 请求                | `AsyncGenerator<ApiStreamChunk>` |
| `ask()`                          | 询问用户                     | `Promise<AskResponse>`           |
| `say()`                          | 向用户发送消息               | `Promise<void>`                  |
| `abortTask()`                    | 中止任务                     | `Promise<void>`                  |
| `dispose()`                      | 清理资源                     | `void`                           |
| `getTaskMode()`                  | 获取任务模式 (异步)          | `Promise<string>`                |
| `get taskMode()`                 | 获取任务模式 (同步)          | `string`                         |
| `get taskStatus()`               | 获取任务状态                 | `TaskStatus`                     |
| `getTokenUsage()`                | 获取 Token 使用情况          | `TokenUsage`                     |
| `startSubtask()`                 | 启动子任务                   | `Promise<Task>`                  |
| `waitForSubtask()`               | 等待子任务完成               | `Promise<void>`                  |
| `completeSubtask()`              | 完成子任务                   | `Promise<void>`                  |
| `checkpointSave()`               | 保存检查点                   | `Promise<void>`                  |
| `checkpointRestore()`            | 恢复检查点                   | `Promise<void>`                  |

---

**文档版本**: 1.0  
**最后更新**: 2025-10-09  
**维护者**: Roo-Code Documentation Team
