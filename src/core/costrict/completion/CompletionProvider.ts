import type { ClineProvider } from "../../webview/ClineProvider"
/**
 * Copyright (c) 2024 - Sangfor LTD.
 *
 * All rights reserved. Code licensed under the MIT license
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 */
import { Mutex } from "async-mutex"
import {
	CancellationToken,
	Disposable,
	ExtensionContext,
	InlineCompletionContext,
	InlineCompletionItem,
	InlineCompletionItemProvider,
	InlineCompletionList,
	Position,
	ProviderResult,
	Range,
	TextDocument,
	workspace,
} from "vscode"
import { COMPLETION_CONST } from "../base/common/constant"
import {
	CompletionAcception,
	CompletionDocumentInformation,
	CompletionPrompt,
	CompletionMode,
	CompletionRequirement,
} from "./completionDataInterface"
import { CompletionClient } from "./CompletionClient"
import { Logger } from "../base/common/log-util"
import { getLanguageByFilePath, LangSetting, LangSwitch } from "../base/common/lang-util"
import { CompletionCache } from "./completionCache"
import { getHideScoreArgs } from "./completionScore"
import { CompletionStatusBar } from "./completionStatusBar"
import { CompletionPoint } from "./completionPoint"
import { TelemetryService } from "@roo-code/telemetry"
import { CodeCompletionError, type TelemetryErrorType } from "../telemetry"

export class AICompletionProvider implements InlineCompletionItemProvider, Disposable {
	private disposables: Disposable[] = []
	private timer: NodeJS.Timeout | undefined
	private mutex: Mutex
	private provider: ClineProvider

	private extensionContext: ExtensionContext

	constructor(context: ExtensionContext, provider: ClineProvider) {
		this.activate()
		this.provider = provider
		this.mutex = new Mutex()
		this.timer = undefined
		this.extensionContext = context
		CompletionClient.setProvider(provider)
	}

	/**
	 * Get completion prompts.
	 * There are several situations where completion is not performed, and the reasons can be roughly divided into two categories:
	 * 1. Not allowed: The language is not supported, the configuration does not allow completion, or the service is abnormal.
	 * 2. Not needed: There is already a completion point at this position, the user does not trust the completion, the editing position has changed, or the leading string has changed.
	 */
	public async provideInlineCompletionItems(
		document: TextDocument,
		pos: Position,
		context: InlineCompletionContext,
		token: CancellationToken,
		// @ts-ignore
	): ProviderResult<InlineCompletionItem[] | InlineCompletionList> {
		/* eslint-disable no-async-promise-executor */
		let triggerMode = "auto"
		if (this.extensionContext.workspaceState.get("shortCutKeys") === true) {
			triggerMode = "manual"
			this.extensionContext.workspaceState.update("shortCutKeys", false)
		}
		const docInfo = this.getDocumentInformation(document)
		if (!this.enableCompletion(triggerMode, docInfo)) {
			return []
		}
		if (!this.needCompletion(pos)) {
			return []
		}
		this.cancelBrokens()
		let cp = this.createCompletionPoint(document, pos, triggerMode)
		const latest = CompletionCache.getLatest()
		const required = this.completionDecision(triggerMode, latest, cp)
		switch (required.mode) {
			case CompletionMode.DontNeed:
				return []
			case CompletionMode.Cached:
				if (!latest) {
					return []
				}
				return this.toInlineCompletions(document, latest)
			case CompletionMode.Partial:
				if (!latest) {
					return []
				}
				cp = CompletionCache.cache(cp)
				cp.fetched(required.remain ?? "")
				return this.toInlineCompletions(document, cp)
			default:
				break
		}
		cp = CompletionCache.cache(cp)
		const delayTimeval = this.calcDelayTimeval(triggerMode, cp)
		Logger.info(
			`Completion [${cp.id}]: Prepare for completion, trigger mode: ${triggerMode}, position: ${cp.pos.line}:${cp.pos.character}, delay time: ${delayTimeval}ms`,
		)

		const { apiConfiguration } = await this.provider.getState()

		if (apiConfiguration.apiProvider !== "zgsm") {
			CompletionStatusBar.disable()
			return []
		}

		return new Promise(async (resolve, reject) => {
			// Anti-shake
			await this.mutex.runExclusive(async () => {
				if (this.timer) {
					clearTimeout(this.timer)
					this.timer = undefined
				}
				// Create a new timer
				this.timer = setTimeout(async () => {
					Logger.info(
						`Completion [${cp.id}]: Completion enters the timer execution, position: ${pos.line}:${pos.character}`,
					)
					try {
						// Execute the calculation and rendering logic here
						const result = await this.doProvideInlineCompletionItems(document, cp, latest)
						resolve(result)
					} catch (error) {
						// Handle the case where the Promise is rejected
						Logger.info(`Completion [${cp.id}]: Promise rejected error: `, error)
						reject(error)
					}
				}, delayTimeval as number)
			})
		})
	}

	public activate() {
		this.setDidChangeTextDocument()
	}

	public dispose() {
		Disposable.from(...this.disposables).dispose()
	}

	/**
	 * Whether code completion is allowed.
	 */
	private enableCompletion(triggerMode: string, docInfo: CompletionDocumentInformation): boolean {
		if (!LangSetting.completionEnabled) {
			// Global disable will ignore the trigger mode
			// Logger.info("Completion: The completion extension is disabled, no completion will be performed.")
			return false
		}
		const sw = LangSetting.getCompletionDisable(docInfo.language)
		if (sw === LangSwitch.Unsupported) {
			// Logger.info(`Completion: The ${docInfo.language} language does not support code completion yet.`)
			return false
		}
		if (triggerMode === "auto") {
			if (sw === LangSwitch.Disabled) {
				return false
			}
		}
		// Manual mode will force completion
		return true
	}

	/**
	 * Whether code completion is needed.
	 */
	private needCompletion(pos: Position): boolean {
		// Check if there is no content before the cursor
		if (pos.isEqual(new Position(0, 0))) {
			Logger.info("Completion: The prompt is empty, no completion is needed.")
			return false
		}
		return true
	}

	/**
	 * Cancel the invalid completion points.
	 */
	private cancelBrokens() {
		const all = CompletionCache.all()
		for (let n = 0; n < all.length - 1; n++) {
			const cp = all[n]
			if (cp.getAcception() === CompletionAcception.None) {
				cp.cancel()
			}
		}
	}
	/**
	 * Compare with the previous completion point to determine the subsequent completion mode.
	 * Mark several previous completion points based on the information of the current position and determine the subsequent completion mode.
	 */
	private completionDecision(
		triggerMode: string,
		latest: CompletionPoint | undefined,
		cp: CompletionPoint,
	): CompletionRequirement {
		if (!latest) {
			return {
				mode: CompletionMode.Newest,
			}
		}
		if (cp.isSamePosition(latest)) {
			//  Same position
			if (latest.getContent().length === 0) {
				return {
					mode: CompletionMode.DontNeed,
				}
			}
			return {
				mode: CompletionMode.Cached,
			}
		}
		// Compare the relationship between the contents of the two completion points
		const res = this.matchCompletion(latest, cp)
		if ((res.mode === CompletionMode.Partial || res.mode === CompletionMode.Cached) && triggerMode === "manual") {
			res.mode = CompletionMode.Newest
		}
		return res
	}

	/**
	 * Determine whether the newly input characters at the completion point cur are part of the completion content of the previous completion point.
	 */
	private matchCompletion(last: CompletionPoint, cur: CompletionPoint): CompletionRequirement {
		// Get the code before the cursor of the last completion
		const lastPrefix = last.linePrefix
		// Get the completion content of the last completion
		const lastCompletion = last.getContent()
		// The content before the cursor of the current completion
		const curPrefix = cur.linePrefix
		if (!lastPrefix || !curPrefix || !lastCompletion || curPrefix.length < lastPrefix.length) {
			return {
				mode: CompletionMode.Newest,
			}
		}
		// Partial match (if the two upward arrows overlap, it is a complete match):
		// head ... lastPrefix.length> | <lastCompletion ... lastCompletion.length> | <lastSuffix ...
		//                                                                    ^     ^
		// head ... curPrefix[...]     | <inputString ... inputString.length> | ... | < curSuffix ...
		const inputString = curPrefix.substring(lastPrefix.length)
		if (!inputString) {
			// No input
			return {
				mode: CompletionMode.Cached,
			}
		}
		if (inputString.length > lastCompletion.length) {
			return {
				mode: CompletionMode.Newest,
			}
		}
		// If the newly added content compared to the last completion trigger is the overlapping content at the beginning of the last completion, directly cache the last completion content
		if (!lastCompletion.startsWith(inputString)) {
			return {
				mode: CompletionMode.Newest,
			}
		}
		if (lastCompletion.length === inputString.length) {
			return {
				mode: CompletionMode.Newest,
			}
		}
		return {
			mode: CompletionMode.Partial,
			matchLen: inputString.length,
			remain: lastCompletion.substring(inputString.length),
		}
	}
	/**
	 * Calculate the number of rejections on the same line.
	 */
	private calcLineRejection(cur: CompletionPoint): number {
		let rejected = 0
		const all = CompletionCache.all()
		for (let n = all.length - 1; n >= 0; n--) {
			const cp = all[n]
			if (!cp.isSameLine(cur)) {
				break
			}
			const acception = cp.getAcception()
			if (acception === CompletionAcception.Accepted) {
				break
			} else if (acception === CompletionAcception.Rejected) {
				rejected++
			}
		}
		return rejected
	}
	/**
	 * Update the delay time.
	 * The default delay time for completion is 300ms. Completion will only be triggered after the user stays at this position for this time to avoid excessive triggering and interfering with the user's input.
	 */
	private calcDelayTimeval(triggerMode: string, cp: CompletionPoint): number {
		if (triggerMode === "manual") {
			return COMPLETION_CONST.manualTriggerDelay
		}
		const latest = CompletionCache.getLatest()
		if (!latest) {
			return COMPLETION_CONST.suggestionDelay
		}
		const rejectCount = this.calcLineRejection(cp)
		let delayTimeval = rejectCount * COMPLETION_CONST.lineRejectedDelayIncrement
		delayTimeval = delayTimeval + COMPLETION_CONST.suggestionDelay
		if (delayTimeval > COMPLETION_CONST.lineRejectedDelayMax) {
			delayTimeval = COMPLETION_CONST.lineRejectedDelayMax
		}
		return delayTimeval
	}
	/**
	 * Convert the completion result returned by the LLM into inline completion items.
	 */
	private toInlineCompletions(document: TextDocument, cp: CompletionPoint): InlineCompletionItem[] {
		const content = cp.getContent()
		if (!content) {
			CompletionStatusBar.noSuggest()
			return []
		}
		CompletionStatusBar.complete()
		const completion = new InlineCompletionItem(content, new Range(cp.pos, cp.pos))
		return [completion]
	}

	/**
	 * Information related to the document at the current editing position, such as document name, document path, and programming language.
	 */
	private getDocumentInformation(document: TextDocument): CompletionDocumentInformation {
		return {
			fpath: document.uri.fsPath,
			language: getLanguageByFilePath(document.uri.fsPath),
		}
	}
	/**
	 * Initiate a request to get completion prompts.
	 */
	private async doProvideInlineCompletionItems(
		document: TextDocument,
		cp: CompletionPoint,
		latestCompletion: CompletionPoint | undefined, // It actually records whether the last code completion was adopted
	): Promise<InlineCompletionItem[] | InlineCompletionList> {
		// After the timeout, there is new input, and the current completion point cp is overwritten by the last completion point
		let latest = CompletionCache.getLatest()
		if (latest && !latest.isStrictSamePosition(cp)) {
			cp.cancel()
			return []
		}
		CompletionStatusBar.loading()
		cp.submit()
		return CompletionClient.callApi(cp, getHideScoreArgs(document, latest, cp), latestCompletion)
			.then((response) => {
				latest = CompletionCache.getLatest()
				if (latest && cp.id !== latest.id) {
					// Avoid echoing the completion content of the old request when multiple requests respond simultaneously
					Logger.info(
						`Completion [${cp.id}]: Ignore the completion result, the new completion [${latest.id}] is located at [${latest.getKey()}]`,
					)
					return Promise.resolve([] as InlineCompletionItem[])
				}
				if (!response) {
					CompletionStatusBar.noSuggest()
					return Promise.resolve([] as InlineCompletionItem[])
				}
				this.setCollectTimer(document, cp, COMPLETION_CONST.collectInterval)
				return Promise.resolve(this.toInlineCompletions(document, cp))
			})
			.catch((error) => {
				if (
					[CompletionAcception.Canceled, CompletionAcception.None].includes(cp.getAcception()) ||
					error.message === "Request was aborted."
				) {
					Logger.info(`Completion [${cp.id}]: The request has been cancelled.`)
					CompletionStatusBar.complete()
				} else {
					Logger.error(`Completion [${cp.id}]: Failed to get completion content`, error)
					this.recordError(CodeCompletionError.ApiError as TelemetryErrorType)
					CompletionStatusBar.fail(error)
				}
				return Promise.reject(error)
			})
	}

	/**
	 * Set the execution logic when the document changes.
	 */
	private setDidChangeTextDocument() {
		this.disposables.push(
			workspace.onDidChangeTextDocument((event) => {
				const document = event.document
				const changes = event.contentChanges
				const lastChange = changes?.[changes.length - 1]
				if (!lastChange) {
					return
				}
				const cur = CompletionCache.getLatest()
				if (!cur) {
					return
				}
				const pos = lastChange.range.start
				if (!cur.isSameAsDoc(document, pos)) {
					return
				}
				// The text changed this time
				let changeText = lastChange.text
				if (lastChange.text) {
					changeText = lastChange.text.trim()
				}
				// The text of the last completion
				const completionText = cur.getContent()
				if (!changeText || !completionText) {
					return
				}
				// If the changed text is exactly the same as the completion text, it means the user has accepted the completion
				if (completionText.replace(/\r\n/g, "\n") === changeText.replace(/\r\n/g, "\n")) {
					Logger.info(`Completion [${cur.id}]: The completion content has been accepted: ${changeText}`)
					cur.accept()
					cur.recordCompletion(CompletionAcception.Accepted, changeText.split("\n").length)
					CompletionCache.cache(cur)
					if (this.timer) {
						clearTimeout(this.timer)
						this.timer = undefined
					}
				}
			}),
		)
	}
	/*
	 * Set a code collection timer to collect the actual code input by the user after rejecting the completion.
	 * After the completion request is completed, report the actual code written by the user after a delay of timerDelay seconds.
	 * The actual code written by the user: Get the code on the same number of lines after the cursor as the completion code, and exclude the code that already exists in the file.
	 * If the user does not make any modifications or there is no completion, do not report.
	 */
	private setCollectTimer(document: TextDocument, cp: CompletionPoint, timerDelay: number) {
		Logger.info(`Completion [${cp.id}]: Start a collectTimer that will execute after ${timerDelay}ms`)

		const completionText = cp.getContent()
		const pos = cp.pos
		// Get the number of lines in the completion
		const completionsLineLength = completionText.split("\n").length - 1
		// Get the code on the same number of lines after the cursor in the document as the completion code
		const originTotalLines = document.lineCount
		const originText = document.getText(
			new Range(pos, document.lineAt(Math.min(originTotalLines - 1, pos.line + completionsLineLength)).range.end),
		)

		setTimeout(() => {
			Logger.info(`Completion [${cp.id}]: The collectTimer starts to execute.`)
			// Report the actual code written after accepting the completion on the same number of lines after the cursor as the completion code.
			const actualTotalLines = document.lineCount
			const actualText = document.getText(
				new Range(
					pos,
					document.lineAt(Math.min(actualTotalLines - 1, pos.line + completionsLineLength)).range.end,
				),
			)

			// If the actual code is the same as the completion code, it means the completion has been accepted, and do not report the code.
			if (
				completionText &&
				actualText &&
				completionText.replace(/\r\n/g, "\n") === actualText.replace(/\r\n/g, "\n")
			) {
				Logger.info("Completion: The actual code is the same as the completion code.", actualText)
				cp.unchanged()
				return
			}

			// If the actual code is the same as the code in the original file, it means no modification has been made, and do not report the code.
			if (originText.replace(/\r\n/g, "\n") === actualText.replace(/\r\n/g, "\n")) {
				Logger.info("Completion: The actual code is the same as the code in the original file.", actualText)
				cp.reject()
				cp.recordCompletion(CompletionAcception.Rejected, actualText.split("\n").length)
				cp.unchanged()
				return
			}

			// Check if the obtained actual code contains content from the original file. If so, remove it.
			const actualRows = actualText.split("\n")
			const originRows = originText.split("\n")

			let uploadRows = []
			// Check if the last line of the actual code does not exist in the original file, i.e., it is newly input content or completion content by the user.
			const actualLastRow = actualRows[actualRows.length - 1]
			if (!originRows.includes(actualLastRow)) {
				uploadRows = actualRows
			} else {
				// Compare each line of the actual code to see if it exists in the original file.
				for (let i = actualRows.length - 1; i >= 0; i--) {
					const actualRow = actualRows[i]
					if (!originRows.includes(actualRow)) {
						uploadRows.unshift(actualRow)
					}
				}
			}
			// Data reporting
			if (uploadRows.length) {
				const actualCode = uploadRows.join("\n")
				cp.changed(actualCode)
				Logger.info(`Completion [${cp.id}]: The completion content has been changed to: ${actualCode}`)
			}
		}, timerDelay)
	}

	/**
	 * Create a code completion point.
	 */
	private createCompletionPoint(document: TextDocument, pos: Position, triggerMode: string): CompletionPoint {
		const docInfo = this.getDocumentInformation(document)
		const prompt = this.getPrompt(document, pos)

		return new CompletionPoint("", docInfo, pos, prompt, triggerMode, Date.now())
	}

	/**
	 * Get the relevant code at the cursor position for subsequent completion.
	 */
	private getPrompt(document: TextDocument, pos: Position): CompletionPrompt {
		const prefix = document.getText(new Range(new Position(0, 0), pos))
		const suffix = document.getText(new Range(pos, document.lineAt(document.lineCount - 1).range.end))
		const lineText = document.lineAt(pos.line).text
		const linePrefix = lineText.substring(0, pos.character)
		const lineSuffix = lineText.substring(pos.character)

		return {
			prefix,
			suffix,
			cursor_line_prefix: linePrefix,
			cursor_line_suffix: lineSuffix,
		}
	}

	private recordError(type: TelemetryErrorType) {
		TelemetryService.instance.captureError(`TabCompletion_${type}`)
	}
}
