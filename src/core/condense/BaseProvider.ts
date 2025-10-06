import { ApiMessage } from "../task-persistence/apiMessages"
import { ApiHandler } from "../../api/index"
import {
	ICondensationProvider,
	CondensationContext,
	CondensationOptions,
	CondensationResult,
	ProviderMetrics,
} from "./types"

/**
 * Base abstract class for condensation providers
 * Implements common functionality and error handling
 */
export abstract class BaseCondensationProvider implements ICondensationProvider {
	abstract readonly id: string
	abstract readonly name: string
	abstract readonly description: string

	/**
	 * Main condensation method - delegates to provider-specific implementation
	 */
	async condense(context: CondensationContext, options: CondensationOptions): Promise<CondensationResult> {
		// 1. Validate inputs
		const validation = await this.validate(context, options)
		if (!validation.valid) {
			return {
				messages: context.messages,
				cost: 0,
				error: validation.error,
			}
		}

		// 2. Start metrics
		const startTime = Date.now()

		// 3. Call provider-specific implementation
		try {
			const result = await this.condenseInternal(context, options)

			// 4. Universal check: Ensure condensation actually reduced context
			// Only check if we have a valid baseline (prevContextTokens > 0)
			if (
				context.prevContextTokens > 0 &&
				result.newContextTokens !== undefined &&
				result.newContextTokens >= context.prevContextTokens
			) {
				return {
					messages: context.messages,
					cost: result.cost || 0,
					error: "Condensation failed: context grew or stayed the same",
					metrics: {
						...result.metrics, // Preserve provider-specific metrics
						providerId: this.id,
						timeElapsed: Date.now() - startTime,
					},
				}
			}

			// 5. Add metrics
			const timeElapsed = Date.now() - startTime
			result.metrics = {
				providerId: this.id,
				timeElapsed,
				tokensSaved: context.prevContextTokens - (result.newContextTokens || 0),
				...result.metrics,
			}

			return result
		} catch (error) {
			return {
				messages: context.messages,
				cost: 0,
				error: error instanceof Error ? error.message : String(error),
				metrics: {
					providerId: this.id,
					timeElapsed: Date.now() - startTime,
				},
			}
		}
	}

	/**
	 * Provider-specific condensation implementation
	 * Must be implemented by concrete providers
	 */
	protected abstract condenseInternal(
		context: CondensationContext,
		options: CondensationOptions,
	): Promise<CondensationResult>

	/**
	 * Estimate cost - delegates to provider-specific implementation
	 */
	abstract estimateCost(context: CondensationContext): Promise<number>

	/**
	 * Default validation - can be overridden
	 */
	async validate(
		context: CondensationContext,
		options: CondensationOptions,
	): Promise<{ valid: boolean; error?: string }> {
		if (!context.messages || context.messages.length === 0) {
			return { valid: false, error: "No messages to condense" }
		}

		if (!options.apiHandler) {
			return { valid: false, error: "No API handler provided" }
		}

		return { valid: true }
	}

	/**
	 * Helper to count tokens (basic implementation)
	 */
	protected countTokens(text: string): number {
		// Rough estimation: 1 token ≈ 4 characters
		return Math.ceil(text.length / 4)
	}
}
