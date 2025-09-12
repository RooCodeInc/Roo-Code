import * as vscode from "vscode"

import { CodeActionId, CodeActionName } from "@roo-code/types"

import { getCodeActionCommand } from "../utils/commands"
import { EditorUtils } from "../integrations/editor/EditorUtils"
import { ClineProvider } from "../core/webview/ClineProvider"

/**
 * Waits for the ClineProvider to become available after focusing the sidebar.
 * Uses a promise-based approach with polling to ensure the provider is ready.
 *
 * @param maxAttempts Maximum number of attempts to check for provider availability
 * @param intervalMs Interval between checks in milliseconds
 * @returns Promise that resolves to the ClineProvider instance or undefined if not found
 */
async function waitForProvider(maxAttempts: number = 10, intervalMs: number = 50): Promise<ClineProvider | undefined> {
	return new Promise((resolve) => {
		let attempts = 0

		const checkProvider = () => {
			attempts++
			const provider = ClineProvider.getVisibleInstance()

			if (provider) {
				// Provider is available
				resolve(provider)
			} else if (attempts >= maxAttempts) {
				// Max attempts reached, resolve with undefined
				resolve(undefined)
			} else {
				// Try again after interval
				setTimeout(checkProvider, intervalMs)
			}
		}

		// Start checking immediately
		checkProvider()
	})
}

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
				try {
					// Focus the Roo Code sidebar/panel
					let visibleProvider = ClineProvider.getVisibleInstance()

					if (!visibleProvider) {
						// If no visible provider, try to show the sidebar view
						await vscode.commands.executeCommand("roo-cline.SidebarProvider.focus")

						// Wait for the provider to become available with a promise-based approach
						visibleProvider = await waitForProvider()
					}

					// Ensure we have a provider and it's ready
					if (visibleProvider && visibleProvider.isWebviewReady()) {
						// Send focus input message with a small delay to ensure DOM is ready
						// This is more reliable than the previous setTimeout approach
						await new Promise((resolve) => setTimeout(resolve, 50))
						await visibleProvider.postMessageToWebview({ type: "action", action: "focusInput" })
					} else if (visibleProvider) {
						// Provider exists but webview might not be fully ready
						// Wait a bit longer and retry
						await waitForProvider(5, 100) // Wait up to 500ms more
						if (visibleProvider.isWebviewReady()) {
							await visibleProvider.postMessageToWebview({ type: "action", action: "focusInput" })
						}
					}
				} catch (error) {
					// Log error but don't throw - focusing input is not critical to the main operation
					console.error("Failed to focus input field:", error)
				}
			}
		}),
	)
}
