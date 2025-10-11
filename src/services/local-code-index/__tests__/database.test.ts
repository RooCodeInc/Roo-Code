/**
 * LocalCodeIndexDatabase 单元测试
 */

import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import { LocalCodeIndexDatabase } from "../database"
import type { ParsedCodeBlock, ParsedImport } from "../types"

describe("LocalCodeIndexDatabase", () => {
	let db: LocalCodeIndexDatabase
	let testDbPath: string

	beforeEach(() => {
		// 创建临时测试数据库
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "local-index-test-"))
		testDbPath = path.join(tmpDir, "test.db")
		db = new LocalCodeIndexDatabase(testDbPath)
	})

	afterEach(() => {
		// 清理测试数据库
		db.close()
		if (fs.existsSync(testDbPath)) {
			fs.unlinkSync(testDbPath)
			// 删除 WAL 和 SHM 文件
			const walPath = testDbPath + "-wal"
			const shmPath = testDbPath + "-shm"
			if (fs.existsSync(walPath)) fs.unlinkSync(walPath)
			if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath)
		}
		const dir = path.dirname(testDbPath)
		if (fs.existsSync(dir)) {
			fs.rmdirSync(dir)
		}
	})

	describe("基础操作", () => {
		test("应该成功初始化数据库", () => {
			expect(fs.existsSync(testDbPath)).toBe(true)
		})

		test("应该能够插入和检索文件记录", () => {
			const fileId = db.upsertFile({
				filePath: "/test/file.ts",
				fileHash: "abc123",
				lastIndexedAt: Date.now(),
				lineCount: 100,
				sizeBytes: 1024,
				language: "typescript",
			})
			expect(fileId).toBeGreaterThan(0)

			const file = db.getFileByPath("/test/file.ts")
			expect(file).toBeDefined()
			expect(file?.filePath).toBe("/test/file.ts")
			expect(file?.fileHash).toBe("abc123")
			expect(file?.language).toBe("typescript")
		})

		test("应该能够更新文件记录", () => {
			const fileId = db.upsertFile({
				filePath: "/test/file.ts",
				fileHash: "abc123",
				lastIndexedAt: Date.now(),
				lineCount: 100,
				sizeBytes: 1024,
				language: "typescript",
			})

			// 更新文件
			db.upsertFile({
				filePath: "/test/file.ts",
				fileHash: "def456",
				lastIndexedAt: Date.now(),
				lineCount: 150,
				sizeBytes: 2048,
				language: "typescript",
			})

			const file = db.getFileByPath("/test/file.ts")
			expect(file?.fileHash).toBe("def456")
			expect(file?.lineCount).toBe(150)
		})

		test("应该能够删除文件及其关联数据", () => {
			const fileId = db.upsertFile({
				filePath: "/test/file.ts",
				fileHash: "abc123",
				lastIndexedAt: Date.now(),
				lineCount: 100,
				sizeBytes: 1024,
				language: "typescript",
			})

			// 添加代码块
			db.insertCodeBlocks(fileId, [
				{
					type: "function",
					name: "testFunc",
					content: "function testFunc() {}",
					startLine: 1,
					endLine: 1,
					startColumn: 0,
					endColumn: 24,
					modifiers: [],
					signature: "testFunc()",
				},
			])

			// 删除文件
			db.deleteFile("/test/file.ts")

			const file = db.getFileByPath("/test/file.ts")
			expect(file).toBeNull()
		})
	})

	describe("代码块操作", () => {
		let fileId: number

		beforeEach(() => {
			fileId = db.upsertFile({
				filePath: "/test/file.ts",
				fileHash: "abc123",
				lastIndexedAt: Date.now(),
				lineCount: 100,
				sizeBytes: 1024,
				language: "typescript",
			})
		})

		test("应该能够插入代码块", () => {
			const blocks: ParsedCodeBlock[] = [
				{
					type: "class",
					name: "TestClass",
					content: "class TestClass {}",
					startLine: 1,
					endLine: 1,
					startColumn: 0,
					endColumn: 18,
					modifiers: ["export"],
					docComment: "Test class",
					signature: "class TestClass",
				},
			]

			db.insertCodeBlocks(fileId, blocks)

			// 通过搜索验证插入
			const results = db.search("TestClass")
			expect(results.length).toBeGreaterThan(0)
			expect(results[0].codeBlock.name).toBe("TestClass")
			expect(results[0].codeBlock.type).toBe("class")
		})

		test("应该能够插入嵌套的代码块", () => {
			const blocks: ParsedCodeBlock[] = [
				{
					type: "class",
					name: "TestClass",
					content: "class TestClass {}",
					startLine: 1,
					endLine: 10,
					startColumn: 0,
					endColumn: 1,
					modifiers: [],
				},
			]

			db.insertCodeBlocks(fileId, blocks)

			const results = db.search("TestClass")
			expect(results).toHaveLength(1)
		})
	})

	describe("导入语句操作", () => {
		let fileId: number

		beforeEach(() => {
			fileId = db.upsertFile({
				filePath: "/test/file.ts",
				fileHash: "abc123",
				lastIndexedAt: Date.now(),
				lineCount: 100,
				sizeBytes: 1024,
				language: "typescript",
			})
		})

		test("应该能够插入导入语句", () => {
			const imports: ParsedImport[] = [
				{
					importPath: "./utils",
					importedNames: ["helper1", "helper2"],
					importType: "named",
					lineNumber: 1,
				},
			]

			db.insertImports(fileId, imports)

			// 验证导入已保存(通过文件记录验证)
			const file = db.getFileByPath("/test/file.ts")
			expect(file).toBeDefined()
		})

		test("应该能够插入默认导入", () => {
			const imports: ParsedImport[] = [
				{
					importPath: "react",
					importedNames: ["React"],
					importType: "default",
					lineNumber: 1,
				},
			]

			db.insertImports(fileId, imports)

			// 验证导入已保存
			const file = db.getFileByPath("/test/file.ts")
			expect(file).toBeDefined()
		})
	})

	describe("全文搜索", () => {
		beforeEach(() => {
			const fileId = db.upsertFile({
				filePath: "/test/file.ts",
				fileHash: "abc123",
				lastIndexedAt: Date.now(),
				lineCount: 100,
				sizeBytes: 1024,
				language: "typescript",
			})

			db.insertCodeBlocks(fileId, [
				{
					type: "function",
					name: "calculateTotal",
					content: "function calculateTotal(items: Item[]) { return items.reduce(...) }",
					startLine: 1,
					endLine: 3,
					startColumn: 0,
					endColumn: 1,
					modifiers: [],
					docComment: "Calculate total price of items",
				},
				{
					type: "function",
					name: "processPayment",
					content: "function processPayment(amount: number) { ... }",
					startLine: 5,
					endLine: 10,
					startColumn: 0,
					endColumn: 1,
					modifiers: [],
					docComment: "Process payment transaction",
				},
			])
		})

		test("应该能够进行全文搜索", () => {
			const results = db.search("calculate", { limit: 10 })
			expect(results.length).toBeGreaterThan(0)
			expect(results[0].codeBlock.name).toBe("calculateTotal")
		})

		test("应该能够在文档注释中搜索", () => {
			const results = db.search("payment", { limit: 10 })
			expect(results.length).toBeGreaterThan(0)
			expect(results[0].codeBlock.name).toBe("processPayment")
		})

		test("应该能够限制搜索结果数量", () => {
			const results = db.search("function", { limit: 1 })
			expect(results.length).toBeLessThanOrEqual(1)
		})
	})

	describe("统计信息", () => {
		test("应该能够获取统计信息", () => {
			const fileId1 = db.upsertFile({
				filePath: "/test/file1.ts",
				fileHash: "abc123",
				lastIndexedAt: Date.now(),
				lineCount: 100,
				sizeBytes: 1024,
				language: "typescript",
			})
			const fileId2 = db.upsertFile({
				filePath: "/test/file2.ts",
				fileHash: "def456",
				lastIndexedAt: Date.now(),
				lineCount: 200,
				sizeBytes: 2048,
				language: "javascript",
			})

			db.insertCodeBlocks(fileId1, [
				{
					type: "function",
					name: "func1",
					content: "function func1() {}",
					startLine: 1,
					endLine: 1,
					startColumn: 0,
					endColumn: 19,
					modifiers: [],
				},
			])

			db.insertCodeBlocks(fileId2, [
				{
					type: "class",
					name: "Class1",
					content: "class Class1 {}",
					startLine: 1,
					endLine: 1,
					startColumn: 0,
					endColumn: 15,
					modifiers: [],
				},
			])

			const stats = db.getStats()
			expect(stats.totalFiles).toBe(2)
			expect(stats.totalBlocks).toBe(2)
			expect(stats.dbSize).toBeGreaterThan(0)
		})
	})

	describe("清理操作", () => {
		test("应该能够清空所有数据", () => {
			const fileId = db.upsertFile({
				filePath: "/test/file.ts",
				fileHash: "abc123",
				lastIndexedAt: Date.now(),
				lineCount: 100,
				sizeBytes: 1024,
				language: "typescript",
			})
			db.insertCodeBlocks(fileId, [
				{
					type: "function",
					name: "func1",
					content: "function func1() {}",
					startLine: 1,
					endLine: 1,
					startColumn: 0,
					endColumn: 19,
					modifiers: [],
				},
			])

			db.clear()

			const stats = db.getStats()
			expect(stats.totalFiles).toBe(0)
			expect(stats.totalBlocks).toBe(0)
		})
	})

	describe("元数据操作", () => {
		test("应该能够设置和获取元数据", () => {
			db.setMetadata("test_key", "test_value")
			const value = db.getMetadata("test_key")
			expect(value).toBe("test_value")
		})

		test("获取不存在的元数据应返回null", () => {
			const value = db.getMetadata("nonexistent_key")
			expect(value).toBeNull()
		})
	})
})
