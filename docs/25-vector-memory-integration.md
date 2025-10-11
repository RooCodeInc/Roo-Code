# 向量记忆系统集成实现文档

## 概述

本文档描述了向量记忆系统与代码索引的集成实现，实现了 augment 方式的高级长期记忆功能。

## 实现日期

2025-10-11

## 目标

✅ 将记忆系统升级为基于向量数据库的语义搜索系统
✅ 与现有代码索引基础设施（Qdrant + Embedder）集成
✅ 支持跨对话的项目级别记忆持久化
✅ 提供高级功能：代码关联、智能推荐、知识图谱

## 架构设计

### 系统组件

```
┌─────────────────────────────────────────────────────────────┐
│                    记忆系统架构                              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐      ┌──────────────────┐            │
│  │ ConversationMemory│──────│  VectorMemoryStore│            │
│  │   (基于规则)      │      │   (语义搜索)      │            │
│  └──────────────────┘      └──────────────────┘            │
│           │                         │                        │
│           │                         │                        │
│           ▼                         ▼                        │
│  ┌──────────────────────────────────────────┐              │
│  │      PersistentMemoryManager              │              │
│  │      (持久化和跨对话管理)                  │              │
│  └──────────────────────────────────────────┘              │
│           │                                                  │
│           ▼                                                  │
│  ┌──────────────────────────────────────────┐              │
│  │     MemoryEnhancementService              │              │
│  │     (高级功能: 代码关联/推荐/图谱)          │              │
│  └──────────────────────────────────────────┘              │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│                    基础设施层                                │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐      ┌──────────────┐                    │
│  │   Embedder    │      │    Qdrant    │                    │
│  │ (OpenAI/Ollama)│      │ (向量数据库) │                    │
│  └──────────────┘      └──────────────┘                    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## 实现细节

### 1. VectorMemoryStore（核心层）

**文件**: `src/core/memory/VectorMemoryStore.ts`

#### 功能

- 使用 Embedder 服务将记忆内容转换为向量
- 存储记忆到 Qdrant 独立 collection (`roo-memories-{projectHash}`)
- 提供语义搜索接口，支持类型、优先级、任务ID过滤
- 支持项目级别的跨对话记忆检索

#### 关键接口

```typescript
class VectorMemoryStore {
	// 初始化向量存储
	async initialize(): Promise<void>

	// 存储记忆
	async storeMemories(memories: MemoryEntry[], taskId?: string): Promise<void>

	// 语义搜索当前对话记忆
	async searchRelevantMemories(query: string, options?: SearchOptions): Promise<MemorySearchResult[]>

	// 搜索项目级别记忆（跨对话）
	async searchProjectMemories(query: string, options?: SearchOptions): Promise<MemorySearchResult[]>
}
```

#### 向量化策略

记忆文本通过以下方式增强以提高语义搜索质量：

```typescript
prepareMemoryTextForEmbedding(memory: MemoryEntry): string {
  return [
    memory.content,
    `[Type: ${memory.type}]`,
    `[Priority: ${memory.priority}]`,
    `[Tech: ${memory.relatedTech.join(", ")}]`,
    `[Tags: ${memory.tags.join(", ")}]`
  ].join(" ")
}
```

### 2. 集成到压缩流程

**文件**: `src/core/condense/index.ts`

#### 修改点

```typescript
export async function summarizeConversation(
	// ... 现有参数
	vectorMemoryStore?: VectorMemoryStore, // 新增参数
): Promise<SummarizeResponse>
```

#### 工作流程

1. **提取记忆** - ConversationMemory 从消息中提取关键信息
2. **存储到向量库** - 新记忆自动存储到 VectorMemoryStore
3. **检索历史记忆** - 使用最近3条消息作为查询上下文，搜索相关历史记忆
4. **注入摘要** - 将历史记忆追加到当前记忆摘要中

```typescript
// 搜索项目级别的相关记忆（跨对话）
const relevantMemories = await vectorMemoryStore.searchProjectMemories(queryContext, {
	minScore: 0.75, // 较高的相似度阈值
	maxResults: 5, // 限制数量
})

// 添加到上下文
if (relevantMemories.length > 0) {
	memoryContext += `\n\n### 相关历史记忆（跨对话）：\n${historicalContext}`
}
```

### 3. PersistentMemoryManager（持久化层）

**文件**: `src/core/memory/PersistentMemoryManager.ts`

#### 功能

- 项目级别记忆管理（存储在 `.roo/memories/`）
- 对话快照的持久化和恢复
- 元数据管理（统计信息、活跃对话数等）
- 向量存储的生命周期管理

#### 存储结构

```
project-root/
└── .roo/
    └── memories/
        ├── metadata.json           # 项目元数据
        ├── conversations.json      # 对话索引
        └── [future] backups/       # 备份数据
```

#### 关键接口

```typescript
class PersistentMemoryManager {
	// 初始化持久化存储
	async initialize(): Promise<void>

	// 保存对话记忆
	async saveConversationMemory(taskId: string, conversationMemory: ConversationMemory): Promise<void>

	// 加载对话记忆
	async loadConversationMemory(taskId: string): Promise<ConversationMemory | null>

	// 清理旧对话
	async pruneOldConversations(maxAge: number): Promise<number>

	// 导入/导出
	async exportMemories(): Promise<ExportData>
	async importMemories(data: ExportData): Promise<void>
}
```

### 4. MemoryEnhancementService（高级功能层）

**文件**: `src/core/memory/MemoryEnhancement.ts`

#### 功能

##### 4.1 记忆与代码块关联

```typescript
async associateCodeWithMemory(
  memory: MemoryEntry,
  maxCodeBlocks: number = 3
): Promise<EnhancedMemoryEntry>
```

- 为记忆查找相关代码块
- 使用语义搜索在代码索引中查找
- 优先搜索 `memory.relatedFiles` 中的文件
- 返回增强的记忆条目（包含代码关联）

##### 4.2 智能记忆推荐

```typescript
async recommendMemories(
  context: string,
  options?: RecommendationOptions
): Promise<MemoryRecommendation[]>
```

推荐分数计算（综合多个因素）：

| 因素         | 权重      | 说明                     |
| ------------ | --------- | ------------------------ |
| 语义相似度   | 基础分    | 通过向量搜索获得         |
| 文件路径匹配 | +0.15     | 相同文件的记忆更相关     |
| 技术栈匹配   | +0.1/个   | 共享技术栈的记忆更相关   |
| 优先级加成   | +0.2/+0.1 | CRITICAL/HIGH 优先级加分 |
| 访问频率     | +0.05     | 高频使用的记忆加分       |

##### 4.3 知识图谱构建

```typescript
async buildKnowledgeGraph(): Promise<KnowledgeGraph>
```

构建规则：

- **节点**: 每个记忆条目
- **边**: 基于共享文件、技术栈、类型的关联
- **关系强度**:
    - 共享文件: 0.3 \* 文件数
    - 共享技术栈: 0.2 \* 技术数
    - 相同类型: 0.1

##### 4.4 记忆聚类

```typescript
async findMemoryClusters(minClusterSize: number = 3): Promise<MemoryCluster[]>
```

- 使用 DFS 查找连通分量
- 识别相关记忆的集合
- 计算聚类的主导技术栈和类型

## 数据流

### 记忆创建流程

```
用户输入 → ConversationMemory.extractMemories()
         ↓
    提取关键信息（类型、优先级、内容）
         ↓
    创建 MemoryEntry[]
         ↓
    ┌────────────────────┬────────────────────┐
    ↓                    ↓                    ↓
内存存储          VectorMemoryStore    PersistentMemoryManager
(Map)             (语义搜索)           (文件持久化)
    ↓                    ↓                    ↓
临时记忆          Embedder → Qdrant      .roo/memories/
```

### 记忆检索流程

```
压缩触发 → summarizeConversation()
         ↓
    提取最近3条消息作为查询上下文
         ↓
    vectorMemoryStore.searchProjectMemories()
         ↓
    Embedder.createEmbeddings(query)
         ↓
    Qdrant.search(queryVector)
         ↓
    过滤 + 排序（分数降序）
         ↓
    返回 MemorySearchResult[]
         ↓
    格式化为摘要文本
         ↓
    注入到压缩提示词
```

## 配置说明

### VectorMemoryStore 配置

```typescript
interface VectorMemoryStoreConfig {
	qdrantUrl: string // Qdrant服务器URL
	qdrantApiKey?: string // API密钥（可选）
	vectorSize: number // 向量维度（由embedder决定）
	workspacePath: string // 工作空间路径
	projectId?: string // 项目ID（用于跨对话）
}
```

### 默认参数

| 参数           | 默认值                | 说明                       |
| -------------- | --------------------- | -------------------------- |
| minScore       | 0.7                   | 最小相似度分数             |
| maxResults     | 10                    | 最大返回结果数             |
| collectionName | `roo-memories-{hash}` | 向量库集合名               |
| searchLimit    | 5                     | 压缩流程中检索的历史记忆数 |

## 性能优化

### 1. 向量化批处理

```typescript
// 批量创建嵌入，减少API调用
const texts = memories.map((m) => prepareMemoryTextForEmbedding(m))
const embeddingResponse = await embedder.createEmbeddings(texts)
```

### 2. 缓存策略

- ConversationMemory 在内存中维护 Map 缓存
- VectorMemoryStore 依赖 Qdrant 的内置缓存
- PersistentMemoryManager 使用懒加载

### 3. 搜索优化

```typescript
// Qdrant HNSW 配置
hnsw_config: {
  m: 64,
  ef_construct: 512,
  on_disk: true,  // 降低内存占用
}
```

## 使用示例

###
