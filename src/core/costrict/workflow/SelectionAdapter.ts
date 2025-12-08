/**
 * Selection 适配器，用于在不同环境间转换 selection 对象
 * 解决 JetBrains 插件与 VSCode 插件之间的 activeEditor.selection 兼容性问题
 */

import * as vscode from "vscode"
import { isJetbrainsPlatform } from "../../../utils/platform"

/**
 * JetBrains 调用上下文接口
 */
interface JetBrainsCallContext {
	filePath: string
	lineNumber: number
	startLine?: number
	endLine?: number
	selectedText?: string
	taskText?: string
	documentType: string
	actionType: string
}

/**
 * Selection 适配器，用于在不同环境间转换 selection 对象
 */
export class SelectionAdapter {
	/**
	 * 获取当前活动的编辑器选择
	 * 在 JetBrains 环境下会重建虚拟的 selection 对象
	 */
	static getSelection(args?: any[]): vscode.Selection | undefined {
		// 原生 VSCode 环境
		if (!isJetbrainsPlatform()) {
			return vscode.window.activeTextEditor?.selection
		}

		// JetBrains 环境重建 selection
		return this.reconstructSelection(args)
	}

	/**
	 * 获取选中的文本内容
	 * 兼容不同环境的文本获取方式
	 */
	static getSelectedText(args?: any[]): string | undefined {
		// 原生 VSCode 环境
		if (!isJetbrainsPlatform()) {
			const activeEditor = vscode.window.activeTextEditor
			const selection = activeEditor?.selection
			if (selection && !selection.isEmpty) {
				return activeEditor.document.getText(selection)
			}
			return undefined
		}

		// JetBrains 环境直接获取
		return this.extractSelectedText(args)
	}

	/**
	 * 重建 JetBrains 环境下的 selection 对象
	 */
	private static reconstructSelection(args?: any[]): vscode.Selection {
		const context = this.extractJetbrainsContext(args)

		// 如果有明确的行范围，使用行范围
		if (context.startLine !== undefined && context.endLine !== undefined) {
			return new vscode.Selection(
				new vscode.Position(context.startLine, 0),
				new vscode.Position(context.endLine, 0),
			)
		}

		// 如果有选中文本但没有明确的行范围，尝试基于行号创建
		if (context.selectedText) {
			const line = context.lineNumber
			return new vscode.Selection(
				new vscode.Position(line, 0),
				new vscode.Position(line, context.selectedText.length),
			)
		}

		// 默认情况：创建空选择
		const line = context.lineNumber
		return new vscode.Selection(new vscode.Position(line, 0), new vscode.Position(line, 0))
	}

	/**
	 * 从参数中提取 JetBrains 上下文
	 */
	private static extractJetbrainsContext(args?: any[]): JetBrainsCallContext {
		if (!args || !Array.isArray(args) || args.length === 0) {
			throw new Error("Invalid arguments for JetBrains context extraction")
		}

		const params = args[0][0] // JetBrains 参数结构: [ [params] ]
		return {
			filePath: params.filePath,
			lineNumber: params.lineNumber,
			startLine: params.startLine,
			endLine: params.endLine,
			selectedText: params.selectedText,
			taskText: params.taskText,
			documentType: params.documentType,
			actionType: params.actionType,
		}
	}

	/**
	 * 提取选中的文本
	 */
	private static extractSelectedText(args?: any[]): string | undefined {
		try {
			const context = this.extractJetbrainsContext(args)
			return context.selectedText
		} catch (error) {
			console.warn("Failed to extract selected text from JetBrains args:", error)
			return undefined
		}
	}

	/**
	 * 检查是否有选中的内容
	 */
	static hasSelection(args?: any[]): boolean {
		// 原生 VSCode 环境
		if (!isJetbrainsPlatform()) {
			const activeEditor = vscode.window.activeTextEditor
			const selection = activeEditor?.selection
			return !!(selection && !selection.isEmpty)
		}

		// JetBrains 环境检查
		const selectedText = this.extractSelectedText(args)
		return !!selectedText && selectedText.trim().length > 0
	}

	/**
	 * 获取选择的范围信息
	 */
	static getSelectionRange(args?: any[]): vscode.Range | undefined {
		const selection = this.getSelection(args)
		if (!selection) return undefined

		return new vscode.Range(selection.start, selection.end)
	}
}
