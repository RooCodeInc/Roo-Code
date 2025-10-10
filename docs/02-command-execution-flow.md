# 命令执行流程详解

## 概述

本文档详细说明 Roo-Code 如何处理工具请求系统命令的完整流程,从用户输入到命令执行再到结果返回。

## 核心文件

### 1. executeCommandTool.ts

**路径**: `src/core/tools/executeCommandTool.ts` (364行)

**职责**:

- 命令执行的入口点
- 处理用户批准逻辑
- 管理终端选择
- 捕获实时输出

**关键代码**:

```typescript
const { exitCode, output } = await terminal.runCommand(approvedCommand)
```

### 2. TerminalRegistry.ts

**路径**: `src/integrations/terminal/TerminalRegistry.ts` (328行)

**职责**:

- 管理终端池(最多5个终端)
- 监听 Shell Integration 事件
- 智能终端复用
- 终端状态跟踪

**关键代码**:

```typescript
vscode.window.onDidEndTerminalShellExecution((event) => {
	this.handleCommandExecution(event)
})
```

### 3. Terminal.ts

**路径**: `src/integrations/terminal/Terminal.ts` (193行)

**职责**:

- VSCode 集成终端实现
- Shell Integration 等待机制
- 输出压缩算法

## 完整执行流程

### 第一步: 工具调用请求

```
用户/AI → executeCommandTool.execute()
```

1. AI 决定需要执行命令
2. 调用 `executeCommandTool.execute()` 方法
3. 传入参数: `{ command: string, cwd?: string }`

### 第二步: 用户批准

```typescript
// 请求用户批准
const approval = await ask("tool", {
	tool: {
		tool: "execute_command",
		command: command,
		cwd: cwd,
	},
})
```

**批准选项**:

- ✅ **Approve**: 执行命令
- ✏️ **Edit**: 修改命令后执行
- ❌ **Reject**: 拒绝执行

### 第三步: 终端选择

```typescript
// 获取或创建终端
const terminalInfo = await this.terminalRegistry.getOrCreateTerminal(cwd)
```

**终端复用策略**:

1. 如果指定了 `cwd`,查找该目录的现有终端
2. 如果没有找到,查找空闲终端
3. 如果所有终端都忙,等待或创建新终端(最多5个)

### 第四步: Shell Integration 等待

```typescript
// 等待 Shell Integration 就绪
await terminal.waitForShellIntegration()
```

**Shell Integration**:

- VSCode 1.93+ 的特性
- 允许捕获命令输出
- 提供命令执行状态

**等待机制**:

- 最多等待 10 秒
- 每 100ms 检查一次
- 超时则降级为普通终端

### 第五步: 执行命令

```typescript
// 在终端中执行命令
const { exitCode, output } = await terminal.runCommand(command)
```

**执行过程**:

1. 如果需要,先切换工作目录: `cd ${cwd}`
2. 发送命令到终端: `terminal.sendText(command)`
3. 监听 Shell Integration 事件
4. 收集命令输出

### 第六步: 输出捕获

**Shell Integration 事件监听**:

```typescript
vscode.window.onDidEndTerminalShellExecution((event) => {
	// 捕获命令输出
	const stream = event.execution.read()
	for await (const data of stream) {
		output += data
	}
})
```

**输出处理**:

- 实时流式捕获
- 自动过滤 ANSI 转义码
- 压缩过长输出(>10000字符)

### 第七步: 输出压缩

```typescript
if (output.length > 10000) {
	// 保留前6000字符
	const start = output.slice(0, 6000)
	// 保留后2000字符
	const end = output.slice(-2000)
	output = start + "\n\n... (output truncated) ...\n\n" + end
}
```

### 第八步: 返回结果

```typescript
return {
	exitCode: exitCode,
	output: output,
	error: error,
}
```

## 终端管理机制

### 终端池 (TerminalRegistry)

**容量**: 最多5个终端

**状态**:

- `busy`: 正在执行命令
- `idle`: 空闲可用
- `disposed`: 已销毁

**复用策略**:

```typescript
// 1. 优先查找相同 cwd 的终端
if (cwd) {
	terminal = findByCwd(cwd)
}

// 2. 查找空闲终端
if (!terminal) {
	terminal = findIdle()
}

// 3. 创建新终端
if (!terminal && count < 5) {
	terminal = create()
}

// 4. 等待终端空闲
if (!terminal) {
	await waitForIdle()
}
```

### Shell Integration 降级

如果 Shell Integration 不可用:

1. 使用普通终端模式
2. 无法捕获输出
3. 返回提示消息

```typescript
return {
	exitCode: 0,
	output: "Command executed in terminal. Shell integration not available.",
}
```

## 特殊情况处理

### 1. 长时间运行的命令

```typescript
// 允许命令在后台运行
// 不阻塞 AI 继续工作
terminal.sendText(command)
// 立即返回,不等待完成
```

### 2. 交互式命令

```typescript
// 支持需要用户输入的命令
// 例如: npm install, git commit
terminal.show() // 显示终端给用户
```

### 3. 目录切换

```typescript
// 自动处理工作目录切换
if (cwd && cwd !== terminal.cwd) {
	terminal.sendText(`cd "${cwd}"`)
}
```

### 4. 错误处理

```typescript
try {
	const result = await terminal.runCommand(command)
	if (result.exitCode !== 0) {
		// 命令失败,返回错误信息
		return { error: result.output }
	}
} catch (error) {
	// 执行异常,返回异常信息
	return { error: error.message }
}
```

## 环境信息收集

执行命令后,系统会自动收集环境信息:

**收集内容**:

```typescript
// src/core/environment/getEnvironmentDetails.ts
{
	activeTerminals: [
		{
			id: number,
			name: string,
			lastCommand: string,
			output: string,
			exitCode: number,
		},
	]
}
```

**自动包含在下一轮对话**:

- AI 可以看到命令执行结果
- 用于决策下一步操作
- 无需用户手动复制粘贴

## 性能优化

### 1. 终端复用

- 避免频繁创建销毁终端
- 减少 Shell Integration 初始化时间

### 2. 输出压缩

- 防止过长输出占用 token
- 保留关键信息(开头和结尾)

### 3. 异步执行

- 不阻塞 UI 线程
- 支持并发执行多个命令

### 4. 智能等待

- Shell Integration 就绪检测
- 避免过早发送命令

## 调试技巧

### 查看终端状态

```typescript
// 在 VSCode 开发工具控制台
console.log(terminalRegistry.getAll())
```

### 手动测试命令

```typescript
// 在扩展开发主机中
const terminal = await terminalRegistry.getOrCreateTerminal()
const result = await terminal.runCommand("ls -la")
console.log(result)
```

### 日志输出

```typescript
// 启用详细日志
// settings.json
{
    "roo-code.verbosity": "debug"
}
```

## 相关文档

- [项目概览](./01-project-overview.md)
- [完整工作流程](./04-complete-workflow.md)
- [目录结构详解](./05-directory-structure.md)

## 参考文件

- `src/core/tools/executeCommandTool.ts`
- `src/integrations/terminal/TerminalRegistry.ts`
- `src/integrations/terminal/Terminal.ts`
- `src/integrations/terminal/ExecaTerminal.ts`
- `src/core/environment/getEnvironmentDetails.ts`
