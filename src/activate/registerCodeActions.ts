import * as vscode from "vscode"

import { CodeActionId, CodeActionName } from "@roo-code/types"

import { getCodeActionCommand } from "../utils/commands"
import { EditorUtils } from "../integrations/editor/EditorUtils"
import { ClineProvider } from "../core/webview/ClineProvider"

export const registerCodeActions = (context: vscode.ExtensionContext) => {
	registerCodeAction(context, "explainCode", "EXPLAIN")
	registerCodeAction(context, "fixCode", "FIX")
	registerCodeAction(context, "improveCode", "IMPROVE")
	registerCodeAction(context, "addToContext", "ADD_TO_CONTEXT")
}

const registerCodeAction = (context: vscode.ExtensionContext, command: CodeActionId, promptType: CodeActionName) => {
	let userInput: string | undefined

	context.subscriptions.push(
		vscode.commands.registerCommand(getCodeActionCommand(command), async (...args: any[]) => {
			// Handle both code action and direct command cases.
			let filePath: string
			let selectedText: string
			let startLine: number | undefined
			let endLine: number | undefined
			let diagnostics: any[] | undefined

			if (args.length > 1) {
				// Called from code action.
				;[filePath, selectedText, startLine, endLine, diagnostics] = args
			} else {
				// Called directly from command palette or keyboard shortcut.
				const context = EditorUtils.getEditorContext()

				if (!context) {
					return
				}

				;({ filePath, selectedText, startLine, endLine, diagnostics } = context)
			}

			const params = {
				...{ filePath, selectedText },
				...(startLine !== undefined ? { startLine: startLine.toString() } : {}),
				...(endLine !== undefined ? { endLine: endLine.toString() } : {}),
				...(diagnostics ? { diagnostics } : {}),
				...(userInput ? { userInput } : {}),
			}

			await ClineProvider.handleCodeAction(command, promptType, params)

			// If this is the addToContext command, also focus the input field
			if (command === "addToContext") {
				// Focus the Roo Code sidebar/panel
				const visibleProvider = ClineProvider.getVisibleInstance()
				if (!visibleProvider) {
					// If no visible provider, try to show the sidebar view
					await vscode.commands.executeCommand("roo-cline.SidebarProvider.focus")
				}
				// Send focus input message after a short delay to ensure the view is ready
				setTimeout(async () => {
					const provider = ClineProvider.getVisibleInstance()
					if (provider) {
						await provider.postMessageToWebview({ type: "action", action: "focusInput" })
					}
				}, 100)
			}
		}),
	)
}
