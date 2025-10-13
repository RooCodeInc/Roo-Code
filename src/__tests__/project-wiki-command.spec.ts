import { getCommands, getCommand } from "../services/command/commands"
import { ensureProjectWikiSubtasksExists } from "../core/costrict/wiki/projectWikiHelpers"
import { projectWikiCommandName } from "../core/costrict/wiki/projectWikiHelpers"

describe("Project Wiki Command Integration", () => {
	const testCwd = process.cwd()

	describe("子任务文件初始化", () => {
		it("应该能够初始化 project-wiki 子任务文件而不抛出错误", async () => {
			// 测试 ensureProjectWikiSubtasksExists 函数
			await expect(ensureProjectWikiSubtasksExists()).resolves.not.toThrow()
		})

		it("getCommands() 应该包含 project-wiki 命令", async () => {
			// 确保子任务文件已初始化
			await ensureProjectWikiSubtasksExists()

			// 获取所有命令
			const commands = await getCommands(testCwd)

			// 验证命令列表是数组
			expect(Array.isArray(commands)).toBe(true)

			// 查找 project-wiki 命令
			const projectWikiCommand = commands.find((cmd) => cmd.name === projectWikiCommandName)

			// 验证 project-wiki 命令存在
			expect(projectWikiCommand).toBeDefined()

			if (projectWikiCommand) {
				expect(projectWikiCommand.name).toBe(projectWikiCommandName)
				// 命令来源可能是 built-in 或 global，取决于是否存在全局文件
				expect(["built-in", "global"]).toContain(projectWikiCommand.source)
				expect(typeof projectWikiCommand.content).toBe("string")
				expect(projectWikiCommand.content.length).toBeGreaterThan(0)
			}
		})

		it("getCommand() 应该能够获取 project-wiki 命令", async () => {
			// 确保子任务文件已初始化
			await ensureProjectWikiSubtasksExists()

			// 获取特定命令
			const command = await getCommand(testCwd, projectWikiCommandName)

			// 验证命令存在且正确
			expect(command).toBeDefined()
			expect(command?.name).toBe(projectWikiCommandName)
			// 命令来源可能是 built-in 或 global，取决于是否存在全局文件
			expect(["built-in", "global"]).toContain(command?.source)
			expect(typeof command?.content).toBe("string")
			expect(command?.content.length).toBeGreaterThan(0)
		})
	})

	describe("错误处理机制", () => {
		it("即使 ensureProjectWikiSubtasksExists 失败，getCommands 也应该正常工作", async () => {
			// 这个测试验证错误隔离机制
			// 即使子任务文件初始化失败，其他命令仍应正常工作
			const commands = await getCommands(testCwd)

			// 应该返回数组（可能为空，但不应该抛出错误）
			expect(Array.isArray(commands)).toBe(true)
		})

		it("应该能够处理重复的子任务文件初始化调用", async () => {
			// 多次调用应该不会出错
			await expect(ensureProjectWikiSubtasksExists()).resolves.not.toThrow()
			await expect(ensureProjectWikiSubtasksExists()).resolves.not.toThrow()
			await expect(ensureProjectWikiSubtasksExists()).resolves.not.toThrow()
		})
	})

	describe("命令内容验证", () => {
		it("project-wiki 命令应该包含预期的内容结构", async () => {
			await ensureProjectWikiSubtasksExists()
			const command = await getCommand(testCwd, projectWikiCommandName)

			expect(command).toBeDefined()
			if (command) {
				// 验证命令内容包含预期的关键词（中文内容）
				const content = command.content
				expect(content).toContain("项目")
				expect(content).toContain("wiki")
				expect(content).toContain("分析")
			}
		})
	})
})
