import * as path from "path"
import { LocalCodeIndexDatabase } from "./database"
import { LocalIndexer } from "./indexer"
import { LocalSearcher } from "./searcher"
import type { RooIgnoreController } from "../../core/ignore/RooIgnoreController"
import type { IndexProgress, SearchOptions, FormattedSearchResult } from "./types"

/**
 * 本地代码索引管理器配置
 */
export interface LocalCodeIndexConfig {
	dbPath: string
	workspacePath: string
	enableFTS?: boolean
}

/**
 * 本地代码索引管理器
 * 统一管理数据库、索引器和搜索器
 */
export class LocalCodeIndexManager {
	private static instances: Map<string, LocalCodeIndexManager> = new Map()

	private database: LocalCodeIndexDatabase
	private indexer: LocalIndexer
	private searcher: LocalSearcher
	private config: LocalCodeIndexConfig
	private rooIgnoreController?: RooIgnoreController

	private constructor(config: LocalCodeIndexConfig, rooIgnoreController?: RooIgnoreController) {
		this.config = config
		this.rooIgnoreController = rooIgnoreController

		// 初始化数据库
		const dbPath = path.isAbsolute(config.dbPath) ? config.dbPath : path.join(config.workspacePath, config.dbPath)

		this.database = new LocalCodeIndexDatabase(dbPath)

		// 初始化索引器和搜索器
		this.indexer = new LocalIndexer(this.database, rooIgnoreController)
		this.searcher = new LocalSearcher(this.database)
	}

	/**
	 * 获取或创建管理器实例(单例模式)
	 */
	static getInstance(workspacePath: string, rooIgnoreController?: RooIgnoreController): LocalCodeIndexManager {
		if (!this.instances.has(workspacePath)) {
			const config: LocalCodeIndexConfig = {
				dbPath: ".roo/local-index.db",
				workspacePath,
				enableFTS: true,
			}
			this.instances.set(workspacePath, new LocalCodeIndexManager(config, rooIgnoreController))
		}
		return this.instances.get(workspacePath)!
	}

	/**
	 * 清除指定工作区的实例
	 */
	static clearInstance(workspacePath: string): void {
		const instance = this.instances.get(workspacePath)
		if (instance) {
			instance.dispose()
			this.instances.delete(workspacePath)
		}
	}

	/**
	 * 清除所有实例
	 */
	static clearAllInstances(): void {
		this.instances.forEach((instance) => instance.dispose())
		this.instances.clear()
	}

	/**
	 * 索引整个工作区
	 */
	async indexWorkspace(onProgress?: (progress: IndexProgress) => void): Promise<void> {
		await this.indexer.indexWorkspace(this.config.workspacePath, onProgress)
	}

	/**
	 * 索引单个文件
	 */
	async indexFile(filePath: string): Promise<void> {
		await this.indexer.indexFile(filePath)
	}

	/**
	 * 删除文件索引
	 */
	async removeFile(filePath: string): Promise<void> {
		await this.indexer.removeFile(filePath)
	}

	/**
	 * 搜索代码
	 */
	search(query: string, options?: SearchOptions): FormattedSearchResult[] {
		return this.searcher.search(query, options)
	}

	/**
	 * 按名称搜索
	 */
	searchByName(name: string, options?: SearchOptions): FormattedSearchResult[] {
		return this.searcher.searchByName(name, options)
	}

	/**
	 * 搜索函数
	 */
	searchFunctions(query: string, options?: SearchOptions): FormattedSearchResult[] {
		return this.searcher.searchFunctions(query, options)
	}

	/**
	 * 搜索类
	 */
	searchClasses(query: string, options?: SearchOptions): FormattedSearchResult[] {
		return this.searcher.searchClasses(query, options)
	}

	/**
	 * 获取统计信息
	 */
	getStats(): {
		totalFiles: number
		totalBlocks: number
		dbSize: number
		lastIndexed: number
		indexStatus: string
	} {
		const stats = this.database.getStats()
		const lastIndexed = parseInt(this.database.getMetadata("last_full_index") || "0")
		const indexStatus = this.database.getMetadata("index_status") || "uninitialized"

		return {
			...stats,
			lastIndexed,
			indexStatus,
		}
	}

	/**
	 * 清空索引
	 */
	clear(): void {
		this.database.clear()
		this.database.setMetadata("index_status", "uninitialized")
	}

	/**
	 * 检查是否已初始化
	 */
	isInitialized(): boolean {
		const status = this.database.getMetadata("index_status")
		return status === "indexed"
	}

	/**
	 * 关闭数据库连接
	 */
	dispose(): void {
		this.database.close()
	}

	/**
	 * 获取数据库路径
	 */
	get dbPath(): string {
		return this.database.dbPath
	}
}
