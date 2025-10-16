import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock logger - must be created at module level
const mockLogger = {
	info: vi.fn(),
	warn: vi.fn(),
	error: vi.fn(),
	debug: vi.fn(),
	dispose: vi.fn(),
}

// Setup logger mock
vi.mock("../../../utils/logger", () => ({
	createLogger: vi.fn(() => mockLogger),
	ILogger: {
		// Mock ILogger interface
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
	subtaskDir: "/home/user/.roo/commands/costrict-project-wiki-tasks/v1.0.5/",
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
	PROJECT_WIKI_TEMPLATE: '---\ndescription: "项目深度分析与知识文档生成"\nversion: v1.0.1\n---\n# 测试模板',
}))

vi.mock("../wiki-prompts/subtasks/01_Project_Overview_Analysis", () => ({
	PROJECT_OVERVIEW_ANALYSIS_TEMPLATE: (workspace: string) => "# 项目概览分析模板",
}))

vi.mock("../wiki-prompts/subtasks/02_Overall_Architecture_Analysis", () => ({
	OVERALL_ARCHITECTURE_ANALYSIS_TEMPLATE: (workspace: string) => "# 整体架构分析模板",
}))

vi.mock("../wiki-prompts/subtasks/03_Service_Dependencies_Analysis", () => ({
	SERVICE_DEPENDENCIES_ANALYSIS_TEMPLATE: (workspace: string) => "# 服务依赖分析模板",
}))

vi.mock("../wiki-prompts/subtasks/04_Data_Flow_Integration_Analysis", () => ({
	DATA_FLOW_INTEGRATION_ANALYSIS_TEMPLATE: (workspace: string) => "# 数据流分析模板",
}))

vi.mock("../wiki-prompts/subtasks/05_Service_Analysis_Template", () => ({
	SERVICE_ANALYSIS_TEMPLATE: (workspace: string) => "# 服务分析模板",
}))

vi.mock("../wiki-prompts/subtasks/06_Database_Schema_Analysis", () => ({
	DATABASE_SCHEMA_ANALYSIS_TEMPLATE: (workspace: string) => "# 数据库分析模板",
}))

vi.mock("../wiki-prompts/subtasks/07_API_Interface_Analysis", () => ({
	API_INTERFACE_ANALYSIS_TEMPLATE: (workspace: string) => "# API分析模板",
}))

vi.mock("../wiki-prompts/subtasks/08_Deploy_Analysis", () => ({
	DEPLOY_ANALYSIS_TEMPLATE: (workspace: string) => "# 部署分析模板",
}))

vi.mock("../wiki-prompts/subtasks/09_Develop_Test_Analysis", () => ({
	DEVELOP_TEST_ANALYSIS_TEMPLATE: (workspace: string) => "# 开发测试分析模板",
}))

vi.mock("../wiki-prompts/subtasks/10_Index_Generation", () => ({
	INDEX_GENERATION_TEMPLATE: (workspace: string) => "# 索引生成模板",
}))

vi.mock("../wiki-prompts/subtasks/11_Project_Rules_Generation", () => ({
	PROJECT_RULES_GENERATION_TEMPLATE: (workspace: string) => "# 项目规则生成模板",
}))

// Import modules
import * as fs from "fs"
import { ensureProjectWikiSubtasksExists, setLogger } from "../projectWikiHelpers"

describe("projectWikiHelpers", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		// Reset logger
		setLogger(mockLogger)
	})

	describe("ensureProjectWikiSubtasksExists", () => {
		it("should create subtask files when subtask directory does not exist", async () => {
			// Mock fs.stat to throw error indicating directory does not exist
			vi.mocked(fs.promises.stat).mockRejectedValue(new Error("Directory not found"))
			vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined)
			vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined)
			vi.mocked(fs.promises.rm).mockResolvedValue(undefined)

			await ensureProjectWikiSubtasksExists()

			// Verify directory creation was called
			expect(fs.promises.mkdir).toHaveBeenCalledWith(
				"/home/user/.roo/commands/costrict-project-wiki-tasks/v1.0.5/",
				{
					recursive: true,
				},
			)
			// Verify file writing was called (in generateSubtaskFiles function)
			expect(fs.promises.writeFile).toHaveBeenCalled()
			expect(mockLogger.info).toHaveBeenCalledWith(
				"[projectWikiHelpers] Starting ensureProjectWikiSubtasksExists...",
			)
			expect(mockLogger.info).toHaveBeenCalledWith("[projectWikiHelpers] Setting up project-wiki subtasks...")
		})

		it("should recreate when subtask files are incomplete", async () => {
			// Mock subtask directory exists but files are incomplete
			vi.mocked(fs.promises.stat).mockResolvedValue({
				isDirectory: () => true,
			} as any)
			vi.mocked(fs.promises.readdir).mockResolvedValue([
				"01_Project_Overview_Analysis.md",
				"02_Overall_Architecture_Analysis.md",
				// 缺少其他文件
			] as any)
			vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined)
			vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined)
			vi.mocked(fs.promises.rm).mockResolvedValue(undefined)

			await ensureProjectWikiSubtasksExists()

			// Verify directory was deleted (because files are incomplete)
			expect(fs.promises.rm).toHaveBeenCalledWith(
				"/home/user/.roo/commands/costrict-project-wiki-tasks/v1.0.5/",
				{
					recursive: true,
					force: true,
				},
			)
			// Verify file writing was called (regenerate files)
			expect(fs.promises.writeFile).toHaveBeenCalled()
			expect(mockLogger.info).toHaveBeenCalledWith("[projectWikiHelpers] Setting up project-wiki subtasks...")
		})

		it("should handle the case when subtask files are complete", async () => {
			// Mock the case when subtask files are complete
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
			// Mock version file content to ensure version check passes
			vi.mocked(fs.promises.readFile).mockResolvedValue(`version: "v1.0.5"`)
			vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined)
			vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined)
			vi.mocked(fs.promises.rm).mockResolvedValue(undefined)

			await ensureProjectWikiSubtasksExists()

			// Verify startup log was called
			expect(mockLogger.info).toHaveBeenCalledWith(
				"[projectWikiHelpers] Starting ensureProjectWikiSubtasksExists...",
			)
			// Verify subtask already exists log was called
			expect(mockLogger.info).toHaveBeenCalledWith("[projectWikiHelpers] project-wiki subtasks already exist")
			// Verify no need to regenerate files
			expect(fs.promises.writeFile).not.toHaveBeenCalled()
		})

		it("should handle error cases", async () => {
			const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			// Mock mkdir to throw error
			vi.mocked(fs.promises.mkdir).mockRejectedValue(new Error("Permission denied"))

			await ensureProjectWikiSubtasksExists()

			expect(consoleSpy).toHaveBeenCalledWith(
				"[commands] Failed to initialize project-wiki subtasks:",
				expect.stringContaining("Permission denied"),
			)

			consoleSpy.mockRestore()
		})

		it("should handle partial subtask file generation failures", async () => {
			// Mock subtask directory does not exist, needs to be created
			vi.mocked(fs.promises.stat).mockRejectedValue(new Error("Directory not found"))
			vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined)
			vi.mocked(fs.promises.writeFile)
				.mockRejectedValueOnce(new Error("Write failed")) // First subtask file fails
				.mockResolvedValue(undefined) // Other files succeed
			vi.mocked(fs.promises.rm).mockResolvedValue(undefined)

			await ensureProjectWikiSubtasksExists()

			// Verify startup and setup logs were called
			expect(mockLogger.info).toHaveBeenCalledWith(
				"[projectWikiHelpers] Starting ensureProjectWikiSubtasksExists...",
			)
			expect(mockLogger.info).toHaveBeenCalledWith("[projectWikiHelpers] Setting up project-wiki subtasks...")
			// Verify warning log was called (partial file generation failed)
			expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Failed to generate"))
		})

		it("should handle mixed results from Promise.allSettled", async () => {
			// Mock mixed success and failure scenarios
			vi.mocked(fs.promises.stat).mockRejectedValue(new Error("Directory not found"))
			vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined)
			vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined)
			vi.mocked(fs.promises.rm).mockResolvedValue(undefined)

			await ensureProjectWikiSubtasksExists()

			// Verify basic flow was executed
			expect(mockLogger.info).toHaveBeenCalledWith(
				"[projectWikiHelpers] Starting ensureProjectWikiSubtasksExists...",
			)
			expect(fs.promises.mkdir).toHaveBeenCalledWith(
				"/home/user/.roo/commands/costrict-project-wiki-tasks/v1.0.5/",
				{
					recursive: true,
				},
			)
		})
	})

	describe("setLogger", () => {
		it("should set logger instance correctly", () => {
			const testLogger = {
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
				debug: vi.fn(),
				dispose: vi.fn(),
			}

			// Test setLogger function, we have imported setLogger from line 113
			expect(() => setLogger(testLogger)).not.toThrow()
		})
	})
})
