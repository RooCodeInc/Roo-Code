import { Completion } from "openai/resources/completions"
import { ClineProvider } from "../../../webview/ClineProvider"
import { settings } from "../../base/common/constant"
import { CalculateHideScore, PromptOptions, AutocompleteOutcome } from "../types"
import { COSTRICT_DEFAULT_HEADERS } from "../../../../shared/headers"
import { getClientId } from "../../../../utils/getClientId"
import { AutocompleteDebouncer } from "../utils/autocompleteDebouncer"
import { AutocompleteLoggingService } from "../utils/autocompleteLoggingService"
import { getWellKnownConfig } from "../../codebase-index/utils"
import { TextAcceptanceAction } from "../utils/autocompleteLoggingService"

export interface AutoCompleteInput {
	completionId: string
	languageId: string
	promptOptions: PromptOptions
	calculateHideScore: CalculateHideScore
	previousCompletionId: string
	filepath: string
}
const MAX_SUGGESTIONS_HISTORY = 20
const DEBOUNCE_DELAY_MS = 300
interface FillInAtCursorSuggestion {
	text: string
	prefix: string
	suffix: string
	completionId: string
}
interface ServiceConfig {
	protocol: string
	port: number
}
export type CompletionErrorHandler = (error: unknown) => void
/**
 * Find a matching suggestion from the history based on current prefix and suffix
 * @param prefix - The text before the cursor position
 * @param suffix - The text after the cursor position
 * @param suggestionsHistory - Array of previous suggestions (most recent last)
 * @returns The matching suggestion text, or null if no match found
 */
export function findMatchingSuggestion(
	prefix: string,
	suffix: string,
	suggestionsHistory: FillInAtCursorSuggestion[],
): { text: string; completionId: string } | null {
	// Search from most recent to least recent
	for (let i = suggestionsHistory.length - 1; i >= 0; i--) {
		const fillInAtCursor = suggestionsHistory[i]

		// First, try exact prefix/suffix match
		if (prefix === fillInAtCursor.prefix && suffix === fillInAtCursor.suffix) {
			return { text: fillInAtCursor.text, completionId: fillInAtCursor.completionId }
		}

		// If no exact match, but suggestion is available, check for partial typing
		// The user may have started typing the suggested text
		if (
			fillInAtCursor.text !== "" &&
			prefix.startsWith(fillInAtCursor.prefix) &&
			suffix === fillInAtCursor.suffix
		) {
			// Extract what the user has typed between the original prefix and current position
			const typedContent = prefix.substring(fillInAtCursor.prefix.length)

			// Check if the typed content matches the beginning of the suggestion
			if (fillInAtCursor.text.startsWith(typedContent)) {
				// Return the remaining part of the suggestion (with already-typed portion removed)
				return {
					text: fillInAtCursor.text.substring(typedContent.length),
					completionId: fillInAtCursor.completionId,
				}
			}
		}
	}

	return null
}
export class CompletionProvider {
	private suggestionsHistory: FillInAtCursorSuggestion[] = []
	private debouncer = new AutocompleteDebouncer()
	private loggingService = new AutocompleteLoggingService()
	private serverHostInfo = {
		protocol: "",
		status: "",
		port: "",
	}
	private serverHost: string = ""
	private readonly onError: CompletionErrorHandler
	constructor(
		private readonly provider: ClineProvider,
		onError: CompletionErrorHandler,
	) {
		this.onError = onError
		this.serverHost = this._getServerHostConfig()
	}

	private _getServerHostConfig(defaultValue?: ServiceConfig) {
		const { services } = getWellKnownConfig()
		const service = services.find((item: any) => item.name === "completion-agent")
		if (service) {
			this.serverHostInfo.port = service?.port || defaultValue?.port
			this.serverHostInfo.protocol = service?.protocol || "http"
			this.serverHostInfo.status = service?.status
		}
		return `${service?.protocol || "http"}://localhost:${service?.port || defaultValue?.port}`
	}

	/**
	 * 提供内联补全项
	 * @param input - 补全输入参数
	 * @param token - 可选的外部 AbortSignal（由 VSCode CancellationToken 转换而来）
	 * @returns 补全结果，或 undefined（取消/错误）
	 */
	public async provideInlineCompletionItems(
		input: AutoCompleteInput,
		token?: AbortSignal,
	): Promise<AutocompleteOutcome | undefined> {
		// 1. 取消之前的所有请求
		this.loggingService.cancel()

		// 2. 没有外部 token 才创建内部 controller
		if (!token) {
			const abortController = this.loggingService.createAbortController(input.completionId)
			token = abortController.signal
		}

		try {
			// 3. 检查是否已取消
			if (token.aborted) {
				return undefined
			}

			// 4. Debounce
			const shouldDebounce = await this.debouncer.delayAndShouldDebounce(DEBOUNCE_DELAY_MS, token)
			if (shouldDebounce) {
				return undefined
			}

			// 5. 再次检查是否已取消
			if (token.aborted) {
				return undefined
			}

			const startTime = Date.now()
			const { prefix, suffix } = input.promptOptions
			const suggestion = findMatchingSuggestion(prefix, suffix, this.suggestionsHistory)
			let completion: string | undefined = ""
			let completionId: string | undefined = ""
			let cacheHit = false

			if (suggestion != null) {
				completion = suggestion.text
				completionId = suggestion.completionId
				cacheHit = true
			} else {
				// 6. 发起网络请求
				await this.fetchAndCacheSuggestions(input, token)

				// 7. 竞态检查
				if (token.aborted) {
					return undefined
				}

				const suggestion = findMatchingSuggestion(prefix, suffix, this.suggestionsHistory)
				if (!suggestion) {
					return undefined
				}
				completion = suggestion.text
				completionId = suggestion.completionId
			}

			// 8. 最终检查是否已取消
			if (token.aborted) {
				return undefined
			}

			const outcome: AutocompleteOutcome = {
				time: Date.now() - startTime,
				completion,
				completionId,
				cacheHit,
				filepath: input.filepath,
				numLines: completion.split("\n").length,
				language: input.languageId,
			}
			return outcome
		} catch (e) {
			// 9. 错误处理：调用回调并返回 undefined
			this.onError(e)
			return undefined
		} finally {
			// 10. 清理资源
			this.loggingService.deleteAbortController(input.completionId)
		}
	}

	public updateSuggestions(fillInAtCursor: FillInAtCursorSuggestion): void {
		const isDuplicate = this.suggestionsHistory.some(
			(existing) =>
				existing.text === fillInAtCursor.text &&
				existing.prefix === fillInAtCursor.prefix &&
				existing.suffix === fillInAtCursor.suffix,
		)

		if (isDuplicate) {
			return
		}

		// Add to the end of the array (most recent)
		this.suggestionsHistory.push(fillInAtCursor)

		// Remove oldest if we exceed the limit
		if (this.suggestionsHistory.length > MAX_SUGGESTIONS_HISTORY) {
			this.suggestionsHistory.shift()
		}
	}

	private async fetchAndCacheSuggestions(input: AutoCompleteInput, token: AbortSignal) {
		const response = await this.getFromLLM(input, token)

		// 竞态检查：更新缓存前检查是否已取消
		if (token.aborted) {
			return
		}

		this.updateSuggestions(response.suggestions)
	}

	private async getFromLLM(input: AutoCompleteInput, token: AbortSignal) {
		const clientId = getClientId()
		const headers = {
			...COSTRICT_DEFAULT_HEADERS,
			"X-Request-ID": input.completionId,
			"zgsm-client-id": clientId,
		}
		const { prefix, suffix } = input.promptOptions
		if (!this.serverHostInfo.port || !this.serverHostInfo.protocol) {
			this.serverHost = this._getServerHostConfig()
		}
		const response = await fetch(`${this.serverHost}/completion-agent/api/v1/completions`, {
			method: "post",
			headers,
			signal: AbortSignal.any([token, AbortSignal.timeout(2000)]),
			body: JSON.stringify({
				model: settings.openai_model,
				temperature: settings.temperature,
				client_id: clientId,
				completion_id: input.completionId,
				language_id: input.languageId,
				calculate_hide_score: input.calculateHideScore,
				prompt_options: input.promptOptions,
				parent_id: input.previousCompletionId,
			}),
		})
		if (!response.ok) {
			console.log(`[Completion Request ${input.completionId}]: ${response.statusText}`)
			throw new Error(`Failed to fetch completion: ${input.completionId} ${response.statusText}`)
		}
		const data = await response.json()
		const text = this.acquireCompletionText(data)
		const completionId = this.acquireCompletionId(data)
		return {
			suggestions: {
				text,
				prefix,
				suffix,
				completionId,
			},
		}
	}

	private acquireCompletionText(response: Completion) {
		const choice = response?.choices?.find((c) => c.text?.trim())
		if (!choice?.text) {
			return ""
		}

		let text = choice.text.trim()

		// Since Chinese characters occupy 3 bytes, the plugin may be affected by Max Tokens. When the result is returned, only half of the last Chinese character is returned, resulting in garbled characters.
		// The garbled characters need to be replaced with ''.
		if (text.includes("�")) {
			text = text.replace(/�/g, "")
		}
		return text
	}

	private acquireCompletionId(resp: Completion): string {
		if (!resp || !resp.choices || resp.choices.length === 0 || !resp.id) {
			return ""
		}

		return resp.id
	}

	/**
	 * 取消所有正在进行的请求
	 */
	public cancel(): void {
		this.loggingService.cancel()
	}
	public accept(completionId: string): void {
		this.loggingService.accept(completionId)
	}
	public markDisplayed(completionId: string, outcome: AutocompleteOutcome): void {
		this.loggingService.markDisplayed(completionId, outcome)
	}
	public getLastCompletedCompletion(): null | {
		outcome: AutocompleteOutcome
		action: TextAcceptanceAction
		completedAt: number
	} {
		const lastCompletedCompletion = this.loggingService.getLastCompletedCompletion()
		if (!lastCompletedCompletion) {
			return null
		}
		return lastCompletedCompletion
	}
}
