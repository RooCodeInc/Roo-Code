/**
 * 本地代码索引服务
 * 基于 SQLite3 + FTS5 + Tree-sitter AST 的代码索引解决方案
 */

export { LocalCodeIndexManager, type LocalCodeIndexConfig } from "./manager"
export { LocalCodeIndexDatabase } from "./database"
export { LocalASTParser } from "./ast-parser"
export { LocalIndexer } from "./indexer"
export { LocalSearcher } from "./searcher"
export type {
	CodeBlockType,
	ParsedCodeBlock,
	ParsedImport,
	FileParseResult,
	FileRecord,
	CodeBlockRecord,
	SearchResult,
	IndexProgress,
	SearchOptions,
	FormattedSearchResult,
} from "./types"
