import { LocalCodeIndexDatabase } from "./database"
import type { SearchOptions, FormattedSearchResult } from "./types"

/**
 * 本地代码搜索器
 * 提供基于FTS5的全文搜索功能
 */
export class LocalSearcher {
	constructor(private database: LocalCodeIndexDatabase) {}

	/**
	 * 搜索代码
	 */
	search(query: string, options?: SearchOptions): FormattedSearchResult[] {
		// 使用 FTS5 搜索
		const results = this.database.search(query, {
			limit: options?.limit || 20,
			blockTypes: options?.blockTypes,
			languages: options?.languages,
		})

		// 格式化结果
		return results.map((result) => ({
			name: result.codeBlock.fullName || result.codeBlock.name,
			type: result.codeBlock.type,
			filePath: result.file.filePath,
			startLine: result.codeBlock.startLine,
			endLine: result.codeBlock.endLine,
			signature: result.codeBlock.signature,
			docComment: result.codeBlock.docComment,
			content: options?.includeContent ? result.codeBlock.content : undefined,
			score: result.score,
		}))
	}

	/**
	 * 按名称精确搜索
	 */
	searchByName(name: string, options?: SearchOptions): FormattedSearchResult[] {
		// 使用引号进行精确匹配
		return this.search(`"${name}"`, options)
	}

	/**
	 * 按类型搜索
	 */
	searchByType(blockType: string, options?: Omit<SearchOptions, "blockTypes">): FormattedSearchResult[] {
		return this.search("*", {
			...options,
			blockTypes: [blockType as any],
		})
	}

	/**
	 * 组合搜索 (名称 + 文档注释)
	 */
	searchCombined(query: string, options?: SearchOptions): FormattedSearchResult[] {
		// FTS5 会自动搜索所有索引字段 (name, full_name, content, doc_comment, signature)
		return this.search(query, options)
	}

	/**
	 * 搜索函数/方法
	 */
	searchFunctions(query: string, options?: SearchOptions): FormattedSearchResult[] {
		return this.search(query, {
			...options,
			blockTypes: ["function", "method"],
		})
	}

	/**
	 * 搜索类
	 */
	searchClasses(query: string, options?: SearchOptions): FormattedSearchResult[] {
		return this.search(query, {
			...options,
			blockTypes: ["class"],
		})
	}

	/**
	 * 搜索接口/类型
	 */
	searchTypes(query: string, options?: SearchOptions): FormattedSearchResult[] {
		return this.search(query, {
			...options,
			blockTypes: ["interface", "type"],
		})
	}
}
