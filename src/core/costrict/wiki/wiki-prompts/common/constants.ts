import * as os from "os"
import * as path from "path"

export const PROJECT_WIKI_VERSION = "v2.0.0"
export const WIKI_OUTPUT_DIR = path.join(".cospec", "wiki") + path.sep
export const GENERAL_RULES_OUTPUT_DIR = path.join(".roo", "rules") + path.sep


export const subtaskDir =
	path.join(getGlobalCommandsDir(), "costrict-project-wiki-tasks", PROJECT_WIKI_VERSION) + path.sep


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

export const NEW_SUBTASK = `创建如下 \`subtask\`子任务，执行，根据实际情况填充Input、Background信息：`

// v2 Agent文件名常量
export const SUBTASK_FILENAMES = {
	PROJECT_CLASSIFICATION_AGENT: "01_project-classification-agent.md",
	THINK_CATALOGUE_AGENT: "02_catalogue-design-agent.md",
	DOCUMENT_GENERATION_AGENT: "03_document-generation-agent.md",
	INDEX_GENERATION_AGENT: "04_index-generation-agent.md",
} as const

// v2 Agent输出文件名常量
export const AGENT_OUTPUT_FILENAMES = {
	PROJECT_CLASSIFICATION_AGENT: "project-classification.md",
	REPOSITORY_ANALYSIS_AGENT: "repository-analysis.md",
	THINK_CATALOGUE_AGENT: "think-catalogue.md",
	DOCUMENT_GENERATION_AGENT: "technical-documentation.md",
	INDEX_GENERATION_AGENT: "index.md",
} as const

// 主文件名
export const MAIN_WIKI_FILENAME = "project-wiki.md"

// v2 系统输入输出文件路径常量
export const WIKI_OUTPUT_FILE_PATHS = {
	// 输出目录
	STAGING_OUTPUT_DIR: ".cospec/wiki/.staging/",
	WIKI_OUTPUT_DIR: ".cospec/wiki/",
	GENERAL_RULES_OUTPUT_DIR: ".roo/rules-code/",
	
	// 各阶段输出文件
	PROJECT_BASIC_ANALYZE_JSON: `.cospec/wiki/.staging/basic_analyze.json`,
	OUTPUT_CATALOGUE_JSON: ".cospec/wiki/.staging/catalogue.json",
	
	// 最终输出文件
	DOCUMENT_INDEX_MD: ".cospec/wiki/index.md",
} as const

// v2 模式选择阈值
export const MODE_THRESHOLDS = {
	SMALL_PROJECT: 50,    // 小型项目文件数阈值
	MEDIUM_PROJECT: 200,  // 中型项目文件数阈值
	LARGE_PROJECT: 201,   // 大型项目文件数阈值
} as const

export const COMMON_RULES = 
`1. 使用\`todo_list\` 规划任务，逐个执行。
2. 严格遵循每个步骤的**输出要求**，不要遗漏任何细节。
3. 使用\`attempt_completion\`工具返回关键信息，供父任务使用。
`