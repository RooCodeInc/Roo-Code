import { LocalASTParser } from "./ast-parser"
import { LocalCodeIndexDatabase } from "./database"
import { listFiles } from "../glob/list-files"
import type { RooIgnoreController } from "../../core/ignore/RooIgnoreController"
import * as crypto from "crypto"
import * as fs from "fs/promises"
import * as path from "path"
import type { IndexProgress } from "./types"

/**
 * 本地代码索引器
 * 负责扫描、解析和索引代码文件
 */
export class LocalIndexer {
	private parser: LocalASTParser
	private database: LocalCodeIndexDatabase
	private rooIgnoreController?: RooIgnoreController

	constructor(database: LocalCodeIndexDatabase, rooIgnoreController?: RooIgnoreController) {
		this.parser = new LocalASTParser()
		this.database = database
		this.rooIgnoreController = rooIgnoreController
	}

	/**
	 * 索引整个工作区
	 */
	async indexWorkspace(workspacePath: string, onProgress?: (progress: IndexProgress) => void): Promise<void> {
		// 阶段 1: 扫描文件
		onProgress?.({ phase: "scanning", current: 0, total: 0 })

		const [allFiles] = await listFiles(workspacePath, true, 10000)

		// 过滤代码文件
		const codeFiles = allFiles.filter((file) => {
			const ext = path.extname(file).toLowerCase()
			return [".ts", ".tsx", ".js", ".jsx", ".py", ".java", ".cpp", ".c", ".go", ".rs"].includes(ext)
		})

		// 应用 .rooignore 过滤
		const filteredFiles = this.rooIgnoreController ? this.rooIgnoreController.filterPaths(codeFiles) : codeFiles

		// 阶段 2: 初始化解析器
		await this.parser.initialize(filteredFiles)

		// 阶段 3: 解析和索引文件
		for (let i = 0; i < filteredFiles.length; i++) {
			const file = filteredFiles[i]

			onProgress?.({
				phase: "parsing",
				current: i + 1,
				total: filteredFiles.length,
				currentFile: path.basename(file),
			})

			try {
				await this.indexFile(file)
			} catch (error) {
				console.error(`Failed to index ${file}:`, error)
			}
		}

		// 更新元数据
		this.database.setMetadata("last_full_index", Date.now().toString())
		this.database.setMetadata("index_status", "indexed")

		const stats = this.database.getStats()
		this.database.setMetadata("total_files", stats.totalFiles.toString())
		this.database.setMetadata("total_blocks", stats.totalBlocks.toString())

		onProgress?.({ phase: "complete", current: filteredFiles.length, total: filteredFiles.length })
	}

	/**
	 * 索引单个文件
	 */
	async indexFile(filePath: string): Promise<void> {
		// 计算文件哈希
		const content = await fs.readFile(filePath, "utf8")
		const hash = crypto.createHash("sha256").update(content).digest("hex")

		// 检查文件是否已索引且未变更
		const existingFile = this.database.getFileByPath(filePath)
		if (existingFile && existingFile.fileHash === hash) {
			return // 文件未变更，跳过
		}

		// 初始化解析器(如果需要)
		await this.parser.initialize([filePath])

		// 解析文件
		const parseResult = await this.parser.parseFile(filePath)
		if (!parseResult) {
			return // 解析失败或不支持的文件类型
		}

		// 获取文件大小
		const stats = await fs.stat(filePath)

		// 插入/更新文件记录
		const fileId = this.database.upsertFile({
			filePath,
			fileHash: hash,
			language: parseResult.language,
			lastIndexedAt: Date.now(),
			lineCount: parseResult.lineCount,
			sizeBytes: stats.size,
		})

		// 插入代码块
		this.database.insertCodeBlocks(fileId, parseResult.codeBlocks)

		// 插入导入记录
		this.database.insertImports(fileId, parseResult.imports)
	}

	/**
	 * 删除文件索引
	 */
	async removeFile(filePath: string): Promise<void> {
		this.database.deleteFile(filePath)
	}

	/**
	 * 检查文件是否需要重新索引
	 */
	async needsReindex(filePath: string): Promise<boolean> {
		try {
			const content = await fs.readFile(filePath, "utf8")
			const hash = crypto.createHash("sha256").update(content).digest("hex")

			const existingFile = this.database.getFileByPath(filePath)
			if (!existingFile) {
				return true // 文件未索引
			}

			return existingFile.fileHash !== hash // 文件已变更
		} catch {
			return false // 文件不存在
		}
	}
}
