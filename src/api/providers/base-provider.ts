import { Anthropic } from "@anthropic-ai/sdk"
import * as vscode from "vscode"

import type { ModelInfo } from "@roo-code/types"

import type { ApiHandler, ApiHandlerCreateMessageMetadata } from "../index"
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
	 * Returns whether native tool calling is supported for the current model AND enabled by user.
	 * Checks the model's supportsNativeToolCalling property and the user setting.
	 *
	 * @returns true if model supports it AND setting is enabled, false otherwise
	 */
	supportsNativeTools(): boolean {
		const model = this.getModel()
		const modelSupportsNativeTools = model.info.supportsNativeToolCalling ?? false

		if (!modelSupportsNativeTools) {
			return false
		}

		return vscode.workspace.getConfiguration("roo-cline").get<boolean>("nativeToolCalling", false)
	}
}
