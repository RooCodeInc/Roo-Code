/**
 * CoworkflowDecorationProvider - Manages visual status indicators for tasks with hierarchical support
 */

import * as vscode from "vscode"
import {
	IHierarchicalCoworkflowDecorationProvider,
	TaskStatus,
	TaskStatusType,
	HierarchicalTaskStatus,
	HierarchyNode,
	HierarchyDecorationConfig,
	IndentStyle,
	IHierarchyDetector,
	IHierarchyDecorationStrategy,
} from "./types"
import { CoworkflowErrorHandler } from "./CoworkflowErrorHandler"

/**
 * 层级检测器实现
 */
class HierarchyDetector implements IHierarchyDetector {
	private readonly INDENT_PATTERNS = [
		/^(\s*)-\s+\[([ x-])\]\s+(.+)$/, // 空格缩进
		/^(\t*)-\s+\[([ x-])\]\s+(.+)$/, // Tab缩进
	]
	private readonly TASK_PATTERN = /^-\s+\[([ x-])\]\s+(.+)$/ // 无缩进任务模式

	/**
	 * 检测任务的层级深度
	 */
	detectHierarchyLevel(line: string): number {
		const trimmedLine = line.trimEnd()
		for (const pattern of this.INDENT_PATTERNS) {
			const match = pattern.exec(trimmedLine)
			if (match) {
				const indentStr = match[1]
				// 计算缩进级别：2个空格或1个Tab = 1级
				const spaceCount = (indentStr.match(/\s/g) || []).length
				const tabCount = (indentStr.match(/\t/g) || []).length
				return Math.floor(spaceCount / 2) + tabCount
			}
		}
		// 检查无缩进的任务
		if (this.TASK_PATTERN.test(trimmedLine)) {
			return 0 // 根级别
		}
		return -1 // 非任务行
	}

	/**
	 * 检测是否为任务行（包括无缩进的任务行）
	 */
	isTaskLine(line: string): boolean {
		const trimmedLine = line.trimEnd()
		// 检查有缩进的任务
		for (const pattern of this.INDENT_PATTERNS) {
			if (pattern.test(trimmedLine)) {
				return true
			}
		}
		// 检查无缩进的任务
		return this.TASK_PATTERN.test(trimmedLine)
	}

	/**
	 * 检测是否为子内容行（包括无缩进的子内容）
	 */
	isChildContentLine(line: string): boolean {
		const trimmedLine = line.trim()

		// 空行不是子内容
		if (trimmedLine === "") {
			return false
		}

		// 任务行不是子内容
		if (this.isTaskLine(line)) {
			return false
		}

		// Markdown 标题行不是子内容
		if (trimmedLine.startsWith("#")) {
			return false
		}

		// 其他所有行都视为子内容（包括无缩进的普通文本、列表项等）
		return true
	}

	/**
	 * 构建层级关系树
	 */
	buildHierarchyTree(tasks: HierarchicalTaskStatus[]): HierarchyNode[] {
		const stack: HierarchyNode[] = []
		const roots: HierarchyNode[] = []

		for (const task of tasks) {
			const node: HierarchyNode = {
				task,
				children: [],
				parent: null,
				level: task.hierarchyLevel,
			}

			// 找到正确的父节点
			while (stack.length > 0 && stack[stack.length - 1].level >= task.hierarchyLevel) {
				stack.pop()
			}

			if (stack.length === 0) {
				// 根节点
				roots.push(node)
			} else {
				// 子节点
				const parent = stack[stack.length - 1]
				parent.children.push(node)
				node.parent = parent
			}

			stack.push(node)
		}

		return roots
	}

	/**
	 * 分析文档的缩进风格
	 */
	analyzeIndentStyle(document: vscode.TextDocument): IndentStyle {
		const lines = document.getText().split("\n")
		const indentSamples: string[] = []

		// 收集缩进样本
		for (const line of lines) {
			const match = /^(\s+)-\s+\[/.exec(line)
			if (match && match[1].length > 0) {
				indentSamples.push(match[1])
			}
		}

		// 分析缩进模式
		const spaceIndents = indentSamples.filter((s) => s.includes(" "))
		const tabIndents = indentSamples.filter((s) => s.includes("\t"))

		if (tabIndents.length > spaceIndents.length) {
			return { type: "tab", size: 1 }
		} else {
			// 计算最常见的空格缩进大小
			const spaceCounts = spaceIndents.map((s) => s.length)
			const commonSize = this.findMostCommon(spaceCounts) || 2
			return { type: "space", size: commonSize }
		}
	}

	private findMostCommon(numbers: number[]): number | null {
		const frequency: { [key: number]: number } = {}
		let maxCount = 0
		let mostCommon: number | null = null

		for (const num of numbers) {
			frequency[num] = (frequency[num] || 0) + 1
			if (frequency[num] > maxCount) {
				maxCount = frequency[num]
				mostCommon = num
			}
		}

		return mostCommon
	}
}

/**
 * 层级装饰类型管理器
 */
class HierarchyDecorationTypeManager {
	private decorationTypes: Map<string, vscode.TextEditorDecorationType> = new Map()
	private config: HierarchyDecorationConfig

	constructor(config: HierarchyDecorationConfig) {
		this.config = config
		this.initializeDecorationTypes()
	}

	/**
	 * 初始化所有层级的装饰类型
	 */
	private initializeDecorationTypes(): void {
		const statuses: TaskStatusType[] = ["not_started", "in_progress", "completed"]

		for (let level = 0; level < this.config.maxDepth; level++) {
			for (const status of statuses) {
				const key = this.getDecorationKey(status, level)
				const decorationType = this.createDecorationTypeForLevel(status, level)
				this.decorationTypes.set(key, decorationType)
			}
		}
	}

	/**
	 * 为特定层级和状态创建装饰类型
	 */
	private createDecorationTypeForLevel(status: TaskStatusType, level: number): vscode.TextEditorDecorationType {
		// 获取字体颜色和左边框颜色
		const fontColor = this.getFontColor(status)
		const borderColor = fontColor

		return vscode.window.createTextEditorDecorationType({
			color: fontColor,
			border: `0px solid transparent; border-left: 4px solid ${borderColor}`,
			isWholeLine: true,
		})
	}

	/**
	 * 获取字体颜色
	 */
	private getFontColor(status: TaskStatusType): string {
		switch (status) {
			case "not_started":
				return "#6B7280" // 灰色字体
			case "in_progress":
				return "#FFA500" // 橙黄色字体
			case "completed":
				return "#32CD32" // 绿色字体
			default:
				return "#6B7280"
		}
	}

	/**
	 * 获取装饰类型
	 */
	getDecorationType(status: TaskStatusType, level: number): vscode.TextEditorDecorationType | undefined {
		const key = this.getDecorationKey(status, level)
		return this.decorationTypes.get(key)
	}

	getDecorationKey(status: TaskStatusType, level: number): string {
		return `${status}_level_${level}`
	}

	dispose(): void {
		this.decorationTypes.forEach((type) => type.dispose())
		this.decorationTypes.clear()
	}
}

/**
 * 独立层级装饰策略
 */
class IndependentHierarchyDecorationStrategy implements IHierarchyDecorationStrategy {
	constructor(private typeManager: HierarchyDecorationTypeManager) {}

	applyDecorations(document: vscode.TextDocument, hierarchyTree: HierarchyNode[], editor: vscode.TextEditor): void {
		// 按层级和状态分组装饰
		const decorationGroups = new Map<string, vscode.Range[]>()

		this.collectDecorations(hierarchyTree, decorationGroups)

		// 应用装饰
		decorationGroups.forEach((ranges, key) => {
			const [status, levelStr] = key.split("_level_")
			const level = parseInt(levelStr)
			const decorationType = this.typeManager.getDecorationType(status as TaskStatusType, level)

			if (decorationType) {
				editor.setDecorations(decorationType, ranges)
			}
		})
	}

	private collectDecorations(nodes: HierarchyNode[], decorationGroups: Map<string, vscode.Range[]>): void {
		for (const node of nodes) {
			const key = this.typeManager.getDecorationKey(node.task.status, node.level)

			if (!decorationGroups.has(key)) {
				decorationGroups.set(key, [])
			}

			// 添加任务本身的装饰
			decorationGroups.get(key)!.push(node.task.range)

			// 为子内容添加相同的装饰效果
			if (node.task.childContentLines && node.task.childContentLines.length > 0) {
				for (const childLine of node.task.childContentLines) {
					// 为子内容创建范围，使用整行
					const childRange = new vscode.Range(childLine, 0, childLine, 1000)
					decorationGroups.get(key)!.push(childRange)
				}
			}

			// 递归处理子节点
			this.collectDecorations(node.children, decorationGroups)
		}
	}
}

/**
 * 默认层级装饰配置
 */
const DEFAULT_HIERARCHY_CONFIG: HierarchyDecorationConfig = {
	maxDepth: 10,
	borderWidth: {
		base: 2,
		increment: 1,
	},
	colors: {
		notStarted: [
			"#6B7280", // 灰色 - 根级别
			"#9CA3AF", // 浅灰色 - 1级
			"#D1D5DB", // 更浅灰色 - 2级
			"#E5E7EB", // 极浅灰色 - 3级+
		],
		inProgress: [
			"#F59E0B", // 橙色 - 根级别
			"#FBBF24", // 浅橙色 - 1级
			"#FCD34D", // 黄橙色 - 2级
			"#FDE68A", // 浅黄色 - 3级+
		],
		completed: [
			"#10B981", // 绿色 - 根级别
			"#34D399", // 浅绿色 - 1级
			"#6EE7B7", // 更浅绿色 - 2级
			"#A7F3D0", // 极浅绿色 - 3级+
		],
	},
	indentVisualization: {
		enabled: true,
		style: "line",
	},
}

export class CoworkflowDecorationProvider implements IHierarchicalCoworkflowDecorationProvider {
	private disposables: vscode.Disposable[] = []
	private decorationTypes: Map<TaskStatusType, vscode.TextEditorDecorationType> = new Map()
	private documentDecorations: Map<string, TaskStatus[]> = new Map()
	private hierarchyDocumentDecorations: Map<string, HierarchicalTaskStatus[]> = new Map()
	private errorHandler: CoworkflowErrorHandler
	private hierarchyDetector: IHierarchyDetector
	private hierarchyTypeManager: HierarchyDecorationTypeManager
	private hierarchyStrategy: IHierarchyDecorationStrategy
	private hierarchyConfig: HierarchyDecorationConfig

	constructor(hierarchyConfig?: HierarchyDecorationConfig) {
		this.errorHandler = new CoworkflowErrorHandler()
		this.hierarchyConfig = hierarchyConfig || DEFAULT_HIERARCHY_CONFIG
		this.hierarchyDetector = new HierarchyDetector()
		this.hierarchyTypeManager = new HierarchyDecorationTypeManager(this.hierarchyConfig)
		this.hierarchyStrategy = new IndependentHierarchyDecorationStrategy(this.hierarchyTypeManager)
		this.initializeDecorationTypes()
		this.setupEventHandlers()
	}

	public dispose(): void {
		try {
			this.decorationTypes.forEach((decorationType) => {
				try {
					decorationType.dispose()
				} catch (error) {
					this.errorHandler.logError(
						this.errorHandler.createError(
							"provider_error",
							"warning",
							"Error disposing decoration type",
							error as Error,
						),
					)
				}
			})
			this.decorationTypes.clear()
			this.documentDecorations.clear()
			this.hierarchyDocumentDecorations.clear()
			this.hierarchyTypeManager.dispose()
			this.disposables.forEach((d) => {
				try {
					d.dispose()
				} catch (error) {
					this.errorHandler.logError(
						this.errorHandler.createError(
							"provider_error",
							"warning",
							"Error disposing event handler",
							error as Error,
						),
					)
				}
			})
			this.disposables = []
		} catch (error) {
			console.error("CoworkflowDecorationProvider: Error during disposal", error)
		}
	}

	public updateDecorations(document: vscode.TextDocument): void {
		// Only process tasks.md files in .cospec directories
		if (!this.isTasksDocument(document)) {
			return
		}

		try {
			// Validate document before parsing
			if (!this.isValidTasksDocument(document)) {
				this.errorHandler.logError(
					this.errorHandler.createError(
						"parsing_error",
						"warning",
						"Tasks document appears to be invalid - skipping decorations",
						undefined,
						document.uri,
					),
				)
				return
			}

			// 使用层级解析
			const hierarchicalTasks = this.parseHierarchicalTaskStatuses(document)
			this.hierarchyDocumentDecorations.set(document.uri.toString(), hierarchicalTasks)

			// 构建层级树
			const hierarchyTree = this.hierarchyDetector.buildHierarchyTree(hierarchicalTasks)

			// 应用层级装饰
			this.applyHierarchicalDecorations(document, hierarchyTree)

			// 保持向后兼容性 - 也更新传统装饰
			const taskStatuses = hierarchicalTasks.map((task) => ({
				line: task.line,
				range: task.range,
				status: task.status,
				text: task.text,
				taskId: task.taskId,
			}))
			this.documentDecorations.set(document.uri.toString(), taskStatuses)
		} catch (error) {
			const coworkflowError = this.errorHandler.createError(
				"parsing_error",
				"error",
				"Error updating task decorations",
				error as Error,
				document.uri,
			)
			this.errorHandler.handleError(coworkflowError)

			// Clear decorations on error to avoid stale state
			this.clearDecorations(document)
		}
	}

	public clearDecorations(document: vscode.TextDocument): void {
		const documentKey = document.uri.toString()
		this.documentDecorations.delete(documentKey)

		// Clear all decoration types for this document
		const editors = vscode.window.visibleTextEditors.filter(
			(editor) => editor.document.uri.toString() === documentKey,
		)

		editors.forEach((editor) => {
			this.decorationTypes.forEach((decorationType) => {
				editor.setDecorations(decorationType, [])
			})
		})
	}

	public refreshAll(): void {
		// Refresh decorations for all open tasks.md documents
		vscode.window.visibleTextEditors.forEach((editor) => {
			if (this.isTasksDocument(editor.document)) {
				this.updateDecorations(editor.document)
			}
		})
	}

	private initializeDecorationTypes(): void {
		// No decoration for not_started tasks ([ ])
		this.decorationTypes.set("not_started", vscode.window.createTextEditorDecorationType({}))

		// Light yellow background for in_progress tasks ([-])
		this.decorationTypes.set(
			"in_progress",
			vscode.window.createTextEditorDecorationType({
				backgroundColor: "rgba(255, 255, 0, 0.2)",
				isWholeLine: true,
			}),
		)

		// Light green background for completed tasks ([x])
		this.decorationTypes.set(
			"completed",
			vscode.window.createTextEditorDecorationType({
				backgroundColor: "rgba(0, 255, 0, 0.2)",
				isWholeLine: true,
			}),
		)
	}

	private setupEventHandlers(): void {
		// Update decorations when document content changes
		this.disposables.push(
			vscode.workspace.onDidChangeTextDocument((event) => {
				if (this.isTasksDocument(event.document)) {
					// Debounce rapid changes
					setTimeout(() => {
						this.updateDecorations(event.document)
					}, 100)
				}
			}),
		)

		// Update decorations when editor becomes visible
		this.disposables.push(
			vscode.window.onDidChangeVisibleTextEditors(() => {
				this.refreshAll()
			}),
		)

		// Clear decorations when document is closed
		this.disposables.push(
			vscode.workspace.onDidCloseTextDocument((document) => {
				this.clearDecorations(document)
			}),
		)
	}

	private isTasksDocument(document: vscode.TextDocument): boolean {
		const path = document.uri.path
		const fileName = path.split("/").pop()
		const parentDir = path.split("/")

		// Check if file is within .cospec directory
		if (!parentDir.includes(".cospec")) {
			return false
		}

		// Only apply decorations to files named exactly "tasks.md"
		return fileName === "tasks.md"
	}

	private isValidTasksDocument(document: vscode.TextDocument): boolean {
		try {
			const text = document.getText()

			// Check if document is empty
			if (!text || text.trim().length === 0) {
				return false
			}

			// Check if document is too large (potential memory issue)
			if (text.length > 1000000) {
				// 1MB limit
				this.errorHandler.logError(
					this.errorHandler.createError(
						"parsing_error",
						"warning",
						"Tasks document is very large - may impact performance",
						undefined,
						document.uri,
					),
				)
			}

			return true
		} catch (error) {
			this.errorHandler.logError(
				this.errorHandler.createError(
					"parsing_error",
					"error",
					"Error validating tasks document",
					error as Error,
					document.uri,
				),
			)
			return false
		}
	}

	private parseTaskStatus(statusChar: string): TaskStatusType {
		try {
			switch (statusChar) {
				case " ":
					return "not_started"
				case "-":
					return "in_progress"
				case "x":
					return "completed"
				default:
					this.errorHandler.logError(
						this.errorHandler.createError(
							"parsing_error",
							"warning",
							`Unknown task status character '${statusChar}' - defaulting to 'not_started'`,
						),
					)
					return "not_started"
			}
		} catch (error) {
			this.errorHandler.logError(
				this.errorHandler.createError(
					"parsing_error",
					"warning",
					"Error parsing task status - defaulting to not_started",
					error as Error,
				),
			)
			return "not_started"
		}
	}

	private applyDecorations(document: vscode.TextDocument, taskStatuses: TaskStatus[]): void {
		try {
			const editors = vscode.window.visibleTextEditors.filter(
				(editor) => editor.document.uri.toString() === document.uri.toString(),
			)

			if (editors.length === 0) {
				return
			}

			// Group task statuses by status type
			const decorationsByStatus = new Map<TaskStatusType, vscode.Range[]>()

			taskStatuses.forEach((task) => {
				try {
					if (!decorationsByStatus.has(task.status)) {
						decorationsByStatus.set(task.status, [])
					}
					decorationsByStatus.get(task.status)!.push(task.range)
				} catch (error) {
					this.errorHandler.logError(
						this.errorHandler.createError(
							"provider_error",
							"warning",
							`Error grouping decoration for task at line ${task.line + 1}`,
							error as Error,
							document.uri,
						),
					)
				}
			})

			// Apply decorations for each status type
			editors.forEach((editor) => {
				try {
					this.decorationTypes.forEach((decorationType, status) => {
						try {
							const ranges = decorationsByStatus.get(status) || []
							editor.setDecorations(decorationType, ranges)
						} catch (error) {
							this.errorHandler.logError(
								this.errorHandler.createError(
									"provider_error",
									"warning",
									`Error applying ${status} decorations`,
									error as Error,
									document.uri,
								),
							)
						}
					})
				} catch (error) {
					this.errorHandler.logError(
						this.errorHandler.createError(
							"provider_error",
							"warning",
							"Error applying decorations to editor",
							error as Error,
							document.uri,
						),
					)
				}
			})
		} catch (error) {
			const coworkflowError = this.errorHandler.createError(
				"provider_error",
				"error",
				"Error applying task decorations",
				error as Error,
				document.uri,
			)
			this.errorHandler.handleError(coworkflowError)
		}
	}

	/**
	 * 解析文档中的层级任务状态
	 */
	public parseHierarchicalTaskStatuses(document: vscode.TextDocument): HierarchicalTaskStatus[] {
		const hierarchicalTasks: HierarchicalTaskStatus[] = []

		try {
			const text = document.getText()
			const lines = text.split("\n")

			// 扩展的正则表达式支持缩进检测
			const taskItemRegex = /^(\s*)-\s+\[([ x-])\]\s+(.+)/
			// 子内容正则表达式：匹配缩进的普通文本行和列表项
			const childContentRegex = /^(\s+)(.+)/

			const hierarchyPath: number[] = []
			const levelCounters: number[] = []

			// 第一遍：解析所有任务
			lines.forEach((line, index) => {
				try {
					const match = taskItemRegex.exec(line)
					if (match) {
						const [, indentStr, statusChar, taskText] = match

						// 验证提取的数据
						if (!taskText || taskText.trim().length === 0) {
							this.errorHandler.logError(
								this.errorHandler.createError(
									"parsing_error",
									"warning",
									`Empty task text at line ${index + 1}`,
									undefined,
									document.uri,
								),
							)
							return
						}

						// 检测层级深度
						const hierarchyLevel = this.hierarchyDetector.detectHierarchyLevel(line)
						if (hierarchyLevel === -1) return

						const status = this.parseTaskStatus(statusChar)
						const range = new vscode.Range(index, 0, index, line.length)

						// 提取任务ID
						let taskId: string | undefined
						try {
							const taskIdMatch = taskText.match(/^(\d+(?:\.\d+)?)\s+/)
							taskId = taskIdMatch ? taskIdMatch[1] : undefined
						} catch (error) {
							this.errorHandler.logError(
								this.errorHandler.createError(
									"parsing_error",
									"info",
									`Error extracting task ID at line ${index + 1}`,
									error as Error,
									document.uri,
								),
							)
						}

						// 更新层级路径和计数器
						this.updateHierarchyPath(hierarchyLevel, hierarchyPath, levelCounters)

						// 构建层级ID
						const hierarchicalId = hierarchyPath.slice(0, hierarchyLevel + 1).join(".")

						// 查找父任务和子任务
						const parentLine = this.findParentLine(hierarchicalTasks, hierarchyLevel)
						const childrenLines: number[] = []
						const childContentLines: number[] = []

						const hierarchicalTask: HierarchicalTaskStatus = {
							line: index,
							range,
							status,
							text: taskText.trim(),
							taskId,
							hierarchyLevel,
							parentLine,
							childrenLines,
							childContentLines,
							hierarchyPath: [...hierarchyPath.slice(0, hierarchyLevel + 1)],
							hierarchicalId,
						}

						// 更新父任务的子任务列表
						if (parentLine !== undefined) {
							const parentTask = hierarchicalTasks.find((t) => t.line === parentLine)
							if (parentTask) {
								parentTask.childrenLines.push(index)
							}
						}

						hierarchicalTasks.push(hierarchicalTask)
					}
				} catch (error) {
					this.errorHandler.logError(
						this.errorHandler.createError(
							"parsing_error",
							"warning",
							`Error processing hierarchical task at line ${index + 1}`,
							error as Error,
							document.uri,
						),
					)
				}
			})

			// 第二遍：识别子内容并关联到父任务
			this.identifyChildContent(lines, hierarchicalTasks, childContentRegex)
		} catch (error) {
			this.errorHandler.logError(
				this.errorHandler.createError(
					"parsing_error",
					"error",
					"Error parsing hierarchical task statuses",
					error as Error,
					document.uri,
				),
			)
		}

		return hierarchicalTasks
	}

	/**
	 * 识别任务的子内容
	 */
	private identifyChildContent(
		lines: string[],
		hierarchicalTasks: HierarchicalTaskStatus[],
		childContentRegex: RegExp,
	): void {
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]

			// 使用层级检测器的新方法来判断是否为子内容
			if (!this.hierarchyDetector.isChildContentLine(line)) {
				continue
			}

			// 计算缩进层级（支持无缩进内容）
			let indentLevel = 0
			const match = childContentRegex.exec(line)
			if (match) {
				const [, indentStr] = match
				const spaceCount = (indentStr.match(/\s/g) || []).length
				const tabCount = (indentStr.match(/\t/g) || []).length
				indentLevel = Math.floor(spaceCount / 2) + tabCount
			}
			// 对于无缩进的内容，indentLevel 保持为 0

			// 查找此行应该属于哪个父任务
			const parentTask = this.findParentTaskForContent(hierarchicalTasks, i, indentLevel)

			if (parentTask) {
				parentTask.childContentLines.push(i)
			}
		}
	}

	/**
	 * 为子内容查找父任务
	 */
	private findParentTaskForContent(
		hierarchicalTasks: HierarchicalTaskStatus[],
		contentLine: number,
		contentIndentLevel: number,
	): HierarchicalTaskStatus | undefined {
		// 从当前行向上查找最近的任务
		for (let i = hierarchicalTasks.length - 1; i >= 0; i--) {
			const task = hierarchicalTasks[i]

			// 任务必须在内容行之前
			if (task.line >= contentLine) {
				continue
			}

			// 对于无缩进的内容（contentIndentLevel === 0），查找最近的同级或上级任务
			if (contentIndentLevel === 0) {
				// 检查是否有更近的任务在这个任务之后但仍在内容行之前
				let hasCloserTask = false
				for (let j = i + 1; j < hierarchicalTasks.length; j++) {
					const laterTask = hierarchicalTasks[j]
					if (laterTask.line < contentLine) {
						hasCloserTask = true
						break
					}
				}

				if (!hasCloserTask) {
					return task
				}
			} else {
				// 对于有缩进的内容，使用原有的逻辑：任务的缩进层级必须小于内容的缩进层级
				if (task.hierarchyLevel < contentIndentLevel) {
					// 检查是否有更近的任务在这个任务之后但仍在内容行之前
					let hasCloserTask = false
					for (let j = i + 1; j < hierarchicalTasks.length; j++) {
						const laterTask = hierarchicalTasks[j]
						if (laterTask.line < contentLine && laterTask.hierarchyLevel <= contentIndentLevel) {
							hasCloserTask = true
							break
						}
					}

					if (!hasCloserTask) {
						return task
					}
				}
			}
		}

		return undefined
	}

	/**
	 * 更新层级装饰配置
	 */
	public updateHierarchyConfig(config: HierarchyDecorationConfig): void {
		this.hierarchyConfig = config

		// 重新初始化装饰类型管理器
		this.hierarchyTypeManager.dispose()
		this.hierarchyTypeManager = new HierarchyDecorationTypeManager(config)
		this.hierarchyStrategy = new IndependentHierarchyDecorationStrategy(this.hierarchyTypeManager)

		// 刷新所有装饰
		this.refreshAll()
	}

	/**
	 * 获取当前层级装饰配置
	 */
	public getHierarchyConfig(): HierarchyDecorationConfig {
		return this.hierarchyConfig
	}

	/**
	 * 应用层级装饰
	 */
	private applyHierarchicalDecorations(document: vscode.TextDocument, hierarchyTree: HierarchyNode[]): void {
		try {
			const editors = vscode.window.visibleTextEditors.filter(
				(editor) => editor.document.uri.toString() === document.uri.toString(),
			)

			if (editors.length === 0) {
				return
			}

			editors.forEach((editor) => {
				this.hierarchyStrategy.applyDecorations(document, hierarchyTree, editor)
			})
		} catch (error) {
			const coworkflowError = this.errorHandler.createError(
				"provider_error",
				"error",
				"Error applying hierarchical decorations",
				error as Error,
				document.uri,
			)
			this.errorHandler.handleError(coworkflowError)
		}
	}

	/**
	 * 更新层级路径和计数器
	 */
	private updateHierarchyPath(level: number, hierarchyPath: number[], levelCounters: number[]): void {
		// 确保数组长度足够
		while (levelCounters.length <= level) {
			levelCounters.push(0)
		}
		while (hierarchyPath.length <= level) {
			hierarchyPath.push(0)
		}

		// 重置更深层级的计数器
		for (let i = level + 1; i < levelCounters.length; i++) {
			levelCounters[i] = 0
		}

		// 增加当前层级计数器
		levelCounters[level]++
		hierarchyPath[level] = levelCounters[level]

		// 截断路径到当前层级
		hierarchyPath.length = level + 1
	}

	/**
	 * 查找父任务行号
	 */
	private findParentLine(tasks: HierarchicalTaskStatus[], currentLevel: number): number | undefined {
		if (currentLevel === 0) return undefined

		// 从后往前查找上一级任务
		for (let i = tasks.length - 1; i >= 0; i--) {
			if (tasks[i].hierarchyLevel === currentLevel - 1) {
				return tasks[i].line
			}
		}

		return undefined
	}
}
