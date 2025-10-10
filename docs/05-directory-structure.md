# Roo-Code 目录结构详解

## 概述

本文档详细说明 Roo-Code 项目中各个文件夹的功能和职责,帮助开发者快速了解代码组织结构。

## 根目录结构

```
Roo-Code/
├── src/                    # 核心扩展代码
├── webview-ui/             # React WebView UI
├── packages/               # 共享包
├── apps/                   # 应用程序
├── qdrant/                 # 向量数据库配置
├── scripts/                # 构建和部署脚本
├── locales/                # 国际化翻译文件
├── releases/               # 发布说明图片
├── .github/                # GitHub 工作流
├── .vscode/                # VSCode 配置
├── .husky/                 # Git hooks
└── .roo/                   # Roo 配置和规则
```

## src/ - 核心扩展代码

### src/core/ - 核心功能模块

#### src/core/task/

**任务管理系统**

- `Task.ts` (2955行): 任务生命周期管理
    - API 对话循环
    - 工具调用协调
    - 状态管理
    - 子任务管理
- `TaskExecutor.ts`: 任务执行器
- `TaskManager.ts`: 任务管理器

#### src/core/webview/

**WebView 提供者**

- `ClineProvider.ts` (2829行): 主要提供者类
    - WebView 生命周期管理
    - 任务创建和切换
    - 状态同步
    - 消息传递
- `WebviewManager.ts`: WebView 管理器

#### src/core/tools/

**工具实现**

- `executeCommandTool.ts` (364行): 执行系统命令
- `readFileTool.ts`: 读取文件内容
- `writeToFileTool.ts`: 写入文件
- `applyDiffTool.ts`: 应用代码差异
- `searchFilesTool.ts`: 搜索文件内容
- `listFilesTool.ts`: 列出文件
- `insertContentTool.ts`: 插入内容
- `searchAndReplaceTool.ts`: 搜索替换
- `codebaseSearchTool.ts`: 代码库语义搜索
- `askFollowupQuestionTool.ts`: 询问跟进问题
- `attemptCompletionTool.ts`: 尝试完成任务
- `useMcpTool.ts`: MCP 工具集成

#### src/core/prompts/

**系统提示词**

- `system.ts`: 主系统提示词
- `modes/`: 不同模式的提示词
    - `code.ts`: Code 模式
    - `architect.ts`: Architect 模式
    - `ask.ts`: Ask 模式
    - `debug.ts`: Debug 模式
    - 等等...

#### src/core/sliding-window/

**上下文窗口管理**

- `index.ts` (175行): 滑动窗口实现
    - Token 计数
    - 截断判断
    - 上下文管理

#### src/core/condense/

**上下文压缩**

- `index.ts` (246行): 智能压缩实现
    - LLM 摘要生成
    - 消息保留策略
    - 压缩效果验证

#### src/core/mentions/

**提及系统 (@mentions)**

- `MentionParser.ts`: 解析 @file、@folder 等
- `MentionResolver.ts`: 解析提及引用
- `MentionFormatter.ts`: 格式化提及内容

#### src/core/checkpoint/

**检查点系统**

- `CheckpointManager.ts`: 管理 Git 检查点
- `GitOperations.ts`: Git 操作封装
- `CheckpointTracker.ts`: 跟踪检查点状态

#### src/core/diff/

**代码差异处理**

- `DiffParser.ts`: 解析 diff 格式
- `DiffApplier.ts`: 应用代码更改
- `DiffValidator.ts`: 验证差异有效性

#### src/core/task-persistence/

**任务持久化**

- `TaskSerializer.ts`: 任务序列化
- `TaskDeserializer.ts`: 任务反序列化
- `HistoryManager.ts`: 历史记录管理

#### src/core/environment/

**环境信息收集**

- `getEnvironmentDetails.ts` (277行): 收集环境信息
    - 可见文件
    - 打开的标签
    - 终端状态
    - 诊断信息

### src/api/ - API 集成

#### src/api/providers/

**AI 提供商实现**

- `anthropic.ts`: Anthropic Claude API
- `openai.ts`: OpenAI API
- `openrouter.ts`: OpenRouter API
- `bedrock.ts`: AWS Bedrock
- `vertex.ts`: Google Vertex AI
- `gemini.ts`: Google Gemini
- `ollama.ts`: Ollama 本地模型
- 等等...

#### src/api/transform/

**API 转换层**

- `stream-handler.ts`: 流式响应处理
- `message-transformer.ts`: 消息格式转换
- `error-handler.ts`: 错误处理

### src/integrations/ - 外部集成

#### src/integrations/terminal/

**终端集成**

- `TerminalRegistry.ts` (328行): 终端池管理
- `Terminal.ts` (193行): VSCode 终端实现
- `ExecaTerminal.ts`: Execa 命令执行
- `TerminalManager.ts`: 终端管理器

#### src/integrations/browser/

**浏览器集成**

- `BrowserManager.ts`: Puppeteer 浏览器管理
- `ScreenshotCapture.ts`: 截图捕获
- `BrowserSession.ts`: 浏览器会话

#### src/integrations/mcp/

**MCP (Model Context Protocol) 集成**

- `McpHub.ts`: MCP 中心管理
- `McpServer.ts`: MCP 服务器
- `McpClient.ts`: MCP 客户端
- `McpToolAdapter.ts`: 工具适配器

#### src/integrations/diagnostics/

**诊断集成**

- `DiagnosticCollector.ts`: 收集 VSCode 诊断
- `DiagnosticFormatter.ts`: 格式化诊断信息

#### src/integrations/git/

**Git 集成**

- `GitManager.ts`: Git 操作管理
- `GitDiffProvider.ts`: Git diff 提供者
- `GitCheckpointManager.ts`: 检查点管理

### src/services/ - 业务服务

#### src/services/code-index/

**代码索引服务**

- `manager.ts` (422行): CodeIndexManager 主管理器
- `orchestrator.ts` (294行): 索引编排器
- `search-service.ts`: 语义搜索服务
- `file-watcher.ts`: 文件变更监听
- `cache-manager.ts`: 缓存管理
- `embeddings/`: 嵌入模型
    - `OpenAIEmbedder.ts`
    - `OllamaEmbedder.ts`
    - `VoyageEmbedder.ts`
- `vector-store/`: 向量存储
    - `QdrantStore.ts`
- `parsers/`: 代码解析器
    - `TypeScriptParser.ts`
    - `PythonParser.ts`
    - `JavaScriptParser.ts`

#### src/services/tree-sitter/

**Tree-sitter 代码解析**

- `TreeSitterService.ts`: Tree-sitter 服务
- `LanguageParser.ts`: 语言解析器
- `ASTNavigator.ts`: AST 导航器

#### src/services/cloud/

**云服务**

- `CloudService.ts`: 云同步服务
- `AuthService.ts`: 认证服务
- `SyncManager.ts`: 同步管理器

#### src/services/telemetry/

**遥测服务**

- `TelemetryService.ts`: 数据收集
- `MetricsCollector.ts`: 指标收集
- `EventTracker.ts`: 事件跟踪

### src/utils/ - 工具函数

- `fs.ts`: 文件系统操作
- `path.ts`: 路径处理
- `string.ts`: 字符串工具
- `array.ts`: 数组工具
- `safeWriteJson.ts`: 安全的 JSON 写入
- `getTheme.ts`: 获取主题
- `cost.ts`: 成本计算
- `ripgrep.ts`: ripgrep 搜索封装

### src/exports/ - 导出 API

- `index.ts`: 公共 API 导出
- 供其他扩展或工具使用

### src/activate/ - 扩展激活

- `activate.ts`: 扩展入口点
- `registerCommands.ts`: 注册命令
- `registerCodeActions.ts`: 注册代码操作

## webview-ui/ - React WebView UI

### webview-ui/src/components/

#### webview-ui/src/components/chat/

**聊天界面组件**

- `ChatView.tsx`: 主聊天视图
- `ChatInput.tsx`: 输入框
- `MessageList.tsx`: 消息列表
- `Message.tsx`: 单条消息
- `ToolApproval.tsx`: 工具批准界面
- `CodeBlock.tsx`: 代码块显示
- `TodoListDisplay.tsx`: 待办事项显示
- `ReasoningBlock.tsx`: 推理块显示

#### webview-ui/src/components/settings/

**设置界面组件**

- `SettingsView.tsx`: 设置主视图
- `ModelPicker.tsx`: 模型选择器
- `ApiConfigManager.tsx`: API 配置管理
- `TemperatureControl.tsx`: 温度控制
- `MaxCostInput.tsx`: 最大成本输入

#### webview-ui/src/components/history/

**历史记录组件**

- `HistoryView.tsx`: 历史记录视图
- `TaskCard.tsx`: 任务卡片
- `TaskFilter.tsx`: 任务过滤器

#### webview-ui/src/components/mcp/

**MCP 工具管理**

- `McpView.tsx`: MCP 主视图
- `McpToolRow.tsx`: 工具行
- `McpResourceRow.tsx`: 资源行

### webview-ui/src/hooks/

**React Hooks**

- `useExtensionState.ts`: 扩展状态管理
- `useVSCodeMessage.ts`: VSCode 消息处理
- `useAutoApprovalState.ts`: 自动批准状态

### webview-ui/src/context/

**React Context**

- `ExtensionStateContext.tsx`: 扩展状态上下文
- `ThemeContext.tsx`: 主题上下文

## packages/ - 共享包

### packages/types/

**TypeScript 类型定义**

- `src/api.ts`: API 类型
- `src/task.ts`: 任务类型
- `src/tool.ts`: 工具类型
- `src/message.ts`: 消息类型
- `src/provider-settings.ts`: 提供商设置
- `src/mode.ts`: 模式类型

### packages/cloud/

**云服务包**

- `src/CloudAPI.ts`: 云 API 客户端
- `src/CloudService.ts`: 云服务
- `src/CloudSettingsService.ts`: 云设置服务

### packages/evals/

**评估系统**

- `src/cli/`: 命令行工具
- `src/db/`: 数据库层
- `src/exercises/`: 评估练习

## apps/ - 应用程序

### apps/web-roo-code/

**官方网站 (Next.js)**

- `src/app/`: Next.js 应用页面
- `src/components/`: React 组件
- `src/lib/`: 工具库

### apps/web-evals/

**评估 Web 界面 (Next.js)**

- `src/app/`: 评估界面页面
- `src/actions/`: 服务器操作
- `src/components/`: UI 组件

### apps/vscode-e2e/

**E2E 测试**

- `src/suite/`: 测试套件
    - `tools/`: 工具测试
    - `modes.test.ts`: 模式测试
    - `task.test.ts`: 任务测试

### apps/vscode-nightly/

**Nightly 版本配置**

- `package.nightly.json`: Nightly 包配置

## 配置和脚本

### scripts/

**构建和部署脚本**

- `build.sh`: 构建脚本
- `package.sh`: 打包脚本
- `test.sh`: 测试脚本
- `publish.sh`: 发布脚本

### .github/workflows/

**CI/CD 工作流**

- `ci.yml`: 持续集成
- `release.yml`: 发布流程
- `test.yml`: 自动化测试

### qdrant/

**Qdrant 向量数据库**

- `docker-compose.yaml`: Docker 配置
- `qdrant_data/`: 数据存储目录

### locales/

**国际化翻译**

- `zh-CN/`: 简体中文
- `zh-TW/`: 繁体中文
- `ja/`: 日语
- `ko/`: 韩语
- `fr/`: 法语
- `de/`: 德语
- `es/`: 西班牙语

### .roo/

**Roo 配置**

- `rules/`: 规则文件
- `rules-code/`: 代码规则
- `modes/`: 自定义模式

## 文件命名约定

### 测试文件

- `*.test.ts`: Vitest 单元测试
- `*.spec.ts`: Vitest 规范测试
- `*.integration.test.ts`: 集成测试

### 类型文件

- `*.d.ts`: TypeScript 声明文件
- `types.ts`: 类型定义文件

### 配置文件

- `*.config.ts`: 配置文件
- `tsconfig.json`: TypeScript 配置
- `eslint.config.mjs`: ESLint 配置
- `vitest.config.ts`: Vitest 配置

## 关
