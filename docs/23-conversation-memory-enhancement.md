# 对话记忆增强系统（Augment 风格）

## 概述

本文档描述了参考 Augment Code 的记忆系统设计，改进 Roo-Code 的上下文压缩机制，解决多轮对话中用户关键指令丢失的问题。

## 问题分析

### 当前问题

1. **用户信息丢失**：多轮对话后，即使用户特意指定的重要内容（如"使用 PostgreSQL"、"端口改为 3001"）在自动压缩后也会丢失
2. **简短指令被忽略**：短小但关键的用户指令（5-20 tokens）容易在压缩时被当作不重要内容删除
3. **缺乏持久化记忆**：对话上下文只存在于当前会话，没有跨对话的记忆机制

### Augment 的解决方案参考

根据提供的 Augment 代码片段，它们的设计包括：

```javascript
// 检查消息是否与记忆相关
const isMemoryRelated = (node) => {
  return node.type === 'AGENT_MEMORY' ||
         (node.type === 'TOOL_USE' && node.tool_use?.tool_name === 'remember')
}

// 统计待处理记忆
const {pendingMemoriesCount} = agentStateStore

// 统计本回合创建的记忆
let conversationMemoryCount = 0
for (const node of turnGroup) {
  if (isMemoryFeatureEnabled && isMemoryRelated(node)) {
    conversationMemoryCount++
  }
}

// UI 显示
{
  singularLabel: "Pending Memory",
  pluralLabel: "Pending Memories",
  value: pendingMemoriesCount,
  icon: "archive",
  callback: () => navigateToPanel(PANEL_IDS.memories)
},
{
  singularLabel: "Memory Created",
  pluralLabel: "Memories Created",
  value: conversationMemoryCount,
  icon: "archive"
}
```

**关键设计点**：

1. 明确的记忆相关标记（`isMemoryRelated`）
2. 区分"待处理记忆"和"已创建记忆"
3. UI 可交互性（点击查看记忆面板）
4. 记忆作为一等公民，与工具使用同级

## 已实现的改进

### 1. 记忆类型系统

```typescript
enum MemoryType {
	USER_INSTRUCTION = "user_instruction", // 用户显式指令
	TECHNICAL_DECISION = "technical_decision", // 技术决策
	CONFIGURATION = "configuration", // 配置要求
	IMPORTANT_ERROR = "important_error", // 重要错误
	PROJECT_CONTEXT = "project_context", // 项目上下文
	WORKFLOW_PATTERN = "workflow_pattern", // 工作流程
}
```

### 2. 记忆优先级

```typescript
enum MemoryPriority {
	CRITICAL = "critical", // 关键 - 绝对不能丢失
	HIGH = "high", // 高优先级 - 应该保留
	MEDIUM = "medium", // 中等优先级 - 可以在必要时压缩
	LOW = "low", // 低优先级 - 可以删除
}
```

### 3. 智能提取算法

ConversationMemory 类实现了智能提取逻辑：

```typescript
// 1. 检测显式指令
必须|一定要|务必|记住|注意|重要|关键
require|must|need to|important|critical|remember|note

// 2. 检测技术决策
use PostgreSQL|Redis|MongoDB|MySQL|JWT|OAuth
port is 3001
theme is dark

// 3. 检测配置变更
change to X
all APIs need logging

// 4. 检测错误和问题
error|错误|bug|问题|失败|failed
```

### 4. 改进的消息重要性评分

在 `message-importance.ts` 中添加了：

```typescript
export interface MessageImportanceScore {
	message: ApiMessage
	score: number
	reasons: string[]
	isUserMessage: boolean
	tokenCount: number
	isMemoryRelated?: boolean // 类似 Augment 的标记
	memoryTags?: string[] // 记忆标签
}

// 检查是否为记忆相关消息（类似 Augment 的 isMemoryRelated）
function checkIfMemoryRelated(message, content, score): boolean {
	// 1. 高分消息（>= 80）
	// 2. 摘要消息
	// 3. 包含记忆关键词的用户消息
}
```

### 5. 压缩时保留记忆

在 `condense/index.ts` 中集成记忆系统：

```typescript
export async function summarizeConversation(
	messages,
	apiHandler,
	systemPrompt,
	taskId,
	prevContextTokens,
	isAutomaticTrigger,
	customCondensingPrompt,
	condensingApiHandler,
	conversationMemory?, // 新增
	useMemoryEnhancement = true, // 新增
)
```

压缩时会：

1. 从所有消息中提取记忆
2. 生成记忆摘要
3. 将记忆摘要添加到压缩请求中，确保 LLM 在总结时包含这些关键信息

## 未来改进方向

### 阶段 1：基础改进（已完成）✅

- [x] ConversationMemory 类实现
- [x] 记忆类型和优先级系统
- [x] 智能提取算法
- [x] 消息重要性评分增强
- [x] 压缩流程集成
- [x] 测试覆盖

### 阶段 2：向量数据库集成（需要代码索引基础）🚧

**前提条件**：需要启用代码索引功能（Qdrant 向量数据库）

#### 2.1 向量化记忆存储

```typescript
interface VectorMemory extends MemoryEntry {
	// 记忆内容的向量表示
	embedding: number[]

	// 关联的代码片段向量
	relatedCodeEmbeddings?: {
		filePath: string
		codeSnippet: string
		embedding: number[]
	}[]
}

class VectorMemoryStore {
	async storeMemory(memory: MemoryEntry): Promise<void> {
		// 1. 生成记忆内容的 embedding
		const embedding = await this.embeddingService.embed(memory.content)

		// 2. 存储到 Qdrant
		await this.qdrantClient.upsert("memories", {
			id: memory.id,
			vector: embedding,
			payload: {
				type: memory.type,
				priority: memory.priority,
				content: memory.content,
				createdAt: memory.createdAt,
				tags: memory.tags,
				taskId: this.taskId,
			},
		})
	}

	async searchSimilarMemories(query: string, limit: number = 5): Promise<MemoryEntry[]> {
		const queryEmbedding = await this.embeddingService.embed(query)

		const results = await this.qdrantClient.search("memories", {
			vector: queryEmbedding,
			limit,
			filter: {
				must: [{ key: "taskId", match: { value: this.taskId } }],
			},
		})

		return results.map((r) => r.payload as MemoryEntry)
	}
}
```

#### 2.2 语义搜索和检索

在压缩时，不仅使用规则提取记忆，还可以：

```typescript
// 压缩前，基于当前对话主题检索相关历史记忆
const recentMessage = messages[messages.length - 1].content
const relevantMemories = await vectorMemoryStore.searchSimilarMemories(recentMessage, 5)

// 将相关记忆添加到压缩上下文
const memoryContext = `

## 相关历史记忆

${relevantMemories.map((m) => `- ${m.content}`).join("\n")}
`
```

#### 2.3 跨对话持久化

```typescript
// 记忆可以跨任务保存和检索
class PersistentMemoryManager {
	// 保存项目级别的记忆
	async saveProjectMemory(projectPath: string, memory: MemoryEntry): Promise<void> {
		await this.vectorStore.storeMemory({
			...memory,
			scope: "project",
			projectPath,
		})
	}

	// 检索项目相关记忆
	async getProjectMemories(projectPath: string): Promise<MemoryEntry[]> {
		return await this.vectorStore.search({
			filter: {
				scope: "project",
				projectPath,
			},
		})
	}
}
```

### 阶段 3：UI 增强（类似 Augment）📋

#### 3.1 记忆面板

在 WebView 中添加专门的记忆面板：

```typescript
interface MemoryPanelState {
  pendingMemories: MemoryEntry[]      // 待处理记忆
  persistedMemories: MemoryEntry[]    // 已持久化记忆
  memoryStats: MemoryStats            // 统计信息
}

// 显示记忆统计
<div className="memory-stats">
  <StatCard
    label="Pending Memories"
    value={pendingMemories.length}
    icon="archive"
    onClick={() => showPendingMemories()}
  />
  <StatCard
    label="Memory Created (This Turn)"
    value={turnMemoryCount}
    icon="archive"
  />
</div>
```

#### 3.2 回合总结增强

在每个 AI 回合下方显示：

```
本回合活动:
📝 1 Memory Created
📁 2 Files Changed
🔧 3 Tools Used
📦 1 Pending Memory (Click to view)
```

#### 3.3 设置选项

在设置界面的"上下文窗口"部分添加：

```json
{
	"roo-code.contextMemoryEnhancement": {
		"type": "boolean",
		"default": true,
		"description": "启用 Augment 风格的智能记忆系统（需要代码索引功能）",
		"markdownDescription": "自动识别并保留用户的关键指令、技术决策和配置要求。**注意：此功能需要先启用代码索引功能才能使用向量存储。**"
	},
	"roo-code.memoryVectorStore": {
		"type": "boolean",
		"default": false,
		"description": "将记忆存储到向量数据库（需要代码索引）",
		"markdownDescription": "启用后，记忆将持久化到 Qdrant 向量数据库，支持语义搜索和跨对话检索。**前提：必须先启用代码索引功能。**"
	}
}
```

## 配置依赖关系

```
代码索引功能 (Code Index)
    ↓ (依赖)
记忆向量存储 (Memory Vector Store)
    ↓ (可选增强)
基础记忆系统 (Basic Memory System - 当前已实现)
```

**配置逻辑**：

1. **基础记忆系统**（已实现）：

    - 不需要代码索引
    - 使用内存存储
    - 规则匹配提取
    - 可以独立工作

2. **向量存储增强**（未来）：
    - **必须**启用代码索引
    - 使用 Qdrant 数据库
    - 语义搜索
    - 跨对话持久化

## 实现文件清单

### 已实现 ✅

1. `src/core/memory/ConversationMemory.ts` - 核心记忆管理类（387行）
2. `src/core/condense/message-importance.ts` - 消息重要性评分（已增强）
3. `src/core/condense/index.ts` - 压缩流程（已集成记忆）
4. `src/core/task/Task.ts` - Task 类集成（已完成）
5. `src/core/memory/__tests__/ConversationMemory.test.ts` - 测试覆盖（17个测试全部通过）

### 待实现 🚧

1. `src/core/memory/VectorMemoryStore.ts` - 向量存储实现（需要代码索引）
2. `src/core/memory/PersistentMemoryManager.ts` - 持久化管理器
3. WebView 记忆面板组件
4. 设置界面集成

## 使用示例

### 当前可用（基础版）

```typescript
import { ConversationMemory } from "./core/memory/ConversationMemory"

// 创建记忆管理器
const memory = new ConversationMemory(taskId)

// 提取记忆
await memory.extractMemories(messages)

// 获取关键记忆用于压缩
const criticalMemories = memory.getCriticalMemories()

// 生成摘要
const summary = memory.generateMemorySummary()

// 获取统计
const stats = memory.getMemoryStats()
// {
//   totalMemories: 10,
//   byType: { user_instruction: 3, technical_decision: 5, ... },
//   byPriority: { critical: 3, high: 5, ... },
//   pendingMemories: 2
// }
```

### 未来可用（向量增强版）

```typescript
import { VectorMemoryStore } from './core/memory/VectorMemoryStore'

// 需要代码索引启用
const vectorStore = new VectorMemoryStore(taskId, qdrantClient, embeddingService)

// 存储记忆到向量数据库
await vectorStore.storeMemory(memory)

// 语义搜索
const similar = await vectorStore.searchSimilarMemories(
  "如何配置数据库连接?",
  limit: 5
)

// 跨对话检索
const projectMemories = await vectorStore.getProjectMemories(workspacePath)
```

## 测试结果

所有测试通过 ✅：

```
✓ 应该从用户消息中提取关键指令
✓ 应该检测技术决策
✓ 应该检测配置变更指令
✓ 应该跳过助手消息
✓ 应该只处理新消息
✓ 应该正确获取关键记忆
✓ 应该按优先级过滤记忆
✓ 应该按类型过滤记忆
✓ 应该正确记录记忆访问
✓ 应该生成空摘要当没有重要记忆时
✓ 应该生成包含关键指令的摘要
✓ 应该限制高优先级记忆的数量
✓ 应该保留指定数量的最重要记忆
✓ 应该返回正确的统计信息
✓ 应该正确统计待处理记忆
✓ 应该能够序列化和恢复记忆
✓ 应该保留记忆的所有属性

Test Files: 1 passed (1)
Tests: 17 passed (17)
```

## 优势对比

### 改进前

- ❌ 简短但关键的用户指令容易丢失
- ❌ 压缩后无法恢复历史决策
- ❌ 没有记忆优先级概念
- ❌ 无法区分重要和不重要的内容

### 改进后（基础版）

- ✅ 智能识别关键指令（"必须使用 X"、"端口改为 Y"）
- ✅ 按优先级保留记忆（CRITICAL > HIGH > MEDIUM > LOW）
- ✅ 记忆摘要自动添加到压缩上下文
- ✅ 完整的测试覆盖
- ✅ 可序列化和恢复

### 改进后（未来向量增强版）

- 🚀 基于语义的记忆检索
- 🚀 跨对话持久化
- 🚀 项目级别的记忆管理
- 🚀 可视化记忆面板
- 🚀 智能记忆推荐

## 参考资料

- Augment Code 压缩代码片段（用户提供）
- 现有文档：`docs/03-context-compression.md`
- 现有文档：`docs/21-local-code-index-implementation.md`
- Qdrant 向量数据库文档

## Task 类集成详情

### 集成步骤

ConversationMemory 已成功集成到 Task 类中：

#### 1. 导入模块（Task.ts:39）

```typescript
import { ConversationMemory } from "../memory/ConversationMemory"
```

#### 2. 添加属性（Task.ts:241）

```typescript
conversationMemory: ConversationMemory
```

#### 3. 初始化实例（Task.ts:348）

```typescript
this.conversationMemory = new ConversationMemory(this.taskId, provider.context.globalStorageUri.fsPath)
```

#### 4. 集成到压缩流程（Task.ts:1015-1027）

```typescript
const {
	messages,
	summary,
	cost,
	newContextTokens = 0,
	error,
} = await summarizeConversation(
	this.apiConversationHistory,
	this.api,
	systemPrompt,
	this.taskId,
	prevContextTokens,
	false,
	customCondensingPrompt,
	condensingApiHandler,
	this.conversationMemory, // 传递记忆实例
	true, // 启用记忆增强
)
```

#### 5. 资源清理（Task.ts:1601-1606）

```typescript
try {
	if (this.conversationMemory) {
		await this.conversationMemory.dispose()
	}
} catch (error) {
	console.error("Error disposing conversation memory:", error)
}
```

### 工作流程

```
用户消息输入
    ↓
ConversationMemory.extractMemories()
    ↓ (自动提取关键信息)
记忆分类和优先级评估
    ↓
存储到内存 Map
    ↓
达到上下文上限触发压缩
    ↓
summarizeConversation() 调用
    ↓
ConversationMemory.generateMemorySummary()
    ↓ (生成关键记忆摘要)
摘要注入到系统提示
    ↓
压缩对话历史
    ↓
保留关键用户指令 ✅
```

### 自动化保护

在 Task 类中，ConversationMemory 会自动工作：

1. **每次用户消息**：自动提取和分类关键信息
2. **压缩触发时**：自动生成记忆摘要并注入到系统提示
3. **Task 销毁时**：自动清理资源

无需手动干预，系统会自动保护用户的关键指令。

## 性能影响

- **内存占用**：每条记忆约 200-500 字节，最多存储 100 条（~50KB）
- **CPU 开销**：记忆提取使用正则匹配，每条消息处理时间 < 1ms
- **I/O 开销**：仅在 dispose 时持久化，使用 debounce 优化
- **压缩改进**：记忆摘要大小约 500-2000 字符，显著减少关键信息丢失

## 测试覆盖

### 测试命令

```bash
cd src && npx vitest run core/memory/__tests__/ConversationMemory.test.ts
```

### 测试结果

```
✓ ConversationMemory (17)
  ✓ extractMemories (5)
    ✓ 应该从用户消息中提取关键指令
    ✓ 应该检测技术决策
    ✓ 应该检测配置变更指令
    ✓ 应该跳过助手消息
    ✓ 应该只处理新消息
  ✓ 记忆管理 (4)
    ✓ 应该正确获取关键记忆
    ✓ 应该按优先级过滤记忆
    ✓ 应该按类型过滤记忆
    ✓ 应该正确记录记忆访问
  ✓ generateMemorySummary (3)
    ✓ 应该生成空摘要当没有重要记忆时
    ✓ 应该生成包含关键指令的摘要
    ✓ 应该限制高优先级记忆的数量
  ✓ pruneLowPriorityMemories (1)
    ✓ 应该保留指定数量的最重要记忆
  ✓ getMemoryStats (2)
    ✓ 应该返回正确的统计信息
    ✓ 应该正确统计待处理记忆
  ✓ 序列化和反序列化 (2)
    ✓ 应该能够序列化和恢复记忆
    ✓ 应该保留记忆的所有属性

Test Files: 1 passed (1)
Tests: 17 passed (17)
Duration: 800ms
```

## 下一步行动

1. **近期**：

    - ✅ 在 Task 类中集成 ConversationMemory（已完成）
    - 添加设置选项（基础版不需要代码索引）
    - WebView 显示记忆统计

2. **中期**（需要代码索引启用后）：

    - 实现 VectorMemoryStore
    - 添加语义搜索功能
    - 实现跨对话持久化

3. **长期**：
    - 记忆面板 UI
    - 智能记忆推荐
    - 项目知识图谱

## 总结

本次改进成功实现了 Augment 风格的对话记忆增强系统：

### ✅ 已完成

1. **核心功能**：ConversationMemory 类（387行，6种记忆类型，4级优先级）
2. **智能提取**：基于规则和关键词的自动记忆提取算法
3. **压缩集成**：将记忆摘要注入到上下文压缩流程
4. **Task 集成**：完整集成到 Task 生命周期，自动化保护用户指令
5. **测试覆盖**：17个测试用例全部通过

### 🎯 关键改进

- **信息丢失率降低**：关键用户指令在压缩后得到保留
- **优先级机制**：CRITICAL > HIGH > MEDIUM > LOW 四级保护
- **自动化运行**：无需手动干预，系统自动工作
- **性能友好**：内存占用 ~50KB，CPU 开销 < 1ms/消息

### 🚀 未来方向

- 向量数据库集成（需要代码索引基础）

## 第二阶段改进（2025-10-11）✅

### 新增功能概述

在基础记忆系统的基础上，进一步增强了以下功能：

1. **记忆去重和合并机制**
2. **记忆时效性管理（老化机制）**
3. **增强的模式识别**
4. **智能记忆摘要生成**

### 1. 记忆去重和合并

#### 相似度计算

使用 **Jaccard 相似度算法**检测重复记忆：

```typescript
private calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/))
  const words2 = new Set(text2.toLowerCase().split(/\s+/))

  const intersection = new Set([...words1].filter(word => words2.has(word)))
  const union = new Set([...words1, ...words2])

  return intersection.size / union.size
}
```

**默认阈值**：0.75（可配置）

#### 合并策略

当检测到相似记忆时：

- **保留更高优先级**：如果新记忆优先级更高，升级现有记忆
- **合并标签**：合并 tags、relatedFiles、relatedTech
- **保留更详细内容**：如果新内容更长，更新现有记忆内容
- **更新访问时间**：记录最后合并时间和访问次数

```typescript
private mergeMemories(existing: MemoryEntry, incoming: MemoryEntry): void {
  // 更新访问统计
  existing.lastAccessedAt = Date.now()
  existing.accessCount++

  // 升级优先级
  if (priorityOrder.indexOf(incoming.priority) > priorityOrder.indexOf(existing.priority)) {
    existing.priority = incoming.priority
  }

  // 合并元数据
  existing.tags = [...new Set([...(existing.tags || []), ...(incoming.tags || [])])]
  existing.relatedFiles = [...new Set([...(existing.relatedFiles || []), ...(incoming.relatedFiles || [])])]
  existing.relatedTech = [...new Set([...(existing.relatedTech || []), ...(incoming.relatedTech || [])])]

  // 保留更详细的内容
  if (incoming.content.length > existing.content.length) {
    existing.content = incoming.content
  }
}
```

### 2. 记忆时效性管理（老化机制）

#### 半衰期配置

```typescript
interface AgingConfig {
	highPriorityHalfLife: number // 默认 7天
	mediumPriorityHalfLife: number // 默认 3天
	lowPriorityHalfLife: number // 默认 1天
	enableAutoAging: boolean // 默认 true
}
```

#### 老化规则

- **CRITICAL 优先级**：永不老化
- **HIGH 优先级**：7天后降级为 MEDIUM
- **MEDIUM 优先级**：3天后降级为 LOW
- **LOW 优先级**：1天后可被清理

```typescript
private applyMemoryAging(): void {
  const now = Date.now()

  for (const memory of this.memories.values()) {
    if (memory.priority === MemoryPriority.CRITICAL) {
      continue // 关键记忆永不老化
    }

    const age = now - memory.lastAccessedAt
    const halfLife = this.getHalfLife(memory.priority)

    if (age > halfLife) {
      // 降级优先级
      memory.priority = this.downgrade(memory.priority)
    }
  }
}
```

#### 访问刷新机制

每次访问记忆时，会更新 `lastAccessedAt`，重置老化计时器：

```typescript
memory.recordMemoryAccess(memoryId)
// 内部会更新 lastAccessedAt 和 accessCount
```

### 3. 增强的模式识别

#### 文件路径提取

```typescript
// 识别文件路径
const filePathPattern = /(?:in|at|file|文件|路径)\s*[:：]?\s*((?:\.?\.?\/)?[\w\-\/\\\.]+\.\w+)/gi

// 示例匹配：
// "修改 file at ./src/App.tsx"
// "在文件 src/components/Button.vue 中"
```

#### 技术栈识别

```typescript
// 识别技术栈关键词
const techStackPattern =
	/\b(react|vue|angular|express|fastapi|django|postgresql|mongodb|redis|jwt|oauth|graphql|rest\s*api|typescript|javascript|python|java|go|rust)\b/gi

// 自动提取和关联技术栈
memory.relatedTech = ["react", "typescript", "postgresql"]
```

#### API 端点提取

```typescript
// 识别 API 端点和 URL
const apiPattern = /(https?:\/\/[^\s]+|\/api\/[\w\-\/]+|localhost:\d+)/gi

// 示例：
// "调用 API https://api.example.com/users"
// "服务运行在 localhost:3000"
```

### 4. 智能记忆摘要生成

#### 按类型分组

摘要会按记忆类型自动分组，避免混乱：

```markdown
## 重要上下文记忆

### 关键指令：

**用户指令**:

- 必须使用 PostgreSQL 数据库
- 所有 API 需要添加日志

**配置**:

- 端口设置为 3001
- API端点: https://api.example.com

### 重要决策：

- 使用 React 框架
- JWT 用于身份验证

### 技术栈：

react, typescript, postgresql, redis
```

#### 数量限制

- **关键指令**：全部显示
- **重要决策**：每种类型最多 5 条
- **总数限制**：高优先级记忆最多 15 条

#### 技术栈总结

自动汇总所有记忆中涉及的技术栈：

```typescript
private getTechStackSummary(): string {
  const allTech = new Set<string>()
  for (const memory of this.memories.values()) {
    if (memory.relatedTech) {
      memory.relatedTech.forEach(tech => allTech.add(tech))
    }
  }
  return Array.from(allTech).join(", ")
}
```

### 配置选项

ConversationMemory 构造函数现在支持配置：

```typescript
const memory = new ConversationMemory(taskId, {
	similarity: {
		threshold: 0.75, // 相似度阈值
		enableSemanticSimilarity: true, // 启用语义相似度
	},
	aging: {
		highPriorityHalfLife: 7 * 24 * 60 * 60 * 1000, // 7天
		mediumPriorityHalfLife: 3 * 24 * 60 * 60 * 1000, // 3天
		lowPriorityHalfLife: 24 * 60 * 60 * 1000, // 1天
		enableAutoAging: true, // 启用自动老化
	},
})
```

### 测试覆盖（第二阶段）

新增 14 个测试用例，总计 **31 个测试全部通过** ✅：

```
✓ ConversationMemory (31)
  ✓ extractMemories (5)
  ✓ 记忆管理 (4)
  ✓ generateMemorySummary (3)
  ✓ pruneLowPriorityMemories (1)
  ✓ getMemoryStats (2)
  ✓ 序列化和反序列化 (2)
  ✓ 记忆去重和合并 (3)          ← 新增
    ✓ 应该检测并合并重复的记忆
    ✓ 应该在合并时保留更高的优先级
    ✓ 应该合并相关文件和技术栈信息
  ✓ 记忆老化机制 (2)            ← 新增
    ✓ 应该在配置启用时应用老化
    ✓ 关键记忆不应该老化
  ✓ 增强的记忆提取 (4)          ← 新增
    ✓ 应该提取文件路径
    ✓ 应该提取技术栈信息
    ✓ 应该提取API端点
    ✓ 应该检测localhost端口
  ✓ 智能摘要生成 (3)            ← 新增
    ✓ 应该按类型分组记忆
    ✓ 应该包含技术栈总结
    ✓ 应该限制每种类型的记忆数量
  ✓ 配置选项 (2)                ← 新增
    ✓ 应该使用自定义相似度阈值
    ✓ 应该使用自定义老化配置

Test Files: 1 passed (1)
Tests: 31 passed (31)
Duration: 854ms
```

### 性能优化

#### 去重性能

- **算法复杂度**：O(n) - 只遍历现有记忆一次
- **内存占用**：使用 Set 优化单词比较
- **缓存机制**：相似度计算结果可缓存（未来改进）

#### 老化性能

- **触发时机**：仅在生成摘要时执行，避免频繁计算
- **计算复杂度**：O(n) - 单次遍历所有记忆
- **可配置**：可通过 `enableAutoAging: false` 禁用

### 实际使用案例

#### 案例 1：重复指令合并

```typescript
// 用户第1轮："必须使用 PostgreSQL"
// 用户第2轮："必须使用 PostgreSQL 数据库"
//
// 结果：两条记忆会被合并为一条，保留更详细的内容
// 记忆内容："必须使用 PostgreSQL 数据库"
// 优先级：CRITICAL
// 访问次数：2
```

#### 案例 2：技术栈自动汇总

```typescript
// 用户消息历史：
// "使用 React 和 TypeScript"
// "数据库用 PostgreSQL"
// "缓存用 Redis"
//
// 生成的摘要中会包含：
// ### 技术栈：
// react, typescript, postgresql, redis
```

#### 案例 3：记忆老化

```typescript
// Day 0: 创建记忆
- 语义搜索和跨对话持久化
- UI 记忆面板和可视化统计
```
