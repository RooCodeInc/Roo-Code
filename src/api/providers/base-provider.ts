import { Anthropic } from "@anthropic-ai/sdk"

import type { ModelInfo } from "@roo-code/types"

import type { ApiHandler, ApiHandlerCreateMessageMetadata } from "../index"
import type { ApiHandlerOptions } from "../../shared/api"
import { ApiStream } from "../transform/stream"
import { countTokens } from "../../utils/countTokens"

/**
 * Base class for API providers that implements common functionality.
 */
export abstract class BaseProvider implements ApiHandler {
	abstract createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream

	abstract getModel(): { id: string; info: ModelInfo }

	/**
	 * Applies user-configured overrides to model info.
	 * This allows users to customize model parameters like context window size
	 * to work around corporate restrictions or other limitations.
	 *
	 * @param info The original model info
	 * @param options The API handler options containing user overrides
	 * @returns The model info with overrides applied
	 */
	protected applyModelOverrides(info: ModelInfo, options: ApiHandlerOptions): ModelInfo {
		const overriddenInfo = { ...info }

		// Apply context window override if specified
		if (options.modelContextWindow && options.modelContextWindow > 0) {
			overriddenInfo.contextWindow = options.modelContextWindow
		}

		return overriddenInfo
	}

	/**
	 * Default token counting implementation using tiktoken.
	 * Providers can override this to use their native token counting endpoints.
	 *
	 * @param content The content to count tokens for
	 * @returns A promise resolving to the token count
	 */
	async countTokens(content: Anthropic.Messages.ContentBlockParam[]): Promise<number> {
		if (content.length === 0) {
			return 0
		}

		return countTokens(content, { useWorker: true })
	}
}
