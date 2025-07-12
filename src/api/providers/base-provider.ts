import { Anthropic } from "@anthropic-ai/sdk"

import type { ModelInfo } from "@roo-code/types"

import type { ApiHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { ApiStream } from "../transform/stream"
import { countTokens } from "../../utils/countTokens"
import { UnifiedErrorHandler, ErrorContext, ErrorHandlerResponse } from "../error-handling/UnifiedErrorHandler"

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

	/**
	 * Handle errors using the unified error handler
	 *
	 * @param error The error to handle
	 * @param context Error context information
	 * @returns Error handler response with retry/throw decisions
	 */
	protected handleError(error: unknown, context: ErrorContext): ErrorHandlerResponse {
		return UnifiedErrorHandler.handle(error, context)
	}

	/**
	 * Create error context for unified error handling
	 *
	 * @param isStreaming Whether the operation is streaming
	 * @param retryAttempt Current retry attempt number
	 * @param requestId Optional request identifier
	 * @returns Error context object
	 */
	protected createErrorContext(isStreaming: boolean, retryAttempt?: number, requestId?: string): ErrorContext {
		const model = this.getModel()
		return {
			isStreaming,
			provider: model.id,
			modelId: model.id,
			retryAttempt,
			requestId,
		}
	}
}
