import {
	InlineCompletionItemProvider,
	InlineCompletionItem,
	TextDocument,
	Position,
	Range,
	InlineCompletionContext,
	CancellationToken,
	ExtensionContext,
	Disposable,
	workspace,
	InlineCompletionList,
	SelectedCompletionInfo,
} from "vscode"
import * as vscode from "vscode"
import { v7 as uuidv7 } from "uuid"
import { CompletionProvider, AutoCompleteInput, CompletionErrorHandler } from "./core/completionProvider"
import { CompletionStatusBar } from "./statusBar"
import { ClineProvider } from "../../webview/ClineProvider"
import { extractPrefixSuffix, getDependencyImports } from "./utils"
import { getWorkspacePath, toRelativePath } from "../../../utils/path"
import { AutocompleteOutcome, CalculateHideScore } from "./types"
import { LangSetting, LangSwitch } from "../base/common/lang-util"
import { RecentlyEditedTracker } from "./context/recentlyEditedTracker"
import { RecentlyVisitedRangesService } from "./context/recentlyVisitedRangesService"
import { VsCodeIde } from "./core/VSCodeIde"
import { IDE } from "./types/ide"
import { getAllSnippets } from "./snippets"
import { openedFilesLruCache } from "./utils/openedFilesLruCache"
import { configCompletion } from "../base/common/constant"
import { TelemetryService } from "@roo-code/telemetry"
import { CodeCompletionError } from "../telemetry"
import { TextAcceptanceAction } from "./utils/autocompleteLoggingService"

export class InlineCompletionProvider implements InlineCompletionItemProvider {
	private completionProvider: CompletionProvider
	private disposables: Disposable[] = []
	private ide: IDE
	private recentlyEditedTracker: RecentlyEditedTracker
	private recentlyVisitedRanges: RecentlyVisitedRangesService
	private completionStatusBar: CompletionStatusBar

	constructor(
		private readonly context: ExtensionContext,
		private readonly provider: ClineProvider,
	) {
		this.ide = new VsCodeIde(context)
		this.recentlyEditedTracker = new RecentlyEditedTracker(this.ide)
		this.recentlyVisitedRanges = new RecentlyVisitedRangesService(this.ide)
		this.completionStatusBar = CompletionStatusBar.getInstance()
		const onError: CompletionErrorHandler = (error) => {
			this.provider.log(`[Completion Error]: ${error}`)
			TelemetryService.instance.captureError(`TabCompletion_${CodeCompletionError.ApiError}`)
			this.completionStatusBar.fail(error as any)
		}
		this.completionProvider = new CompletionProvider(provider, onError)
		this._setupActiveTextEditorChangeListener()
	}
	public async provideInlineCompletionItems(
		document: TextDocument,
		position: Position,
		context: InlineCompletionContext,
		token: CancellationToken,
	): Promise<InlineCompletionItem[] | InlineCompletionList> {
		const abortController = new AbortController()
		const signal = abortController.signal
		token.onCancellationRequested(() => {
			abortController.abort()
		})
		if (!(await this.isProviderSupported())) {
			this.completionStatusBar.notSupport()
			return []
		}
		if (document.uri.scheme === "vscode-scm") {
			return []
		}

		const editor = vscode.window.activeTextEditor
		if (!editor) {
			return []
		}
		// Don't autocomplete with multi-cursor
		if (editor && editor.selections.length > 1) {
			return []
		}

		const selectedCompletionInfo = context.selectedCompletionInfo

		// This code checks if there is a selected completion suggestion in the given context and ensures that it is valid
		// To improve the accuracy of suggestions it checks if the user has typed at least 4 characters
		// This helps refine and filter out irrelevant autocomplete options
		if (selectedCompletionInfo) {
			const { text, range } = selectedCompletionInfo
			const typedText = document.getText(range)

			const typedLength = range.end.character - range.start.character

			if (typedLength < 4) {
				return []
			}

			if (!text.startsWith(typedText)) {
				return []
			}
		}

		this.completionStatusBar.loading()
		let triggerMode = "auto"
		if (this.context.workspaceState.get("shortCutKeys") === true) {
			triggerMode = "manual"
			this.context.workspaceState.update("shortCutKeys", false)
		}
		if (!this.isCompletionAllowed(triggerMode, document.languageId)) {
			this.completionStatusBar.noSuggest()
			return []
		}

		const input = await this._prepareInput(document, position)
		const result = await this.completionProvider.provideInlineCompletionItems(input, signal)

		if (!result || !result.completion) {
			this.completionStatusBar.noSuggest()
			return []
		}
		this.provider.log(`[Completions]: ${JSON.stringify(result)}`)
		const willDisplay = this.willDisplay(document, selectedCompletionInfo, signal, result)
		if (!willDisplay) {
			return []
		}
		this.completionProvider.markDisplayed(result.completionId, result)

		this.completionStatusBar.complete()
		const autocompleteItem = new InlineCompletionItem(result.completion, new Range(position, position), {
			title: "Log Autocomplete Outcome",
			command: "zgsm-completion.logAutocompleteOutcome",
			arguments: [result.completionId, this.completionProvider],
		})
		// 返回 InlineCompletionItem
		return [autocompleteItem]
	}
	private async _prepareInput(document: TextDocument, position: Position): Promise<AutoCompleteInput> {
		const completionId = uuidv7()
		const { prefix, suffix } = extractPrefixSuffix(document, position)
		const projectPath = getWorkspacePath()
		const calculateHideScore = await this._calculateHideScore(document, position)
		const relativePath = toRelativePath(document.uri.fsPath, projectPath)
		const importContent = getDependencyImports(relativePath, document.getText())
		const filepath = document.uri.toString()
		const recentlyVisitedRanges = this.recentlyVisitedRanges.getSnippets()
		const recentlyEditedRanges = await this.recentlyEditedTracker.getRecentlyEditedRanges()
		const lastCompletedCompletion = this.completionProvider.getLastCompletedCompletion()
		const {
			recentlyEditedRangeSnippets,
			recentlyVisitedRangesSnippets,
			clipboardSnippets,
			recentlyOpenedFileSnippets,
		} = await getAllSnippets({
			recentlyEditedRanges,
			recentlyVisitedRanges,
			filepath,
			ide: this.ide,
		})
		return {
			completionId,
			languageId: document.languageId,
			promptOptions: {
				prefix,
				suffix,
				project_path: projectPath,
				file_project_path: relativePath,
				import_content: importContent.join("\n"),
				recently_edited_ranges: recentlyEditedRangeSnippets,
				recently_visited_ranges: recentlyVisitedRangesSnippets,
				clipboard_content: clipboardSnippets,
				recently_opened_files: recentlyOpenedFileSnippets,
			},
			calculateHideScore,
			previousCompletionId: lastCompletedCompletion?.outcome.completionId ?? "",
			filepath: relativePath,
		}
	}
	private async _calculateHideScore(document: TextDocument, position: Position): Promise<CalculateHideScore> {
		const lastCompletedCompletion = this.completionProvider.getLastCompletedCompletion()
		return {
			is_whitespace_after_cursor: this._isWhitespaceAfterCursor(document, position),
			document_length: document.getText().length,
			prompt_end_pos: document.offsetAt(position),
			previous_label: lastCompletedCompletion?.action === TextAcceptanceAction.ACCEPTED ? 1 : 0,
			previous_label_timestamp: lastCompletedCompletion?.completedAt ?? 0,
		}
	}

	/**
	 * 检查光标后是否全为空白字符
	 */
	private _isWhitespaceAfterCursor(document: TextDocument, position: Position): boolean {
		const lineText = document.lineAt(position.line).text
		const textAfterCursor = lineText.substring(position.character)
		return textAfterCursor.trim() === ""
	}
	/**
	 * 判断是否允许代码补全
	 * @param triggerMode 触发模式: "auto" | "manual"
	 * @param language 编程语言标识
	 * @returns 是否允许补全
	 */
	private isCompletionAllowed(triggerMode: string, language: string): boolean {
		// 全局禁用时直接返回
		if (!LangSetting.completionEnabled) {
			return false
		}

		const langSwitch = LangSetting.getCompletionDisable(language)

		// 不支持的语言直接禁用
		if (langSwitch === LangSwitch.Unsupported) {
			return false
		}

		// 自动模式下需检查语言开关，手动模式强制允许
		return triggerMode !== "auto" || langSwitch !== LangSwitch.Disabled
	}

	private async isProviderSupported(): Promise<boolean> {
		const { apiConfiguration } = await this.provider.getState()
		return apiConfiguration.apiProvider === "zgsm"
	}

	private _setupActiveTextEditorChangeListener(): void {
		this.ide.onDidChangeActiveTextEditor((fileUri) => {
			openedFilesLruCache.set(fileUri, fileUri)
		})
	}
	willDisplay(
		document: TextDocument,
		selectedCompletionInfo: SelectedCompletionInfo | undefined,
		abortSignal: AbortSignal,
		outcome: AutocompleteOutcome,
	): boolean {
		if (selectedCompletionInfo) {
			const { text } = selectedCompletionInfo
			if (!outcome.completion.startsWith(text)) {
				return false
			}
		}

		if (abortSignal.aborted) {
			return false
		}

		return true
	}
	public dispose(): void {
		Disposable.from(...this.disposables).dispose()
		this.recentlyEditedTracker.dispose()
		this.recentlyVisitedRanges.dispose()
	}
}
