import { safeWriteJson } from "../../utils/safeWriteJson"
import * as path from "path"
import * as fs from "fs/promises"

import type { ClineMessage } from "@roo-code/types"

import { fileExistsAtPath } from "../../utils/fs"

import { GlobalFileNames } from "../../shared/globalFileNames"
import { getTaskDirectoryPath } from "../../utils/storage"

export type ReadTaskMessagesOptions = {
	taskId: string
	globalStoragePath: string
}

export async function readTaskMessages({
	taskId,
	globalStoragePath,
}: ReadTaskMessagesOptions): Promise<ClineMessage[]> {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	const filePath = path.join(taskDir, GlobalFileNames.uiMessages)
	const fileExists = await fileExistsAtPath(filePath)

	if (fileExists) {
		try {
			const parsedData = JSON.parse(await fs.readFile(filePath, "utf8"))
			if (!Array.isArray(parsedData)) {
				console.warn(
					`[readTaskMessages] Parsed data is not an array (got ${typeof parsedData}), returning empty. TaskId: ${taskId}, Path: ${filePath}`,
				)
				return []
			}
			return parsedData
		} catch (error) {
			console.warn(
				`[readTaskMessages] Failed to parse ${filePath} for task ${taskId}, returning empty: ${error instanceof Error ? error.message : String(error)}`,
			)
			return []
		}
	}

	return []
}

export type SaveTaskMessagesOptions = {
	messages: ClineMessage[]
	taskId: string
	globalStoragePath: string
}

export async function saveTaskMessages({ messages, taskId, globalStoragePath }: SaveTaskMessagesOptions) {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	const filePath = path.join(taskDir, GlobalFileNames.uiMessages)
	await safeWriteJson(filePath, messages)
}
