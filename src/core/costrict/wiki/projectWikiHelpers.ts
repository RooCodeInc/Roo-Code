import { promises as fs } from "fs"
import * as path from "path"
import { formatError, SUBTASK_FILENAMES, subtaskDir } from "./wiki-prompts/common/constants"
import { ILogger, createLogger } from "../../../utils/logger"
import { PROJECT_BASIC_ANALYZE_AGENT_TEMPLATE } from "./wiki-prompts/subtasks/01_project-basic-analyze-agent"
import { GENERATE_THINK_CATALOGUE_TEMPLATE } from "./wiki-prompts/subtasks/02_catalogue-design-agent"
import { DOCUMENT_GENERATION_AGENT_TEMPLATE } from "./wiki-prompts/subtasks/03_document-generate-agent"
import { INDEX_GENERATION_AGENT_TEMPLATE } from "./wiki-prompts/subtasks/04_index-generation-agent"

export const projectWikiCommandName = "project-wiki"
export const projectWikiCommandDescription = `执行项目深度分析并创建全面的项目技术文档（v2版本）`


// Template data mapping for subtasks only
const SUBTASK_TEMPLATES = {
	[SUBTASK_FILENAMES.PROJECT_CLASSIFICATION_AGENT]: PROJECT_BASIC_ANALYZE_AGENT_TEMPLATE,
	[SUBTASK_FILENAMES.THINK_CATALOGUE_AGENT]: GENERATE_THINK_CATALOGUE_TEMPLATE,
	[SUBTASK_FILENAMES.DOCUMENT_GENERATION_AGENT]: DOCUMENT_GENERATION_AGENT_TEMPLATE,
	[SUBTASK_FILENAMES.INDEX_GENERATION_AGENT]: INDEX_GENERATION_AGENT_TEMPLATE,
}


// 创建 logger 实例，但允许在测试时被替换
let logger: ILogger = createLogger()

// 导出 logger setter 以便测试时可以替换
export function setLogger(testLogger: ILogger): void {
	logger = testLogger
}

export async function ensureProjectWikiSubtasksExists() {
	const startTime = Date.now()
	logger.info("[projectWikiHelpers] Starting ensureProjectWikiSubtasksExists...")

	try {
		// Ensure subtask directory exists
		await fs.mkdir(subtaskDir, { recursive: true })

		// Check if subtask setup is needed
		const needsSetup = await checkIfSubtaskSetupNeeded(subtaskDir)
		if (!needsSetup) {
			logger.info("[projectWikiHelpers] project-wiki subtasks already exist")
			return
		}

		logger.info("[projectWikiHelpers] Setting up project-wiki subtasks...")

		// Clean up existing subtask directory
		await fs.rm(subtaskDir, { recursive: true, force: true })

		// Generate subtask files
		await generateSubtaskFiles(subtaskDir)

		const duration = Date.now() - startTime
		logger.info(`[projectWikiHelpers] project-wiki subtasks setup completed in ${duration}ms`)
	} catch (error) {
		const errorMsg = formatError(error)
		console.error("[commands] Failed to initialize project-wiki subtasks:", errorMsg)
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
		const subTaskFileNames = Object.keys(SUBTASK_TEMPLATES)
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

// Check if subtask setup is needed
async function checkIfSubtaskSetupNeeded(subTaskDir: string): Promise<boolean> {
	try {
		const isSubtaskDirValid = await checkSubtaskDirectory(subTaskDir)
		return !isSubtaskDirValid
	} catch (error) {
		logger.info("[projectWikiHelpers] subTaskDir not accessible:", formatError(error))
		return true
	}
}

// Generate subtask files
async function generateSubtaskFiles(subTaskDir: string): Promise<void> {
	try {
		// Create subtask directory
		await fs.mkdir(subTaskDir, { recursive: true })

		// Generate subtask files
		const subTaskFiles = Object.keys(SUBTASK_TEMPLATES)
		const generateResults = await Promise.allSettled(
			subTaskFiles.map(async (file) => {
				const template = SUBTASK_TEMPLATES[file as keyof typeof SUBTASK_TEMPLATES]("${workspaceFolder}/")
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
		throw new Error(`Failed to generate subtask files: ${errorMsg}`)
	}
}