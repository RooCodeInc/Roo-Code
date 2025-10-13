# 任务拆分与UI显示改进方案

> 本文档详细说明大模型如何根据提示词将大型任务拆分成多个子任务，以及UI面板显示的改进建议。

## 文档版本

- **创建时间**: 2025-10-12
- **参考文档**: docs/07-task-lifecycle.md, docs/08-prompts-system.md, docs/14-multi-agent-collaboration-system.md
- **状态**: 技术方案

---

## 1. 当前任务拆分机制分析

### 1.1 现有的任务拆分能力

Roo-Code 目前有**三种**任务拆分相关的机制：

#### 1.1.1 TODO列表系统（轻量级任务拆分）

**工具**: `update_todo_list`

**位置**:

- 工具实现: [`src/core/tools/updateTodoListTool.ts`](src/core/tools/updateTodoListTool.ts)
- 提示词: [`src/core/prompts/tools/update-todo-list.ts`](src/core/prompts/tools/update-todo-list.ts)

**工作原理**:

```typescript
// 数据结构
interface TodoItem {
  id: string
  content: string
  status: TodoStatus  // "pending" | "in_progress" | "completed"
}

// 大模型调用方式
<update_todo_list>
<todos>
[x] 分析需求
[x] 设计架构
[-] 实现核心逻辑
[ ] 编写测试
[ ] 更新文档
</todos>
</update_todo_list>
```

**特点**:

- ✅ **简单轻量**: 只是任务状态跟踪，不创建新的Task实例
- ✅ **实时更新**: 大模型可随时更新进度
- ✅ **用户可见**: 显示在环境详情中
- ❌ **无并行**: 不支持并发执行
- ❌ **无隔离**: 所有TODO共享一个任务上下文

**提示词指导** (来自 [`update-todo-list.ts`](src/core/prompts/tools/update-todo-list.ts)):

```
**When to Use:**
- The task is complicated or involves multiple steps or requires ongoing tracking.
- You need to update the status of several todos at once.
- New actionable items are discovered during task execution.
- The user requests a todo list or provides multiple tasks.
- The task is complex and benefits from clear, stepwise progress tracking.

**When NOT to Use:**
- There is only a single, trivial task.
- The task can be completed in one or two simple steps.
- The request is purely conversational or informational.
```

#### 1.1.2 子任务机制（真实任务拆分）

**工具**: `new_task`

**位置**:

- 工具实现: [`src/core/tools/newTaskTool.ts`](src/core/tools/newTaskTool.ts)
- Task实现: [`src/core/task/Task.ts`](src/core/task/Task.ts:1805)

**工作原理**:

```typescript
// 创建子任务
public async startSubtask(
  message: string,
  initialTodos: TodoItem[],
  mode: string
): Promise<Task> {
  // 1. 创建新的Task实例
  const newTask = await provider.createTask(message, undefined, this, { initialTodos })

  // 2. 暂停父任务
  this.isPaused = true
  this.childTaskId = newTask.taskId

  // 3. 切换到子任务模式
  await provider.handleModeSwitch(mode)

  // 4. 发送事件
  this.emit(RooCodeEventName.TaskPaused, this.taskId)
  this.emit(RooCodeEventName.TaskSpawned, newTask.taskId)

  return newTask
}
```

**特点**:

- ✅ **完全隔离**: 每个子任务有独立的上下文和对话历史
- ✅ **模式切换**: 子任务可以使用不同的模式
- ✅ **父子关系**: 维护清晰的任务层级
- ❌ **串行执行**: 子任务完成前父任务暂停
- ❌ **无并行**: 一次只能运行一个子任务

**子任务完成流程**:

```typescript
// 当子任务完成
public async completeSubtask(lastMessage: string) {
  // 1. 恢复父任务
  this.isPaused = false
  this.childTaskId = undefined

  // 2. 将子任务结果注入父任务对话
  await this.say("subtask_result", lastMessage)
  await this.addToApiConversationHistory({
    role: "user",
    content: [{
      type: "text",
      text: `[new_task completed] Result: ${lastMessage}`
    }]
  })

  // 3. 恢复父任务执行
  this.emit(RooCodeEventName.TaskUnpaused, this.taskId)
}
```

#### 1.1.3 多代理协作系统（未实现，仅设计文档）

**参考**: [`docs/14-multi-agent-collaboration-system.md`](docs/14-multi-agent-collaboration-system.md)

这是一个**高级特性的设计方案**，尚未实现，但提供了任务拆分的理想架构：

**核心概念**:

- **专职代理**: Architect, CodeWriter, TestWriter, Documentation, Review等
- **智能分发**: 根据任务特征自动选择合适的代理
- **并行执行**: 多个代理同时工作
- **结果整合**: 合并多个代理的输出并解决冲突

---

## 2. 大模型如何根据提示词拆分任务

### 2.1 提示词系统的任务拆分指导

根据 [`docs/08-prompts-system.md`](docs/08-prompts-system.md)，系统提示词包含以下关键部分：

#### 2.1.1 工具使用指南 (Tool Use Guidelines)

```
# Tool Use Guidelines

1. Assess what information you already have and what information you need to proceed with the task.
2. **CRITICAL: For ANY exploration of code you haven't examined yet in this conversation,
   you MUST use the `codebase_search` tool FIRST before any other search or file exploration tools.**
3. Choose the most appropriate tool based on the task and the tool descriptions provided.
4. If multiple actions are needed, use one tool at a time per message to accomplish the task iteratively.
5. Formulate your tool use using the XML format specified for each tool.
6. After each tool use, the user will respond with the result of that tool use.
7. ALWAYS wait for user confirmation after each tool use before proceeding.
```

**关键点**:

- 强调**迭代式执行**: "use one tool at a time per message"
- 强调**等待确认**: "ALWAYS wait for user confirmation"
  architect 模式（只读）
- 实施阶段应该用 code 模式（可编辑）
- 但大模型不知道应该创建子任务来切换模式

理想行为（使用子任务）:

1. 创建子任务1 (architect模式): 分析代码结构
2. 等待子任务1完成，获取分析报告
3. 创建子任务2 (code模式): 实施重构
4. 使用 attempt_completion 完成

❌ 问题 - 缺少明确的提示词指导何时创建子任务

```

---

## 3. 问题分析与改进方案

### 3.1 当前存在的问题

#### 问题1: 提示词缺少任务拆分决策指导

**现象**:
大模型不清楚何时应该使用 `update_todo_list` vs `new_task`

**原因**:
- `update_todo_list` 工具描述中说明了"何时使用"
- `new_task` 工具描述中**没有**说明适用场景
- 系统提示词中没有任务拆分策略指导

**影响**:
- 大模型倾向于使用更简单的 TODO 列表
- 错过了子任务带来的模式隔离和上下文清晰度
- 复杂任务的执行质量降低

#### 问题2: UI没有可视化TODO层级结构

**现象**:
TODO列表只显示为扁平的文本列表，没有树状结构或折叠展开功能

**当前显示** (在环境详情中):
```

# TODO List (Current Task Progress)

[x] 分析需求
[x] 设计架构  
[-] 实现核心逻辑
[ ] 编写测试
[ ] 更新文档

````

**问题**:
- 看不出任务之间的层级关系
- 无法折叠/展开完成的任务
- 对于有10+个TODO的任务，列表太长
- 没有进度百分比指示器

#### 问题3: 子任务嵌套关系不可见

**现象**:
当使用 `new_task` 创建子任务时，用户在UI中看不到父子关系

**当前情况**:
- Task类维护了 `parentTaskId` 和 `childTaskId`
- ClineProvider维护了任务栈
- 但UI没有显示这些关系

---

### 3.2 改进方案

#### 改进方案1: 增强提示词 - 任务拆分决策指导

**位置**: 修改 `src/core/prompts/sections/objective.ts`

**添加内容**:

```markdown
## Task Decomposition Strategy

When analyzing a task, choose the appropriate approach:

### Option A: Use TODO List (update_todo_list)
**When to use:**
- Task has multiple steps but can be completed in the SAME mode
- All steps share the same context and conversation history
- Steps are sequential and don't require mode switching
- Example: "Implement a login feature" (all in code mode)

### Option B: Create Subtasks (new_task)
**When to use:**
- Task requires DIFFERENT modes for different phases
  - Example: Architect mode for design → Code mode for implementation
- Task has clearly separable concerns that benefit from isolated contexts
- Task is very large and would benefit from checkpointing between phases

### Option C: Hybrid Approach
- Main task has sub-phases that each need their own TODO lists
- Example: "Refactor project" → Create subtask per module
````

#### 改进方案2: UI显示 - 树状结构

**方案A: 简单的Accordion折叠模式**

适合快速实现，在现有UI中添加折叠展开功能：

```typescript
// webview-ui/src/components/TaskProgress.tsx
interface TaskProgressProps {
  todos: TodoItem[]
  taskStack: Array<{ taskId: string; description: string }>
}

function TaskProgress({ todos, taskStack }: TaskProgressProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  // 计算进度
  const completed = todos.filter(t => t.status === 'completed').length
  const progress = todos.length > 0 ? (completed / todos.length) * 100 : 0

  return (
    <div className="task-progress">
      {/* 进度条 */}
      <div className="mb-2">
        <div className="flex justify-between text-sm mb-1">
          <span>任务进度</span>
          <span>{completed}/{todos.length} ({progress.toFixed(0)}%)</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* TODO列表 - 按状态分组 */}
      <div>
        {/* 进行中的任务 */}
        <Section title="进行中" icon="⚙️" defaultOpen={true}>
          {todos.filter(t => t.status === 'in_progress').map(renderTodoItem)}
        </Section>

        {/* 待办任务 */}
        <Section title="待办" icon="📋" defaultOpen={true}>
          {todos.filter(t => t.status === 'pending').map(renderTodoItem)}
        </Section>

        {/* 已完成任务 - 默认折叠 */}
        <Section title="已完成" icon="✅" defaultOpen={false}>
          {todos.filter(t => t.status === 'completed').map(renderTodoItem)}
        </Section>
      </div>
    </div>
  )
}
```

**方案B: 完整的树状层级显示**

显示任务栈和TODO的完整层级关系：

```
📊 任务层级 (80% 完成)
└─ 🎯 实现用户认证系统 (根任务 - code模式)
   ├─ ✅ 子任务: 设计架构 (architect模式) - 已完成
   │  ├─ [x] 定义数据模型
   │  ├─ [x] 设计API接口
   │  └─ [x] 创建架构文档
   ├─ ⚙️ 子任务: 实现后端 (code模式) - 进行中
   │  ├─ [x] 实现用户注册
   │  ├─ [x] 实现登录功能
   │  ├─ [-] 实现JWT验证  ← 当前
   │  └─ [ ] 添加单元测试
   └─ 📋 待创建: 编写文档
```

#### 改进方案3: 环境详情增强

**当前显示**:

```
# Current Task
Task ID: abc123
Mode: code

# TODO List
[x] Step 1
[-] Step 2
[ ] Step 3
```

**改进后的显示**:

```
# Task Context

## Task Hierarchy (点击查看完整层级)
Current: 实现JWT验证 (子任务 2/3)
Parent: 实现用户认证系统
Root: 用户认证功能开发

## Current Task Progress
🎯 实现后端 (code模式)
Progress: 75% (3/4 completed)

Todos:
  ✅ 实现用户注册
  ✅ 实现登录功能
  ⚙️ 实现JWT验证 (当前)
  📋 添加单元测试

Tip: Use `update_todo_list` to update your progress as you work.
```

---

## 4. 实施建议

### 4.1 优先级排序

**P0 - 立即实施**:

1. ✅ 增强 `new_task` 工具描述，说明何时使用子任务
2. ✅ 在 `objective.ts` 中添加任务拆分决策指导
3. ✅ 修改环境详情格式，添加进度百分比

**P1 - 短期实施** (1-2周): 4. 🔨 实现简单的Accordion折叠模式（方案A）5. 🔨 在UI中显示任务栈信息6. 🔨 添加TODO状态分组显示

**P2 - 中期实施** (1个月): 7. 🚀 实现完整的树状层级显示（方案B）8. 🚀 添加任务层级可视化组件9. 🚀 支持点击跳转到父任务/子任务

**P3 - 长期愿景** (3个月+): 10. 💡 实现多代理协作系统（参考 docs/14）11. 💡 智能任务分解推荐 12. 💡 任务依赖关系可视化

### 4.2 具体实施步骤

#### Step 1: 修改提示词（立即可做）

**文件**: `src/core/prompts/tools/new-task.ts`

创建新文件或修改现有工具描述，添加：

- 何时使用子任务的明确指导
- 与 TODO 列表的对比
- 实际使用示例

**文件**: `src/core/prompts/sections/objective.ts`

在OBJECTIVE部分添加任务拆分决策树。

#### Step 2: 改进环境详情显示（1天工作量）

**文件**: `src/core/environment/reminder.ts`

修改 `formatReminderSection()` 函数：

```typescript
export function formatReminderSection(
	todoList?: TodoItem[],
	taskStack?: Array<{ taskId: string; description: string; mode: string }>,
	currentTaskId?: string,
): string {
	if (!todoList || todoList.length === 0) {
		return "You have not created a todo list yet..."
	}

	const completed = todoList.filter((t) => t.status === "completed").length
	const inProgress = todoList.filter((t) => t.status === "in_progress").length
	const pending = todoList.filter((t) => t.status === "pending").length
	const progress = (completed / todoList.length) * 100

	let result = `# Current Task Progress\n\n`
	result += `Progress: ${progress.toFixed(0)}% (${completed}/${todoList.length} completed)\n`
	result += `Status: ${completed} ✅ | ${inProgress} ⚙️ | ${pending} 📋\n\n`

	// 任务层级信息
	if (taskStack && taskStack.length > 1) {
		result += `## Task Hierarchy\n`
		result += `Current task is a subtask (${taskStack.length - 1} level(s) deep)\n\n`
	}

	// TODO列表分组显示
	result += `## Active Todos\n\n`

	if (inProgress > 0) {
		result += `In Progress:\n`
		todoList.filter((t) => t.status === "in_progress").forEach((t) => (result += `  ⚙️ ${t.content}\n`))
		result += `\n`
	}

	if (pending > 0) {
		result += `Pending:\n`
		todoList.filter((t) => t.status === "pending").forEach((t) => (result += `  📋 ${t.content}\n`))
	}

	return result
}
```

#### Step 3: UI组件实现（2-3天工作量）

**文件**: `webview-ui/src/components/TaskProgress/TaskProgressView.tsx`

创建新组件来显示任务进度和层级结构。

**集成点**: 在主聊天界面的侧边栏或顶部添加任务进度面板。

---

## 5. 示例场景

### 5.1 场景：完整功能开发

**用户请求**:

```
实现一个完整的博客系统，包括设计、开发、测试和文档
```

**改进后的大模型行为**:

```typescript
// 第1步: 创建总体TODO
<update_todo_list>
<todos>
[ ] Phase 1: 架构设计
[ ] Phase 2: 后端开发
[ ] Phase 3: 前端开发
[ ] Phase 4: 测试
[ ] Phase 5: 文档
</todos>
</update_todo_list>

// 第2步: 启动Phase 1子任务（architect模式）
<new_task>
<mode>architect</mode>
<message>设计博客系统的完整架构，包括：
- 数据库schema设计
- REST API接口定义
- 前后端交互流程
- 技术栈选择
</message>
<todos>
[ ] 设计数据模型
[ ] 定义API接口
[ ] 设计系统架构图
[ ]
- **没有明确提到任务拆分策略**

#### 2.1.2 目标说明 (Objective)

```

# OBJECTIVE

You accomplish a given task iteratively, breaking it down into clear steps and working through them methodically.

1. Analyze the user's task and set clear, achievable goals to accomplish it.
   Prioritize these goals in a logical order.
2. Work through these goals sequentially, utilizing available tools one at a time as necessary.
3. Remember, you have extensive capabilities with access to a wide range of tools...
4. Once you've completed the user's task, you must use the attempt_completion tool to present the result.

```

**关键点**:
- "breaking it down into clear steps" - 明确要求拆分步骤
- "Work through these goals sequentially" - 串行执行
- **但没有说明何时使用TODO列表 vs 何时创建子任务**

#### 2.1.3 update_todo_list 工具描述

```

## update_todo_list

Description: Replace the entire TODO list with an updated checklist reflecting the current state.

**When to Use:**

- The task is complicated or involves multiple steps or requires ongoing tracking.
- You need to update the status of several todos at once.
- New actionable items are discovered during task execution.
- The user requests a todo list or provides multiple tasks.
- The task is complex and benefits from clear, stepwise progress tracking.

**When NOT to Use:**

- There is only a single, trivial task.
- The task can be completed in one or two simple steps.
- The request is purely conversational or informational.

```

#### 2.1.4 new_task 工具描述

```

## new_task

Description: This will let you create a new task instance in the chosen mode using your provided message.

Parameters:

- mode: (required) The slug of the mode to start the new task in
- message: (required) The initial user message or instructions for this new task.

Usage:
<new_task>
<mode>your-mode-slug-here</mode>
<message>Your initial instructions here</message>
</new_task>

```

**关键缺失**: 没有说明何时应该创建子任务而不是使用TODO列表！

---

### 2.2 大模型当前的拆分行为

基于现有提示词，大模型的行为模式：

#### 场景1: 简单任务（无拆分）

```

用户: 在 utils.ts 中添加一个 formatDate 函数

大模型行为:

1. 直接使用 read_file 读取文件
2. 使用 apply_diff 或 write_to_file 添加函数
3. 使用 attempt_completion 完成

✅ 正确 - 简单任务无需拆分

```

#### 场景2: 复杂任务（使用TODO列表）

```

用户: 实现一个用户认证系统，包括注册、登录、JWT验证

大模型行为:

1. 使用 update_todo_list 创建待办列表:
   [ ] 设计数据库schema
   [ ] 实现用户注册
   [ ] 实现登录功能
   [ ] 实现JWT验证
   [ ] 编写测试
   [ ] 更新文档

2. 逐步执行每个TODO
3. 定期调用 update_todo_list 更新状态
4. 使用 attempt_completion 完成

✅ 正确 - 在单一任务内逐步完成

```

#### 场景3: 需要模式切换的任务（应该用子任务但常被忽略）

```

用户: 重构这个项目，先分析问题，再实施重构

大模型当前行为（次优）:

1. 使用 update_todo_list:
   [ ] 分析现有代码
   [ ] 识别重构点
   [ ] 实施重构
   [ ] 验证测试

问题:

- 分析阶段应该用
  编写技术选型文档
  </todos>
  </new_task>

// 第3步: 子任务完成后，更新总体进度
<update_todo_list>
<todos>
[x] Phase 1: 架构设计 ✅
[-] Phase 2: 后端开发 ← 当前
[ ] Phase 3: 前端开发  
[ ] Phase 4: 测试
[ ] Phase 5: 文档
</todos>
</update_todo_list>

// 第4步: 启动Phase 2子任务（code模式）
<new_task>
<mode>code</mode>
<message>根据架构设计实现博客系统后端，包括：
[之前子任务的设计内容作为上下文]
</message>
<todos>
[ ] 搭建项目结构
[ ] 实现数据模型
[ ] 实现API端点
[ ] 添加身份验证
[ ] 编写单元测试
</todos>
</new_task>

// ... 继续其他phases

```

**UI显示效果**:

```

┌─────────────────────────────────────────────────┐
│ 📊 任务进度 (40% 完成) │
├─────────────────────────────────────────────────┤
│ │
│ 🎯 实现完整的博客系统 │
│ └─ ✅ Phase 1: 架构设计 (architect模式) │
│ ├─ [x] 设计数据模型 │
│ ├─ [x] 定义API接口 │
│ ├─ [x] 设计系统架构图 │
│ └─ [x] 编写技术选型文档 │
│ └─ ⚙️ Phase 2: 后端开发 (code模式) ← 当前 │
│ ├─ [x] 搭建项目结构 │
│ ├─ [-] 实现数据模型 ← 正在进行 │
│ ├─ [ ] 实现API端点 │
│ ├─ [ ] 添加身份验证 │
│ └─ [ ] 编写单元测试 │
│ └─ 📋 Phase 3: 前端开发 (待创建) │
│ └─ 📋 Phase 4: 测试 (待创建) │
│ └─ 📋 Phase 5: 文档 (待创建) │
│ │
│ [折叠已完成] [展开全部] [查看详情] │
└─────────────────────────────────────────────────┘

```

---

## 6. 总结

### 6.1 关键发现

1. **TODO列表 vs 子任务**
   - TODO列表适合：同一模式内的多步骤任务
   - 子任务适合：需要切换模式或隔离上下文的任务
   - 当前问题：提示词中缺少明确的选择指导

2. **大模型行为模式**
   - 大模型**能够**使用这两种机制
   - 但倾向于使用更简单的TODO列表
   - 需要更清晰的提示词来引导正确选择

3. **UI可视化需求**
   - 用户需要看到任务的层级结构
   - 进度跟踪需要更直观（百分比、分组）
   - 树状/折叠显示能显著改善用户体验

### 6.2 推荐实施路径

**短期（1-2周）**:
1. ✅ 增强提示词 - 添加任务拆分决策指导
2. ✅ 改进环境详情 - 添加进度百分比和分组
3. ✅ 修改 `new_task` 工具描述 - 说明使用场景

**中期（1个月）**:
4. 🔨 实现UI组件 - Accordion折叠模式
5. 🔨 显示任务栈信息 - 让用户看到父子关系
6. 🔨 添加进度可视化 - 进度条和状态图标

**长期（3个月+）**:
7. 🚀 完整树状层级显示
8. 🚀 任务依赖关系可视化
9. 🚀 多代理协作系统（参考 docs/14）

### 6.3 预期效果

实施这些改进后，用户和大模型都将获得更好的体验：

**对大模型**:
- 清晰的任务拆分决策指导
- 更好地利用子任务机制
- 提高复杂任务的完成质量

**对用户**:
- 直观的进度跟踪
- 清晰的任务层级结构
- 更好的任务执行可见性

---

## 7. 参考资料

- [`docs/07-task-lifecycle.md`](docs/07-task-lifecycle.md) - Task类生命周期详解
- [`docs/08-prompts-system.md`](docs/08-prompts-system.md) - 提示词系统架构
- [`docs/14-multi-agent-collaboration-system.md`](docs/14-multi-agent-collaboration-system.md) - 多代理协作系统设计
- [`src/core/tools/updateTodoListTool.ts`](src/core/tools/updateTodoListTool.ts) - TODO列表实现
- [`src/core/tools/newTaskTool.ts`](src/core/tools/newTaskTool.ts) - 子任务创建实现
- [`src/core/task/Task.ts`](src/core/task/Task.ts) - Task类核心实现

---

**文档版本**: 1.0
**最后更新**: 2025-10-12
**作者**: Roo AI Assistant
**审阅状态**: 待团队审阅
```
