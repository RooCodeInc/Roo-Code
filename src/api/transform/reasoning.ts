import { BetaThinkingConfigParam } from "@anthropic-ai/sdk/resources/beta"
import OpenAI from "openai"
import type { GenerateContentConfig } from "@google/genai"

import type { ModelInfo, ProviderSettings, ReasoningEffortWithMinimal } from "@roo-code/types"

import { shouldUseReasoningBudget, shouldUseReasoningEffort } from "../../shared/api"

export type OpenRouterReasoningParams = {
	effort?: ReasoningEffortWithMinimal
	max_tokens?: number
	exclude?: boolean
}

export type AnthropicReasoningParams = BetaThinkingConfigParam

export type OpenAiReasoningParams = { reasoning_effort: OpenAI.Chat.ChatCompletionCreateParams["reasoning_effort"] }

export type GeminiReasoningParams = GenerateContentConfig["thinkingConfig"]

export type GetModelReasoningOptions = {
	model: ModelInfo
	reasoningBudget: number | undefined
	reasoningEffort: ReasoningEffortWithMinimal | undefined
	settings: ProviderSettings
}

export const getOpenRouterReasoning = ({
	model,
	reasoningBudget,
	reasoningEffort,
	settings,
}: GetModelReasoningOptions): OpenRouterReasoningParams | undefined => {
	// Check if model should use reasoning budget
	if (shouldUseReasoningBudget({ model, settings })) {
		return { max_tokens: reasoningBudget }
	}

	// Check if model should use reasoning effort
	if (shouldUseReasoningEffort({ model, settings })) {
		return reasoningEffort ? { effort: reasoningEffort } : undefined
	}

	// Check if model supports reasoning but not effort or budget (e.g., grok-4-fast on OpenRouter)
	// These models use a simple on/off toggle via the exclude parameter
	if (
		model.supportedParameters?.includes("reasoning") &&
		!model.supportsReasoningEffort &&
		!model.supportsReasoningBudget
	) {
		// If reasoning is not explicitly disabled, enable it
		// We use exclude: false to enable reasoning, and exclude: true to disable
		// Check both settings.reasoningEffort and the passed reasoningEffort parameter
		const effectiveEffort = reasoningEffort || settings.reasoningEffort
		const reasoningEnabled = effectiveEffort !== "minimal"
		return reasoningEnabled ? { exclude: false } : { exclude: true }
	}

	return undefined
}

export const getAnthropicReasoning = ({
	model,
	reasoningBudget,
	settings,
}: GetModelReasoningOptions): AnthropicReasoningParams | undefined =>
	shouldUseReasoningBudget({ model, settings }) ? { type: "enabled", budget_tokens: reasoningBudget! } : undefined

export const getOpenAiReasoning = ({
	model,
	reasoningEffort,
	settings,
}: GetModelReasoningOptions): OpenAiReasoningParams | undefined => {
	if (!shouldUseReasoningEffort({ model, settings })) {
		return undefined
	}

	// If model has reasoning effort capability, return object even if effort is undefined
	// This preserves the reasoning_effort field in the API call
	if (reasoningEffort === "minimal") {
		return undefined
	}

	return { reasoning_effort: reasoningEffort }
}

export const getGeminiReasoning = ({
	model,
	reasoningBudget,
	settings,
}: GetModelReasoningOptions): GeminiReasoningParams | undefined =>
	shouldUseReasoningBudget({ model, settings })
		? { thinkingBudget: reasoningBudget!, includeThoughts: true }
		: undefined
