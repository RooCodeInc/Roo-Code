/**
 * .cospec 文档差异集成工具
 * 用于在 handleUpdateSection 中获取文件与 checkpoint 的差异
 */

import * as path from "path"
import * as fs from "fs"
import * as vscode from "vscode"
import { CospecMetadataManager } from "./CospecMetadataManager"
import { isCoworkflowDocument } from "./commands"

/**
 * 差异获取结果
 */
export interface CospecDiffIntegrationResult {
	/** 是否成功获取差异 */
	success: boolean
	/** 差异内容 */
	diffContent?: string
	/** 文件内容 */
	fileContent?: string
	/** 错误信息 */
	error?: string
	/** 使用的任务ID */
	lastTaskId?: string
	/** 使用的checkpoint ID */
	lastCheckpointId?: string
	/** 文件路径 */
	filePath?: string
	/** 是否有差异 */
	hasDifference?: boolean
}

/**
 * .cospec 文档差异集成工具类
 */
export class CospecDiffIntegration {
	/**
	 * 检查是否应该获取差异
	 * 基于文件类型和配置决定
	 */
	static shouldGetDiff(uri: vscode.Uri): boolean {
		const filePath = uri.fsPath
		const fileName = path.basename(filePath)

		// 只处理 .cospec 目录中的三个主要文件
		const supportedFiles = ["requirements.md", "design.md", "tasks.md"]

		return isCoworkflowDocument(filePath) && supportedFiles.includes(fileName)
	}

	/**
	 * 更新文件的元数据（在文件修改后调用）
	 */
	static async updateFileMetadata(uri: vscode.Uri, taskId: string, lastCheckpointId: string): Promise<void> {
		try {
			await CospecMetadataManager.updateMetadataFromUri(uri, taskId, lastCheckpointId)
			console.log(`[CospecDiffIntegration] 更新文件元数据成功: ${uri.fsPath}`)
		} catch (error) {
			console.error(`[CospecDiffIntegration] 更新文件元数据失败: ${uri.fsPath}`, error)
			// 不抛出错误，避免影响主流程
		}
	}
}
