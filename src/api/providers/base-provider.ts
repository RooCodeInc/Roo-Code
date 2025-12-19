import { Anthropic } from "@anthropic-ai/sdk"

import type { ModelInfo } from "@roo-code/types"

import type { ApiHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { ApiStream } from "../transform/stream"
import { countTokens } from "../../utils/countTokens"
import { applyModelFamilyDefaults } from "./utils/model-family-defaults"

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
	 * Converts an array of tools to be compatible with OpenAI's strict mode.
	 * Filters for function tools, applies schema conversion to their parameters,
	 * and ensures all tools have consistent strict: true values.
	 */
	protected convertToolsForOpenAI(tools: any[] | undefined): any[] | undefined {
		if (!tools) {
			return undefined
		}

		return tools.map((tool) =>
			tool.type === "function"
				? {
						...tool,
						function: {
							...tool.function,
							strict: true,
							parameters: this.convertToolSchemaForOpenAI(tool.function.parameters),
						},
					}
				: tool,
		)
	}

	/**
	 * Converts tool schemas to be compatible with OpenAI's strict mode by:
	 * - Ensuring all properties are in the required array (strict mode requirement)
	 * - Converting nullable types (["type", "null"]) to non-nullable ("type")
	 * - Recursively processing nested objects and arrays
	 *
	 * This matches the behavior of ensureAllRequired in openai-native.ts
	 */
	protected convertToolSchemaForOpenAI(schema: any): any {
		if (!schema || typeof schema !== "object" || schema.type !== "object") {
			return schema
		}

		const result = { ...schema }

		if (result.properties) {
			const allKeys = Object.keys(result.properties)
			// OpenAI strict mode requires ALL properties to be in required array
			result.required = allKeys

			// Recursively process nested objects and convert nullable types
			const newProps = { ...result.properties }
			for (const key of allKeys) {
				const prop = newProps[key]

				// Handle nullable types by removing null
				if (prop && Array.isArray(prop.type) && prop.type.includes("null")) {
					const nonNullTypes = prop.type.filter((t: string) => t !== "null")
					prop.type = nonNullTypes.length === 1 ? nonNullTypes[0] : nonNullTypes
				}

				// Recursively process nested objects
				if (prop && prop.type === "object") {
					newProps[key] = this.convertToolSchemaForOpenAI(prop)
				} else if (prop && prop.type === "array" && prop.items?.type === "object") {
					newProps[key] = {
						...prop,
						items: this.convertToolSchemaForOpenAI(prop.items),
					}
				}
			}
			result.properties = newProps
		}

		return result
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

	/**
	 * Apply model family defaults to a ModelInfo object.
	 *
	 * This helper method allows providers to apply consistent defaults
	 * for recognized model families (OpenAI, Gemini, etc.) regardless of
	 * which provider is serving the model.
	 *
	 * Defaults are only applied when the corresponding property is not
	 * already explicitly set on the model info, ensuring that provider-specific
	 * or model-specific settings take precedence.
	 *
	 * @param modelId - The model identifier
	 * @param info - The original ModelInfo object
	 * @returns A new ModelInfo object with family defaults applied
	 */
	protected applyModelDefaults(modelId: string, info: ModelInfo): ModelInfo {
		return applyModelFamilyDefaults(modelId, info)
	}
}
