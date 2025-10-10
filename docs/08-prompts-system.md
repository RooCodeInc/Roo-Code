# Prompts 系统架构文档

## 概述

`src/core/prompts` 目录是 Roo-Code 项目中负责生成和管理 AI 模型系统提示词（System Prompts）的核心模块。该模块采用模块化设计，通过组合不同的提示词片段（sections）、工具描述（tools）和指令（instructions）来动态生成针对不同模式和场景的完整系统提示词。

## 目录结构

```
src/core/prompts/
├── system.ts                 # 系统提示词生成的主入口
├── responses.ts              # 响应格式化工具集合
├── types.ts                  # 类型定义
├── sections/                 # 提示词片段模块
│   ├── index.ts
│   ├── capabilities.ts       # 能力描述片段
│   ├── custom-instructions.ts # 自定义指令加载
│   ├── custom-system-prompt.ts # 自定义系统提示词
│   ├── markdown-formatting.ts # Markdown 格式规则
│   ├── mcp-servers.ts        # MCP 服务器信息
│   ├── modes.ts              # 模式描述
│   ├── objective.ts          # 目标和任务说明
│   ├── rules.ts              # 规则片段
│   ├── system-info.ts        # 系统信息
│   ├── tool-use.ts           # 工具使用基础说明
│   └── tool-use-guidelines.ts # 工具使用指南
├── tools/                    # 工具描述生成器
│   ├── index.ts              # 工具描述聚合器
│   ├── types.ts              # 工具参数类型
│   ├── execute-command.ts    # 命令执行工具
│   ├── read-file.ts          # 文件读取工具
│   ├── write-to-file.ts      # 文件写入工具
│   ├── apply-diff.ts         # 差异应用工具
│   ├── search-files.ts       # 文件搜索工具
│   ├── list-files.ts         # 文件列表工具
│   ├── codebase-search.ts    # 代码库语义搜索
│   ├── ask-followup-question.ts # 追问工具
│   ├── attempt-completion.ts # 任务完成工具
│   ├── use-mcp-tool.ts       # MCP 工具调用
│   ├── switch-mode.ts        # 模式切换
│   ├── new-task.ts           # 新任务创建
│   ├── update-todo-list.ts   # 待办列表更新
│   └── ...                   # 其他工具描述
└── instructions/             # 特殊任务指令
    ├── instructions.ts       # 指令获取入口
    ├── create-mcp-server.ts  # MCP 服务器创建指令
    └── create-mode.ts        # 模式创建指令
```

## 核心模块详解

### 1. system.ts - 系统提示词生成器

这是整个提示词系统的核心入口文件，负责协调各个模块生成完整的系统提示词。

#### 主要函数

##### `SYSTEM_PROMPT()`

主要的系统提示词生成函数，接受以下参数：

```typescript
async function SYSTEM_PROMPT(
	context: vscode.ExtensionContext, // VSCode 扩展上下文
	cwd: string, // 当前工作目录
	supportsComputerUse: boolean, // 是否支持计算机使用
	mcpHub?: McpHub, // MCP Hub 实例
	diffStrategy?: DiffStrategy, // 差异策略
	browserViewportSize?: string, // 浏览器视口大小
	mode: Mode = defaultModeSlug, // 当前模式
	customModePrompts?: CustomModePrompts, // 自定义模式提示词
	customModes?: ModeConfig[], // 自定义模式配置
	globalCustomInstructions?: string, // 全局自定义指令
	diffEnabled?: boolean, // 是否启用差异功能
	experiments?: Record<string, boolean>, // 实验性功能开关
	enableMcpServerCreation?: boolean, // 是否启用 MCP 服务器创建
	language?: string, // 语言偏好
	rooIgnoreInstructions?: string, // .rooignore 指令
	partialReadsEnabled?: boolean, // 是否启用部分读取
	settings?: SystemPromptSettings, // 系统提示词设置
	todoList?: TodoItem[], // 待办事项列表
	modelId?: string, // 模型 ID
): Promise<string>
```

**工作流程：**

1. **自定义系统提示词检查**：首先尝试从文件加载自定义系统提示词
2. **提示词组装**：如果没有自定义提示词，则按顺序组装以下部分：
    - 角色定义（Role Definition）
    - Markdown 格式规则
    - 工具使用基础说明
    - 具体工具描述
    - 工具使用指南
    - MCP 服务器信息（如果适用）
    - 能力描述
    - 模式列表
    - 规则
    - 系统信息
    - 目标说明
    - 自定义指令

##### `getPromptComponent()`

辅助函数，用于获取特定模式的提示词组件，并过滤掉空对象。

##### `generatePrompt()`

内部函数，实际执行提示词的生成和组装逻辑。

#### 关键特性

1. **模式支持**：根据不同的模式（code、architect、debug 等）生成不同的提示词
2. **MCP 集成**：动态检查 MCP 功能是否应该包含在提示词中
3. **条件性功能**：根据功能开关决定是否包含特定部分
4. **自定义优先**：优先使用文件系统中的自定义系统提示词

### 2. responses.ts - 响应格式化工具

这个模块提供了一系列用于格式化工具执行结果和错误信息的函数。

#### 主要功能

##### 错误和反馈格式化

```typescript
formatResponse = {
  toolDenied(): string                              // 用户拒绝操作
  toolDeniedWithFeedback(feedback?: string): string // 带反馈的拒绝
  toolApprovedWithFeedback(feedback?: string): string // 带反馈的批准
  toolError(error?: string): string                 // 工具执行错误
  rooIgnoreError(path: string): string              // .rooignore 阻止访问
  noToolsUsed(): string                             // 未使用工具的错误
  tooManyMistakes(feedback?: string): string        // 错误过多
  missingToolParameterError(paramName: string): string // 缺少参数
  lineCountTruncationError(...): string             // 行数截断错误
  // ... 其他格式化方法
}
```

##### 特殊格式化功能

- **`formatFilesList()`**：格式化文件列表，包括处理 `.rooignore` 和写保护文件
- **`createPrettyPatch()`**：创建美化的差异补丁显示
- **`toolResult()`**：格式化工具结果，支持文本和图像
- **`imageBlocks()`**：将图像数据转换为 Anthropic 图像块格式

#### 关键特性

1. **统一错误处理**：为所有工具错误提供一致的格式
2. **友好提示**：为 AI 提供清晰的错误信息和下一步建议
3. **视觉支持**：支持在响应中包含图像
4. **安全标记**：使用 🔒 和 🛡️ 标记受限和写保护文件

### 3. sections/ - 提示词片段模块

#### 3.1 custom-instructions.ts - 自定义指令加载器

负责加载和管理用户自定义的指令和规则。

**主要功能：**

1. **规则文件加载**：

    - 支持 `.roo/rules/` 目录结构
    - 支持传统的 `.roorules` 和 `.clinerules` 文件
    - 支持模式特定规则 `.roo/rules-{mode}/`
    - 支持符号链接解析（最大深度 5 层）

2. **AGENTS.md 标准支持**：

    - 自动加载项目根目录的 `AGENTS.md` 或 `AGENT.md` 文件
    - 可通过设置禁用

3. **指令优先级**（从高到低）：
    - 语言偏好
    - 全局自定义指令
    - 模式特定指令
    - 模式特定规则
    - .rooignore 指令
    - AGENTS.md 规则
    - 通用规则

**关键函数：**

```typescript
// 加载规则文件
async function loadRuleFiles(cwd: string): Promise<string>

// 加载 AGENTS.md
async function loadAgentRulesFile(cwd: string): Promise<string>

// 添加自定义指令
async function addCustomInstructions(
	modeCustomInstructions: string,
	globalCustomInstructions: string,
	cwd: string,
	mode: string,
	options: {
		language?: string
		rooIgnoreInstructions?: string
		settings?: SystemPromptSettings
	},
): Promise<string>
```

**特性：**

- 递归目录遍历
- 符号链接支持（防止循环）
- 文件过滤（排除缓存和系统文件）
- 按字母顺序排序
- 全局和项目本地规则合并

#### 3.2 rules.ts - 规则片段生成器

生成系统的规则部分，包括文件编辑、工具使用等规则。

**主要规则类别：**

1. **项目路径规则**：定义工作目录和路径处理规则
2. **代码库搜索规则**：强制在探索代码前使用 `codebase_search`
3. **文件编辑规则**：
    - 列出可用的编辑工具
    - 工具使用建议和限制
    - `write_to_file` 的完整性要求
4. **模式限制**：某些模式只能编辑特定类型的文件
5. **交互规则**：
    - 只能使用 `ask_followup_question` 工具提问
    - 必须等待每个工具使用后的用户响应
    - 不能以问题结束 `attempt_completion`
6. **响应风格**：禁止使用 "Great"、"Certainly" 等会话式开头

**动态内容：**

- 根据 `diffStrategy` 是否存在调整可用工具列表
- 根据 `codeIndexManager` 状态决定是否包含代码库搜索规则
- 根据 `supportsComputerUse` 决定是否包含浏览器相关规则

#### 3.3 capabilities.ts - 能力描述

描述 AI 助手的能力和可用工具。

**描述的能力：**

1. **文件操作**：列出、读取、写入、搜索文件
2. **代码分析**：
    - 语义搜索（如果启用）
    - 正则表达式搜索
    - 代码定义列表
3. **命令执行**：执行 CLI 命令
4. **浏览器操作**（如果支持）：启动浏览器、交互、截图
5. **MCP 服务器**（如果配置）：使用外部工具和资源

**特点：**

- 根据功能可用性动态调整内容
- 提供具体的使用场景和示例
-

强调工具和资源的可用性

#### 3.4 tool-use-guidelines.ts - 工具使用指南

提供详细的工具使用步骤指导。

**指南步骤：**

1. 评估已有信息和所需信息
2. **关键步骤**：对于任何未探索的代码，必须先使用 `codebase_search`（如果可用）
3. 选择最合适的工具
4. 迭代使用工具，每次一个
5. 使用 XML 格式调用工具
6. 等待工具结果
7. 始终等待用户确认

**动态调整：**

- 根据 `codeIndexManager` 状态调整是否包含代码库搜索相关指南
- 自动编号确保步骤顺序正确

**特点：**

- 强调迭代过程的重要性
- 明确要求等待用户响应
- 提供处理工具结果的指导

#### 3.5 objective.ts - 目标说明

定义 AI 助手完成任务的方法论。

**核心方法论：**

1. **任务分析**：将任务分解为清晰可实现的目标
2. **顺序执行**：按逻辑顺序逐步完成目标
3. **工具选择**：
    - 使用 `codebase_search` 探索新代码区域（如果可用）
    - 分析文件结构
    - 选择最相关的工具
    - 验证参数是否完整
4. **任务完成**：使用 `attempt_completion` 呈现结果
5. **迭代改进**：根据反馈改进，但不进行无意义的对话

#### 3.6 modes.ts - 模式描述

生成所有可用模式的列表和描述。

**功能：**

- 从扩展状态加载所有模式（包括自定义模式）
- 使用 `whenToUse` 字段作为主要描述
- 如果没有 `whenToUse`，则使用 `roleDefinition` 的第一句
- 提供创建新模式的指令引用

**输出格式：**

```
====

MODES

- These are the currently available modes:
  * "💻 Code" mode (code) - Use this mode when...
  * "🏗️ Architect" mode (architect) - Use this mode when...
  ...
```

#### 3.7 mcp-servers.ts - MCP 服务器信息

生成关于已连接 MCP 服务器的详细信息。

**包含内容：**

1. **MCP 协议说明**：本地和远程服务器类型
2. **已连接服务器列表**：
    - 服务器名称和命令
    - 服务器指令（如果有）
    - 可用工具及其 JSON Schema
    - 资源模板
    - 直接资源
3. **创建 MCP 服务器指令**（如果启用）

**特点：**

- 过滤 `enabledForPrompt !== false` 的工具
- 格式化 JSON Schema 以便阅读
- 只在 MCP Hub 可用且有连接的服务器时生成

#### 3.8 system-info.ts - 系统信息

提供关于用户系统环境的信息。

**包含信息：**

- 操作系统类型
- 默认 Shell
- 用户主目录
- 当前工作目录

**用途：**

帮助 AI 助手理解运行环境，以便生成兼容的命令和路径。

#### 3.9 tool-use.ts - 工具使用基础

提供工具调用的基本格式说明。

**内容：**

- 工具调用的 XML 格式规范
- 参数封装方式
- 使用实际工具名作为 XML 标签名

#### 3.10 markdown-formatting.ts - Markdown 格式规则

定义代码和文件名引用的格式规则。

**规则：**

所有语言构造和文件名引用必须显示为可点击链接：

```
[`filename OR language.declaration()`](relative/file/path.ext:line)
```

**特点：**

- 强制在所有 markdown 响应中使用
- 包括 `<attempt_completion>` 中的响应
- 语法引用需要行号
- 文件名引用的行号可选

### 4. tools/ - 工具描述模块

#### 4.1 index.ts - 工具描述聚合器

这是工具描述系统的核心，负责根据模式动态选择和生成工具描述。

**核心函数：**

```typescript
function getToolDescriptionsForMode(
	mode: Mode, // 当前模式
	cwd: string, // 工作目录
	supportsComputerUse: boolean, // 浏览器支持
	codeIndexManager?: CodeIndexManager, // 代码索引管理器
	diffStrategy?: DiffStrategy, // 差异策略
	browserViewportSize?: string, // 浏览器视口
	mcpHub?: McpHub, // MCP Hub
	customModes?: ModeConfig[], // 自定义模式
	experiments?: Record<string, boolean>, // 实验功能
	partialReadsEnabled?: boolean, // 部分读取
	settings?: Record<string, any>, // 设置
	enableMcpServerCreation?: boolean, // MCP 创建
	modelId?: string, // 模型 ID
): string
```

**工作流程：**

1. **获取模式配置**：从自定义模式或内置模式获取配置
2. **构建参数对象**：将所有参数封装为 `ToolArgs`
3. **收集工具**：
    - 遍历模式的工具组（groups）
    - 添加该组中的所有工具
    - 检查工具是否被模式允许
    - 添加始终可用的工具
4. **条件性过滤**：
    - 如果代码索引不可用，移除 `codebase_search`
    - 如果待办列表功能禁用，移除 `update_todo_list`
    - 如果图像生成实验未启用，移除 `generate_image`
    - 如果斜杠命令实验未启用，移除 `run_slash_command`
5. **生成描述**：
    - 对每个工具调用其描述函数
    - 过滤掉空值
    - 组合成完整的工具部分

**工具描述映射表：**

```typescript
const toolDescriptionMap: Record<string, (args: ToolArgs) => string | undefined> = {
  execute_command: (args) => getExecuteCommandDescription(args),
  read_file: (args) => {
    // 特殊处理：根据模型选择简化版或完整版
    const modelId = args.settings?.modelId
    if (modelId && shouldUseSingleFileRead(modelId)) {
      return getSimpleReadFileDescription(args)
    }
    return getReadFileDescription(args)
  },
  write_to_file: (args) => getWriteToFileDescription(args),
  apply_diff: (args) => args.diffStrategy ? args.diffStrategy.getToolDescription(...) : "",
  // ... 其他工具映射
}
```

**关键特性：**

1. **模式感知**：不同模式获得不同的工具集
2. **条件性工具**：根据功能可用性动态调整
3. **可扩展性**：易于添加新工具
4. **类型安全**：通过 TypeScript 确保参数正确性

#### 4.2 工具描述示例

每个工具描述文件负责生成该工具的详细使用说明。典型结构：

```typescript
export function getToolDescription(args: ToolArgs): string {
	return `## tool_name
Description: 工具的详细描述

Parameters:
- param1: (required) 参数说明
- param2: (optional) 可选参数说明

Usage:
<tool_name>
<param1>value</param1>
<param2>value</param2>
</tool_name>

Example: 示例说明
<tool_name>
<param1>example value</param1>
</tool_name>`
}
```

**常见工具描述：**

1. **read_file**：支持单文件和多文件读取，支持行范围
2. **write_to_file**：创建新文件或完全重写，自动创建目录
3. **apply_diff**：外科手术式编辑，支持多个 SEARCH/REPLACE 块
4. **execute_command**：执行 CLI 命令，支持工作目录参数
5. **codebase_search**：语义搜索代码库
6. **ask_followup_question**：询问用户，提供建议答案
7. **attempt_completion**：完成任务，呈现结果

### 5. instructions/ - 特殊任务指令

#### 5.1 instructions.ts - 指令获取入口

提供统一的接口来获取特定任务的详细指令。

```typescript
async function fetchInstructions(
	text: string, // 任务类型
	detail: InstructionsDetail, // 详细参数
): Promise<string>
```

**支持的任务类型：**

1. **`create_mcp_server`**：创建 MCP 服务器的详细指南
2. **`create_mode`**：创建自定义模式的详细指南

**用途：**

当 AI 需要执行复杂任务（如创建 MCP 服务器）时，可以通过 `fetch_instructions` 工具获取详细的分步指导。

#### 5.2 create-mcp-server.ts

提供创建 MCP 服务器的完整指南，包括：

- MCP 协议概述
- 服务器类型（stdio/SSE）
- 实现步骤
- 工具和资源定义
- 配置和测试

#### 5.3 create-mode.ts

提供创建自定义模式的指南，包括：

- 模式配置结构
- 工具组定义
- 角色定义
- 文件限制模式
- 保存和管理

## 系统提示词生成流程

### 完整流程图

```
用户请求 → SYSTEM_PROMPT()
    ↓
检查自定义系统提示词文件
    ↓
    ├─ 有自定义 → 加载文件 + 自定义指令 → 返回
    ↓
    └─ 无自定义 → 生成标准提示词
         ↓
         1. 获取模式配置和角色定义
         2. 添加 Markdown 格式规则
         3. 添加工具使用基础说明
         4.

生成工具描述（根据模式和功能）
         5. 添加工具使用指南
         6. 添加 MCP 服务器信息（如适用）
         7. 添加能力描述
         8. 添加模式列表
         9. 添加规则
         10. 添加系统信息
         11. 添加目标说明
         12. 添加自定义指令
         ↓
     返回完整的系统提示词
```

### 详细步骤说明

#### 步骤 1：模式配置获取

```typescript
const modeConfig = getModeBySlug(mode, customModes) || modes.find((m) => m.slug === mode) || modes[0]
const { roleDefinition, baseInstructions } = getModeSelection(mode, promptComponent, customModes)
```

- 优先使用自定义模式
- 回退到内置模式
- 提取角色定义和基础指令

#### 步骤 2-3：基础框架

```typescript
const basePrompt = `${roleDefinition}

${markdownFormattingSection()}

${getSharedToolUseSection()}
```

- 设置 AI 的角色和职责
- 定义 Markdown 格式规则
- 说明工具使用的基本格式

#### 步骤 4：工具描述生成

```typescript
${getToolDescriptionsForMode(
  mode,
  cwd,
  supportsComputerUse,
  codeIndexManager,
  effectiveDiffStrategy,
  browserViewportSize,
  shouldIncludeMcp ? mcpHub : undefined,
  customModeConfigs,
  experiments,
  partialReadsEnabled,
  settings,
  enableMcpServerCreation,
  modelId,
)}
```

- 根据模式的工具组收集工具
- 为每个工具生成详细描述
- 条件性地包含特定工具

#### 步骤 5-12：上下文和约束

按顺序添加各个部分，构建完整的系统提示词。每个部分都是独立的模块，可以根据需要启用或禁用。

### MCP 集成逻辑

```typescript
const hasMcpGroup = modeConfig.groups.some((groupEntry) => getGroupName(groupEntry) === "mcp")
const hasMcpServers = mcpHub && mcpHub.getServers().length > 0
const shouldIncludeMcp = hasMcpGroup && hasMcpServers
```

只有当以下条件同时满足时才包含 MCP 功能：

1. 当前模式的工具组包含 "mcp" 组
2. MCP Hub 存在且有已连接的服务器

## 响应格式化系统

### 错误处理策略

响应格式化系统提供了统一的错误处理机制，确保 AI 能够理解和响应各种错误情况。

#### 1. 用户交互错误

```typescript
// 用户拒绝操作
toolDenied() → "The user denied this operation."

// 带反馈的拒绝
toolDeniedWithFeedback(feedback) → 包含用户反馈的拒绝消息
```

**用途**：当用户拒绝工具使用请求时，清晰地告知 AI

#### 2. 工具执行错误

```typescript
// 一般工具错误
toolError(error) → 包含错误详情的格式化消息

// .rooignore 阻止
rooIgnoreError(path) → 说明文件被 .rooignore 阻止

// 参数缺失
missingToolParameterError(paramName) → 指出缺失的参数
```

**用途**：提供清晰的错误信息和恢复建议

#### 3. 特殊错误处理

##### 行数截断错误

```typescript
lineCountTruncationError(actualLineCount, isNewFile, diffStrategyEnabled)
```

这是一个复杂的错误处理器，针对 `write_to_file` 工具的输出截断问题：

**新文件场景：**

1. 说明截断原因
2. 建议重试并包含 `line_count` 参数
3. 建议分块写入（先 `write_to_file` 后 `insert_content`）

**现有文件场景：**

1. 建议重试并包含 `line_count` 参数
2. 如果启用了 diff 策略，建议使用 `apply_diff`
3. 建议使用 `search_and_replace` 进行特定替换
4. 建议使用 `insert_content` 添加特定内容

**关键特性**：

- 根据上下文提供不同的恢复策略
- 优先建议更高效的工具
- 包含工具使用提醒

#### 4. MCP 相关错误

```typescript
// 无效的 JSON 参数
invalidMcpToolArgumentError(serverName, toolName)

// 未知工具
unknownMcpToolError(serverName, toolName, availableTools)

// 未知服务器
unknownMcpServerError(serverName, availableServers)
```

**特点**：列出可用选项，帮助 AI 做出正确选择

### 文件列表格式化

`formatFilesList()` 是一个复杂的格式化函数，处理文件列表的显示：

**功能：**

1. **路径转换**：将绝对路径转换为相对路径
2. **排序**：按目录结构排序，目录优先
3. **.rooignore 集成**：
    - 标记被忽略的文件（🔒）
    - 可选择隐藏被忽略的文件
4. **写保护标记**：标记写保护文件（🛡️）
5. **截断处理**：如果列表太长，显示截断提示

**排序算法：**

```typescript
// 按目录层级排序
// 同级元素按字母顺序
// 目录在文件之前
```

这确保文件列表清晰、有层次，即使在截断情况下也能显示重要的目录结构。

### 差异补丁格式化

`createPrettyPatch()` 使用 `diff` 库创建美化的差异显示：

```typescript
createPrettyPatch(filename, oldStr, newStr) → 格式化的差异
```

**输出示例：**

```diff
@@ -1,3 +1,3 @@
-old line
+new line
 unchanged line
```

**用途**：

- 在应用更改前显示预览
- 帮助用户理解将要发生的更改
- 提供清晰的视觉反馈

## 自定义指令系统

### 指令加载层级

自定义指令系统支持多层级的配置，按优先级从高到低：

#### 1. 语言偏好（最高优先级）

```typescript
if (options.language) {
	sections.push(`Language Preference:\n...`)
}
```

直接影响 AI 的输出语言。

#### 2. 全局自定义指令

```typescript
if (globalCustomInstructions && globalCustomInstructions.trim()) {
	sections.push(`Global Instructions:\n${globalCustomInstructions}`)
}
```

适用于所有模式的指令。

#### 3. 模式特定指令

```typescript
if (modeCustomInstructions && modeCustomInstructions.trim()) {
	sections.push(`Mode-specific Instructions:\n${modeCustomInstructions}`)
}
```

只在特定模式下生效。

#### 4. 规则文件

按以下顺序加载：

1. **模式特定规则**：

    - `.roo/rules-{mode}/` 目录（推荐）
    - `.roorules-{mode}` 文件（传统）
    - `.clinerules-{mode}` 文件（兼容）

2. **.rooignore 指令**：访问控制规则

3. **AGENTS.md 规则**（可选）：

    - 项目根目录的 `AGENTS.md` 或 `AGENT.md`
    - 支持 AI Agent 标准

4. **通用规则**：
    - `.roo/rules/` 目录（推荐）
    - `.roorules` 文件（传统）
    - `.clinerules` 文件（兼容）

### 规则文件系统

#### 新格式：目录结构

推荐使用 `.roo/rules/` 和 `.roo/rules-{mode}/` 目录结构：

```
project/
├── .roo/
│   ├── rules/                 # 通用规则
│   │   ├── code-style.md
│   │   ├── testing.md
│   │   └── documentation.md
│   └── rules-code/            # code 模式专用规则
│       ├── use-safeWriteJson.md
│       └── typescript-rules.md
```

**优点：**

- 模块化：每个规则一个文件
- 易于管理：可以单独启用/禁用规则
- 支持符号链接：可以链接到共享规则
- 全局和本地：支持全局 `~/.roo/` 和项目本地 `.roo/`

#### 传统格式：单文件

仍然支持传统的单文件格式：

```
project/
├── .roorules              # 通用规则
├── .roorules-code         # code 模式规则
└── .clinerules            # Cline 兼容性
```

#### 符号链接支持

系统支持符号链接解析，允许：

- 链接到共享规则库
- 跨项目复用规则
- 集中管理规则

**安全措施：**

- 最大深度限制（5 层）
- 循环检测
- 失败时静默跳过

### AGENTS.md 标准

支持 AI Agents 社区标准的项目级指令：

**格式：**

```markdown
# Agent Rules

## Code Style

- Use TypeScript
- Follow ESLint rules

## Testing

- Write tests for all new features
- Maintain >80% coverage
```

**位置：**

- 项目根目录
- 文件名：`AGENTS.md`（首选）或 `AGENT.md`（备选）

**控制：**

可通过设置禁用：

```typescript
settings.useAgentRules = false
```

### 规则文件过滤

系统自动过滤不应该被包含的文件：

**排除的文件类型：**

```typescript
const cachePatterns = [
  "*.DS_Store", "*.bak", "*.cache", "*.log",
  "*.tmp", "*.temp", "*.swp", "*.lock",
  "*.pyc", "*.pyo", "Thumbs.db", ...
]
```

这确保只有真正的规则文件被加载，避免包含缓存或临时文件。

## 工具描述系统详解

### 工具分组机制

工具通过组（groups）进行组织，每个模式指定其可用的工具组：

#### 预定义工具组

```typescript
TOOL_GROUPS = {
	edit: {
		tools: ["write_to_file", "apply_diff", "insert_content", "search_and_replace"],
	},
	read: {
		tools: ["read_file", "list_files", "search_files", "list_code_definition_names"],
	},
	browser: {
		tools: ["browser_action"],
	},
	mcp: {
		tools: ["use_mcp_tool", "access_mcp_resource"],
	},
	// ... 更多工具组
}
```

#### 模式示例

**Code 模式：**

```typescript
{
  slug: "code",
  groups: ["edit", "read", "terminal", "mcp"],
  // 获得编辑、读取、终端和 MCP 相关的所有工具
}
```

**Architect 模式：**

```typescript
{
  slug: "architect",
  groups: ["read", "terminal"],
  filePattern: "\\.md$",  // 只能编辑 .md 文件
  // 不包含编辑组，因此没有 write_to_file 等工具
}
```

### 工具选择逻辑

```typescript
// 1. 收集模式的所有工具组
config.groups.forEach((groupEntry) => {
  const groupName = getGroupName(groupEntry)
  const toolGroup = TOOL_GROUPS[groupName]
  if (toolGroup) {
    toolGroup.tools.forEach((tool) => {
      // 2. 检查工具是否被模式允许
      if (isToolAllowedForMode(tool, mode, customModes, ...)) {
        tools.add(tool)
      }
    })
  }
})

// 3. 添加始终可用的工具
ALWAYS_AVAILABLE_TOOLS.forEach((tool) => tools.add(tool))

// 4. 条件性过滤
if (!codeIndexManager.isInitialized) {
  tools.delete("codebase_search")
}
```

### 特殊工具处理

#### read_file 工具

根据模型类型选择简化版或完整版：

```typescript
read_file: (args) => {
	const modelId = args.settings?.modelId
	if (modelId && shouldUseSingleFileRead(modelId)) {
		return getSimpleReadFileDescription(args) // 单文件读取
	}
	return getReadFileDescription(args) // 多文件读取 + 行范围
}
```

**原因**：某些模型对复杂参数支持不佳，使用简化版本可以提高成功率。

#### apply_diff 工具

差异工具由策略对象提供：

```typescript
apply_diff: (args) =>
	args.diffStrategy ? args.diffStrategy.getToolDescription({ cwd: args.cwd, toolOptions: args.toolOptions }) : ""
```

这允许不同的差异策略提供自定义的工具描述。

## 测试覆盖

`src/core/prompts` 目录有全面的测试覆盖：

### 测试文件结构

```
__tests__/
├── add-custom-instructions.spec.ts      # 自定义指令加载测试
├── custom-system-prompt.spec.ts         # 自定义系统提示词测试
├── get-prompt-component.spec.ts         # 提示词组件获取测试
├── responses-rooignore.spec.ts          # .rooignore 响应测试
├── sections.spec.ts                     # 各个片段测试
├── system-prompt.spec.ts                # 完整系统提示词测试
├── utils.ts                             # 测试工具函数
└── __snapshots__/                       # 快照测试
    ├── add-custom-instructions/
    └── system-prompt/
```

### 关键测试场景

#### 1. 自定义指令加载测试

```typescript
describe("addCustomInstructions", () => {
	test("loads mode-specific rules from .roo/rules-{mode}/")
	test("falls back to .roorules-{mode} if directory doesn't exist")
	test("loads AGENTS.md if enabled")
	test("respects priority order")
	test("handles symlinks correctly")
})
```

#### 2. 系统提示词一致性测试

```typescript
describe("SYSTEM_PROMPT", () => {
	test("generates consistent prompt for same inputs")
	test("includes MCP servers when available")
	test("adapts to diffStrategy presence")
	test("filters tools based on mode")
	test("respects feature flags")
})
```

#### 3. 快照测试

使用 Jest 快照测试确保提示词格式的稳定性：

```typescript
test("with-custom-instructions", async () => {
  const result = await addCustomInstructions(...)
  expect(result).toMatchSnapshot()
})
```

快照存储在 `__snapshots__/` 目录中，任何意外的提示词变化都会被捕获。

## 最佳实践

### 1. 添加新工具

要添加新工具到系统：

**步骤 1：创建工具描述文件**

```typescript
// src/core/prompts/tools/my-new-tool.ts
import { ToolArgs } from "./types"

export function getMyNewToolDescription(args: ToolArgs): string {
	return `## my_new_tool
Description: 工具的详细描述

Parameters:
- param1: (required) 参数说明

Usage:
<my_new_tool>
<param1>value</param1>
</my_new_tool>

Example:
<my_new_tool>
<param1>example</param1>
</my_new_tool>`
}
```

**步骤 2：注册到工具映射**

```typescript
// src/core/prompts/tools/index.ts
import { getMyNewToolDescription } from "./my-new-tool"

const toolDescriptionMap: Record<string, (args: ToolArgs) => string | undefined> = {
	// ... 现有工具
	my_new_tool: (args) => getMyNewToolDescription(args),
}
```

**步骤 3：添加到工具组**

```typescript
// src/shared/tools.ts
TOOL_GROUPS["my-group"] = {
  tools: ["my_new_tool", ...],
}
```

**步骤 4：在模式中启用**

```typescript
// src/shared/modes.ts
{
  slug: "my-mode",
  groups: ["my-group", ...],
}
```

### 2. 添加新的提示词片段

要添加新的系统提示词片段：

**步骤 1：创建片段文件**

```typescript
// src/core/prompts/sections/my-section.ts
export function getMySectionSection(args): string {
	return `====

MY SECTION

内容...`
}
```

**步骤 2：导出片段**

```typescript
// src/core/prompts/sections/index.ts
export { getMySectionSection } from "./my-section"
```

**步骤 3：在系统提示词中使用**

```typescript
// src/core/prompts/system.ts
import { getMySectionSection } from "./sections"

const basePrompt = `...
${getMySectionSection(args)}
...`
```

### 3. 自定义规则文件组织

推荐的项目规则文件组织：

```
project/
├── .roo/
│   ├── rules/                    # 通用规则
│   │   ├── 01-code-style.md     # 使用数字前缀控制顺序
│   │   ├── 02-testing.md
│   │   └── 03-documentation.md
│   ├── rules-code/               # Code 模式规则
│   │   ├── typescript.md
│   │   └── react.md
│   └── rules-architect/          # Architect 模式规则
│       └── design-patterns.md
└── AGENTS.md                     # AI Agents 标准
```

**命名建议：**

- 使用数字前缀（01-, 02-）控制加载顺序
- 使用描述性名称
- 使用 `.md` 扩展名以便在编辑器中语法高亮

### 4. 性能优化

**并行加载：**

```typescript
const [modesSection, mcpServersSection] = await Promise.all([
  getModesSection(context),
  shouldIncludeMcp ? getMcpServersSection(...) : Promise.resolve(""),
])
```

使用 `Promise.all()` 并行加载独立的片段。

**条件性生成：**

```typescript
const shouldIncludeMcp = hasMcpGroup && hasMcpServers
// 只有需要时才生成 MCP 部分
```

避免生成不会使用的内容。

**缓存策略：**

对于不常变化的内容（如模式列表），考虑缓存：

```typescript
let cachedModesSection: string | null = null

export async function getModesSection(context) {
	if (cachedModesSection) return cachedModesSection
	// 生成并缓存
	cachedModesSection = await generateModesSection(context)
	return cachedModesSection
}
```

## 扩展性设计

### 1. 插件化架构

提示词系统的模块化设计支持轻松扩展：

- **片段独立**：每个片段是独立的模块
- **工具描述分离**：每个工具有自己的描述生成器
- **条件性包含**：通过功能标志控制内容

### 2. 自定义模式支持

系统完全支持用户定义的自定义模式：

```typescript
const customMode: ModeConfig = {
	slug: "my-custom-mode",
	name: "My Custom Mode",
	roleDefinition: "You are a specialist in...",
	groups: ["edit", "read"],
	filePattern: "\\.tsx?$", // 只能编辑 TypeScript 文件
	whenToUse: "Use this mode when...",
}
```

### 3. 实验性功能

通过实验性功能标志逐步引入新功能：

```typescript
if (experiments?.imageGeneration) {
	// 包含图像生成相关内容
}

if (experiments?.runSlashCommand) {
	// 包含斜杠命令相关内容
}
```

这允许在正式发布前测试新功能。

## 调试和故障排除

### 1. 查看生成的提示词

在开发模式下，可以输出生成的完整系统提示词：

```typescript
const prompt = await SYSTEM_PROMPT(...)
console.log("Generated prompt:", prompt)
```

### 2. 验证工具描述

检查特定模式的工具列表：

```typescript
const tools = getToolDescriptionsForMode(mode, ...)
console.log("Available tools:", tools)
```

### 3. 测试自定义指令

验证自定义指令是否正确加载：

```typescript
const instructions = await addCustomInstructions(...)
console.log("Custom instructions:", instructions)
```

### 4. 常见问题

**问题：工具没有出现在提示词中**

解决方案：

1. 检查工具是否在模式的工具组中
2. 验证 `isToolAllowedForMode()` 是否返回 true
3. 检查条件性过滤逻辑（如 codebase_search 需要索引可用）

**问题：自定义规则没有加载**

解决方案：

1. 检查文件路径是否正确
2. 验证文件权限
3. 查看文件是否被过滤器排除（缓存文件等）
4. 检查符号链接是否有效

**问题：MCP 服务器信息没有显示**

解决方案：

1. 确认模式包含 "mcp" 工具组
2. 验证 MCP Hub 已连接服务器
3. 检查 `shouldIncludeMcp` 的计算逻辑

## 总结

`src/core/prompts`
是一个高度模块化、可扩展的系统提示词生成系统，具有以下核心特性：

### 核心优势

1. **模块化设计**：

    - 片段（sections）独立管理
    - 工具描述分离
    - 指令系统可扩展

2. **模式感知**：

    - 不同模式获得不同的工具集
    - 支持自定义模式
    - 文件访问限制

3. **条件性内容**：

    - 根据功能可用性动态调整
    - 实验性功能标志支持
    - 性能优化的并行加载

4. **灵活的自定义**：

    - 多层级指令系统
    - 规则文件的目录结构
    - 符号链接支持
    - AGENTS.md 标准支持

5. **全面的错误处理**：

    - 统一的响应格式化
    - 清晰的错误信息
    - 恢复策略建议

6. **测试覆盖**：
    - 单元测试
    - 快照测试
    - 集成测试

### 关键设计原则

1. **单一职责**：每个模块负责一个特定的功能
2. **开放封闭**：对扩展开放，对修改封闭
3. **依赖注入**：通过参数传递依赖，便于测试
4. **失败安全**：错误处理不会中断整个流程
5. **性能优先**：并行加载、条件性生成、缓存策略

### 未来扩展方向

1. **动态提示词优化**：

    - 根据对话历史调整提示词
    - 学习用户偏好
    - 上下文感知的内容包含

2. **提示词模板系统**：

    - 允许用户定义提示词模板
    - 支持变量替换
    - 条件性内容块

3. **多语言支持增强**：

    - 更精细的语言控制
    - 多语言规则文件
    - 本地化的工具描述

4. **性能监控**：

    - 提示词生成时间追踪
    - Token 使用优化
    - 内容压缩策略

5. **AI 辅助的提示词优化**：
    - 自动检测低效的提示词
    - 建议改进方案
    - A/B 测试支持

## 相关文档

- [01-项目概览](./01-project-overview.md) - 项目整体架构
- [02-命令执行流程](./02-command-execution-flow.md) - 命令执行机制
- [07-任务生命周期](./07-task-lifecycle.md) - 任务管理系统

## 附录

### A. 系统提示词示例

一个典型的生成的系统提示词结构：

```
You are Roo, a highly skilled software engineer...

====

MARKDOWN RULES

ALL responses MUST show ANY `language construct`...

====

TOOL USE

You have access to a set of tools...

# Tools

## execute_command
Description: Request to execute a CLI command...

## read_file
Description: Request to read the contents of files...

[... 更多工具描述 ...]

# Tool Use Guidelines

1. Assess what information you already have...
2. **CRITICAL: For ANY exploration of code...**
[... 更多指南 ...]

====

CAPABILITIES

- You have access to tools that let you...
[... 能力描述 ...]

====

MODES

- These are the currently available modes:
  * "💻 Code" mode (code) - Use this mode when...
  * "🏗️ Architect" mode (architect) - Use this mode when...
[... 更多模式 ...]

====

RULES

- The project base directory is: /path/to/project
- All file paths must be relative...
[... 更多规则 ...]

====

SYSTEM INFORMATION

Operating System: Linux
Default Shell: /bin/bash
[... 系统信息 ...]

====

OBJECTIVE

You accomplish a given task iteratively...
[... 目标说明 ...]

====

USER'S CUSTOM INSTRUCTIONS

Language Preference:
You should always speak in "简体中文"...

Rules:
[... 自定义规则 ...]
```

### B. 工具组完整列表

```typescript
export const TOOL_GROUPS: Record<string, ToolGroup> = {
	edit: {
		tools: ["write_to_file", "apply_diff", "insert_content", "search_and_replace"],
	},
	read: {
		tools: ["read_file", "list_files", "search_files", "list_code_definition_names", "codebase_search"],
	},
	terminal: {
		tools: ["execute_command"],
	},
	browser: {
		tools: ["browser_action"],
	},
	mcp: {
		tools: ["use_mcp_tool", "access_mcp_resource"],
	},
	mode: {
		tools: ["switch_mode", "new_task"],
	},
	instruction: {
		tools: ["fetch_instructions"],
	},
	todo: {
		tools: ["update_todo_list"],
	},
	experimental: {
		tools: ["generate_image", "run_slash_command"],
	},
}

export const ALWAYS_AVAILABLE_TOOLS = ["ask_followup_question", "attempt_completion"]
```

### C. 模式配置示例

```typescript
// 内置 Code 模式
{
  slug: "code",
  name: "💻 Code",
  roleDefinition: "You are Roo, a highly skilled software engineer...",
  groups: ["edit", "read", "terminal", "mcp", "mode", "instruction", "todo"],
  whenToUse: "Use this mode when you need to write, modify, or refactor code..."
}

// 内置 Architect 模式
{
  slug: "architect",
  name: "🏗️ Architect",
  roleDefinition: "You are Roo, an expert software architect...",
  groups: ["read", "terminal", "mode", "instruction"],
  filePattern: "\\.md$",
  whenToUse: "Use this mode when you need to plan, design, or strategize..."
}

// 自定义模式示例
{
  slug: "my-reviewer",
  name: "👀 Code Reviewer",
  roleDefinition: "You are a meticulous code reviewer...",
  groups: ["read", "terminal"],
  filePattern: "\\.(ts|tsx|js|jsx)$",
  whenToUse: "Use this mode to review code changes and provide feedback...",
  baseInstructions: `
    Focus on:
    - Code quality and best practices
    - Potential bugs and edge cases
    - Performance implications
    - Security concerns
  `
}
```

### D. 自定义指令优先级示例

给定以下配置：

```
~/.roo/rules/global-style.md            # 全局规则 1
~/.roo/rules/global-testing.md          # 全局规则 2
/project/.roo/rules/project-style.md    # 项目规则 1
/project/.roo/rules-code/typescript.md  # Code 模式规则
/project/AGENTS.md                      # AI Agents 标准
/project/.roorules                      # 传统规则文件
```

在 Code 模式下，加载顺序为：

1. 语言偏好（如果设置）
2. 全局自定义指令（通过 UI 设置）
3. Code 模式自定义指令（通过 UI 设置）
4. `/project/.roo/rules-code/typescript.md`（模式特定规则）
5. `.rooignore` 指令（如果存在）
6. `/project/AGENTS.md`（如果启用且存在）
7. 全局规则：
    - `~/.roo/rules/global-style.md`
    - `~/.roo/rules/global-testing.md`
8. 项目规则：
    - `/project/.roo/rules/project-style.md`
9. `/project/.roorules`（如果目录规则不存在）

后加载的规则可以覆盖或补充先加载的规则。

---

**文档版本**: 1.0  
**最后更新**: 2025-10-10  
**维护者**: Roo-Code 开发团队
