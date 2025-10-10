# 代码库索引流程详解

## 概述

Roo-Code 实现了基于向量数据库的语义代码搜索功能,能够根据自然语言查询找到相关代码,而不仅仅是关键字匹配。本文档详细说明代码库索引的完整流程。

## 核心概念

### 语义搜索 (Semantic Search)

- 基于代码含义而非关键字匹配
- 使用向量相似度计算
- 能理解自然语言查询

### 向量嵌入 (Vector Embeddings)

- 将代码转换为高维向量
- 相似代码的向量距离更近
- 使用专门的嵌入模型生成

### 向量数据库 (Vector Database)

- 使用 Qdrant 存储向量
- 支持高效的相似度搜索
- 持久化存储索引数据

## 核心文件

### 1. CodeIndexManager

**路径**: `src/services/code-index/manager.ts` (422行)

**职责**:

- 单例管理器
- 协调所有索引服务
- 生命周期管理
- 错误恢复

### 2. CodeIndexOrchestrator

**路径**: `src/services/code-index/orchestrator.ts` (294行)

**职责**:

- 编排索引流程
- 协调文件扫描、解析、嵌入
- 批量处理优化
- 增量更新

### 3. SearchService

**路径**: `src/services/code-index/search-service.ts`

**职责**:

- 语义搜索实现
- 查询向量化
- 结果排序和过滤

### 4. FileWatcher

**路径**: `src/services/code-index/file-watcher.ts`

**职责**:

- 监听文件变更
- 触发增量更新
- 防抖处理

### 5. CacheManager

**路径**: `src/services/code-index/cache-manager.ts`

**职责**:

- 文件哈希缓存
- 跳过未变更文件
- 缓存持久化

## 完整索引流程

### 步骤 1: 初始化配置

```typescript
// src/services/code-index/manager.ts
async initialize() {
    // 1. 加载配置
    const config = await this.configManager.getConfig()

    // 配置包含:
    // - 嵌入模型: OpenAI, Ollama, Voyage 等
    // - Qdrant 连接信息: host, port
    // - 索引设置: 批量大小, 并发数
}
```

**配置示例**:

```json
{
	"embedder": {
		"provider": "openai",
		"model": "text-embedding-3-small",
		"apiKey": "sk-..."
	},
	"vectorStore": {
		"type": "qdrant",
		"host": "localhost",
		"port": 6333,
		"collectionName": "roo-code-index"
	},
	"indexing": {
		"batchSize": 50,
		"concurrency": 3,
		"chunkSize": 500
	}
}
```

### 步骤 2: 创建服务实例

```typescript
// 使用工厂模式创建服务
const services = await this.serviceFactory.create(config)

// 创建的服务包括:
// - Embedder: 嵌入模型客户端
// - VectorStore: Qdrant 客户端
// - DirectoryScanner: 文件扫描器
// - CodeParser: 代码解析器
// - FileWatcher: 文件监听器
```

**服务依赖关系**:

```
ServiceFactory
    ├── EmbedderFactory → OpenAIEmbedder | OllamaEmbedder
    ├── VectorStoreFactory → QdrantStore
    ├── DirectoryScanner
    ├── CodeParser
    └── FileWatcher
```

### 步骤 3: 初始化缓存

```typescript
// src/services/code-index/cache-manager.ts
await this.cacheManager.initialize()

// 加载缓存数据:
// - 文件路径 → 文件哈希映射
// - 上次索引时间
// - 索引元数据
```

**缓存结构**:

```typescript
{
    "files": {
        "src/core/task/Task.ts": {
            "hash": "a1b2c3d4...",
            "lastIndexed": "2024-01-01T00:00:00Z",
            "blocksCount": 15
        }
    },
    "metadata": {
        "version": "1.0.0",
        "lastFullIndex": "2024-01-01T00:00:00Z"
    }
}
```

### 步骤 4: 启动 Orchestrator

```typescript
// src/services/code-index/orchestrator.ts
await this.orchestrator.start()

// Orchestrator 协调整个索引流程
```

### 步骤 5: 向量存储初始化

```typescript
// 连接 Qdrant
await this.vectorStore.connect()

// 检查集合是否存在
const exists = await this.vectorStore.collectionExists("roo-code-index")

if (!exists) {
	// 创建集合
	await this.vectorStore.createCollection({
		name: "roo-code-index",
		vectorSize: 1536, // 取决于嵌入模型
		distance: "Cosine",
	})
} else {
	// 验证集合配置
	await this.vectorStore.validateCollection("roo-code-index")
}
```

**Qdrant 集合配置**:

```typescript
{
    name: "roo-code-index",
    vectors: {
        size: 1536,           // OpenAI text-embedding-3-small
        distance: "Cosine"    // 余弦相似度
    },
    optimizers_config: {
        indexing_threshold: 10000
    }
}
```

### 步骤 6: 工作区扫描

```typescript
// src/services/code-index/orchestrator.ts
const files = await this.directoryScanner.scan(workspaceRoot)

// 扫描逻辑:
// 1. 递归遍历目录
// 2. 过滤文件 (.gitignore, .rooignore)
// 3. 只包含代码文件 (.ts, .js, .py 等)
// 4. 排除 node_modules, .git 等
```

**文件过滤规则**:

```typescript
const INCLUDED_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".py", ".java", ".cpp", ".c", ".go", ".rs", ".rb", ".php"]

const EXCLUDED_PATTERNS = ["node_modules/**", ".git/**", "dist/**", "build/**", "*.min.js"]
```

**扫描结果**:

```typescript
// 返回文件列表
;[
	"/workspace/src/core/task/Task.ts",
	"/workspace/src/core/tools/executeCommandTool.ts",
	"/workspace/src/api/providers/anthropic.ts",
	// ... 更多文件
]
```

### 步骤 7: 文件解析和分块

```typescript
// 对每个文件进行解析
for (const filePath of files) {
	// 检查缓存
	const cached = await this.cacheManager.get(filePath)
	const currentHash = await computeFileHash(filePath)

	if (cached && cached.hash === currentHash) {
		// 文件未变更,跳过
		continue
	}

	// 解析文件
	const codeBlocks = await this.codeParser.parse(filePath)

	// 更新待索引列表
	filesToIndex.push(...codeBlocks)
}
```

**代码块结构**:

```typescript
interface CodeBlock {
	id: string // 唯一标识
	filePath: string // 文件路径
	type: string // 'function' | 'class' | 'method'
	name: string // 函数/类名
	content: string // 代码内容
	startLine: number // 起始行
	endLine: number // 结束行
	language: string // 编程语言
	metadata: {
		// 额外元数据
		description?: string
		parameters?: string[]
		returnType?: string
	}
}
```

**解析示例**:

```typescript
// 输入文件: src/utils/fs.ts
export async function readFile(path: string): Promise<string> {
	const content = await fs.readFile(path, "utf-8")
	return content
}

export async function writeFile(path: string, content: string): Promise<void> {
	await fs.writeFile(path, content, "utf-8")
}

// 解析结果:
;[
	{
		id: "src/utils/fs.ts:readFile:1-4",
		filePath: "src/utils/fs.ts",
		type: "function",
		name: "readFile",
		content: "export async function readFile(path: string): Promise<string> { ... }",
		startLine: 1,
		endLine: 4,
		language: "typescript",
	},
	{
		id: "src/utils/fs.ts:writeFile:6-8",
		filePath: "src/utils/fs.ts",
		type: "function",
		name: "writeFile",
		content: "export async function writeFile(path: string, content: string): Promise<void> { ... }",
		startLine: 6,
		endLine: 8,
		language: "typescript",
	},
]
```

### 步骤 8: 生成嵌入向量

```typescript
// 批量生成嵌入
const batches = chunk(codeBlocks, config.batchSize) // 每批 50 个

for (const batch of batches) {
	// 提取文本内容
	const texts = batch.map((block) => {
		// 组合上下文信息
		return `File: ${block.filePath}
Type: ${block.type}
Name: ${block.name}

${block.content}`
	})

	// 调用嵌入 API
	const embeddings = await this.embedder.embed(texts)

	// embeddings: number[][] (每个文本对应一个向量)
	// 例如: [[0.1, -0.2, 0.3, ...], [0.4, 0.1, -0.1, ...]]
}
```

**嵌入 API 调用**:

```typescript
// OpenAI 示例
const response = await openai.embeddings.create({
	model: "text-embedding-3-small",
	input: texts, // 批量输入
	encoding_format: "float",
})

const embeddings = response.data.map((d) => d.embedding)
// embeddings: number[][] (维度: 1536)
```

### 步骤 9: 写入向量存储

```typescript
// 批量写入 Qdrant
const points = codeBlocks.map((block, i) => ({
	id: block.id,
	vector: embeddings[i],
	payload: {
		filePath: block.filePath,
		type: block.type,
		name: block.name,
		content: block.content,
		startLine: block.startLine,
		endLine: block.endLine,
		language: block.language,
	},
}))

await this.vectorStore.upsert("roo-code-index", points)
```

**Qdrant 存储结构**:

```json
{
    "id": "src/utils/fs.ts:readFile:1-4",
    "vector": [0.1, -0.2, 0.3, ...],  // 1536 维
    "payload": {
        "filePath": "src/utils/fs.ts",
        "type": "function",
        "name": "readFile",
        "content": "export async function readFile...",
        "startLine": 1,
        "endLine": 4,
        "language": "typescript"
    }
}
```

### 步骤 10: 启动文件监听器

```typescript
// src/services/code-index/file-watcher.ts
await this.fileWatcher.start()

// 监听文件变更事件
this.fileWatcher.on("change", async (filePath) => {
	// 文件变更
	await this.reindexFile(filePath)
})

this.fileWatcher.on("delete", async (filePath) => {
	// 文件删除
	await this.removeFromIndex(filePath)
})

this.fileWatcher.on("create", async (filePath) => {
	// 新文件创建
	await this.indexFile(filePath)
})
```

**文件监听实现**:

```typescript
// 使用 VSCode 文件监听 API
const watcher = vscode.workspace.createFileSystemWatcher(
	"**/*.{ts,js,py,java,cpp,go}",
	false, // ignoreCreateEvents
	false, // ignoreChangeEvents
	false, // ignoreDeleteEvents
)

// 防抖处理 (500ms)
const debouncedUpdate = debounce((uri) => this.handleFileChange(uri), 500)

watcher.onDidChange(debouncedUpdate)
watcher.onDidCreate(debouncedUpdate)
watcher.onDidDelete((uri) => this.handleFileDelete(uri))
```

## 语义搜索流程

### 1. 用户发起搜索

```typescript
// 用户在 AI 对话中使用 codebase_search 工具
{
    "tool": "codebase_search",
    "query": "how to execute terminal commands"
}
```

### 2. 查询向量化

```typescript
// src/services/code-index/search-service.ts
async search(query: string, limit: number = 10) {
    // 1. 将查询转换为向量
    const queryVector = await this.embedder.embed([query])

    // queryVector: number[] (1536 维)
}
```

### 3. 向量相似度搜索

```typescript
// 2. 在 Qdrant 中搜索相似向量
const results = await this.vectorStore.search({
	collection: "roo-code-index",
	vector: queryVector[0],
	limit: limit,
	scoreThreshold: 0.7, // 最低相似度阈值
})
```

\*\*Qdrant
