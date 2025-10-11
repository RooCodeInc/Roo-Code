# 本地代码索引实现总结

## 概述

根据 `docs/21-local-code-index-implementation.md` 设计文档,成功实现了基于 SQLite3 + FTS5 + Tree-sitter AST 的本地代码索引系统,作为 Qdrant 向量数据库的替代方案。

## 实现日期

2025-10-11

## 核心技术栈

- **SQLite3**: 使用 `better-sqlite3` 实现同步数据库操作
- **FTS5**: SQLite 全文搜索引擎,支持布尔查询和相关性排序
- **Tree-sitter**: 复用现有的 AST 解析基础设施
- **TypeScript**: 类型安全的实现

## 已实现的功能

### 1. 数据库层 (database.ts)

**文件**: `src/services/local-code-index/database.ts` (430行)

**核心功能**:

- SQLite 数据库初始化和管理
- 4个主表: `files`, `code_blocks`, `imports`, `index_metadata`
- FTS5 虚拟表: `code_blocks_fts` 用于全文搜索
- 3个触发器实现自动同步 FTS 表
- WAL 模式提升并发性能

**主要方法**:

- `upsertFile()`: 插入/更新文件记录
- `insertCodeBlocks()`: 批量插入代码块
- `insertImports()`: 插入导入语句
- `search()`: FTS5 全文搜索
- `getStats()`: 获取统计信息
- `clear()`: 清空所有数据

### 2. AST 解析器 (ast-parser.ts)

**文件**: `src/services/local-code-index/ast-parser.ts` (401行)

**核心功能**:

- 基于 Tree-sitter 解析 TypeScript/JavaScript 代码
- 提取函数、类、接口、类型等代码块
- 提取导入语句信息
- 支持嵌套作用域和完整代码内容

**支持的代码块类型**:

- `function`: 函数声明
- `method`: 类方法
- `class`: 类定义
- `interface`: 接口定义
- `type`: 类型别名
- `enum`: 枚举类型
- `variable`: 变量声明

### 3. 索引服务 (indexer.ts)

**文件**: `src/services/local-code-index/indexer.ts` (148行)

**核心功能**:

- 工作区全量索引
- 单文件增量索引
- SHA-256 文件哈希检测变更
- 自动跳过未变更的文件
- 支持 .rooignore 过滤

**主要方法**:

- `indexWorkspace()`: 索引整个工作区
- `indexFile()`: 索引单个文件
- `removeFile()`: 删除文件索引
- `needsReindex()`: 检查是否需要重新索引

### 4. 搜索服务 (searcher.ts)

**文件**: `src/services/local-code-index/searcher.ts` (91行)

**核心功能**:

- FTS5 全文搜索
- 按类型过滤
- 按语言过滤
- 相关性评分

**主要方法**:

- `search()`: 通用搜索
- `searchByName()`: 精确名称匹配
- `searchFunctions()`: 搜索函数/方法
- `searchClasses()`: 搜索类
- `searchTypes()`: 搜索接口/类型

### 5. 管理器 (manager.ts)

**文件**: `src/services/local-code-index/manager.ts` (179行)

**核心功能**:

- 单例模式管理多个工作区
- 统一的 API 接口
- 自动数据库路径管理

**单例方法**:

- `getInstance()`: 获取工作区实例
- `clearInstance()`: 清除指定实例
- `clearAllInstances()`: 清除所有实例

### 6. codebaseSearchTool 集成

**文件**: `src/core/tools/codebaseSearchTool.ts` (修改)

**实现的双模式架构**:

```typescript
const indexMode = codebaseIndexConfig.codebaseIndexMode || "vector"

if (indexMode === "local") {
	// 使用本地 SQLite 索引
	const localManager = LocalCodeIndexManager.getInstance(workspacePath)
	const localResults = localManager.search(query, { limit: 10 })
	// 转换为统一格式
} else {
	// 使用 Qdrant 向量索引
	const manager = CodeIndexManager.getInstance(context)
	searchResults = await manager.searchIndex(query, directoryPrefix)
}
```

### 7. UI 集成

**修改的文件**:

- `src/core/webview/ClineProvider.ts`: 添加默认配置
- `webview-ui/src/context/ExtensionStateContext.tsx`: 前端状态管理
- `webview-ui/src/components/chat/CodeIndexPopover.tsx`: 添加模式选择器

**UI 新增功能**:

- 索引模式选择下拉框 (Vector / Local)
- 根据模式显示对应配置项
- 中英文翻译支持

## 测试覆盖

### 数据库测试 (database.test.ts)

**测试文件**: `src/services/local-code-index/__tests__/database.test.ts` (379行)

**测试用例**: 15个测试全部通过

- ✅ 基础操作: 初始化、插入、更新、删除
- ✅ 代码块操作: 插入单个和嵌套代码块
- ✅ 导入语句操作: 命名导入和默认导入
- ✅ 全文搜索: 基本搜索、文档注释搜索、结果限制
- ✅ 统计信息: 文件数、代码块数、数据库大小
- ✅ 清理操作: 清空所有数据
- ✅ 元数据操作: 设置和获取元数据

### 管理器测试 (manager.test.ts)

**测试文件**: `src/services/local-code-index/__tests__/manager.test.ts` (167行)

**测试用例**: 9个测试全部通过

- ✅ 单例模式: 同一工作区返回相同实例
- ✅ 多工作区: 不同工作区返回不同实例
- ✅ 实例清理: 清除单个和所有实例
- ✅ 基础功能: 统计信息、初始化状态、搜索、清空
- ✅ 数据库路径: 正确生成路径

**总测试结果**: 24个测试全部通过 ✅

## 数据库 Schema

### files 表

```sql
CREATE TABLE files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT UNIQUE NOT NULL,
  file_hash TEXT NOT NULL,
  language TEXT,
  last_indexed_at INTEGER NOT NULL,
  line_count INTEGER,
  size_bytes INTEGER
);
```

### code_blocks 表

```sql
CREATE TABLE code_blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  full_name TEXT,
  content TEXT NOT NULL,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  start_column INTEGER,
  end_column INTEGER,
  parent_id INTEGER,
  modifiers TEXT,
  signature TEXT,
  doc_comment TEXT,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);
```

### code_blocks_fts 表 (FTS5虚拟表)

```sql
CREATE VIRTUAL TABLE code_blocks_fts USING fts5(
  id UNINDEXED,
  name,
  full_name,
  content,
  doc_comment,
  signature
);
```

### 触发器

- `code_blocks_ai`: INSERT 时同步到 FTS
- `code_blocks_ad`: DELETE 时同步到 FTS
- `code_blocks_au`: UPDATE 时同步到 FTS

## 性能优化

1. **WAL 模式**: 提升并发读写性能
2. **索引优化**: 在关键字段添加索引
3. **增量索引**: 通过文件哈希避免重复索引
4. **批量插入**: 使用事务批量插入代码块
5. **同步 API**: better-sqlite3 的同步 API 避免异步开销

## 配置说明

### 配置字段

- `codebaseIndexMode`: `"vector"` | `"local"`
    - `"vector"`: 使用 Qdrant 向量数据库 (默认)
    - `"local"`: 使用本地 SQLite 索引

### 默认数据库路径

```
<workspace>/.roo/local-index.db
```

## 使用示例

### 创建管理器实例

```typescript
import { LocalCodeIndexManager } from "./services/local-code-index"

const manager = LocalCodeIndexManager.getInstance(workspacePath)
```

### 索引工作区

```typescript
await manager.indexWorkspace((progress) => {
	console.log(`${progress.phase}: ${progress.current}/${progress.total}`)
})
```

### 搜索代码

```typescript
const results = manager.search("function name", {
	limit: 20,
	blockTypes: ["function", "method"],
	languages: ["typescript"],
})
```

### 获取统计信息

```typescript
const stats = manager.getStats()
console.log(`索引了 ${stats.totalFiles} 个文件`)
console.log(`共 ${stats.totalBlocks} 个代码块`)
```

## 与向量索引的对比

| 特性       | 本地索引 (SQLite) | 向量索引 (Qdrant) |
| ---------- | ----------------- | ----------------- |
| 依赖       | 无外部依赖        | 需要 Qdrant 服务  |
| 搜索方式   | 关键词匹配        | 语义相似度        |
| 性能       | 快速              | 较慢(网络请求)    |
| 存储位置   | 本地文件          | 远程数据库        |
| 配置复杂度 | 简单              | 需要配置服务端    |
| 支持离线   | ✅                | ❌                |
| 搜索精度   | 精确匹配          | 语义理解          |

## 已知限制

1. **语言支持**: 当前主要支持 TypeScript/JavaScript,其他语言需要扩展
2. **Tree-sitter 依赖**: 需要 wasm 文件正确加载
3. **搜索语义**: 关键词搜索,不支持语义理解
4. **大型项目**: 首次全量索引可能需要较长时间

## 未来改进方向

1. **增量更新**: 实现文件监听自动更新索引
2. **多语言支持**: 扩展支持更多编程语言
3. **搜索优化**: 改进搜索算法和相关性排序
4. **UI 增强**: 添加索引进度显示和统计面板
5. **导出功能**: 支持导出索引数据用于分析

## 文件清单

### 核心实现 (7个文件)

- `src/services/local-code-index/types.ts` (127行)
- `src/services/local-code-index/database.ts` (430行)
- `src/services/local-code-index/ast-parser.ts` (401行)
- `src/services/local-code-index/indexer.ts` (148行)
- `src/services/local-code-index/searcher.ts` (91行)
- `src/services/local-code-index/manager.ts` (179行)
- `src/services/local-code-index/index.ts` (22行)

### 测试文件 (2个文件)

- `src/services/local-code-index/__tests__/database.test.ts` (379行)
- `src/services/local-code-index/__tests__/manager.test.ts` (167行)

### 集成修改 (4个文件)

- `src/core/tools/codebaseSearchTool.ts` (修改)
- `src/core/webview/ClineProvider.ts` (修改)
- `webview-ui/src/context/ExtensionStateContext.tsx` (修改)
- `webview-ui/src/components/chat/CodeIndexPopover.tsx` (修改)

### 翻译文件 (2个文件)

- `webview-ui/src/i18n/locales/en/settings.json` (修改)
- `webview-ui/src/i18n/locales/zh-CN/settings.json` (修改)

### 依赖更新 (1个文件)

- `src/package.json` (添加 better-sqlite3)

**总代码量**: ~2000+ 行

## 结论

成功按照设计文档实现了完整的本地代码索引系统,提供了:

- ✅ 无外部依赖的本地索引方案
- ✅ 基于 AST
