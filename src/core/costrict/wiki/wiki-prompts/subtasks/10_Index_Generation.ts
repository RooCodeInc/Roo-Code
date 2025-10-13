import { WIKI_OUTPUT_DIR, SUBTASK_OUTPUT_FILENAMES } from "./constants"

export const INDEX_GENERATION_TEMPLATE = `# 项目技术文档索引生成任务

## 🎯 任务目标
为 ${WIKI_OUTPUT_DIR} 文件夹下的技术文档生成结构化索引文件，便于AI快速导航和信息定位。

## 📥 输入要求
- **技术文档目录**: ${WIKI_OUTPUT_DIR} 文件夹下的所有.md技术文档
- **项目基本信息**: 从文档中提取项目名称、核心特性等
- **文档内容**: 各技术文档的核心内容和结构

## 🔍 信息提取规则

### 项目概述信息提取
从 \`${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.PROJECT_OVERVIEW_TASK_FILE}\` 文件中提取：
1. **项目定位**: 从"项目概述"或"项目定位"章节提取，控制在50字以内
2. **技术栈**: 从"技术栈分析"章节提取主要技术组件，控制在40字以内
3. **架构特点**: 从"架构设计"章节提取核心架构特色，控制在40字以内
4. **组织结构**: 从"项目组织结构"部分提取目录树格式（50行以内），若不存在则自动扫描项目目录生成

### 提取原则
- ✅ 必须基于实际文档内容，严禁虚构
- ✅ 优先提取最核心、最具代表性的信息
- ✅ 使用关键词和短语，避免冗长描述
- ✅ 确保信息对AI理解项目有实际帮助

## 📋 严格输出格式要求

### 🔴 强制约束条件（必须严格遵守）
1. **文档链接路径**: 必须使用 \`${WIKI_OUTPUT_DIR}\` 作为父路径前缀，格式为：\`${WIKI_OUTPUT_DIR}{文件名}\`
2. **文档长度**: 整个索引文档严格控制在100行以内
3. **内容范围**: 只包含文档目录和快速导航两部分，禁止添加其他内容
4. **摘要长度**: 所有摘要信息严格控制在30字以内
5. **存在性检查**: 如果某个文档不存在，则不在索引中包含该项

### 📄 文档结构模板
严格按照以下结构生成，不得修改或添加任何额外结构：

\`\`\`markdown
# {项目名称} 项目技术文档索引

## 📚 文档导航

本索引为AI提供{项目名称}项目的完整技术文档导航，支持快速信息定位和上下文理解。

### 📋 项目概述

**项目定位**: {从项目概览文档提取的项目定位，30字以内}
**技术栈**: {从项目概览文档提取的技术栈，30字以内}
**架构特点**: {从项目概览文档提取的架构特点，30字以内}

### 🏗️ 组织结构

\`\`\`
src/
├── core/           # 核心功能模块
├── integrations/   # 集成功能
├── utils/          # 工具函数
└── webview-ui/     # 前端界面
...                # 其他目录
{从项目概览文档提取的项目组织结构，50行以内，若不存在则自动扫描项目目录生成}

### 🎯 核心文档概览

| 文档名称 | 文件路径 | 主要内容 | 适用场景 |
|---------|---------|---------|---------|
| **项目概览** | [\`${SUBTASK_OUTPUT_FILENAMES.PROJECT_OVERVIEW_TASK_FILE}\`](${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.PROJECT_OVERVIEW_TASK_FILE}) | {项目定位摘要，30字以内} | 项目理解、技术选型、功能开发 |
| **整体架构** | [\`${SUBTASK_OUTPUT_FILENAMES.OVERALL_ARCHITECTURE_TASK_FILE}\`](${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.OVERALL_ARCHITECTURE_TASK_FILE}) | {架构模式摘要，30字以内} | 架构设计、模块开发、系统集成 |
| **服务依赖** | [\`${SUBTASK_OUTPUT_FILENAMES.SERVICE_DEPENDENCIES_TASK_FILE}\`](${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.SERVICE_DEPENDENCIES_TASK_FILE}) | {服务间依赖摘要，30字以内} | 依赖管理、性能优化、故障排查 |
| **数据流分析** | [\`${SUBTASK_OUTPUT_FILENAMES.DATA_FLOW_INTEGRATION_TASK_FILE}\`](${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.DATA_FLOW_INTEGRATION_TASK_FILE}) | {数据流模式摘要，30字以内} | 数据处理、集成开发、性能调优 |
| **服务模块** | [\`${SUBTASK_OUTPUT_FILENAMES.SERVICE_ANALYSIS_TASK_FILE}\`](${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.SERVICE_ANALYSIS_TASK_FILE}) | {核心服务摘要，30字以内} | 服务开发、代码重构、功能扩展 |
| **数据库分析** | [\`${SUBTASK_OUTPUT_FILENAMES.DATABASE_SCHEMA_TASK_FILE}\`](${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.DATABASE_SCHEMA_TASK_FILE}) | {数据库架构摘要，30字以内} | 数据库设计、查询优化、数据迁移 |
| **API接口** | [\`${SUBTASK_OUTPUT_FILENAMES.API_INTERFACE_TASK_FILE}\`](${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.API_INTERFACE_TASK_FILE}) | {接口规范摘要，30字以内} | API开发、接口测试、集成开发 |
| **部署分析** | [\`${SUBTASK_OUTPUT_FILENAMES.DEPLOY_ANALYSIS_TASK_FILE}\`](${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.DEPLOY_ANALYSIS_TASK_FILE}) | {部署方式摘要，30字以内} | 部署配置、运维管理、扩容缩容 |

### 🚀 角色导向导航

#### 🆕 新手入门路径
1. **快速了解项目**: [\`项目概览\`](${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.PROJECT_OVERVIEW_TASK_FILE}) → [\`API接口\`](${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.API_INTERFACE_TASK_FILE})
2. **开发环境准备**: [\`项目规则\`](.roo/code-rules/generated_rules.md) → [\`部署分析\`](${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.DEPLOY_ANALYSIS_TASK_FILE})

#### 🏗️ 架构设计路径
1. **架构理解**: [\`整体架构\`](${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.OVERALL_ARCHITECTURE_TASK_FILE}) → [\`服务依赖\`](${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.SERVICE_DEPENDENCIES_TASK_FILE})
2. **数据架构**: [\`数据流分析\`](${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.DATA_FLOW_INTEGRATION_TASK_FILE}) → [\`数据库分析\`](${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.DATABASE_SCHEMA_TASK_FILE})

#### 💻 开发实施路径
1. **编码规范**: [\`项目规则\`](.roo/code-rules/generated_rules.md) → [\`服务模块\`](${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.SERVICE_ANALYSIS_TASK_FILE})
2. **接口开发**: [\`API接口\`](${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.API_INTERFACE_TASK_FILE}) → [\`数据库分析\`](${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.DATABASE_SCHEMA_TASK_FILE})

#### 🔧 运维部署路径
1. **部署配置**: [\`部署分析\`](${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.DEPLOY_ANALYSIS_TASK_FILE}) → [\`项目规则\`](.roo/code-rules/generated_rules.md)
2. **系统维护**: [\`服务依赖\`](${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.SERVICE_DEPENDENCIES_TASK_FILE}) → [\`数据流分析\`](${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.DATA_FLOW_INTEGRATION_TASK_FILE})
\`\`\`

## ⚠️ 严格禁止事项
1. ❌ 禁止使用 ./ 或 ../ 等相对路径前缀，必须使用 \`${WIKI_OUTPUT_DIR}\` 作为前缀
2. ❌ 禁止添加索引概述、使用说明、统计信息等额外内容
3. ❌ 禁止摘要信息超过30字
4. ❌ 禁止文档总行数超过100行
5. ❌ 禁止虚构任何信息，必须基于实际文档内容
6. ❌ 禁止修改文档结构模板
7. ❌ 禁止为不存在的文档创建索引条目

## 📁 输出文件命名
\`${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.INDEX_GENERATION_TASK_FILE}\`
注意：如果${WIKI_OUTPUT_DIR} 目录不存在，则创建。`
