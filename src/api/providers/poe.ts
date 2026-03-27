import { Anthropic } from "@anthropic-ai/sdk"
import { createPoe, type PoeProvider, type PoeScopedProviderOptions } from "ai-sdk-provider-poe"
import { extractUsageMetrics, mapToolChoice } from "ai-sdk-provider-poe/code"
import { streamText, generateText, type ToolSet } from "ai"

import { poeDefaultModelId, poeDefaultModelInfo, type ReasoningEffortExtended, ApiProviderError } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

import { shouldUseReasoningBudget, shouldUseReasoningEffort, type ApiHandlerOptions } from "../../shared/api"

import { convertToAiSdkMessages, convertToolsForAiSdk, processAiSdkStreamPart } from "../transform/ai-sdk"
import { ApiStream } from "../transform/stream"

import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { getModelsFromCache } from "./fetchers/modelCache"

const DEFAULT_THINKING_BUDGET = 8192

export class PoeHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private poe: PoeProvider

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
		this.poe = createPoe({
			apiKey: options.poeApiKey ?? "not-provided",
			baseURL: options.poeBaseUrl || undefined,
		})
	}

	override getModel() {
		const id = this.options.apiModelId ?? poeDefaultModelId
		const cached = getModelsFromCache("poe")
		const info = cached?.[id] ?? poeDefaultModelInfo
		return { id, info }
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const { id, info } = this.getModel()
		const languageModel = this.poe(id)

		const aiSdkMessages = convertToAiSdkMessages(messages)
		const openAiTools = this.convertToolsForOpenAI(metadata?.tools)
		const aiSdkTools = convertToolsForAiSdk(openAiTools) as ToolSet | undefined

		const useBudget = shouldUseReasoningBudget({ model: info, settings: this.options })
		const useEffort = !useBudget && shouldUseReasoningEffort({ model: info, settings: this.options })

		// Only pass temperature when the user explicitly configured it.
		let temperature: number | undefined = this.options.modelTemperature ?? undefined
		// Only pass maxOutputTokens when reasoning is active and the user configured it via the UI toggles.
		const maxOutputTokens: number | undefined =
			(useBudget || useEffort) && this.options.modelMaxTokens ? this.options.modelMaxTokens : undefined
		const providerOptions: NonNullable<Parameters<typeof streamText>[0]["providerOptions"]> & {
			poe?: PoeScopedProviderOptions
		} = {}

		if (useBudget) {
			const requestedBudget = this.options.modelMaxThinkingTokens ?? DEFAULT_THINKING_BUDGET
			providerOptions.poe = {
				reasoningBudgetTokens: requestedBudget,
			}
			temperature = 1.0
		} else if (useEffort) {
			let effort = (this.options.reasoningEffort ?? info.reasoningEffort ?? "medium") as ReasoningEffortExtended
			// Validate that the effort level is actually supported by the current model
			const supportedEfforts = info.supportsReasoningEffort
			if (Array.isArray(supportedEfforts) && !supportedEfforts.includes(effort as any)) {
				effort = (info.reasoningEffort as ReasoningEffortExtended) ?? "medium"
			}
			providerOptions.poe = {
				reasoningEffort: effort,
				reasoningSummary: "auto",
			}
		}

		let result
		try {
			result = streamText({
				model: languageModel,
				system: systemPrompt,
				messages: aiSdkMessages,
				temperature,
				maxOutputTokens,
				tools: aiSdkTools,
				toolChoice: mapToolChoice(metadata?.tool_choice as any),
				...(Object.keys(providerOptions).length > 0 && { providerOptions }),
			})
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			TelemetryService.instance.captureException(new ApiProviderError(errorMessage, "poe", id, "createMessage"))
			throw new Error(`Poe completion error: ${errorMessage}`)
		}

		try {
			let sawReasoning = false
			for await (const part of result.fullStream) {
				for (const chunk of processAiSdkStreamPart(part)) {
					if (chunk.type === "reasoning" && chunk.text.trim().length > 0) {
						sawReasoning = true
					}
					yield chunk
				}
			}

			if (!sawReasoning) {
				const reasoningText = await result.reasoningText
				if (reasoningText?.trim()) {
					yield { type: "reasoning", text: reasoningText }
				}
			}

			const usage = await result.usage
			if (usage) {
				const metrics = extractUsageMetrics(usage as any)
				yield {
					type: "usage" as const,
					inputTokens: metrics.inputTokens,
					outputTokens: metrics.outputTokens,
					cacheReadTokens: metrics.cacheReadTokens,
					cacheWriteTokens: metrics.cacheWriteTokens,
					reasoningTokens: metrics.reasoningTokens,
				}
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			TelemetryService.instance.captureException(new ApiProviderError(errorMessage, "poe", id, "createMessage"))
			throw new Error(`Poe streaming error: ${errorMessage}`)
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		const { id } = this.getModel()
		try {
			const { text } = await generateText({
				model: this.poe(id),
				prompt,
			})
			return text
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			TelemetryService.instance.captureException(new ApiProviderError(errorMessage, "poe", id, "completePrompt"))
			throw new Error(`Poe completion error: ${errorMessage}`)
		}
	}
}
