import { ProviderSettings, ClineMessage, TelemetryEventName } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"
import { supportPrompt } from "../../shared/support-prompt"
import { singleCompletionHandler } from "../../utils/single-completion-handler"
import { ProviderSettingsManager } from "../config/ProviderSettingsManager"
import { ClineProvider } from "./ClineProvider"

export interface TitleSummarizerOptions {
	text: string
	apiConfiguration: ProviderSettings
	customSupportPrompts?: Record<string, any>
	listApiConfigMeta?: Array<{ id: string; name?: string }>
	enhancementApiConfigId?: string
	providerSettingsManager?: ProviderSettingsManager
	maxLength?: number
}

export interface TitleSummarizerResult {
	success: boolean
	summarizedTitle?: string
	error?: string
}

/**
 * Summarizes long task titles using AI, similar to message enhancement
 */
export class TitleSummarizer {
	/**
	 * Summarizes a task title using the configured AI provider
	 * @param options Configuration options for title summarization
	 * @returns Summarized title result with success status
	 */
	static async summarizeTitle(options: TitleSummarizerOptions): Promise<TitleSummarizerResult> {
		try {
			const {
				text,
				apiConfiguration,
				customSupportPrompts,
				listApiConfigMeta,
				enhancementApiConfigId,
				providerSettingsManager,
				maxLength = 150,
			} = options

			// Check if title needs summarization
			if (text.length <= maxLength) {
				return {
					success: true,
					summarizedTitle: text,
				}
			}

			// Determine which API configuration to use
			let configToUse: ProviderSettings = apiConfiguration

			// Try to get enhancement config first, fall back to current config
			if (
				enhancementApiConfigId &&
				listApiConfigMeta?.find(({ id }) => id === enhancementApiConfigId) &&
				providerSettingsManager
			) {
				const { name: _, ...providerSettings } = await providerSettingsManager.getProfile({
					id: enhancementApiConfigId,
				})

				if (providerSettings.apiProvider) {
					configToUse = providerSettings
				}
			}

			// Create the summarization prompt using the support prompt system
			const summarizationPrompt = supportPrompt.create(
				"SUMMARIZE_TITLE",
				{ userInput: text },
				customSupportPrompts,
			)

			// Call the single completion handler to get the summarized title
			const summarizedTitle = await singleCompletionHandler(configToUse, summarizationPrompt)

			// Validate the summarized title
			if (!summarizedTitle || summarizedTitle.trim().length === 0) {
				throw new Error("Received empty summarized title")
			}

			// Ensure the summarized title doesn't exceed the max length
			const trimmedTitle = summarizedTitle.trim()
			if (trimmedTitle.length > maxLength) {
				// If the AI didn't respect the length limit, truncate manually
				return {
					success: true,
					summarizedTitle: trimmedTitle.substring(0, maxLength - 3) + "...",
				}
			}

			return {
				success: true,
				summarizedTitle: trimmedTitle,
			}
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
				summarizedTitle: options.text, // Return original text as fallback
			}
		}
	}

	/**
	 * Captures telemetry for title summarization
	 * @param taskId Optional task ID for telemetry tracking
	 * @param originalLength Length of the original title
	 * @param summarizedLength Length of the summarized title
	 */
	static captureTelemetry(taskId?: string, originalLength?: number, summarizedLength?: number): void {
		// TODO: Add telemetry event for title summarization when available
		// if (TelemetryService.hasInstance()) {
		// 	TelemetryService.instance.captureEvent(TelemetryEventName.TASK_TITLE_SUMMARIZED, {
		// 		...(taskId && { taskId }),
		// 		originalLength: originalLength ?? 0,
		// 		summarizedLength: summarizedLength ?? 0,
		// 	})
		// }
	}
}
