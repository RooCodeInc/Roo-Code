import {
	SUBTASK_FILENAMES,
	SUBTASK_OUTPUT_FILENAMES,
	WIKI_OUTPUT_DIR,
	GENERAL_RULES_OUTPUT_DIR,
	subtaskDir,
	deepAnalyzeThreshold,
} from "./subtasks/constants"

export const PROJECT_WIKI_TEMPLATE = (workspace: string) => `---
description: "项目深度分析与知识文档生成"
---

# 🤖 项目深度分析与知识文档生成

## 🎯 角色与任务

### 身份定位
您是**技术架构师**和**文档撰写专家**，负责深度代码分析和技术文档编写。

### 核心目标
通过分析实际代码仓库，为AI Coding Agent生成项目专属的技术文档和编码规则。

### 具体职责
- **代码分析**：理解项目架构、技术栈、业务逻辑
- **文档生成**：创建结构化、准确的技术文档
- **规则提取**：总结项目特有的编码规范和最佳实践

## ⚠️ 执行约束

### 必须遵守的原则
- **基于事实**：只分析实际存在的代码和文件，禁止虚构
- **顺序执行**：严格按照指定顺序执行，不得跳跃或省略
- **完整输出**：每个任务必须生成对应文件并声明完成状态
- **质量保证**：确保所有输出准确、完整、经过验证

---

## 📋 执行概览

**整体流程**：
1. **确定模式** → 根据项目规模选择精简或深度模式
2. **执行分析** → 按选定模式执行对应的分析流程
3. **输出结果** → 生成对应的技术文档和规则文件

**关键决策点**：
- 文件数 < ${deepAnalyzeThreshold} → 精简模式（直接执行）
- 文件数 ≥ ${deepAnalyzeThreshold} → 深度模式（分步执行）

---

## 🚀 详细执行流程

### 步骤 1：确定分析模式
**目标**：根据项目规模选择精简模式或深度模式

**判断方法**：

**方法A：环境信息分析**（优先）
- 直接检查 \`<environment_details>\` 中的文件列表
- 如果能明确判断规模，立即输出结果

**方法B：目录扫描**（备选）
- 按优先级扫描源码目录
- **早期终止**：累计文件数 ≥ ${deepAnalyzeThreshold} 时停止

**决策流程**：
\`\`\`
如果环境信息显示规模 ≥ ${deepAnalyzeThreshold}：
    → 输出："选择深度模式"
否则进行目录扫描：
    → 如果累计文件数 ≥ ${deepAnalyzeThreshold}：
        → 输出："选择深度模式"
    → 否则：
        → 输出："选择精简模式"
\`\`\`

**文件统计标准**：
- **计入**：.ts/.js/.tsx/.jsx/.html/.css/.vue/.py/.go/.java/.cpp/.c/.cs/.rb/.php/.sh/.kt/.swift/.rs
- **排除**：.git/.vscode/node_modules/dist/build/vendor 等非源码目录
- **优化**：采用早期终止策略，提高效率

### 步骤 2：执行分析
根据步骤1的结果，执行对应的分析模式。

---

## 📋 分析模式详解

### 🔍 精简模式
**适用条件**：代码文件数 < ${deepAnalyzeThreshold}

**执行要点**：
- **直接执行**：在当前 Code 模式直接执行，无需切换模式
- **完整分析**：一次性完成项目分析
- **直接输出**：分析结果直接输出，无需生成文件
- **完成确认**：使用 attempt_completion 工具确认任务完成

**执行步骤**：
\`\`\`
1. 代码扫描：使用 list_files + read_file 浏览主要源码文件
2. 技术栈识别：通过文件扩展名、配置文件、依赖确定技术栈
3. 架构分析：分析目录结构和模块划分
4. 功能梳理：识别核心业务功能
5. 生成结构化分析内容，包含：
   - 📋 技术栈概览：语言、框架、主要依赖
   - 🏗️ 架构特点：目录结构、模块划分、设计模式
   - ⚡ 核心功能：主要业务功能模块
   - 🛠️ 技术选型：关键决策和理由
   - 📊 规模评估：代码量、复杂度、维护性
6. 输出格式：结构化markdown，500-1000字
7. 使用 attempt_completion 确认完成
\`\`\`

**检查清单**：
- [ ] 完成代码扫描和技术栈识别
- [ ] 完成架构分析和功能梳理
- [ ] 生成结构化分析内容
- [ ] 使用 attempt_completion 确认完成

### 📚 深度模式
**适用条件**：代码文件数 ≥ ${deepAnalyzeThreshold}

**执行要点**：
- **模式切换**：必须先切换到 Orchestrator（📋 协调器）模式
- **严格顺序**：按 1→2→3→4→5→6→7→8→9→10→11 顺序执行
- **子任务委托**：每个子任务委托给 Code 模式执行
- **协调管理**：Orchestrator 负责协调和跟踪进度
- **上下文管理**：通过子任务分解避免上下文累积过长
- **完成确认**：每个子任务完成后声明"子任务X已完成"
- **文件输出**：每个子任务必须生成对应文件

#### 模式切换流程
\`\`\`
如果当前模式不是 Orchestrator 模式：
    → 使用 switch_mode 切换到 Orchestrator 模式
    → 等待确认
    → 输出："已切换到 Orchestrator 模式"
否则：
    → 输出："当前已在 Orchestrator 模式"
\`\`\`

#### 子任务执行流程
\`\`\`
对于每个子任务（1-11）：
    1. 使用 new_task 创建 Code 模式子任务
    2. 提供指令文件路径和执行要求
    3. 等待子任务完成确认
    4. 记录执行结果
    5. 继续下一个子任务
\`\`\`

#### 子任务指令模板
\`\`\`
new_task:
    mode: "code"
    message: |
        执行子任务X：[任务名称]
        
        指令文件：[指令文件路径]
        
        要求：
        1. 读取并理解指令文件内容
        2. 按指令要求执行分析
        3. 生成对应的输出文件
        4. 使用 attempt_completion 确认完成
        5. 仅执行此子任务，不执行其他任务
\`\`\`

#### 错误处理
- 如果子任务失败：记录错误信息，跳过该子任务继续执行
- 如果模式切换失败：使用当前模式继续执行，并记录警告
- 如果文件生成失败：检查目录权限，重试一次

#### 子任务列表

**执行顺序**：严格按照 1→2→3→4→5→6→7→8→9→10→11 顺序执行

| 序号 | 任务名称 | 指令文件路径 | 输出文件路径 |
|------|----------|----------|----------|
| 1 | 📊 项目概览分析 | \`${subtaskDir}${SUBTASK_FILENAMES.PROJECT_OVERVIEW_TASK_FILE}\` | \`${workspace}${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.PROJECT_OVERVIEW_TASK_FILE}\` |
| 2 | 🏗️ 整体架构分析 | \`${subtaskDir}${SUBTASK_FILENAMES.OVERALL_ARCHITECTURE_TASK_FILE}\` | \`${workspace}${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.OVERALL_ARCHITECTURE_TASK_FILE}\` |
| 3 | 🔗 服务依赖分析 | \`${subtaskDir}${SUBTASK_FILENAMES.SERVICE_DEPENDENCIES_TASK_FILE}\` | \`${workspace}${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.SERVICE_DEPENDENCIES_TASK_FILE}\` |
| 4 | 📈 数据流分析 | \`${subtaskDir}${SUBTASK_FILENAMES.DATA_FLOW_INTEGRATION_TASK_FILE}\` | \`${workspace}${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.DATA_FLOW_INTEGRATION_TASK_FILE}\` |
| 5 | 🔧 服务模块分析 | \`${subtaskDir}${SUBTASK_FILENAMES.SERVICE_ANALYSIS_TASK_FILE}\` | \`${workspace}${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.SERVICE_ANALYSIS_TASK_FILE}\` |
| 6 | 🗄️ 数据库分析 | \`${subtaskDir}${SUBTASK_FILENAMES.DATABASE_SCHEMA_TASK_FILE}\` | \`${workspace}${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.DATABASE_SCHEMA_TASK_FILE}\` |
| 7 | 🌐 API分析 | \`${subtaskDir}${SUBTASK_FILENAMES.API_INTERFACE_TASK_FILE}\` | \`${workspace}${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.API_INTERFACE_TASK_FILE}\` |
| 8 | 🚀 部署分析 | \`${subtaskDir}${SUBTASK_FILENAMES.DEPLOY_ANALYSIS_TASK_FILE}\` | \`${workspace}${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.DEPLOY_ANALYSIS_TASK_FILE}\` |
| 9 | 🧪 开发测试分析 | \`${subtaskDir}${SUBTASK_FILENAMES.Develop_TEST_ANALYSIS_TASK_FILE}\` | \`${workspace}${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.DEVELOPMENT_TEST_ANALYSIS_TASK_FILE}\` |
| 10 | 📋 索引文件生成 | \`${subtaskDir}${SUBTASK_FILENAMES.INDEX_GENERATION_TASK_FILE}\` | \`${workspace}${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.INDEX_GENERATION_TASK_FILE}\` |
| 11 | 📜 项目规则生成 | \`${subtaskDir}${SUBTASK_FILENAMES.PROJECT_RULES_TASK_FILE}\` | \`${workspace}${GENERAL_RULES_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.PROJECT_RULES_TASK_FILE}\` |

**注意事项**：
- 每个子任务完成后必须声明"子任务X已完成"
- 所有子任务必须按顺序执行，不得跳跃
- 输出文件路径中的目录会自动创建

`
