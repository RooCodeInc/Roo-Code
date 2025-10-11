/**
 * 记忆系统统一导出
 *
 * 该模块提供了完整的记忆管理功能：
 * 1. ConversationMemory - 基于规则的对话记忆提取和管理
 * 2. VectorMemoryStore - 基于向量数据库的语义记忆存储和检索
 * 3. PersistentMemoryManager - 项目级别的记忆持久化和跨对话管理
 * 4. MemoryEnhancementService - 高级功能：代码关联、智能推荐、知识图谱
 */

// 基础记忆管理
export {
	ConversationMemory,
	type ConversationMemoryManager,
	type MemoryEntry,
	type MemoryExtractionResult,
	type MemoryStats,
	MemoryType,
	MemoryPriority,
} from "./ConversationMemory"

// 向量记忆存储
export {
	VectorMemoryStore,
	type VectorMemoryStoreConfig,
	type VectorMemoryPayload,
	type MemorySearchResult,
} from "./VectorMemoryStore"

// 持久化管理
export {
	PersistentMemoryManager,
	type ProjectMemoryMetadata,
	type ConversationMemorySnapshot,
} from "./PersistentMemoryManager"

// 高级功能
export {
	MemoryEnhancementService,
	type CodeChunkAssociation,
	type EnhancedMemoryEntry,
	type MemoryRecommendation,
	type KnowledgeNode,
	type KnowledgeEdge,
	type KnowledgeGraph,
	type MemoryCluster,
} from "./MemoryEnhancement"
