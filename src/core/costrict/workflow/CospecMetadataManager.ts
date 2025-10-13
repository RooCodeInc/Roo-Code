/**
 * .cospec 目录元数据管理器
 * 负责管理 .cometa.json 文件，记录最后的任务ID和checkpoint信息
 */

import * as fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"
import { safeWriteJson } from "../../../utils/safeWriteJson"

/**
 * 单个文件的元数据
 */
export interface FileMetadata {
	/** 最后修改的任务ID */
	lastTaskId: string
	/** 最后的checkpoint ID */
	lastCheckpointId: string
	/* 文件内容 */
	content?: string
}

/**
 * .cometa.json 文件的数据结构
 * 按文件类型分组存储元数据
 */
export interface CospecMetadata {
	/** design.md 文件的元数据 */
	design?: FileMetadata
	/** requirements.md 文件的元数据 */
	requirements?: FileMetadata
	/** tasks.md 文件的元数据 */
	tasks?: FileMetadata
}

/**
 * .cospec 元数据管理器
 */
export class CospecMetadataManager {
	private static readonly METADATA_FILENAME = ".cometa.json"
	private static readonly CURRENT_VERSION = "1.0.0"

	/**
	 * 获取指定目录的 .cometa.json 文件路径
	 */
	private static getMetadataPath(directoryPath: string): string {
		return path.join(directoryPath, this.METADATA_FILENAME)
	}

	/**
	 * 读取 .cometa.json 文件，如果不存在则创建默认文件
	 */
	static async readMetadata(directoryPath: string): Promise<CospecMetadata | null> {
		try {
			const metadataPath = this.getMetadataPath(directoryPath)
			const content = await fs.readFile(metadataPath, "utf8")
			const metadata = JSON.parse(content) as CospecMetadata
			
			console.log(`[CospecMetadataManager] 读取元数据成功: ${metadataPath}`, metadata)
			return metadata
		} catch (error) {
			if ((error as any).code === "ENOENT") {
				console.log(`[CospecMetadataManager] 元数据文件不存在，创建默认文件: ${directoryPath}`)
				
				// 创建默认元数据
				const defaultMetadata: CospecMetadata = {
					design: {
						lastTaskId: "",
						lastCheckpointId: ""
					},
					requirements: {
						lastTaskId: "",
						lastCheckpointId: ""
					},
					tasks: {
						lastTaskId: "",
						lastCheckpointId: ""
					}
				}
				
				try {
					// 写入默认元数据文件
					await this.writeMetadata(directoryPath, defaultMetadata)
					console.log(`[CospecMetadataManager] 已创建默认元数据文件: ${this.getMetadataPath(directoryPath)}`)
					return defaultMetadata
				} catch (writeError) {
					console.error(`[CospecMetadataManager] 创建默认元数据文件失败: ${directoryPath}`, writeError)
					return null
				}
			}
			console.error(`[CospecMetadataManager] 读取元数据失败: ${directoryPath}`, error)
			return null
		}
	}

	/**
	 * 写入 .cometa.json 文件
	 */
	static async writeMetadata(directoryPath: string, metadata: CospecMetadata): Promise<void> {
		try {
			const metadataPath = this.getMetadataPath(directoryPath)
			
			// 确保目录存在
			await fs.mkdir(directoryPath, { recursive: true })
			
			// 添加版本信息和时间戳
			const fullMetadata = {
				...metadata,
				version: this.CURRENT_VERSION,
				lastModified: new Date().toISOString()
			}
			
			// 使用 safeWriteJson 进行原子写入
			await safeWriteJson(metadataPath, fullMetadata)
			
			console.log(`[CospecMetadataManager] 写入元数据成功: ${metadataPath}`, fullMetadata)
		} catch (error) {
			console.error(`[CospecMetadataManager] 写入元数据失败: ${directoryPath}`, error)
			throw error
		}
	}

	/**
	 * 更新指定文件的元数据
	 */
	static async updateFileMetadata(
		filePath: string,
		taskId: string,
		checkpointId: string
	): Promise<void> {
		try {
			const directoryPath = path.dirname(filePath)
			const fileName = path.basename(filePath)
			
			// 读取现有元数据
			const existingMetadata = await this.readMetadata(directoryPath) || this.createDefaultMetadata()
			
			// 根据文件名确定文件类型
			const fileType = this.getFileType(fileName)
			if (!fileType) {
				console.warn(`[CospecMetadataManager] 不支持的文件类型: ${fileName}`)
				return
			}
			
			// 更新对应文件类型的元数据
			const updatedMetadata: CospecMetadata = {
				...existingMetadata,
				[fileType]: {
					lastTaskId: taskId,
					lastCheckpointId: checkpointId
				}
			}
			
			// 写入更新后的元数据
			await this.writeMetadata(directoryPath, updatedMetadata)
			
			console.log(`[CospecMetadataManager] 更新文件元数据: ${filePath}`, {
				taskId,
				checkpointId,
				fileName,
				fileType
			})
		} catch (error) {
			console.error(`[CospecMetadataManager] 更新文件元数据失败: ${filePath}`, error)
			throw error
		}
	}

	/**
	 * 从 VS Code URI 获取目录路径并更新元数据
	 */
	static async updateMetadataFromUri(
		uri: vscode.Uri,
		taskId: string,
		checkpointId: string
	): Promise<void> {
		const filePath = uri.fsPath
		await this.updateFileMetadata(filePath, taskId, checkpointId)
	}

	/**
	 * 获取指定目录的元数据，如果不存在则返回默认值
	 */
	static async getMetadataOrDefault(directoryPath: string): Promise<CospecMetadata> {
		const metadata = await this.readMetadata(directoryPath)
		return metadata || this.createDefaultMetadata()
	}

	/**
	 * 创建默认元数据
	 */
	static createDefaultMetadata(): CospecMetadata {
		return {
			design: { lastTaskId: '', lastCheckpointId: '' },
			requirements: { lastTaskId: '', lastCheckpointId: '' },
			tasks: { lastTaskId: '', lastCheckpointId: '' }
		}
	}

	/**
	 * 根据文件名获取文件类型
	 */
	static getFileType(fileName: string): 'design' | 'requirements' | 'tasks' | null {
		switch (fileName) {
			case 'design.md':
				return 'design'
			case 'requirements.md':
				return 'requirements'
			case 'tasks.md':
				return 'tasks'
			default:
				return null
		}
	}

}