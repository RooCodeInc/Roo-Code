import { safeWriteJson } from "../../utils/safeWriteJson"
import * as path from "path"
import * as fs from "fs/promises"

import type { ClineMessage } from "@roo-code/types"

import { fileExistsAtPath } from "../../utils/fs"

import { GlobalFileNames } from "../../shared/globalFileNames"
import { getTaskDirectoryPath } from "../../utils/storage"
import { ImageManager } from "../image-storage/ImageManager"

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

	if (!fileExists) {
		return []
	}

	const messages: ClineMessage[] = JSON.parse(await fs.readFile(filePath, "utf8"))

	// 恢复图片数据：将 imageIds 转换回 images
	const imageManager = new ImageManager(globalStoragePath)

	for (const message of messages) {
		if (message.imageIds && message.imageIds.length > 0) {
			try {
				// 从磁盘加载图片数据
				const images = await imageManager.loadImages(taskId, message.imageIds)

				// 将加载的图片数据添加到消息中
				message.images = images

				// 保留 imageIds 以便再次保存时使用
				// 不删除 imageIds，因为它们是磁盘上图片文件的引用
			} catch (error) {
				console.error(`[readTaskMessages] Failed to load images for message ${message.ts}:`, error)
				// 如果加载失败，保持消息完整但没有图片数据
			}
		}
	}

	return messages
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
