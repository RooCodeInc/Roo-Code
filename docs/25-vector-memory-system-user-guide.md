# 向量记忆系统用户指南

## 概述

向量记忆系统是Roo-Code的高级长期记忆功能，通过**语义向量搜索**实现跨对话的智能记忆检索。该系统与代码索引共享向量数据库后端，提供统一的语义搜索体验。

**创建日期**: 2025-10-11  
**版本**: 1.0.0  
**相关文档**: [对话记忆增强系统](./23-conversation-memory-enhancement.md), [代码索引系统](./06-codebase-indexing.md)

---

## 功能特性

### 1. 核心功能

- ✅ **语义记忆存储**：使用向量嵌入存储对话记忆
- ✅ **智能检索**：基于语义相似度检索相关历史记忆
- ✅ **跨对话记忆**：在不同任务间共享项目级记忆
- ✅ **自动持久化**：记忆自动保存到Qdrant向量数据库
- ✅ **Augment方式集成**：在上下文压缩时自动增强记忆

### 2. 与代码索引的集成

向量记忆系统与代码索引共享基础设施：

```
共享组件：
├── Embedder（嵌入模型）
├── Qdrant向量数据库
├── 配置管理
└── 错误处理机制
```

这种设计带来的好处：

- **统一配置**：一次配置，两个系统同时启用
- **资源共享**：减少内存和计算开销
- **一致体验**：代码搜索和记忆检索使用相同的语义引擎

---

## 系统架构

### 记忆存储流程

```
用户对话
    ↓
ConversationMemory.extractMemories()
    ↓ (提取关键信息)
记忆分类和优先级评估
    ↓
VectorMemoryStore.storeMemories()
    ↓ (生成向量嵌入)
存储到Qdrant向量数据库
    ↓
支持跨对话语义检索
```

### 记忆检索流程（Augment方式）

```
触发上下文压缩
    ↓
summarizeConversation()
    ↓
VectorMemoryStore.searchProjectMemories()
    ↓ (语义搜索top-K相关记忆)
历史记忆注入到压缩请求
    ↓
LLM生成包含历史上下文的摘要
    ↓
保留关键用户指令和技术决策 ✅
```

---

## 配置指南

### 前提条件

1. **Qdrant向量数据库**（必需）

    - 安装并启动Qdrant服务
    - 默认地址：`http://localhost:6333`

2. **嵌入模型**（必需）
    - OpenAI embeddings（推荐）
    - Transformers.js本地嵌入
    - Ollama embeddings

### 启用向量记忆

在VSCode设置中配置：

```json
{
	"roo-cline.experimental.vectorMemory": true,
	"roo-cline.codebaseIndexing.enabled": true,
	"roo-cline.codebaseIndexing.qdrantUrl": "http://localhost:6333",
	"roo-cline.codebaseIndexing.embeddingProvider": "openai"
}
```

### 配置选项说明

| 配置项                                  | 类型    | 默认值                 | 说明                 |
| --------------------------------------- | ------- | ---------------------- | -------------------- |
| `vectorMemory`                          | boolean | false                  | 启用向量记忆系统     |
| `codebaseIndexing.enabled`              | boolean | false                  | 启用代码索引（必需） |
| `codebaseIndexing.qdrantUrl`            | string  | http://localhost:6333  | Qdrant服务地址       |
| `codebaseIndexing.embeddingProvider`    | string  | openai                 | 嵌入模型提供商       |
| `codebaseIndexing.openaiEmbeddingModel` | string  | text-embedding-3-small | OpenAI嵌入模型       |

---

## 使用方法

### 1. 基础使用

启用向量记忆后，系统会**自动**：

1. 在对话时提取关键记忆
2. 存储到向量数据库
3. 在压缩时检索相关历史记忆
4. 将历史记忆注入到上下文中

**无需手动操作**，系统全自动运行。

### 2. 记忆提取触发条件

系统会从以下类型的消息中提取记忆：

```typescript
// ✅ 会被提取的用户指令示例
"记住：所有API都需要添加认证"
"重要：使用PostgreSQL作为数据库"
"必须使用端口3001"
"注意文件路径：src/config/database.ts"

// ✅ 会被提取的技术决策
"使用JWT进行身份验证"
"采用Redis缓存"
"主题颜色改为蓝色"

// ❌ 不会被提取（没有关键词）
"继续"
"好的"
"实现这个功能"
```

**关键词模式**（自动触发记忆提取）：

- 中文：必须、一定要、务必、记住、注意、重要、关键
- 英文：require、must、need to、important、critical、remember、note

### 3. 语义搜索示例

当你开始新对话时，系统会自动检索相关历史记忆：

```
当前对话：
User: "继续之前的向量记忆工作"

系统自动检索：
✓ "使用Qdrant作为向量数据库"（相似度: 85%）
✓ "所有记忆需要支持语义搜索"（相似度: 78%）

这些历史记忆会被注入到当前上下文中，
帮助AI理解之前的技术决策和项目状态。
```

---

## 记忆类型和优先级

### 记忆类型

| 类型                 | 说明         | 示例                   |
| -------------------- | ------------ | ---------------------- |
| `USER_INSTRUCTION`   | 用户显式指令 | "记住：使用PostgreSQL" |
| `TECHNICAL_DECISION` | 技术决策     | "采用JWT认证方案"      |
| `CONFIGURATION`      | 配置要求     | "端口改为3001"         |
| `IMPORTANT_ERROR`    | 重要错误     | "数据库连接超时问题"   |
| `PROJECT_CONTEXT`    | 项目上下文   | "这是一个电商项目"     |
| `WORKFLOW_PATTERN`   | 工作流程     | "先运行测试再部署"     |

### 优先级系统

| 优先级     | 说明     | 保留策略   |
| ---------- | -------- | ---------- |
| `CRITICAL` | 关键指令 | 绝对不删除 |
| `HIGH`     | 重要决策 | 优先保留   |
| `MEDIUM`   | 中等重要 | 可压缩     |
| `LOW`      | 低优先级 | 可删除     |

---

## 高级特性

### 1. 记忆去重和合并

系统会自动检测重复记忆并智能合并：

```typescript
// 原记忆
"使用PostgreSQL数据库"

// 新消息
"记住PostgreSQL作为主数据库，端口5432"

// 合并后
{
  content: "记住PostgreSQL作为主数据库，端口5432",
  priority: CRITICAL,  // 提升优先级
  relatedFiles: ["src/database/config.ts"],
  tags: ["database", "configuration"]
}
```

### 2. 记忆老化机制

记忆会随时间自动降低优先级（可配置）：

```typescript
老化半衰期（默认值）：
- CRITICAL: 永不老化
- HIGH: 7天
- MEDIUM: 3天
- LOW: 1天
```

### 3. 跨对话检索

```typescript
// 任务A（昨天）
User: "使用Qdrant作为向量数据库"

// 任务B（今天，新对话）
User: "继续向量记忆的开发"

// 系统自动检索任务A的记忆
VectorMemoryStore.searchProjectMemories()
→ 找到相关记忆并注入到当前上下文
```

---

## 性能优化

### 1. 检索限制

为避免上下文窗口溢出，系统限制检索数量：

```typescript
searchProjectMemories(query, {
	minScore: 0.75, // 最低相似度阈值
	maxResults: 5, // 最多返回5条记忆
})
```

### 2. 内存管理

```typescript
// 自动清理低优先级记忆
conversationMemory.pruneLowPriorityMemories(100)

// 保留最重要的100条记忆
```

### 3. 错误处理

系统具有健壮的错误处理机制：

```typescript
try {
	await vectorMemoryStore.storeMemories(memories, taskId)
} catch (error) {
	console.warn("Failed to store memories:", error)
	// 继续执行，不影响主流程
}
```

---

## 故障排查

### 问题1：记忆未被存储

**可能原因**：

- Qdrant服务未启动
- 配置错误
- 消息内容不包含关键词

**解决方案**：

```bash
# 检查Qdrant服务
curl http://localhost:6333/collections

# 查看日志
检查VSCode开发者工具控制台

# 确认配置
检查 roo-cline.experimental.vectorMemory 是否为true
```

### 问题2：检索不到历史记忆

**可能原因**：

- 相似度得分低于阈值(0.75)
- 记忆已被老化降级
- 查询关键词不匹配

**解决方案**：

```typescript
// 降低相似度阈值（不推荐）
searchProjectMemories(query, {
	minScore: 0.6, // 从0.75降低到0.6
})
```

### 问题3：性能问题

**症状**：压缩过程缓慢

**解决方案**：

```json
{
	// 减少检索数量
	"maxResults": 3,

	// 使用更快的嵌入模型
	"embeddingProvider": "transformers.js"
}
```

---

## API参考

### VectorMemoryStore

#### 构造函数

```typescript
new VectorMemoryStore(
  embedder: Embedder,
  vectorStore: QdrantVectorStore,
  config: VectorMemoryConfig
)
```

#### 主要方法

**storeMemories**

```typescript
async storeMemories(
  memories: MemoryEntry[],
  taskId: string
): Promise<void>
```

存储记忆到向量数据库。

**searchProjectMemories**

```typescript
async searchProjectMemories(
  query: string,
  options?: {
    minScore?: number      // 默认 0.75
    maxResults?: number    // 默认 5
    taskId?: string        // 可选，限制特定任务
  }
): Promise<MemorySearchResult[]>
```

语义搜索项目级记忆。

**searchTaskMemories**

```typescript
async searchTaskMemories(
  query: string,
  taskId: string,
  options?: SearchOptions
): Promise<MemorySearchResult[]>
```

搜索特定任务的记忆。

---

## 最佳实践

### 1. 编写有效的指令

✅ **推荐**：

```
"记住：所有API端点都需要添加速率限制"
"重要：使用JWT token有效期设为7天"
"必须在每个组件添加错误边界"
```

❌ **不推荐**：

```
"继续"
"好的"
"完成这个任务"
```

### 2. 保持指令简洁明确

指令应该在10-200字符之间，既不过短也不过长：

```
✅ "记住：使用Redis缓存用户会话，TTL设为30分钟"
❌ "记"（太短，无意义）
❌ "记住：在实现用户认证系统时，我们需要考虑多个方面，包括但不限于密码哈希、会话管理、令牌刷新、多因素认证、社交登录集成、权限管理、审计日志..."（太长，难以索引）
```

### 3. 包含技术细节

提供足够的上下文信息：

```
✅ "使用PostgreSQL端口5432，数据库名roo_db"
✅ "JWT token过期时间：访问令牌15分钟，刷新令牌7天"
❌ "用PostgreSQL"（缺少细节）
```

### 4. 合理使用标签

在关键位置提及文件路径和技术栈：

```
"在文件src/config/auth.ts中配置JWT密钥"
"使用React Router v6进行路由管理"
```

这些信息会被自动提取并关联到记忆条目。

---

## 与ConversationMemory的关系

向量记忆系统是ConversationMemory的**增强版本**：

```
ConversationMemory（基础）:
├── 基于规则的记忆提取
├── 内存存储（单次对话）
└── 优先级管理

VectorMemoryStore（增强）:
├── 继承ConversationMemory的所有功能
├── 向量化存储（持久化）
├── 语义搜索（跨对话）
└── 与代码索引集成
```

**使用建议**：

- 小型项目或短期任务：使用ConversationMemory即可
- 大型项目或长期开发：启用VectorMemoryStore获得更强记忆能力

---

## 数据隐私和安全

### 1. 本地存储

向量记忆存储在**本地Qdrant数据库**中：

```
数据位置：
├── Qdrant数据目录（默认: ~/.qdrant）
├── 向量嵌入（本地生成）
└── 记忆内容（本地存储）
```

### 2. 数据不会上传

- ✅ 所有记忆数据保存在本地
- ✅ 向量嵌入可以使用本地模型（Transformers.js）
- ✅ 可以完全离线运行（如果使用本地embedder）

### 3. 数据清理

```bash
# 清理所有记忆数据
curl -X DELETE http://localhost:6333/collections/memories

# 或者停止Qdrant并删除数据目录
rm -rf ~/.qdrant/storage
```

---

## 未来规划

### 即将推出的功能

- 🔄 **记忆导出/导入**：在不同环境间迁移记忆
- 🔄 **记忆可视化**：查看和管理记忆条目的UI
- 🔄 **自定义记忆规则**：用户定义提取模式
- 🔄 **记忆分享**：团队间共享项目记忆

### 实验性功能

- 🧪 **多模态记忆**：支持代码片段、图片链接
- 🧪 **记忆推荐**：主动提醒相关历史上下文
- 🧪 **记忆分析**：项目知识图谱生成

---

## 相关资源

### 文档

- [对话记忆增强系统](./23-conversation-memory-enhancement.md)
- [自动压缩记忆集成](./24-auto-compression-memory-integration-fix.md)
- [代码索引系统](./06-codebase-indexing.md)
- [本地代码索引实现](./21-local-code-index-implementation.md)

### 代码

- [VectorMemoryStore实现](../src/core/memory/VectorMemoryStore.ts)
- [ConversationMemory实现](../src/core/memory/ConversationMemory.ts)
- [上下文压缩集成](../src/core/condense/index.ts)
- [Task集成](../src/core/task/Task.ts)

### 测试

- [向量记忆集成测试](../src/core/condense/__tests__/vector-memory-integration.spec.ts)
- [ConversationMemory测试](../src/core/memory/__tests__/ConversationMemory.test.ts)

---

## 常见问题 (FAQ)

### Q: 向量记忆会影响性能吗？

A: 影响很小。记忆存储是异步的，检索被限制为top-5结果。主要开销在嵌入生成（通常<100ms）。

### Q: 可以只启用ConversationMemory不启用VectorMemory吗？

A: 可以。ConversationMemory是独立的基础功能，即使不启用向量记忆也能工作。VectorMemory是可选的增强功能。

### Q: 记忆会占用多少磁盘空间？

A: 每条记忆约1-2KB（包括向量嵌入）。100条记忆约100-200KB，对磁盘空间影响极小。

### Q: 如何备份记忆数据？

A: 备份Qdrant数据目录：

```bash
tar -czf qdrant-backup.tar.gz ~/.qdrant/storage
```

### Q: 支持哪些嵌入模型？

A:

- OpenAI text-embedding-3-small（推荐，质量最佳）
- OpenAI text-embedding-ada-002（传统模型）
- Transformers.js（本地模型，隐私最佳）
- Ollama embeddings（本地模型，可定制）

### Q: 能否自定义记忆提取规则？

A: 当前版本使用预定义规则。自定义规则功能在开发路线图中（v1.1计划）。

---

## 贡献和反馈

遇到问题或有改进建议？

- 📝 提交Issue: https://github.com/RooCodeInc/Roo-Code/issues
- 💬 加入讨论: https://github.com/RooCodeInc/Roo-Code/discussions
- 📧 联系团队: support@roocode.com

---

**最后更新**: 2025-10-11
**文档版本**: 1.0.0
**适用版本**: Roo-Code v3.26+
