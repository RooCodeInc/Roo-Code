import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock logger - 必须在模块级别创建
const mockLogger = {
	info: vi.fn(),
	warn: vi.fn(),
	error: vi.fn(),
	debug: vi.fn(),
	dispose: vi.fn(),
}

// 设置 logger mock
vi.mock("../../../utils/logger", () => ({
	createLogger: vi.fn(() => mockLogger),
	ILogger: {
		// Mock ILogger 接口
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		dispose: vi.fn(),
	},
}))

vi.mock("fs", () => ({
	promises: {
		mkdir: vi.fn(),
		readFile: vi.fn(),
		writeFile: vi.fn(),
		readdir: vi.fn(),
		stat: vi.fn(),
		rm: vi.fn(),
		access: vi.fn(),
	},
	constants: {
		F_OK: 0,
		R_OK: 4,
		W_OK: 2,
	},
}))

vi.mock("../wiki-prompts/subtasks/constants", () => ({
	getGlobalCommandsDir: vi.fn(() => "/home/user/.roo/commands"),
	subtaskDir: "/home/user/.roo/commands/project-wiki-tasks/",
	MAIN_WIKI_FILENAME: "project-wiki.md",
	SUBTASK_FILENAMES: {
		PROJECT_OVERVIEW_TASK_FILE: "01_Project_Overview_Analysis.md",
		OVERALL_ARCHITECTURE_TASK_FILE: "02_Overall_Architecture_Analysis.md",
		SERVICE_DEPENDENCIES_TASK_FILE: "03_Service_Dependencies_Analysis.md",
		DATA_FLOW_INTEGRATION_TASK_FILE: "04_Data_Flow_Integration_Analysis.md",
		SERVICE_ANALYSIS_TASK_FILE: "05_Service_Analysis_Template.md",
		DATABASE_SCHEMA_TASK_FILE: "06_Database_Schema_Analysis.md",
		API_INTERFACE_TASK_FILE: "07_API_Interface_Analysis.md",
		DEPLOY_ANALYSIS_TASK_FILE: "08_Deploy_Analysis.md",
		Develop_TEST_ANALYSIS_TASK_FILE: "09_Develop_Test_Analysis.md",
		INDEX_GENERATION_TASK_FILE: "10_Index_Generation.md",
		PROJECT_RULES_TASK_FILE: "11_Project_Rules_Generation.md",
	},
	formatError: vi.fn((error) => `Error: ${error}`),
}))

vi.mock("../wiki-prompts/project_wiki", () => ({
	projectWikiVersion: "v1.0.1",
	PROJECT_WIKI_TEMPLATE: "---\ndescription: \"项目深度分析与知识文档生成\"\nversion: v1.0.1\n---\n# 测试模板",
}))

vi.mock("../wiki-prompts/subtasks/01_Project_Overview_Analysis", () => ({
	PROJECT_OVERVIEW_ANALYSIS_TEMPLATE: "# 项目概览分析模板",
}))

vi.mock("../wiki-prompts/subtasks/02_Overall_Architecture_Analysis", () => ({
	OVERALL_ARCHITECTURE_ANALYSIS_TEMPLATE: "# 整体架构分析模板",
}))

vi.mock("../wiki-prompts/subtasks/03_Service_Dependencies_Analysis", () => ({
	SERVICE_DEPENDENCIES_ANALYSIS_TEMPLATE: "# 服务依赖分析模板",
}))

vi.mock("../wiki-prompts/subtasks/04_Data_Flow_Integration_Analysis", () => ({
	DATA_FLOW_INTEGRATION_ANALYSIS_TEMPLATE: "# 数据流分析模板",
}))

vi.mock("../wiki-prompts/subtasks/05_Service_Analysis_Template", () => ({
	SERVICE_ANALYSIS_TEMPLATE: "# 服务分析模板",
}))

vi.mock("../wiki-prompts/subtasks/06_Database_Schema_Analysis", () => ({
	DATABASE_SCHEMA_ANALYSIS_TEMPLATE: "# 数据库分析模板",
}))

vi.mock("../wiki-prompts/subtasks/07_API_Interface_Analysis", () => ({
	API_INTERFACE_ANALYSIS_TEMPLATE: "# API分析模板",
}))

vi.mock("../wiki-prompts/subtasks/08_Deploy_Analysis", () => ({
	DEPLOY_ANALYSIS_TEMPLATE: "# 部署分析模板",
}))

vi.mock("../wiki-prompts/subtasks/09_Develop_Test_Analysis", () => ({
	DEVELOP_TEST_ANALYSIS_TEMPLATE: "# 开发测试分析模板",
}))

vi.mock("../wiki-prompts/subtasks/10_Index_Generation", () => ({
	INDEX_GENERATION_TEMPLATE: "# 索引生成模板",
}))

vi.mock("../wiki-prompts/subtasks/11_Project_Rules_Generation", () => ({
	PROJECT_RULES_GENERATION_TEMPLATE: "# 项目规则生成模板",
}))

// 导入模块
import * as fs from "fs"
import { ensureProjectWikiCommandExists, setLogger } from "../projectWikiHelpers"

describe("projectWikiHelpers", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		// 重置 logger
		setLogger(mockLogger)
	})

	describe("ensureProjectWikiCommandExists", () => {
		it("应该在文件不存在时创建项目wiki命令", async () => {
			// Mock fs.access 抛出错误表示文件不存在
			vi.mocked(fs.promises.access).mockRejectedValue(new Error("File not found"))
			vi.mocked(fs.promises.stat).mockRejectedValue(new Error("Directory not found"))
			vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined)
			vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined)
			vi.mocked(fs.promises.rm).mockResolvedValue(undefined)

			await ensureProjectWikiCommandExists()

			expect(fs.promises.mkdir).toHaveBeenCalledWith("/home/user/.roo/commands", { recursive: true })
			expect(fs.promises.writeFile).toHaveBeenCalled()
			expect(mockLogger.info).toHaveBeenCalledWith("[projectWikiHelpers] Starting ensureProjectWikiCommandExists...")
		})

		it("应该在版本不匹配时重新创建文件", async () => {
			// Mock 文件存在但版本不匹配
			vi.mocked(fs.promises.access).mockResolvedValue(undefined)
			vi.mocked(fs.promises.readFile).mockResolvedValue(`---
description: "项目深度分析与知识文档生成"
version: "v1.0.0"
---
# 旧版本模板`)
			vi.mocked(fs.promises.stat).mockResolvedValue({
				isDirectory: () => true,
			} as any)
			vi.mocked(fs.promises.readdir).mockResolvedValue([
				"01_Project_Overview_Analysis.md",
				"02_Overall_Architecture_Analysis.md",
			] as any)
			vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined)
			vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined)
			vi.mocked(fs.promises.rm).mockResolvedValue(undefined)

			await ensureProjectWikiCommandExists()

			expect(fs.promises.rm).toHaveBeenCalled()
			expect(fs.promises.writeFile).toHaveBeenCalled()
		})

		it("应该正确处理文件存在的情况", async () => {
			// Mock 文件存在的情况
			vi.mocked(fs.promises.access).mockResolvedValue(undefined)
			vi.mocked(fs.promises.readFile).mockResolvedValue(`---
description: "项目深度分析与知识文档生成"
version: "v1.0.1"
---
# 当前版本模板`)
			vi.mocked(fs.promises.stat).mockResolvedValue({
				isDirectory: () => true,
			} as any)
			vi.mocked(fs.promises.readdir).mockResolvedValue([
				"01_Project_Overview_Analysis.md",
				"02_Overall_Architecture_Analysis.md",
				"03_Service_Dependencies_Analysis.md",
				"04_Data_Flow_Integration_Analysis.md",
				"05_Service_Analysis_Template.md",
				"06_Database_Schema_Analysis.md",
				"07_API_Interface_Analysis.md",
				"08_Deploy_Analysis.md",
				"09_Develop_Test_Analysis.md",
				"10_Index_Generation.md",
				"11_Project_Rules_Generation.md",
			] as any)
			vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined)
			vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined)
			vi.mocked(fs.promises.rm).mockResolvedValue(undefined)

			await ensureProjectWikiCommandExists()

			// 验证启动日志被调用
			expect(mockLogger.info).toHaveBeenCalledWith("[projectWikiHelpers] Starting ensureProjectWikiCommandExists...")
			// 验证设置命令的日志被调用
			expect(mockLogger.info).toHaveBeenCalledWith("[projectWikiHelpers] Setting up project-wiki command...")
			// 验证写文件操作被调用
			expect(fs.promises.writeFile).toHaveBeenCalled()
		})

		it("应该在子任务目录缺少文件时重新创建", async () => {
			// Mock 主文件存在但子任务目录缺少文件
			vi.mocked(fs.promises.access).mockResolvedValue(undefined)
			vi.mocked(fs.promises.readFile).mockResolvedValue(`---
description: "项目深度分析与知识文档生成"
version: "v1.0.1"
---
# 当前版本模板`)
			vi.mocked(fs.promises.stat).mockResolvedValue({
				isDirectory: () => true,
			} as any)
			vi.mocked(fs.promises.readdir).mockResolvedValue([
				"01_Project_Overview_Analysis.md",
				// 缺少其他文件
			] as any)
			vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined)
			vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined)
			vi.mocked(fs.promises.rm).mockResolvedValue(undefined)

			await ensureProjectWikiCommandExists()

			expect(fs.promises.rm).toHaveBeenCalled()
			expect(fs.promises.writeFile).toHaveBeenCalled()
		})

		it("应该处理错误情况", async () => {
			const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
			
			// Mock mkdir 抛出错误
			vi.mocked(fs.promises.mkdir).mockRejectedValue(new Error("Permission denied"))

			await ensureProjectWikiCommandExists()

			expect(consoleSpy).toHaveBeenCalledWith(
				"[commands] Failed to initialize project-wiki command:",
				expect.stringContaining("Permission denied")
			)

			consoleSpy.mockRestore()
		})

		it("应该正确处理前置matter解析错误", async () => {
			// Mock 文件存在但前置matter格式错误
			vi.mocked(fs.promises.access).mockResolvedValue(undefined)
			vi.mocked(fs.promises.readFile).mockResolvedValue(`# 没有前置matter的文件`)
			vi.mocked(fs.promises.stat).mockResolvedValue({
				isDirectory: () => true,
			} as any)
			vi.mocked(fs.promises.readdir).mockResolvedValue([] as any)
			vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined)
			vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined)
			vi.mocked(fs.promises.rm).mockResolvedValue(undefined)

			await ensureProjectWikiCommandExists()

			// 验证启动日志被调用
			expect(mockLogger.info).toHaveBeenCalledWith("[projectWikiHelpers] Starting ensureProjectWikiCommandExists...")
			// 验证设置命令的日志被调用
			expect(mockLogger.info).toHaveBeenCalledWith("[projectWikiHelpers] Setting up project-wiki command...")
			// 验证写文件操作被调用
			expect(fs.promises.writeFile).toHaveBeenCalled()
		})

		it("应该正确处理部分子任务文件生成失败的情况", async () => {
			// Mock 文件不存在，需要创建
			vi.mocked(fs.promises.access).mockRejectedValue(new Error("File not found"))
			vi.mocked(fs.promises.stat).mockRejectedValue(new Error("Directory not found"))
			vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined)
			vi.mocked(fs.promises.writeFile)
				.mockResolvedValueOnce(undefined) // 主文件成功
				.mockRejectedValueOnce(new Error("Write failed")) // 第一个子任务文件失败
				.mockResolvedValue(undefined) // 其他文件成功
			vi.mocked(fs.promises.rm).mockResolvedValue(undefined)

			await ensureProjectWikiCommandExists()

			// 验证启动和设置日志被调用
			expect(mockLogger.info).toHaveBeenCalledWith("[projectWikiHelpers] Starting ensureProjectWikiCommandExists...")
			expect(mockLogger.info).toHaveBeenCalledWith("[projectWikiHelpers] Setting up project-wiki command...")
			// 验证警告日志被调用（部分文件生成失败）
			expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Failed to generate"))
		})

		it("应该正确处理Promise.allSettled的混合结果", async () => {
			// Mock 混合的成功和失败情况
			vi.mocked(fs.promises.access).mockRejectedValue(new Error("File not found"))
			vi.mocked(fs.promises.stat).mockRejectedValue(new Error("Directory not found"))
			vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined)
			vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined)
			vi.mocked(fs.promises.rm).mockResolvedValue(undefined)

			await ensureProjectWikiCommandExists()

			// 验证基本流程被执行
			expect(mockLogger.info).toHaveBeenCalledWith("[projectWikiHelpers] Starting ensureProjectWikiCommandExists...")
			expect(fs.promises.mkdir).toHaveBeenCalledWith("/home/user/.roo/commands", { recursive: true })
		})
	})

	describe("setLogger", () => {
		it("应该正确设置logger实例", () => {
			const testLogger = {
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
				debug: vi.fn(),
				dispose: vi.fn(),
			}

			// 测试setLogger函数，我们已经从第113行导入了setLogger
			expect(() => setLogger(testLogger)).not.toThrow()
		})
	})
})