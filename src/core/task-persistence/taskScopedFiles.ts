import * as path from "path"
import * as fs from "fs/promises"
import { fileExistsAtPath } from "../../utils/fs"
import { getTaskDirectoryPath } from "../../utils/storage"
import { safeWriteJson } from "../../utils/safeWriteJson"

const TASK_SCOPED_FILES_DIR = "task_files"

/**
 * Gets the directory path for task-scoped files
 */
export async function getTaskScopedFilesDirectory(globalStoragePath: string, taskId: string): Promise<string> {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	const filesDir = path.join(taskDir, TASK_SCOPED_FILES_DIR)
	await fs.mkdir(filesDir, { recursive: true })
	return filesDir
}

/**
 * Writes a task-scoped file
 */
export async function writeTaskScopedFile(
	globalStoragePath: string,
	taskId: string,
	filename: string,
	content: string,
): Promise<string> {
	const filesDir = await getTaskScopedFilesDirectory(globalStoragePath, taskId)
	const filePath = path.join(filesDir, filename)

	// Create subdirectories if needed
	const fileDir = path.dirname(filePath)
	await fs.mkdir(fileDir, { recursive: true })

	// Write the file
	await fs.writeFile(filePath, content, "utf-8")

	return filePath
}

/**
 * Reads a task-scoped file
 */
export async function readTaskScopedFile(
	globalStoragePath: string,
	taskId: string,
	filename: string,
): Promise<string | null> {
	const filesDir = await getTaskScopedFilesDirectory(globalStoragePath, taskId)
	const filePath = path.join(filesDir, filename)

	if (!(await fileExistsAtPath(filePath))) {
		return null
	}

	return await fs.readFile(filePath, "utf-8")
}

/**
 * Lists all task-scoped files
 */
export async function listTaskScopedFiles(globalStoragePath: string, taskId: string): Promise<string[]> {
	const filesDir = await getTaskScopedFilesDirectory(globalStoragePath, taskId)

	try {
		const files: string[] = []

		async function scanDirectory(dir: string, basePath: string = ""): Promise<void> {
			const entries = await fs.readdir(dir, { withFileTypes: true })

			for (const entry of entries) {
				const fullPath = path.join(dir, entry.name)
				const relativePath = basePath ? path.join(basePath, entry.name) : entry.name

				if (entry.isFile()) {
					files.push(relativePath)
				} else if (entry.isDirectory()) {
					await scanDirectory(fullPath, relativePath)
				}
			}
		}

		await scanDirectory(filesDir)
		return files
	} catch (error) {
		// Directory might not exist yet
		return []
	}
}

/**
 * Checks if a file exists as a task-scoped file
 */
export async function taskScopedFileExists(
	globalStoragePath: string,
	taskId: string,
	filename: string,
): Promise<boolean> {
	const filesDir = await getTaskScopedFilesDirectory(globalStoragePath, taskId)
	const filePath = path.join(filesDir, filename)
	return await fileExistsAtPath(filePath)
}

/**
 * Deletes a task-scoped file
 */
export async function deleteTaskScopedFile(
	globalStoragePath: string,
	taskId: string,
	filename: string,
): Promise<boolean> {
	const filesDir = await getTaskScopedFilesDirectory(globalStoragePath, taskId)
	const filePath = path.join(filesDir, filename)

	try {
		await fs.unlink(filePath)
		return true
	} catch (error) {
		return false
	}
}

/**
 * Gets metadata about task-scoped files for a task
 */
export interface TaskScopedFilesMetadata {
	count: number
	files: Array<{
		name: string
		size: number
	}>
}

export async function getTaskScopedFilesMetadata(
	globalStoragePath: string,
	taskId: string,
): Promise<TaskScopedFilesMetadata> {
	const files = await listTaskScopedFiles(globalStoragePath, taskId)
	const filesDir = await getTaskScopedFilesDirectory(globalStoragePath, taskId)

	const metadata: TaskScopedFilesMetadata = {
		count: files.length,
		files: [],
	}

	for (const file of files) {
		const filePath = path.join(filesDir, file)
		try {
			const stats = await fs.stat(filePath)
			metadata.files.push({
				name: file,
				size: stats.size,
			})
		} catch (error) {
			// Skip files that can't be accessed
		}
	}

	return metadata
}
