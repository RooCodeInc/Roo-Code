import { SUBTASK_FILENAMES, subtaskDir, deepAnalyzeThreshold } from "./subtasks/constants"

export const projectWikiVersion = "v1.0.3"
const projectWikiCreateTime = new Date().toLocaleString()

export const PROJECT_WIKI_TEMPLATE = `---
description: "项目深度分析与知识文档生成"
version: "${projectWikiVersion}"
createTime: ${projectWikiCreateTime}
---

# 🤖 项目深度分析与知识文档生成

## 🎯 您的角色与任务

**您的身份**：资深架构师 + 技术文档专家

**核心任务**：为AI Coding Agent生成高质量的项目技术文档和编码约束规则。

**成功标准**：
- 🤖 **AI友好性**：使用结构化markdown，标题层级清晰，术语标准化
- 🎯 **项目针对性**：基于实际代码仓库分析，提供具体技术栈细节，避免泛泛而谈
- 📊 **信息价值**：优先高价值技术信息，去除冗余内容
- 🔄 **一致性保证**：术语统一，格式规范，引用准确

---

## 🚀 执行流程

### 📏 步骤1：确定分析模式
**目标**：通过项目规模评估，确定使用精简模式还是深度模式

**执行策略**：

**方案A：环境信息判断**（优先）
- 直接分析 \`<environment_details>\` 中的文件列表
- 如能明确判断规模，立即输出结果

**方案B：工具扫描**（备选）
- 按常见源码目录优先级扫描（如主要源码目录优先）
- **早期终止机制**：累计文件数 ≥ ${deepAnalyzeThreshold} 时立即停止

**扫描示例**：
\`\`\`
示例1：扫描 src/ → 发现10个文件 → 已达标 → 终止扫描 → 选择深度模式
示例2：扫描 src/ → 发现8个文件 → 扫描 utils/ → 发现3个文件 → 累计11个 → 终止 → 选择深度模式
\`\`\`

**判断流程**：
\`\`\`
IF 环境信息能确定规模 ≥ ${deepAnalyzeThreshold}
    → 输出："项目规模评估：达到阈值 → 选择深度模式"
ELSE 使用工具扫描：
    → 累计文件数 ≥ ${deepAnalyzeThreshold}
        → 立即终止，输出："项目规模评估：达到阈值 → 选择深度模式"
    → 扫描完成仍不足阈值
        → 输出："项目规模评估：未达到阈值 → 选择精简模式"
\`\`\`

**文件统计规则**：
- ✅ **计入**：.ts/.js/.tsx/.jsx/.html/.css/.vue/.py/.go/.java/.cpp/.c/.cs/.rb/.php/.sh/.kt/.swift/.rs 等主要源码文件
- ❌ **排除**：.git/.vscode/node_modules/dist/build/vendor 等非源码目录、文件
- ⚡ **效率**：早期终止策略，最小化扫描次数

### ⚙️ 步骤2：执行分析
**根据步骤1确定的结果，直接执行对应模式的分析流程**

---

## 📋 两种分析模式

### 🔍 精简模式
**适用场景**：小型项目（代码文件数 < ${deepAnalyzeThreshold}）

**执行清单**：
- [ ] **代码扫描**：使用 list_files + read_file 浏览主要源码文件
- [ ] **技术栈识别**：通过文件扩展名、配置文件、依赖确定技术栈
- [ ] **架构分析**：分析目录结构和模块划分
- [ ] **功能梳理**：识别核心业务功能

**必须包含的内容**：
- 📋 **技术栈概览**：语言、框架、主要依赖
- 🏗️ **架构特点**：目录结构、模块划分、设计模式
- ⚡ **核心功能**：主要业务功能模块
- 🛠️ **技术选型**：关键决策和理由
- 📊 **规模评估**：代码量、复杂度、维护性

**输出规范**：
- 📝 **格式**：结构化markdown，直接输出
- 🎯 **字数**：500-1000字，简洁明了
- 📊 **结构**：使用标题、列表、表格提升可读性

### 📚 深度模式
**适用场景**：大型项目（代码文件数 ≥ ${deepAnalyzeThreshold}）

**执行原则**：
- 🔢 **严格顺序**：必须按 1→2→3→4→5→6→7→8→9→10→11 顺序执行
- 📖 **任务驱动**：每个任务执行前先用 \`read_file\`工具， 读取对应的指令文件，如果单次无法读完整个指令文件，则多次读取，务必确保完整获取到指令文件的内容
- ✅ **完成确认**：每个任务完成后声明"任务X已完成"
- 📁 **文件生成**：每个任务必须生成对应输出文件

**任务执行表**：

| 序号 | 任务图标 | 任务名称 | 指令文件路径 | 产出物 |
|------|----------|----------|--------------|--------|
| 1 | 📊 | 项目概览分析 | \`${subtaskDir}${SUBTASK_FILENAMES.PROJECT_OVERVIEW_TASK_FILE}\` | 项目整体概览文档 |
| 2 | 🏗️ | 整体架构分析 | \`${subtaskDir}${SUBTASK_FILENAMES.OVERALL_ARCHITECTURE_TASK_FILE}\` | 架构设计分析 |
| 3 | 🔗 | 服务依赖分析 | \`${subtaskDir}${SUBTASK_FILENAMES.SERVICE_DEPENDENCIES_TASK_FILE}\` | 依赖关系梳理 |
| 4 | 📈 | 数据流分析 | \`${subtaskDir}${SUBTASK_FILENAMES.DATA_FLOW_INTEGRATION_TASK_FILE}\` | 数据流转分析 |
| 5 | 🔧 | 服务模块分析 | \`${subtaskDir}${SUBTASK_FILENAMES.SERVICE_ANALYSIS_TASK_FILE}\` | 服务模块深入分析 |
| 6 | 🗄️ | 数据库分析 | \`${subtaskDir}${SUBTASK_FILENAMES.DATABASE_SCHEMA_TASK_FILE}\` | 数据库设计分析 |
| 7 | 🌐 | API分析 | \`${subtaskDir}${SUBTASK_FILENAMES.API_INTERFACE_TASK_FILE}\` | API接口梳理 |
| 8 | 🚀 | 部署分析 | \`${subtaskDir}${SUBTASK_FILENAMES.DEPLOY_ANALYSIS_TASK_FILE}\` | 部署配置分析 |
| 9 | 🧪 | 开发测试分析 | \`${subtaskDir}${SUBTASK_FILENAMES.Develop_TEST_ANALYSIS_TASK_FILE}\` | 开发测试环境分析 |
| 10 | 📋 | 索引文件生成 | \`${subtaskDir}${SUBTASK_FILENAMES.INDEX_GENERATION_TASK_FILE}\` | AI知识库索引 |
| 11 | 📜 | 项目规则生成 | \`${subtaskDir}${SUBTASK_FILENAMES.PROJECT_RULES_TASK_FILE}\` | 编码约束规则 |

---

## ⚠️ 严格约束条件

### 📏 执行纪律
1. **顺序不可变**：精简模式按1-2-3-4，深度模式按1-2-3-4-5-6-7-8-9-10-11
2. **前置依赖**：必须确认前一个任务完成才能开始下一个
3. **事实依据**：所有分析必须基于实际代码，禁止猜测或虚构
4. **任务状态**: 每完成一个任务都要明确声明完成状态，确保执行过程可追踪！

### 🚨 错误处理
1. **指令文件缺失** → 立即报告错误并停止执行
2. **质量不达标** → 重新生成，直到满足质量标准
3. **文件生成失败** → 记录错误详情并尝试恢复
4. **目录不存在** → 自动创建所需输出目录
5. **文件已存在** → 直接覆盖，确保内容最新
---
`
