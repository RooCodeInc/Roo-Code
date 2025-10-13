/**
 * .cospec 文档差异集成工具
 * 用于在 handleUpdateSection 中获取文件与 checkpoint 的差异
 */

import * as path from "path"
import * as fs from "fs"
import * as vscode from "vscode"
import { CospecMetadataManager } from "./CospecMetadataManager"
import { simpleGit, SimpleGit } from "simple-git"
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
	 * 从指定文件获取与 checkpoint 的差异
	 * 优先使用 .cometa.json 中的信息，如果没有则查找最近的任务
	 */
	static async getDiffForFile(
		uri: vscode.Uri,
		globalStorageDir: string,
	): Promise<CospecDiffIntegrationResult | null> {
		try {
			const filePath = uri.fsPath
			const workspaceRoot = this.getWorkspaceRoot(uri)

			if (!workspaceRoot) {
				return {
					success: false,
					error: "无法确定工作区根目录",
				}
			}

			// 检查是否是 .cospec 文件
			if (!isCoworkflowDocument(filePath)) {
				return {
					success: false,
					error: "文件不在 .cospec 目录中",
				}
			}

			// 获取文件所在目录
			const directoryPath = path.dirname(filePath)
			const fileName = path.basename(filePath)

			// 尝试从 .cometa.json 获取元数据
			const metadata = await CospecMetadataManager.readMetadata(directoryPath)

			// 根据文件名获取对应的元数据
			const fileType = CospecDiffIntegration.getFileType(fileName)
			const fileMetadata = fileType && metadata?.[fileType]

			if (!fileMetadata) {
				return {
					success: false,
					error: "无法获取文件元数据",
				}
			}

			return await this.getDiffWithTaskInfo({
				fileName,
				lastTaskId: fileMetadata?.lastTaskId,
				lastCheckpointId: fileMetadata?.lastCheckpointId,
				workspaceRoot,
				globalStorageDir,
				filePath,
			})
		} catch (error) {
			return {
				success: false,
				error: `[CospecDiffIntegration] 获取文件差异失败: ${error.message}`,
			}
		}
	}

	/**
	 * 使用指定的任务信息获取差异 (核心)
	 */
	private static async getDiffWithTaskInfo({
		fileName,
		lastTaskId,
		lastCheckpointId,
		workspaceRoot,
		globalStorageDir,
		filePath,
	}: {
		fileName: string
		lastTaskId: string
		lastCheckpointId: string
		workspaceRoot: string
		globalStorageDir: string
		filePath: string
	}): Promise<CospecDiffIntegrationResult | null> {
		const shadowGitDir = path.join(globalStorageDir, "tasks", lastTaskId, "checkpoints")
		const commitId = lastCheckpointId

		if (!commitId) {
			return null
		}

		// 使用 simple-git 创建 git 实例，指定影子仓库目录
		const git = simpleGit(shadowGitDir)

		// 获取文件在影子仓库中的相对路径
		const relativePath = path.relative(workspaceRoot, filePath)

		// 执行 git diff 获取文件差异
		const diffResult = await git.diff([commitId, "--", relativePath])

		// 获取文件在指定 commit 中的内容
		const fileContent = await git.show([`${commitId}:${relativePath}`])
		
		if (diffResult) {
			const curfileContent = await fs.promises.readFile(filePath, "utf-8")
			// 读取 filePath 文件内容
			// const fileContentString = Buffer.from(fileContent).toString('utf-8')
			if (curfileContent === fileContent) {
				throw new Error("文件内容相同，无差异")
			}
			// 有差异的情况
			return {
				success: true,
				hasDifference: true,
				diffContent: diffResult,
				fileContent: fileContent,
				filePath: filePath,
				lastTaskId: lastTaskId,
				lastCheckpointId,
			}
		} else {
			// 无差异的情况
			return {
				success: true,
				hasDifference: false,
				diffContent: "",
				fileContent: fileContent,
				filePath: filePath,
				lastTaskId: lastTaskId,
				lastCheckpointId: lastCheckpointId,
			}
		}
	}

	/**
	 * 获取工作区根目录
	 */
	private static getWorkspaceRoot(uri: vscode.Uri): string | null {
		const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri)
		return workspaceFolder?.uri.fsPath || null
	}

	/**
	 * 格式化差异内容用于显示
	 */
	static formatDiffForDisplay(diffResult: any): string {
		if (!diffResult.success) {
			return `获取差异失败: ${diffResult.error}`
		}

		if (!diffResult.hasDifference) {
			return "文件与 checkpoint 版本相同，无差异"
		}

		if (!diffResult.diffContent) {
			return "文件有差异，但无法获取详细内容"
		}

		// 添加头部信息
		const header = [
			`文件: ${path.basename(diffResult.filePath || "")}`,
			`任务: ${diffResult.lastTaskId || "unknown"}`,
			`差异内容:`,
			"---",
		].join("\n")

		return `${header}\n${diffResult.diffContent}`
	}

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

	/**
	 * 根据文件名获取文件类型
	 */
	private static getFileType(fileName: string): "design" | "requirements" | "tasks" | null {
		switch (fileName) {
			case "design.md":
				return "design"
			case "requirements.md":
				return "requirements"
			case "tasks.md":
				return "tasks"
			default:
				return null
		}
	}
}
