/**
 * 本地代码索引类型定义
 */

/**
 * 代码块类型
 */
export type CodeBlockType =
	| "class"
	| "interface"
	| "type"
	| "function"
	| "method"
	| "property"
	| "variable"
	| "enum"
	| "constant"

/**
 * 解析后的代码块
 */
export interface ParsedCodeBlock {
	type: CodeBlockType
	name: string
	fullName?: string
	startLine: number
	endLine: number
	startColumn?: number
	endColumn?: number
	content: string
	signature?: string
	docComment?: string
	parentId?: number
	modifiers: string[]
	parameters?: Array<{
		name: string
		type?: string
		defaultValue?: string
	}>
	returnType?: string
}

/**
 * 解析后的导入信息
 */
export interface ParsedImport {
	importPath: string
	importType: "default" | "named" | "namespace" | "side-effect"
	importedNames?: string[]
	lineNumber: number
}

/**
 * 文件解析结果
 */
export interface FileParseResult {
	filePath: string
	language: string
	lineCount: number
	codeBlocks: ParsedCodeBlock[]
	imports: ParsedImport[]
}

/**
 * 文件记录
 */
export interface FileRecord {
	id: number
	filePath: string
	fileHash: string
	language: string
	lastIndexedAt: number
	lineCount: number
	sizeBytes: number
}

/**
 * 代码块记录
 */
export interface CodeBlockRecord extends ParsedCodeBlock {
	id: number
	fileId: number
}

/**
 * 搜索结果
 */
export interface SearchResult {
	codeBlock: CodeBlockRecord
	file: FileRecord
	score: number // FTS5 rank score
}

/**
 * 索引进度回调
 */
export interface IndexProgress {
	phase: "scanning" | "parsing" | "indexing" | "complete"
	current: number
	total: number
	currentFile?: string
}

/**
 * 搜索选项
 */
export interface SearchOptions {
	limit?: number
	blockTypes?: CodeBlockType[]
	languages?: string[]
	includeContent?: boolean
}

/**
 * 格式化的搜索结果
 */
export interface FormattedSearchResult {
	name: string
	type: string
	filePath: string
	startLine: number
	endLine: number
	signature?: string
	docComment?: string
	content?: string
	score: number
}
