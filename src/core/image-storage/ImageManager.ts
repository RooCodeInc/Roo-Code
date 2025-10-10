import path from "path"
import * as fs from "fs/promises"
import { fileExistsAtPath } from "../../utils/fs"

/**
 * 图片外部化存储管理器
 *
 * 功能：
 * - 将Base64图片数据保存到磁盘文件
 * - 消息中只保存图片ID引用，大幅降低内存占用
 * - 支持按需加载、删除和清理孤立图片
 *
 * 预期效果：
 * - 100张图片从667MB内存占用降至~50MB（降低92%）
 */
export class ImageManager {
	private imageDir: string
	private cachedMemoryUsageMB: number = 0
	private taskId: string | null = null

	/**
	 * @param globalStoragePath - 全局存储路径
	 */
	constructor(globalStoragePath: string) {
		this.imageDir = path.join(globalStoragePath, "images")
	}

	/**
	 * 设置当前任务ID（用于内存估算）
	 */
	setTaskId(taskId: string): void {
		this.taskId = taskId
	}

	/**
	 * 保存图片到磁盘并返回图片ID
	 *
	 * @param taskId - 任务ID
	 * @param imageData - Base64编码的图片数据（data:image/...;base64,...）
	 * @returns 图片ID
	 */
	async saveImage(taskId: string, imageData: string): Promise<string> {
		// 生成唯一图片ID
		const imageId = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`

		// 创建任务专用的图片目录
		const taskImageDir = path.join(this.imageDir, taskId)
		await fs.mkdir(taskImageDir, { recursive: true })

		// 解析图片格式和数据
		const matches = imageData.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/)
		if (!matches) {
			throw new Error("Invalid image data format")
		}

		const [, extension, base64Data] = matches
		const imagePath = path.join(taskImageDir, `${imageId}.${extension}`)

		// 解码Base64并保存到磁盘
		const buffer = Buffer.from(base64Data, "base64")
		await fs.writeFile(imagePath, buffer)

		return imageId
	}

	/**
	 * 从磁盘加载图片数据
	 *
	 * @param taskId - 任务ID
	 * @param imageId - 图片ID
	 * @returns Base64编码的图片数据
	 */
	async loadImage(taskId: string, imageId: string): Promise<string | undefined> {
		const taskImageDir = path.join(this.imageDir, taskId)

		// 查找匹配的图片文件（可能有不同的扩展名）
		try {
			const files = await fs.readdir(taskImageDir)
			const imageFile = files.find((file) => file.startsWith(imageId + "."))

			if (!imageFile) {
				return undefined
			}

			const imagePath = path.join(taskImageDir, imageFile)
			const buffer = await fs.readFile(imagePath)

			// 从文件扩展名确定MIME类型
			const extension = path.extname(imageFile).substring(1)
			const mimeType = this.getMimeType(extension)

			return `data:${mimeType};base64,${buffer.toString("base64")}`
		} catch (error) {
			// 目录不存在或读取失败
			return undefined
		}
	}

	/**
	 * 删除单个图片文件
	 *
	 * @param taskId - 任务ID
	 * @param imageId - 图片ID
	 */
	async deleteImage(taskId: string, imageId: string): Promise<void> {
		const taskImageDir = path.join(this.imageDir, taskId)

		try {
			const files = await fs.readdir(taskImageDir)
			const imageFile = files.find((file) => file.startsWith(imageId + "."))

			if (imageFile) {
				const imagePath = path.join(taskImageDir, imageFile)
				await fs.unlink(imagePath)
			}
		} catch (error) {
			// 忽略删除失败的情况
		}
	}

	/**
	 * 清理孤立的图片文件（不在引用列表中的图片）
	 *
	 * @param taskId - 任务ID
	 * @param referencedImageIds - 当前被引用的图片ID列表
	 * @returns 清理的图片数量
	 */
	async cleanupOrphanedImages(taskId: string, referencedImageIds: Set<string>): Promise<number> {
		const taskImageDir = path.join(this.imageDir, taskId)

		try {
			const exists = await fileExistsAtPath(taskImageDir)
			if (!exists) {
				return 0
			}

			const files = await fs.readdir(taskImageDir)
			let cleanedCount = 0

			for (const file of files) {
				// 提取图片ID（文件名格式：{timestamp}_{random}.{extension}）
				// 需要找到文件名中的第一个点之前的部分作为imageId
				const dotIndex = file.indexOf(".")
				if (dotIndex === -1) {
					continue // 跳过没有扩展名的文件
				}

				const imageId = file.substring(0, dotIndex)

				// 如果不在引用列表中，删除
				if (!referencedImageIds.has(imageId)) {
					const imagePath = path.join(taskImageDir, file)
					await fs.unlink(imagePath)
					cleanedCount++
				}
			}

			return cleanedCount
		} catch (error) {
			return 0
		}
	}

	/**
	 * 清理整个任务的所有图片
	 *
	 * @param taskId - 任务ID
	 */
	async cleanupTaskImages(taskId: string): Promise<void> {
		const taskImageDir = path.join(this.imageDir, taskId)

		try {
			await fs.rm(taskImageDir, { recursive: true, force: true })
		} catch (error) {
			// 忽略清理失败的情况
		}
	}

	/**
	 * 批量保存图片
	 *
	 * @param taskId - 任务ID
	 * @param imageDataArray - Base64编码的图片数据数组
	 * @returns 图片ID数组
	 */
	async saveImages(taskId: string, imageDataArray: string[]): Promise<string[]> {
		const imageIds: string[] = []

		for (const imageData of imageDataArray) {
			const imageId = await this.saveImage(taskId, imageData)
			imageIds.push(imageId)
		}

		return imageIds
	}

	/**
	 * 批量加载图片
	 *
	 * @param taskId - 任务ID
	 * @param imageIds - 图片ID数组
	 * @returns Base64编码的图片数据数组（不存在的图片会被跳过）
	 */
	async loadImages(taskId: string, imageIds: string[]): Promise<string[]> {
		const images: string[] = []

		for (const imageId of imageIds) {
			const imageData = await this.loadImage(taskId, imageId)
			if (imageData) {
				images.push(imageData)
			}
		}

		return images
	}

	/**
	 * 获取任务的图片统计信息
	 *
	 * @param taskId - 任务ID
	 * @returns 图片数量和总大小（MB）
	 */
	async getImageStats(taskId: string): Promise<{ count: number; totalSizeMB: number }> {
		const taskImageDir = path.join(this.imageDir, taskId)

		try {
			const exists = await fileExistsAtPath(taskImageDir)
			if (!exists) {
				return { count: 0, totalSizeMB: 0 }
			}

			const files = await fs.readdir(taskImageDir)
			let totalSize = 0

			for (const file of files) {
				const filePath = path.join(taskImageDir, file)
				const stats = await fs.stat(filePath)
				totalSize += stats.size
			}

			const totalSizeMB = totalSize / (1024 * 1024)

			// 更新缓存的内存使用值
			if (taskId === this.taskId) {
				this.cachedMemoryUsageMB = totalSizeMB
			}

			return {
				count: files.length,
				totalSizeMB,
			}
		} catch (error) {
			return { count: 0, totalSizeMB: 0 }
		}
	}

	/**
	 * 获取估算的内存使用（同步方法，返回缓存值）
	 *
	 * @returns 估算的内存使用（MB）
	 */
	getEstimatedMemoryUsage(): number {
		return this.cachedMemoryUsageMB
	}

	/**
	 * 更新内存使用缓存（后台异步更新）
	 */
	async updateMemoryUsageCache(): Promise<void> {
		if (this.taskId) {
			const stats = await this.getImageStats(this.taskId)
			this.cachedMemoryUsageMB = stats.totalSizeMB
		}
	}

	/**
	 * 根据文件扩展名获取MIME类型
	 */
	private getMimeType(extension: string): string {
		const mimeTypes: Record<string, string> = {
			png: "image/png",
			jpg: "image/jpeg",
			jpeg: "image/jpeg",
			gif: "image/gif",
			webp: "image/webp",
			svg: "image/svg+xml",
			bmp: "image/bmp",
			ico: "image/x-icon",
			tiff: "image/tiff",
			tif: "image/tiff",
			avif: "image/avif",
		}

		return mimeTypes[extension.toLowerCase()] || "image/png"
	}
}
