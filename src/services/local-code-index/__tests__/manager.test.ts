/**
 * LocalCodeIndexManager 单例模式和集成测试
 */

import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import { LocalCodeIndexManager } from "../manager"

describe("LocalCodeIndexManager", () => {
	let testWorkspacePath: string

	beforeEach(() => {
		// 创建临时测试工作区
		testWorkspacePath = fs.mkdtempSync(path.join(os.tmpdir(), "local-manager-test-"))
	})

	afterEach(() => {
		// 清理所有实例
		LocalCodeIndexManager.clearAllInstances()

		// 清理测试目录
		if (fs.existsSync(testWorkspacePath)) {
			// 递归删除目录
			const removeDir = (dirPath: string) => {
				if (fs.existsSync(dirPath)) {
					fs.readdirSync(dirPath).forEach((file) => {
						const curPath = path.join(dirPath, file)
						if (fs.lstatSync(curPath).isDirectory()) {
							removeDir(curPath)
						} else {
							fs.unlinkSync(curPath)
						}
					})
					fs.rmdirSync(dirPath)
				}
			}
			removeDir(testWorkspacePath)
		}
	})

	describe("单例模式", () => {
		test("应该为同一工作区返回相同的实例", () => {
			const instance1 = LocalCodeIndexManager.getInstance(testWorkspacePath)
			const instance2 = LocalCodeIndexManager.getInstance(testWorkspacePath)

			expect(instance1).toBe(instance2)
		})

		test("应该为不同工作区返回不同的实例", () => {
			const testWorkspacePath2 = fs.mkdtempSync(path.join(os.tmpdir(), "local-manager-test-2-"))

			try {
				const instance1 = LocalCodeIndexManager.getInstance(testWorkspacePath)
				const instance2 = LocalCodeIndexManager.getInstance(testWorkspacePath2)

				expect(instance1).not.toBe(instance2)
			} finally {
				// 清理第二个工作区
				LocalCodeIndexManager.clearInstance(testWorkspacePath2)
				if (fs.existsSync(testWorkspacePath2)) {
					const rooDir = path.join(testWorkspacePath2, ".roo")
					if (fs.existsSync(rooDir)) {
						const dbPath = path.join(rooDir, "local-index.db")
						if (fs.existsSync(dbPath)) {
							fs.unlinkSync(dbPath)
							const walPath = dbPath + "-wal"
							const shmPath = dbPath + "-shm"
							if (fs.existsSync(walPath)) fs.unlinkSync(walPath)
							if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath)
						}
						fs.rmdirSync(rooDir)
					}
					fs.rmdirSync(testWorkspacePath2)
				}
			}
		})

		test("应该能够清除指定工作区的实例", () => {
			const instance1 = LocalCodeIndexManager.getInstance(testWorkspacePath)
			expect(instance1).toBeDefined()

			LocalCodeIndexManager.clearInstance(testWorkspacePath)

			const instance2 = LocalCodeIndexManager.getInstance(testWorkspacePath)
			expect(instance2).not.toBe(instance1)
		})

		test("应该能够清除所有实例", () => {
			const testWorkspacePath2 = fs.mkdtempSync(path.join(os.tmpdir(), "local-manager-test-2-"))

			try {
				const instance1 = LocalCodeIndexManager.getInstance(testWorkspacePath)
				const instance2 = LocalCodeIndexManager.getInstance(testWorkspacePath2)

				LocalCodeIndexManager.clearAllInstances()

				const instance3 = LocalCodeIndexManager.getInstance(testWorkspacePath)
				const instance4 = LocalCodeIndexManager.getInstance(testWorkspacePath2)

				expect(instance3).not.toBe(instance1)
				expect(instance4).not.toBe(instance2)
			} finally {
				LocalCodeIndexManager.clearInstance(testWorkspacePath2)
				if (fs.existsSync(testWorkspacePath2)) {
					const rooDir = path.join(testWorkspacePath2, ".roo")
					if (fs.existsSync(rooDir)) {
						const dbPath = path.join(rooDir, "local-index.db")
						if (fs.existsSync(dbPath)) {
							fs.unlinkSync(dbPath)
							const walPath = dbPath + "-wal"
							const shmPath = dbPath + "-shm"
							if (fs.existsSync(walPath)) fs.unlinkSync(walPath)
							if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath)
						}
						fs.rmdirSync(rooDir)
					}
					fs.rmdirSync(testWorkspacePath2)
				}
			}
		})
	})

	describe("基础功能", () => {
		test("应该能够获取统计信息", () => {
			const manager = LocalCodeIndexManager.getInstance(testWorkspacePath)

			const stats = manager.getStats()
			expect(stats).toBeDefined()
			expect(stats.totalFiles).toBe(0)
			expect(stats.totalBlocks).toBe(0)
			expect(stats.indexStatus).toBe("uninitialized")
		})

		test("应该能够检查初始化状态", () => {
			const manager = LocalCodeIndexManager.getInstance(testWorkspacePath)

			expect(manager.isInitialized()).toBe(false)
		})

		test("应该能够清空索引", () => {
			const manager = LocalCodeIndexManager.getInstance(testWorkspacePath)

			manager.clear()

			const stats = manager.getStats()
			expect(stats.totalFiles).toBe(0)
			expect(stats.totalBlocks).toBe(0)
		})

		test("应该能够执行搜索(空结果)", () => {
			const manager = LocalCodeIndexManager.getInstance(testWorkspacePath)

			const results = manager.search("test")
			expect(results).toEqual([])
		})

		test("应该能够获取数据库路径", () => {
			const manager = LocalCodeIndexManager.getInstance(testWorkspacePath)

			const dbPath = manager.dbPath
			expect(dbPath).toContain(".roo")
			expect(dbPath).toContain("local-index.db")
		})
	})

	// 注意: 索引功能测试需要 tree-sitter wasm 文件,在单元测试环境中可能无法正常工作
	// 这些功能应该在集成测试或实际运行环境中验证
})
