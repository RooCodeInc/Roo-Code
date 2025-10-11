import Database from "better-sqlite3"
import * as path from "path"
import * as fs from "fs"
import type { ParsedCodeBlock, ParsedImport, FileRecord, CodeBlockRecord, SearchResult, SearchOptions } from "./types"

/**
 * 本地代码索引数据库
 * 使用 SQLite3 + FTS5 实现基于AST的代码索引
 */
export class LocalCodeIndexDatabase {
	private db: Database.Database

	constructor(dbPath: string) {
		// 确保目录存在
		const dir = path.dirname(dbPath)
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true })
		}

		this.db = new Database(dbPath)
		this.initialize()
	}

	/**
	 * 初始化数据库（创建表和索引）
	 */
	private initialize(): void {
		// 启用外键约束
		this.db.pragma("foreign_keys = ON")

		// 启用 WAL 模式提升并发性能
		this.db.pragma("journal_mode = WAL")

		// 设置缓存大小 (64MB)
		this.db.pragma("cache_size = -64000")

		// 创建 files 表
		this.db.exec(`
            CREATE TABLE IF NOT EXISTS files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT NOT NULL UNIQUE,
                file_hash TEXT NOT NULL,
                language TEXT NOT NULL,
                last_indexed_at INTEGER NOT NULL,
                line_count INTEGER NOT NULL,
                size_bytes INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_file_path ON files(file_path);
            CREATE INDEX IF NOT EXISTS idx_file_hash ON files(file_hash);
            CREATE INDEX IF NOT EXISTS idx_language ON files(language);
        `)

		// 创建 code_blocks 表
		this.db.exec(`
            CREATE TABLE IF NOT EXISTS code_blocks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_id INTEGER NOT NULL,
                block_type TEXT NOT NULL,
                name TEXT NOT NULL,
                full_name TEXT,
                start_line INTEGER NOT NULL,
                end_line INTEGER NOT NULL,
                start_column INTEGER,
                end_column INTEGER,
                content TEXT NOT NULL,
                signature TEXT,
                doc_comment TEXT,
                parent_id INTEGER,
                modifiers TEXT,
                parameters TEXT,
                return_type TEXT,
                FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
                FOREIGN KEY (parent_id) REFERENCES code_blocks(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_file_id ON code_blocks(file_id);
            CREATE INDEX IF NOT EXISTS idx_block_type ON code_blocks(block_type);
            CREATE INDEX IF NOT EXISTS idx_name ON code_blocks(name);
            CREATE INDEX IF NOT EXISTS idx_full_name ON code_blocks(full_name);
            CREATE INDEX IF NOT EXISTS idx_parent_id ON code_blocks(parent_id);
            CREATE INDEX IF NOT EXISTS idx_block_type_file ON code_blocks(block_type, file_id);
            CREATE INDEX IF NOT EXISTS idx_name_type ON code_blocks(name, block_type);
        `)

		// 创建 FTS5 虚拟表
		this.db.exec(`
            CREATE VIRTUAL TABLE IF NOT EXISTS code_blocks_fts USING fts5(
                block_id UNINDEXED,
                name,
                full_name,
                content,
                doc_comment,
                signature,
                tokenize = 'porter unicode61 remove_diacritics 1'
            );
        `)

		// 创建触发器: 插入时同步到 FTS 表
		this.db.exec(`
            CREATE TRIGGER IF NOT EXISTS code_blocks_ai AFTER INSERT ON code_blocks BEGIN
                INSERT INTO code_blocks_fts(block_id, name, full_name, content, doc_comment, signature)
                VALUES (new.id, new.name, new.full_name, new.content, new.doc_comment, new.signature);
            END;
        `)

		// 创建触发器: 删除时同步删除 FTS 记录
		this.db.exec(`
            CREATE TRIGGER IF NOT EXISTS code_blocks_ad AFTER DELETE ON code_blocks BEGIN
                DELETE FROM code_blocks_fts WHERE block_id = old.id;
            END;
        `)

		// 创建触发器: 更新时同步更新 FTS 记录
		this.db.exec(`
            CREATE TRIGGER IF NOT EXISTS code_blocks_au AFTER UPDATE ON code_blocks BEGIN
                DELETE FROM code_blocks_fts WHERE block_id = old.id;
                INSERT INTO code_blocks_fts(block_id, name, full_name, content, doc_comment, signature)
                VALUES (new.id, new.name, new.full_name, new.content, new.doc_comment, new.signature);
            END;
        `)

		// 创建 imports 表
		this.db.exec(`
            CREATE TABLE IF NOT EXISTS imports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_id INTEGER NOT NULL,
                import_path TEXT NOT NULL,
                import_type TEXT NOT NULL,
                imported_names TEXT,
                line_number INTEGER NOT NULL,
                FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_import_file_id ON imports(file_id);
            CREATE INDEX IF NOT EXISTS idx_import_path ON imports(import_path);
        `)

		// 创建 metadata 表
		this.db.exec(`
            CREATE TABLE IF NOT EXISTS index_metadata (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );
        `)

		// 初始化元数据
		const initMetadata = this.db.prepare(`
            INSERT OR IGNORE INTO index_metadata (key, value, updated_at) VALUES (?, ?, ?)
        `)

		const now = Date.now()
		initMetadata.run("schema_version", "1", now)
		initMetadata.run("last_full_index", "0", 0)
		initMetadata.run("total_files", "0", 0)
		initMetadata.run("total_blocks", "0", 0)
		initMetadata.run("index_status", "uninitialized", now)

		// 分析表统计信息以优化查询
		this.db.exec("ANALYZE")
	}

	/**
	 * 插入或更新文件记录
	 */
	upsertFile(fileData: Omit<FileRecord, "id">): number {
		const stmt = this.db.prepare(`
            INSERT INTO files (file_path, file_hash, language, last_indexed_at, line_count, size_bytes)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(file_path) DO UPDATE SET
                file_hash = excluded.file_hash,
                language = excluded.language,
                last_indexed_at = excluded.last_indexed_at,
                line_count = excluded.line_count,
                size_bytes = excluded.size_bytes
            RETURNING id
        `)

		const result = stmt.get(
			fileData.filePath,
			fileData.fileHash,
			fileData.language,
			fileData.lastIndexedAt,
			fileData.lineCount,
			fileData.sizeBytes,
		) as { id: number }

		return result.id
	}

	/**
	 * 批量插入代码块
	 */
	insertCodeBlocks(fileId: number, blocks: ParsedCodeBlock[]): void {
		// 先删除该文件的旧代码块
		this.db.prepare("DELETE FROM code_blocks WHERE file_id = ?").run(fileId)

		if (blocks.length === 0) return

		// 批量插入新代码块
		const insertStmt = this.db.prepare(`
            INSERT INTO code_blocks (
                file_id, block_type, name, full_name,
                start_line, end_line, start_column, end_column,
                content, signature, doc_comment, parent_id,
                modifiers, parameters, return_type
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)

		const insertMany = this.db.transaction((blocks: ParsedCodeBlock[]) => {
			for (const block of blocks) {
				insertStmt.run(
					fileId,
					block.type,
					block.name,
					block.fullName || null,
					block.startLine,
					block.endLine,
					block.startColumn || null,
					block.endColumn || null,
					block.content,
					block.signature || null,
					block.docComment || null,
					block.parentId || null,
					JSON.stringify(block.modifiers),
					JSON.stringify(block.parameters || null),
					block.returnType || null,
				)
			}
		})

		insertMany(blocks)
	}

	/**
	 * 批量插入导入记录
	 */
	insertImports(fileId: number, imports: ParsedImport[]): void {
		// 先删除该文件的旧导入记录
		this.db.prepare("DELETE FROM imports WHERE file_id = ?").run(fileId)

		if (imports.length === 0) return

		const insertStmt = this.db.prepare(`
            INSERT INTO imports (file_id, import_path, import_type, imported_names, line_number)
            VALUES (?, ?, ?, ?, ?)
        `)

		const insertMany = this.db.transaction((imports: ParsedImport[]) => {
			for (const imp of imports) {
				insertStmt.run(
					fileId,
					imp.importPath,
					imp.importType,
					JSON.stringify(imp.importedNames || null),
					imp.lineNumber,
				)
			}
		})

		insertMany(imports)
	}

	/**
	 * 全文搜索
	 */
	search(query: string, options?: SearchOptions): SearchResult[] {
		const limit = options?.limit || 20

		let sql = `
            SELECT 
                cb.*,
                f.*,
                fts.rank as score,
                cb.id as block_id,
                f.id as file_id
            FROM code_blocks_fts fts
            JOIN code_blocks cb ON cb.id = fts.block_id
            JOIN files f ON f.id = cb.file_id
            WHERE code_blocks_fts MATCH ?
        `

		const params: any[] = [query]

		if (options?.blockTypes && options.blockTypes.length > 0) {
			sql += ` AND cb.block_type IN (${options.blockTypes.map(() => "?").join(",")})`
			params.push(...options.blockTypes)
		}

		if (options?.languages && options.languages.length > 0) {
			sql += ` AND f.language IN (${options.languages.map(() => "?").join(",")})`
			params.push(...options.languages)
		}

		sql += ` ORDER BY fts.rank LIMIT ?`
		params.push(limit)

		const stmt = this.db.prepare(sql)
		const rows = stmt.all(...params) as any[]

		return rows.map((row) => ({
			codeBlock: {
				id: row.block_id,
				fileId: row.file_id,
				type: row.block_type,
				name: row.name,
				fullName: row.full_name,
				startLine: row.start_line,
				endLine: row.end_line,
				startColumn: row.start_column,
				endColumn: row.end_column,
				content: row.content,
				signature: row.signature,
				docComment: row.doc_comment,
				parentId: row.parent_id,
				modifiers: JSON.parse(row.modifiers),
				parameters: JSON.parse(row.parameters),
				returnType: row.return_type,
			},
			file: {
				id: row.file_id,
				filePath: row.file_path,
				fileHash: row.file_hash,
				language: row.language,
				lastIndexedAt: row.last_indexed_at,
				lineCount: row.line_count,
				sizeBytes: row.size_bytes,
			},
			score: row.score,
		}))
	}

	/**
	 * 根据文件路径查找文件
	 */
	getFileByPath(filePath: string): FileRecord | null {
		const stmt = this.db.prepare("SELECT * FROM files WHERE file_path = ?")
		const row = stmt.get(filePath) as any

		if (!row) return null

		return {
			id: row.id,
			filePath: row.file_path,
			fileHash: row.file_hash,
			language: row.language,
			lastIndexedAt: row.last_indexed_at,
			lineCount: row.line_count,
			sizeBytes: row.size_bytes,
		}
	}

	/**
	 * 删除文件及其关联数据
	 */
	deleteFile(filePath: string): void {
		this.db.prepare("DELETE FROM files WHERE file_path = ?").run(filePath)
	}

	/**
	 * 获取统计信息
	 */
	getStats(): { totalFiles: number; totalBlocks: number; dbSize: number } {
		const filesStmt = this.db.prepare("SELECT COUNT(*) as count FROM files")
		const blocksStmt = this.db.prepare("SELECT COUNT(*) as count FROM code_blocks")

		const filesResult = filesStmt.get() as { count: number }
		const blocksResult = blocksStmt.get() as { count: number }

		// 获取数据库文件大小
		const dbSize = fs.statSync(this.db.name).size

		return {
			totalFiles: filesResult.count,
			totalBlocks: blocksResult.count,
			dbSize,
		}
	}

	/**
	 * 清空所有数据
	 */
	clear(): void {
		this.db.exec(`
            DELETE FROM code_blocks;
            DELETE FROM files;
            DELETE FROM imports;
            DELETE FROM code_blocks_fts;
        `)
	}

	/**
	 * 更新元数据
	 */
	setMetadata(key: string, value: string): void {
		const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO index_metadata (key, value, updated_at)
            VALUES (?, ?, ?)
        `)
		stmt.run(key, value, Date.now())
	}

	/**
	 * 获取元数据
	 */
	getMetadata(key: string): string | null {
		const stmt = this.db.prepare("SELECT value FROM index_metadata WHERE key = ?")
		const result = stmt.get(key) as { value: string } | undefined
		return result?.value || null
	}

	/**
	 * 关闭数据库
	 */
	close(): void {
		this.db.close()
	}

	/**
	 * 获取数据库路径
	 */
	get dbPath(): string {
		return this.db.name
	}
}
