import * as vscode from "vscode"
import { ClineProvider } from "../../webview/ClineProvider"
import { InlineCompletionProvider } from "./inlineCompletionProvider"
import { CompletionProvider } from "./core/completionProvider"
export class CompletionServiceManager {
	private static instance: CompletionServiceManager | null = null
	private readonly cline: ClineProvider
	private readonly context: vscode.ExtensionContext

	public readonly inlineCompletionProvider: InlineCompletionProvider
	private constructor(context: vscode.ExtensionContext, provider: ClineProvider) {
		this.cline = provider
		this.context = context
		this.inlineCompletionProvider = new InlineCompletionProvider(context, provider)
		this.load()
	}
	public static initialize(context: vscode.ExtensionContext, provider: ClineProvider) {
		if (!CompletionServiceManager.instance) {
			CompletionServiceManager.instance = new CompletionServiceManager(context, provider)
		}
		return CompletionServiceManager.instance
	}
	private load() {
		this.context.subscriptions.push(
			// Code completion service
			vscode.languages.registerInlineCompletionItemProvider({ pattern: "**" }, this.inlineCompletionProvider),
		)
		this.context.subscriptions.push(
			vscode.commands.registerCommand("zgsm-completion.shortKeyCut", async () => {
				await this.context.workspaceState.update("shortCutKeys", true)
				await vscode.commands.executeCommand("editor.action.inlineSuggest.trigger")
			}),
		)
		this.context.subscriptions.push(
			vscode.commands.registerCommand(
				"zgsm-completion.logAutocompleteOutcome",
				async (completionId: string, completionProvider: CompletionProvider) => {
					completionProvider.accept(completionId)
				},
			),
		)
	}
}
