import { promises as fs } from "fs"
import * as path from "path"
import { formatError, getGlobalCommandsDir, subtaskDir } from "./wiki-prompts/subtasks/constants"
import { PROJECT_WIKI_TEMPLATE, projectWikiVersion } from "./wiki-prompts/project_wiki"
import { SUBTASK_FILENAMES, MAIN_WIKI_FILENAME } from "./wiki-prompts/subtasks/constants"
import { PROJECT_OVERVIEW_ANALYSIS_TEMPLATE } from "./wiki-prompts/subtasks/01_Project_Overview_Analysis"
import { OVERALL_ARCHITECTURE_ANALYSIS_TEMPLATE } from "./wiki-prompts/subtasks/02_Overall_Architecture_Analysis"
import { SERVICE_DEPENDENCIES_ANALYSIS_TEMPLATE } from "./wiki-prompts/subtasks/03_Service_Dependencies_Analysis"
import { DATA_FLOW_INTEGRATION_ANALYSIS_TEMPLATE } from "./wiki-prompts/subtasks/04_Data_Flow_Integration_Analysis"
import { SERVICE_ANALYSIS_TEMPLATE } from "./wiki-prompts/subtasks/05_Service_Analysis_Template"
import { DATABASE_SCHEMA_ANALYSIS_TEMPLATE } from "./wiki-prompts/subtasks/06_Database_Schema_Analysis"
import { API_INTERFACE_ANALYSIS_TEMPLATE } from "./wiki-prompts/subtasks/07_API_Interface_Analysis"
import { DEPLOY_ANALYSIS_TEMPLATE } from "./wiki-prompts/subtasks/08_Deploy_Analysis"
import { DEVELOP_TEST_ANALYSIS_TEMPLATE } from "./wiki-prompts/subtasks/09_Develop_Test_Analysis"
import { PROJECT_RULES_GENERATION_TEMPLATE } from "./wiki-prompts/subtasks/11_Project_Rules_Generation"
import { ILogger, createLogger } from "../../../utils/logger"
import { INDEX_GENERATION_TEMPLATE } from "./wiki-prompts/subtasks/10_Index_Generation"

export const projectWikiCommandName = "project-wiki"
export const projectWikiCommandDescription = `Perform an in-depth analysis of the project and create a comprehensive project wiki.`

// 创建 logger 实例，但允许在测试时被替换
let logger: ILogger = createLogger()

// 导出 logger setter 以便测试时可以替换
export function setLogger(testLogger: ILogger): void {
	logger = testLogger
}

// Template data mapping
const TEMPLATES = {
	[MAIN_WIKI_FILENAME]: PROJECT_WIKI_TEMPLATE,
	[SUBTASK_FILENAMES.PROJECT_OVERVIEW_TASK_FILE]: PROJECT_OVERVIEW_ANALYSIS_TEMPLATE,
	[SUBTASK_FILENAMES.OVERALL_ARCHITECTURE_TASK_FILE]: OVERALL_ARCHITECTURE_ANALYSIS_TEMPLATE,
	[SUBTASK_FILENAMES.SERVICE_DEPENDENCIES_TASK_FILE]: SERVICE_DEPENDENCIES_ANALYSIS_TEMPLATE,
	[SUBTASK_FILENAMES.DATA_FLOW_INTEGRATION_TASK_FILE]: DATA_FLOW_INTEGRATION_ANALYSIS_TEMPLATE,
	[SUBTASK_FILENAMES.SERVICE_ANALYSIS_TASK_FILE]: SERVICE_ANALYSIS_TEMPLATE,
	[SUBTASK_FILENAMES.DATABASE_SCHEMA_TASK_FILE]: DATABASE_SCHEMA_ANALYSIS_TEMPLATE,
	[SUBTASK_FILENAMES.API_INTERFACE_TASK_FILE]: API_INTERFACE_ANALYSIS_TEMPLATE,
	[SUBTASK_FILENAMES.DEPLOY_ANALYSIS_TASK_FILE]: DEPLOY_ANALYSIS_TEMPLATE,
	[SUBTASK_FILENAMES.Develop_TEST_ANALYSIS_TASK_FILE]: DEVELOP_TEST_ANALYSIS_TEMPLATE,
	[SUBTASK_FILENAMES.INDEX_GENERATION_TASK_FILE]: INDEX_GENERATION_TEMPLATE,
	[SUBTASK_FILENAMES.PROJECT_RULES_TASK_FILE]: PROJECT_RULES_GENERATION_TEMPLATE,
}

export async function ensureProjectWikiCommandExists() {
	const startTime = Date.now()
	logger.info("[projectWikiHelpers] Starting ensureProjectWikiCommandExists...")

	try {
		const globalCommandsDir = getGlobalCommandsDir()
		await fs.mkdir(globalCommandsDir, { recursive: true })

		const projectWikiFile = path.join(globalCommandsDir, `${projectWikiCommandName}.md`)

		// Check if setup is needed
		const needsSetup = await checkIfSetupNeeded(projectWikiFile, subtaskDir)
		if (!needsSetup) {
			logger.info("[projectWikiHelpers] project-wiki command already exists")
			return
		}

		logger.info("[projectWikiHelpers] Setting up project-wiki command...")

		// Clean up existing files
		await Promise.allSettled([
			fs.rm(projectWikiFile, { force: true }),
			fs.rm(subtaskDir, { recursive: true, force: true }),
		])

		// Generate Wiki files
		await generateWikiCommandFiles(projectWikiFile, subtaskDir)

		const duration = Date.now() - startTime
		logger.info(`[projectWikiHelpers] project-wiki command setup completed in ${duration}ms`)
	} catch (error) {
		const errorMsg = formatError(error)
		console.error("[commands] Failed to initialize project-wiki command:", errorMsg)
	}
}

// Check if file version matches current version
async function checkFileVersion(projectWikiFile: string): Promise<boolean> {
	try {
		const existingContent = await fs.readFile(projectWikiFile, "utf-8")

		// Extract front matter section (between --- and ---)
		const frontMatterMatch = existingContent.match(/^---\s*\n([\s\S]*?)\n---/)
		if (!frontMatterMatch) {
			logger.info("[projectWikiHelpers] No valid front matter found in existing file")
			return false
		}

		// Parse version from front matter
		const frontMatterContent = frontMatterMatch[1]
		const versionMatch = frontMatterContent.match(/^version:\s*"([^"]+)"/m)
		if (!versionMatch) {
			logger.info("[projectWikiHelpers] Version field not found in front matter")
			return false
		}

		const existingVersion = versionMatch[1].trim()
		if (existingVersion !== projectWikiVersion) {
			logger.info(
				`[projectWikiHelpers] Version mismatch. Current: ${existingVersion}, Expected: ${projectWikiVersion}`,
			)
			return false
		}

		logger.info(`[projectWikiHelpers] Version check passed: ${existingVersion}`)
		return true
	} catch (error) {
		logger.info("[projectWikiHelpers] Failed to read or parse existing file version:", formatError(error))
		return false
	}
}

// Check if subtask directory is valid
async function checkSubtaskDirectory(subTaskDir: string): Promise<boolean> {
	try {
		const subDirResult = await fs.stat(subTaskDir)

		if (!subDirResult.isDirectory()) {
			logger.info("[projectWikiHelpers] subTaskDir exists but is not a directory")
			return false
		}

		// Check if subtask directory has .md files
		const subTaskFiles = await fs.readdir(subTaskDir)
		const mdFiles = subTaskFiles.filter((file) => file.endsWith(".md"))

		// subtask file check.
		const subTaskFileNames = Object.keys(TEMPLATES).filter((file) => file !== MAIN_WIKI_FILENAME)
		const missingSubTaskFiles = subTaskFileNames.filter((fileName) => !mdFiles.includes(fileName))

		if (missingSubTaskFiles.length > 0) {
			logger.info(`[projectWikiHelpers] Missing subtask files: ${missingSubTaskFiles.join(", ")}`)
			return false
		}

		return mdFiles.length > 0
	} catch (error) {
		logger.info("[projectWikiHelpers] subTaskDir not accessible:", formatError(error))
		return false
	}
}

// Optimized file checking logic, using Promise.allSettled to improve performance
async function checkIfSetupNeeded(projectWikiFile: string, subTaskDir: string): Promise<boolean> {
	try {
		const [mainFileResult, subDirResult] = await Promise.allSettled([
			fs.access(projectWikiFile, fs.constants.F_OK | fs.constants.R_OK | fs.constants.W_OK),
			fs.stat(subTaskDir),
		])

		// If main file doesn't exist, setup is needed
		if (mainFileResult.status === "rejected") {
			logger.info("[projectWikiHelpers] projectWikiFile not accessible:", formatError(mainFileResult.reason))
			return true
		}

		// Check version in existing file
		const isVersionValid = await checkFileVersion(projectWikiFile)
		if (!isVersionValid) {
			return true
		}

		// If subtask directory doesn't exist or is not valid, setup is needed
		if (subDirResult.status === "rejected") {
			logger.info("[projectWikiHelpers] subTaskDir not accessible:", formatError(subDirResult.reason))
			return true
		}

		const isSubtaskDirValid = await checkSubtaskDirectory(subTaskDir)
		return !isSubtaskDirValid
	} catch (error) {
		logger.error("[projectWikiHelpers] Error checking setup status:", formatError(error))
		return true
	}
}

// Generate Wiki files
async function generateWikiCommandFiles(projectWikiFile: string, subTaskDir: string): Promise<void> {
	try {
		// Generate main file
		const mainTemplate = TEMPLATES[MAIN_WIKI_FILENAME]
		if (!mainTemplate) {
			throw new Error("Main template not found")
		}

		await fs.writeFile(projectWikiFile, mainTemplate, "utf-8")
		logger.info(`[projectWikiHelpers] Generated main wiki file: ${projectWikiFile}`)

		// Create subtask directory
		await fs.mkdir(subTaskDir, { recursive: true })

		// Generate subtask files
		const subTaskFiles = Object.keys(TEMPLATES).filter((file) => file !== MAIN_WIKI_FILENAME)
		const generateResults = await Promise.allSettled(
			subTaskFiles.map(async (file) => {
				const template = TEMPLATES[file as keyof typeof TEMPLATES]
				if (!template) {
					throw new Error(`Template not found for file: ${file}`)
				}

				const targetFile = path.join(subTaskDir, file)
				await fs.writeFile(targetFile, template, "utf-8")
				return file
			}),
		)

		// Count generation results
		const successful = generateResults.filter((result) => result.status === "fulfilled")
		const failed = generateResults.filter((result) => result.status === "rejected")

		logger.info(`[projectWikiHelpers] Successfully generated ${successful.length} subtask files`)

		if (failed.length > 0) {
			logger.warn(`[projectWikiHelpers] Failed to generate ${failed.length} subtask files:`)
			failed.forEach((result) => {
				if (result.status === "rejected") {
					logger.warn(`  - ${subTaskFiles[generateResults.indexOf(result)]}: ${formatError(result.reason)}`)
				}
			})
		}
	} catch (error) {
		const errorMsg = formatError(error)
		throw new Error(`Failed to generate wiki files: ${errorMsg}`)
	}
}
