# Roo-Code 完整工作流程

## 概述

本文档详细描述 Roo-Code 从用户输入到任务完成的完整端到端工作流程,包括所有关键组件的交互和数据流转。

## 工作流程图

```
用户输入
   ↓
WebView (React UI)
   ↓
ClineProvider (扩展后端)
   ↓
Task (任务管理器)
   ↓
API Handler (AI 提供商)
   ↓
Tool Dispatcher (工具分发)
   ↓
Tool Execution (工具执行)
   ↓
Environment Details (环境信息收集)
   ↓
WebView Update (UI 更新)
   ↓
用户确认/反馈
   ↓
[循环直到任务完成]
```

## 详细流程

### 阶段 1: 任务创建

#### 1.1 用户触发

**方式一: WebView 输入**

```typescript
// webview-ui/src/components/chat/ChatInput.tsx
const handleSubmit = () => {
	vscode.postMessage({
		type: "newTask",
		text: userInput,
	})
}
```

**方式二: 命令面板**

```typescript
// VSCode 命令
vscode.commands.executeCommand("roo-code.plusButtonClicked")
```

**方式三: 快捷键**

```
Cmd/Ctrl + Shift + P → "Roo-Code: New Task"
```

#### 1.2 消息传递到扩展

```typescript
// src/core/webview/ClineProvider.ts
private async handleWebviewMessage(message: WebviewMessage) {
    switch (message.type) {
        case 'newTask':
            await this.initClineWithTask(message.text)
            break
    }
}
```

#### 1.3 创建 Task 实例

```typescript
// src/core/webview/ClineProvider.ts
private async initClineWithTask(text: string) {
    // 创建新任务
    this.currentTaskId = Date.now().toString()

    // 初始化 Task
    const task = new Task({
        taskId: this.currentTaskId,
        userMessage: text,
        provider: this.apiProvider,
        // ... 其他配置
    })

    // 开始执行
    await task.start()
}
```

### 阶段 2: API 对话循环

#### 2.1 构建初始消息

```typescript
// src/core/task/Task.ts
async start() {
    // 构建消息列表
    const messages = [
        {
            role: 'user',
            content: this.userMessage
        }
    ]

    // 添加环境信息
    const envDetails = await getEnvironmentDetails()
    messages.push({
        role: 'user',
        content: `<environment_details>\n${envDetails}\n</environment_details>`
    })

    // 开始递归对话
    await this.recursivelyMakeClaudRequests(messages)
}
```

#### 2.2 发送 API 请求

```typescript
// src/core/task/Task.ts
private async recursivelyMakeClaudRequests(messages: ApiMessage[]) {
    // 1. 检查是否需要压缩上下文
    if (shouldCompress(messages)) {
        messages = await compressContext(messages)
    }

    // 2. 发送请求到 AI
    const response = await this.apiHandler.createMessage({
        messages: messages,
        system: this.systemPrompt,
        tools: this.availableTools
    })

    // 3. 处理响应
    await this.handleResponse(response)
}
```

#### 2.3 流式接收响应

```typescript
// src/api/providers/anthropic.ts
for await (const chunk of stream) {
	if (chunk.type === "content_block_delta") {
		// 文本响应
		accumulatedText += chunk.delta.text

		// 实时更新 WebView
		this.postMessageToWebview({
			type: "partialMessage",
			content: accumulatedText,
		})
	} else if (chunk.type === "tool_use") {
		// 工具调用
		toolCalls.push(chunk)
	}
}
```

### 阶段 3: 工具调用

#### 3.1 解析工具请求

```typescript
// src/core/task/Task.ts
private async handleResponse(response: ApiResponse) {
    if (response.stop_reason === 'tool_use') {
        // 提取工具调用
        const toolUse = response.content.find(
            block => block.type === 'tool_use'
        )

        // 分发到对应工具
        await this.executeTool(toolUse)
    }
}
```

#### 3.2 工具分发

```typescript
// src/core/task/Task.ts
private async executeTool(toolUse: ToolUse) {
    const { name, input } = toolUse

    switch (name) {
        case 'execute_command':
            return await executeCommandTool(input)
        case 'read_file':
            return await readFileTool(input)
        case 'write_to_file':
            return await writeToFileTool(input)
        case 'apply_diff':
            return await applyDiffTool(input)
        // ... 其他工具
    }
}
```

#### 3.3 请求用户批准

```typescript
// src/core/task/Task.ts
private async executeTool(toolUse: ToolUse) {
    // 发送到 WebView 请求批准
    const approval = await this.ask('tool', {
        tool: toolUse
    })

    if (approval === 'rejected') {
        return { error: 'User rejected' }
    }

    // 执行工具
    const result = await this.tools[toolUse.name].execute(toolUse.input)
    return result
}
```

#### 3.4 WebView 显示批准请求

```typescript
// webview-ui/src/components/chat/ToolApproval.tsx
const ToolApproval = ({ tool }) => {
    return (
        <div className="tool-approval">
            <h3>Tool: {tool.name}</h3>
            <pre>{JSON.stringify(tool.input, null, 2)}</pre>
            <button onClick={() => approve()}>Approve</button>
            <button onClick={() => reject()}>Reject</button>
            <button onClick={() => edit()}>Edit</button>
        </div>
    )
}
```

#### 3.5 用户响应

```typescript
// webview-ui/src/components/chat/ToolApproval.tsx
const approve = () => {
	vscode.postMessage({
		type: "askResponse",
		askTs: tool.ts,
		response: "yesButtonClicked",
	})
}
```

#### 3.6 执行工具

```typescript
// src/core/tools/executeCommandTool.ts
export async function execute(params: { command: string; cwd?: string }) {
	// 获取终端
	const terminal = await terminalRegistry.getOrCreateTerminal(params.cwd)

	// 执行命令
	const result = await terminal.runCommand(params.command)

	// 返回结果
	return {
		exitCode: result.exitCode,
		output: result.output,
	}
}
```

### 阶段 4: 环境信息收集

#### 4.1 收集系统信息

```typescript
// src/core/environment/getEnvironmentDetails.ts
export async function getEnvironmentDetails(): Promise<string> {
	const details = []

	// 1. 可见文件
	details.push(await getVisibleFiles())

	// 2. 打开的标签页
	details.push(await getOpenTabs())

	// 3. 活动终端
	details.push(await getActiveTerminals())

	// 4. 诊断信息 (错误、警告)
	details.push(await getDiagnostics())

	return details.join("\n\n")
}
```

#### 4.2 格式化环境信息

```typescript
// 格式化后的环境信息
<environment_details>
# VSCode Visible Files
src/App.tsx
src/index.tsx

# VSCode Open Tabs
src/App.tsx, src/components/Header.tsx

# Actively Running Terminals
## Terminal 1 (Active)
### Working Directory: /project
### Last Command: npm run dev
### Output:
Server started on http://localhost:3000

# Problems
src/App.tsx:10:5 - error TS2304: Cannot find name 'foo'
</environment_details>
```

### 阶段 5: 继续对话循环

#### 5.1 构建工具结果消息

```typescript
// src/core/task/Task.ts
private async handleToolResult(toolUse: ToolUse, result: any) {
    // 将工具结果添加到消息历史
    messages.push({
        role: 'assistant',
        content: [
            { type: 'tool_use', ...toolUse },
            { type: 'text', text: thinkingText }
        ]
    })

    messages.push({
        role: 'user',
        content: [
            {
                type: 'tool_result',
                tool_use_id: toolUse.id,
                content: JSON.stringify(result)
            }
        ]
    })

    // 继续递归对话
    await this.recursivelyMakeClaudRequests(messages)
}
```

#### 5.2 AI 处理结果并决策

```typescript
// AI 看到工具结果后:
// 1. 如果任务完成 → 调用 attempt_completion
// 2. 如果需要更多信息 → 调用其他工具
// 3. 如果出错 → 调用工具修复
// 4. 如果需要用户输入 → 调用 ask_followup_question
```

### 阶段 6: 任务完成

#### 6.1 AI 调用 attempt_completion

```typescript
// AI 响应
{
    type: 'tool_use',
    name: 'attempt_completion',
    input: {
        result: '我已经完成了任务...'
    }
}
```

#### 6.2 显示完成消息

```typescript
// src/core/task/Task.ts
if (toolName === "attempt_completion") {
	// 暂停任务
	this.state = "waiting_for_user"

	// 显示完成消息
	await this.postMessageToWebview({
		type: "completion",
		result: toolInput.result,
	})
}
```

#### 6.3 用户确认或反馈

**选项 1: 接受**

```typescript
// 用户点击 "Accept"
vscode.postMessage({
	type: "askResponse",
	response: "yesButtonClicked",
})

// 任务结束
task.state = "completed"
```

**选项 2: 反馈**

```typescript
// 用户提供反馈
vscode.postMessage({
	type: "askResponse",
	response: "messageResponse",
	text: "请修改颜色为蓝色",
})

// 任务继续,将反馈添加到消息历史
messages.push({
	role: "user",
	content: "请修改颜色为蓝色",
})

// 继续对话循环
await recursivelyMakeClaudRequests(messages)
```

## 状态管理

### Task 状态机

```typescript
type TaskState =
	| "idle" // 空闲
	| "running" // 运行中
	| "waiting_for_api" // 等待 API 响应
	| "waiting_for_user" // 等待用户输入
	| "executing_tool" // 执行工具
	| "completed" // 已完成
	| "error" // 错误
```

### 状态转换

```
idle → running → waiting_for_api → waiting_for_user → executing_tool
  ↑                                        ↓                    ↓
  └────────────────────────────────────────┴────────────────────┘
                            (循环直到完成)
```

### 状态同步

```typescript
// src/core/webview/ClineProvider.ts
private async postStateToWebview() {
    await this.view?.webview.postMessage({
        type: 'state',
        state: {
            taskId: this.currentTaskId,
            taskState: this.task?.state,
            messages: this.task?.messages,
            apiMetrics: this.task?.metrics
        }
    })
}
```

## 消息流

### 扩展 → WebView

```typescript
// 消息类型
type ExtensionMessage =
	| { type: "state"; state: TaskState }
	| { type: "partialMessage"; content: string }
	| { type: "action"; action: "askResponse" }
	| { type: "completion"; result: string }
```

### WebView → 扩展

```typescript
// 消息类型
type WebviewMessage =
	| { type: "newTask"; text: string }
	| { type: "askResponse"; response: string }
	| { type: "cancelTask" }
	| { type: "retryLastMessage" }
```

## 并发处理

### 单任务执行

```typescript
// 同一时间只能有一个活动任务
if (this.currentTask?.isRunning) {
	throw new Error("A task is already running")
}
```

### 子任务支持

```typescript
// 主任务可以创建子任务
const subtask = await this.createSubtask({
	instruction: "修复测试",
})

await subtask.start()
await subtask.waitForCompletion()
```

### 工具并发

```typescript
// 某些工具可以并发执行
const results = await Promise.all([
	readFileTool({ path: "file1.ts" }),
	readFileTool({ path: "file2.ts" }),
	readFileTool({ path: "file3.ts" }),
])
```

## 错误处理

### API 错误

```typescript
try {
	const response = await api.createMessage(params)
} catch (error) {
	if (error.type === "rate_limit_error") {
		// 等待后重试
		await sleep(error.retryAfter)
		return this.retry()
	} else if (error.type === "overloaded_error") {
		// 使用备用模型
		return this.switchToBackupModel()
	}
}
```

### 工具执行错误

```typescript

```
