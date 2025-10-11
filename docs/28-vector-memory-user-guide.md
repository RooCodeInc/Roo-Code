# 向量记忆系统用户指南

## 概述

向量记忆系统是Roo-Code的高级长期记忆功能，通过向量化和语义搜索技术，实现跨对话的智能记忆管理。该系统与代码索引共享底层架构，提供augment方式的上下文增强。

## 核心特性

### 1. 语义记忆检索

- **智能搜索**：基于语义相似度而非关键词匹配
- **跨对话记忆**：在不同对话任务间共享项目级记忆
- **自动提取**：从对话中自动识别和提取重要信息
- **优先级管理**：根据重要性自动分配记忆优先级

### 2. Augment方式增强

- **上下文注入**：在上下文压缩时自动检索相关历史记忆
- **RAG模式**：检索增强生成（Retrieval-Augmented Generation）
- **智能降级**：向量服务不可用时自动降级到基础记忆

### 3. 与代码索引集成

- **共享架构**：复用代码索引的embedder和向量存储
- **统一配置**：Qdrant配置和embedder设置统一管理
- **资源优化**：避免重复部署向量服务

## 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                   对话上下文压缩流程                      │
│                                                           │
│  1. 提取记忆 → ConversationMemory.extractMemories()     │
│     ├─ 用户指令 (USER_INSTRUCTION)                       │
│     ├─ 技术决策 (TECHNICAL_DECISION)                     │
│     ├─ 配置信息 (CONFIGURATION)                          │
│     └─ 重要错误 (IMPORTANT_ERROR)                        │
│                                                           │
│  2. 存储到向量数据库 → VectorMemoryStore.storeMemories()│
│     └─ 使用embedder创建向量嵌入                          │
│                                                           │
│  3. 语义搜索 → VectorMemoryStore.searchProjectMemories()│
│     └─ 查询最近3条消息的语义上下文                        │
│                                                           │
│  4. 注入压缩上下文                                        │
│     └─ 添加"相关项目记忆"部分到摘要请求                   │
└─────────────────────────────────────────────────────────┘
                            ↓
              ┌─────────────────────────┐
              │   QdrantVectorStore     │
              │  (向量数据库)            │
              └─────────────────────────┘
                            ↑
                   共享embedder和存储
                            ↑
              ┌─────────────────────────┐
              │   CodeIndexManager      │
              │  (代码索引管理器)        │
              └─────────────────────────┘
```

## 前置条件

### 1. Qdrant向量数据库

向量记忆系统需要Qdrant服务，与代码索引共享同一实例：

```bash
# 使用Docker Compose启动Qdrant
cd qdrant
docker-compose up -d

# 验证服务状态
curl http://localhost:6333/health
```

### 2. Embedder配置

系统复用代码索引的embedder配置，支持以下选项：

- **OpenAI API**：`text-embedding-3-small` 或 `text-embedding-3-large`
- **本地模型**：通过Ollama运行的embedding模型
- **其他提供商**：任何兼容OpenAI API的embedding服务

### 3. 代码索引初始化

向量记忆依赖代码索引管理器，确保代码索引已正确初始化：

1. 在VSCode设置中配置embedding provider
2. 运行代码索引初始化
3. 验证Qdrant连接成功

## 配置指南

### 基础配置

向量记忆系统通过以下方式自动配置：

1. **从CodeIndexManager获取配置**

    ```typescript
    // src/core/task/Task.ts (Line 484-542)
    const codeIndexManager = this.codebaseIndexer?.codeIndexManager
    if (codeIndexManager?.embedder && codeIndexManager?.vectorDimensions) {
    	const config: VectorMemoryStoreConfig = {
    		qdrantUrl: "http://localhost:6333",
    		vectorSize: codeIndexManager.vectorDimensions,
    		workspacePath: this.cwd,
    		projectId: this.taskId, // 项目级记忆的唯一标识
    	}
    	this.vectorMemoryStore = new VectorMemoryStore(codeIndexManager.embedder, config)
    }
    ```

2. **自动启用条件**
    - 代码索引已初始化
    - Embedder可用
    - Qdrant服务正常运行

### 高级配置

#### 调整相似度阈值

在 `src/core/condense/index.ts` (Line 271) 修改：

```typescript
const relevantMemories = await vectorMemoryStore.searchProjectMemories(queryContext, {
	minScore: 0.75, // 默认0.75，提高以获取更相关的记忆
	maxResults: 5, // 默认5，增加以获取更多上下文
})
```

#### 禁用向量记忆

如果只想使用基础记忆而不使用向量搜索：

```typescript
// 在summarizeConversation调用时设置
const result = await summarizeConversation(
	messages,
	apiHandler,
	systemPrompt,
	taskId,
	prevContextTokens,
	isAutomaticTrigger,
	customCondensingPrompt,
	condensingApiHandler,
	conversationMemory,
	false, // 设置为false禁用记忆增强
	vectorMemoryStore,
)
```

## 使用场景

### 场景1：项目配置持久化

**问题**：在新对话中需要记住之前设定的配置

**解决方案**：

```
用户（第一个对话）：
"记住这个配置：使用PostgreSQL数据库，端口3001，启用SSL"

Roo：
"好的，已记录配置信息"

---

用户（几天后的新对话）：
"继续开发数据库相关功能"

Roo（自动检索到历史记忆）：
"我注意到项目配置使用PostgreSQL数据库（端口3001，启用SSL）。
我将基于这些设置继续开发..."
```

### 场景2：技术决策追踪

**问题**：团队成员需要了解之前的技术选型理由

**解决方案**：

```
用户：
"为什么我们选择使用Redis而不是Memcached？"

Roo（检索历史记忆）：
"根据项目记忆，选择Redis是因为：
1. 需要数据持久化功能
2. 使用Redis的发布/订阅功能实现实时通知
3. 团队已有Redis运维经验
（相似度：87.5%，来自2周前的讨论）"
```

### 场景3：错误模式识别

**问题**：重复出现类似的错误

**解决方案**：

```
Roo（自动检测到相似错误）：
"我注意到这个错误与之前遇到的问题类似：
之前的解决方案是增加数据库连接池大小至50。
是否需要检查当前的连接池配置？"
```

## 记忆类型

系统自动识别并分类以下记忆类型：

### 1. USER_INSTRUCTION（用户指令）

- **优先级**：CRITICAL
- **示例**："所有API都需要添加日志记录"
- **触发词**："请记住"、"重要"、"务必"

### 2. TECHNICAL_DECISION（技术决策）

- **优先级**：HIGH
- **示例**："使用JWT进行身份认证"
- **触发词**："决定使用"、"选择"、"采用"

### 3. CONFIGURATION（配置信息）

- **优先级**：HIGH
- **示例**："数据库端口：3001"
- **触发词**："配置"、"设置"、"端口"

### 4. IMPORTANT_ERROR（重要错误）

- **优先级**：HIGH
- **示例**："避免在循环中调用async函数"
- **触发词**："错误"、"失败"、"问题"

### 5. PROJECT_CONTEXT（项目上下文）

- **优先级**：MEDIUM
- **示例**："使用microservices架构"
- **触发词**：架构、设计模式、框架

### 6. WORKFLOW_PATTERN（工作流模式）

- **优先级**：MEDIUM
- **示例**："先写测试再实现功能"
- **触发词**：流程、步骤、工作流

## 性能与限制

### 资源消耗

- **Qdrant内存**：每1000条记忆约占用10-20MB（取决于向量维度）
- **Embedder API调用**：每次压缩触发1-2次embedding请求
- **搜索延迟**：典型情况下<100ms

### 限制与约束

1. **依赖Qdrant服务**

    - 服务不可用时自动降级到基础记忆
    - 不影响核心对话功能

2. **Embedder成本**

    - 使用OpenAI API时会产生embedding成本
    - 建议使用本地Ollama模型降低成本

3. **Collection命名**

    - 每个项目ID对应一个独立collection
    - Collection名称：`roo-memories-{projectId-hash}`

4. **搜索限制**
    - 默认最多返回5条相关记忆
    - 相似度阈值：0.75（可调整）

## 故障排查

### 问题1：向量记忆未启用

**症状**：上下文压缩时没有检索历史记忆

**检查步骤**：

1. 验证Qdrant服务状态

    ```bash
    curl http://localhost:6333/health
    ```

2. 检查代码索引是否初始化

    - 在VSCode命令面板运行"Roo: Index Codebase"
    - 查看输出日志确认embedder配置

3. 检查vectorMemoryStore初始化
    - 查看Task初始化日志
    - 确认embedder和vectorDimensions可用

**解决方案**：

- 重启Qdrant服务
- 重新初始化代码索引
- 检查Qdrant端口是否被占用

### 问题2：记忆检索不准确

**症状**：检索到的记忆与当前上下文不相关

**可能原因**：

1. 相似度阈值设置过低
2. 查询上下文不够清晰
3. 记忆内容过于简短

**解决方案**：

1. 提高minScore阈值（从0.75提升至0.80）
2.
