import type { ModelInfo } from "@roo-code/types"

import type { NeutralMessageParam, NeutralContentBlock } from "../../core/task-persistence"
import type { ApiHandler, SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import type { ApiHandlerOptions } from "../../shared/api"
import { ApiStream } from "../transform/stream"

interface FakeAI {
	/**
	 * The unique identifier for the FakeAI instance.
	 * It is used to lookup the original FakeAI object in the fakeAiMap
	 * when the fakeAI object is read from the VSCode global state.
	 */
	readonly id: string

	/**
	 * A function set by the FakeAIHandler on the FakeAI instance, that removes
	 * the FakeAI instance from the fakeAIMap when the FakeAI instance is
	 * no longer needed.
	 */
	removeFromCache?: () => void

	createMessage(
		systemPrompt: string,
		messages: NeutralMessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream
	getModel(): { id: string; info: ModelInfo }
	countTokens(content: NeutralContentBlock[]): Promise<number>
	completePrompt(prompt: string): Promise<string>
}

/**
 * API providers configuration is stored in the VSCode global state.
 * Therefore, when a new task is created, the FakeAI object in the configuration
 * is a new object not related to the original one, but with the same ID.
 *
 * We use the ID to lookup the original FakeAI object in the mapping.
 */
let fakeAiMap: Map<string, FakeAI> = new Map()

export class FakeAIHandler implements ApiHandler, SingleCompletionHandler {
	private ai: FakeAI

	constructor(options: ApiHandlerOptions) {
		const optionsFakeAi = options.fakeAi as FakeAI | undefined
		if (!optionsFakeAi) {
			throw new Error("Fake AI is not set")
		}

		const id = optionsFakeAi.id
		let cachedFakeAi = fakeAiMap.get(id)
		if (cachedFakeAi === undefined) {
			cachedFakeAi = optionsFakeAi
			cachedFakeAi.removeFromCache = () => fakeAiMap.delete(id)
			fakeAiMap.set(id, cachedFakeAi)
		}
		this.ai = cachedFakeAi
	}

	async *createMessage(
		systemPrompt: string,
		messages: NeutralMessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		yield* this.ai.createMessage(systemPrompt, messages, metadata)
	}

	getModel(): { id: string; info: ModelInfo } {
		return this.ai.getModel()
	}

	countTokens(content: NeutralContentBlock[]): Promise<number> {
		return this.ai.countTokens(content)
	}

	completePrompt(prompt: string): Promise<string> {
		return this.ai.completePrompt(prompt)
	}

	isAiSdkProvider(): boolean {
		return false
	}
}
