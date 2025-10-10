# Roo-Code 项目概览

## 项目简介

Roo-Code 是一个基于 VSCode 的 AI 编程助手扩展,通过集成多种 AI 模型和智能工具,帮助开发者更高效地完成编程任务。

## 技术架构

### 架构模式

- **Monorepo 架构**: 使用 pnpm workspace 管理多个包
- **VSCode 扩展**: 基于 VSCode Extension API 构建
- **事件驱动**: 大量使用 EventEmitter 模式进行组件通信
- **单例模式**: 核心服务(如 CodeIndexManager)采用单例设计
- **工厂模式**: ServiceFactory 负责创建和管理服务实例

### 核心技术栈

- **语言**: TypeScript
- **测试框架**: Vitest
- **构建工具**: esbuild
- **包管理**: pnpm workspace
- **前端**: React + Vite
- **AI 集成**: 支持 Anthropic、OpenAI、OpenRouter 等多种 AI 提供商
- **浏览器自动化**: Puppeteer
- **向量数据库**: Qdrant

## 核心组件

### 1. Task (任务系统)

- 管理任务生命周期
- 处理 API 对话
- 协调工具调用
- 管理子任务

### 2. Terminal (终端系统)

- **TerminalRegistry**: 终端池管理(最多5个)
- **Terminal**: VSCode 终端集成
- **ExecaTerminal**: 命令执行引擎

### 3. ClineProvider (提供者)

- WebView 生命周期管理
- 任务创建和切换
- 状态同步
- 配置管理

### 4. CodeIndexManager (索引管理)

- 代码库语义索引
- 向量搜索
- 增量更新
- 缓存管理

## 项目结构

```
Roo-Code/
├── src/                      # 核心扩展代码
│   ├── core/                 # 核心功能模块
│   ├── api/                  # API 集成
│   ├── integrations/         # 外部集成
│   └── services/             # 业务服务
├── webview-ui/               # React WebView UI
├── packages/                 # 共享包
│   ├── types/                # 类型定义
│   ├── cloud/                # 云服务
│   └── evals/                # 评估系统
├── apps/                     # 应用程序
│   ├── web-roo-code/         # 官方网站
│   ├── web-evals/            # 评估 Web 界面
│   └── vscode-e2e/           # E2E 测试
└── qdrant/                   # 向量数据库配置
```

## 关键技术特性

### Shell Integration

- 与 VSCode 终端深度集成
- 实时捕获命令输出
- 智能终端复用

### Sliding Window Context

- 对话历史管理
- 自动截断机制(75%阈值)
- 保持上下文连贯性

### Context Condensing

- LLM 驱动的智能压缩
- 保留最近3条消息
- 确保至少20%的压缩率

### MCP (Model Context Protocol)

- 扩展工具能力
- 统一的工具接口
- 支持自定义工具

### Git Checkpoints

- 基于 Git 的检查点系统
- 支持任务回滚
- 保护代码安全

## 开发工作流

1. **任务创建**: 用户通过 WebView 或命令面板创建任务
2. **API 对话**: Task 通过 API 与 AI 模型交互
3. **工具调用**: AI 决策后调用相应工具
4. **状态同步**: 结果同步回 WebView 显示
5. **任务完成**: 用户确认或继续迭代

## 扩展能力

- **多模型支持**: 支持20+种 AI 模型
- **多语言支持**: 国际化支持多种语言
- **模式系统**: 可自定义不同工作模式
- **云同步**: 支持云端状态同步
- **代码索引**: 语义搜索代码库

## 相关文档

- [命令执行流程](./02-command-execution-flow.md)
- [上下文压缩机制](./03-context-compression.md)
- [完整工作流程](./04-complete-workflow.md)
- [目录结构详解](./05-directory-structure.md)
- [代码库索引流程](./06-codebase-indexing.md)
