import * as os from "os"
import * as path from "path"

export const WIKI_OUTPUT_DIR = path.join(".cospec", "wiki") + path.sep
export const GENERAL_RULES_OUTPUT_DIR = path.join(".roo", "rules") + path.sep

// Safely get home directory
export function getHomeDir(): string {
	const homeDir = os.homedir()
	if (!homeDir) {
		throw new Error("Unable to determine home directory")
	}
	return homeDir
}

// Get global commands directory path
export function getGlobalCommandsDir(): string {
	return path.join(getHomeDir(), ".roo", "commands")
}

export function formatError(error: unknown): string {
	if (error instanceof Error) {
		return error.stack || error.message
	}
	return String(error)
}

export const subtaskDir = path.join(getGlobalCommandsDir(), "project-wiki-tasks") + path.sep

export const deepAnalyzeThreshold = 10

// 子任务文件名常量
export const SUBTASK_FILENAMES = {
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
} as const

// 子任务输出文件名常量
export const SUBTASK_OUTPUT_FILENAMES = {
	PROJECT_OVERVIEW_TASK_FILE: "01_Overview.md",
	OVERALL_ARCHITECTURE_TASK_FILE: "02_Architecture.md",
	SERVICE_DEPENDENCIES_TASK_FILE: "03_Service_Dependencies.md",
	DATA_FLOW_INTEGRATION_TASK_FILE: "04_Data_Flow_Integration.md",
	SERVICE_ANALYSIS_TASK_FILE: "05_Service.md",
	DATABASE_SCHEMA_TASK_FILE: "06_Database.md",
	API_INTERFACE_TASK_FILE: "07_API.md",
	DEPLOY_ANALYSIS_TASK_FILE: "08_Deploy.md",
	DEVELOPMENT_TEST_ANALYSIS_TASK_FILE: "09_Develop_Test.md",
	INDEX_GENERATION_TASK_FILE: "index.md",
	PROJECT_RULES_TASK_FILE: "generated_rules.md",
} as const

// 主文件名
export const MAIN_WIKI_FILENAME = "project-wiki.md"

// 所有子任务文件名数组（用于遍历）
export const ALL_SUBTASK_FILENAMES = Object.values(SUBTASK_OUTPUT_FILENAMES)
