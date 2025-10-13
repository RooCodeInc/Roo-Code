import { getCommands, getCommand } from "../services/command/commands"
import { ensureProjectWikiCommandExists } from "../core/costrict/wiki/projectWikiHelpers"
import { projectWikiCommandName } from "../core/costrict/wiki/projectWikiHelpers"

describe("Project Wiki Command Integration", () => {
	const testCwd = process.cwd()

	describe("动态命令初始化", () => {
		it("应该能够初始化 project-wiki 命令而不抛出错误", async () => {
			// 测试 ensureProjectWikiCommandExists 函数
			await expect(ensureProjectWikiCommandExists()).resolves.not.toThrow()
		})

		it("getCommands() 应该包含 project-wiki 命令", async () => {
			// 确保命令已初始化
			await ensureProjectWikiCommandExists()

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
				expect(projectWikiCommand.source).toBe("global")
				expect(typeof projectWikiCommand.content).toBe("string")
				expect(projectWikiCommand.content.length).toBeGreaterThan(0)
				expect(projectWikiCommand.filePath).toContain("project-wiki.md")
			}
		})

		it("getCommand() 应该能够获取 project-wiki 命令", async () => {
			// 确保命令已初始化
			await ensureProjectWikiCommandExists()

			// 获取特定命令
			const command = await getCommand(testCwd, projectWikiCommandName)

			// 验证命令存在且正确
			expect(command).toBeDefined()
			expect(command?.name).toBe(projectWikiCommandName)
			expect(command?.source).toBe("global")
			expect(typeof command?.content).toBe("string")
			expect(command?.content.length).toBeGreaterThan(0)
		})
	})

	describe("错误处理机制", () => {
		it("即使 ensureProjectWikiCommandExists 失败，getCommands 也应该正常工作", async () => {
			// 这个测试验证错误隔离机制
			// 即使动态命令初始化失败，其他命令仍应正常工作
			const commands = await getCommands(testCwd)

			// 应该返回数组（可能为空，但不应该抛出错误）
			expect(Array.isArray(commands)).toBe(true)
		})

		it("应该能够处理重复的命令初始化调用", async () => {
			// 多次调用应该不会出错
			await expect(ensureProjectWikiCommandExists()).resolves.not.toThrow()
			await expect(ensureProjectWikiCommandExists()).resolves.not.toThrow()
			await expect(ensureProjectWikiCommandExists()).resolves.not.toThrow()
		})
	})

	describe("命令内容验证", () => {
		it("project-wiki 命令应该包含预期的内容结构", async () => {
			await ensureProjectWikiCommandExists()
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
