/**
 * Copyright (c) 2024 - Sangfor LTD.
 *
 * All rights reserved. Code licensed under the MIT license
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 */
import * as vscode from "vscode"
import { getLanguageClass } from "../base/language/factory"
import { CODELENS_FUNC } from "../base/common/constant"
import { Logger } from "../base/common/log-util"
import { LangSetting, LangSwitch, getLanguageByFilePath } from "../base/common/lang-util"

/**
 * Service provider for codelens (header menu group for symbol definitions)
 */
export class CostrictCodeLensProvider implements vscode.CodeLensProvider {
	async provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken) {
		const editor = vscode.window.activeTextEditor
		if (!editor) {
			return []
		}
		if (!LangSetting.codelensEnabled) {
			return []
		}
		const language = getLanguageByFilePath(editor.document.uri.fsPath)
		const sw = LangSetting.getCodelensDisable(language)
		if (sw === LangSwitch.Disabled || sw === LangSwitch.Unsupported) {
			return []
		}
		// Check if this view needs to display codelens buttons
		const langClass = getLanguageClass(language)
		const checkResult = langClass.checkCodelensEnabled()
		if (!checkResult) {
			return []
		}

		const results: any[] = []
		const config = vscode.workspace.getConfiguration(`FunctionQuickCommands.quickCommandButtons`)

		// Get the codeLens buttons that need to be displayed from the configuration
		const configCodelensDicts = Object.entries(CODELENS_FUNC)
			.filter(([key, value]) => config.get<boolean>(key))
			.reduce(
				(acc, [key, value]) => {
					acc[key] = value
					return acc
				},
				{} as Record<string, (typeof CODELENS_FUNC)[keyof typeof CODELENS_FUNC]>,
			)

		if (Object.keys(configCodelensDicts).length === 0) {
			Logger.log("No quick commands are configured")
			return results
		}

		const docSymbols: any = await (async function (editor) {
			const docSymbols = await vscode.commands.executeCommand(
				"vscode.executeDocumentSymbolProvider",
				editor.document.uri,
			)
			return docSymbols
		})(editor)
		if (!docSymbols || 0 === docSymbols.length) {
			Logger.log("No DocumentSymbol was parsed, no codelens")
			return []
		}

		const showableSymbols = langClass.getShowableSymbols(docSymbols)
		for (const documentSymbol of showableSymbols) {
			for (const [key, codelensItem] of Object.entries(configCodelensDicts)) {
				// Determine which buttons can be displayed, which may vary by language and context
				if (!langClass.checkItemShowable(codelensItem, documentSymbol)) continue
				const range = new vscode.Range(documentSymbol.range.start.line, 0, documentSymbol.range.start.line, 0)
				results.push(
					new vscode.CodeLens(range, {
						title: codelensItem.actionName,
						tooltip: codelensItem.tooltip,
						command: codelensItem.command,
						arguments: [documentSymbol, codelensItem],
					}),
				)
			}
		}
		return results
	}
}
