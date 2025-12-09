import * as vscode from "vscode"
import { ClineProvider } from "../../webview/ClineProvider"
import { CompletionStatusBar } from "./statusBar"
import { CompletionServiceManager } from "./completionServiceManager"
export { CompletionStatusBar } from "./statusBar"
export const registerAutoCompletionProvider = (context: vscode.ExtensionContext, provider: ClineProvider) => {
	const statusBar = CompletionStatusBar.getInstance()
	statusBar.init(context)
	CompletionServiceManager.initialize(context, provider)
}
