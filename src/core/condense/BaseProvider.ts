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

	/**
	 * Retry an operation with exponential back-off
	 * @param operation The async operation to retry
	 * @param maxRetries Maximum number of retry attempts (default: 3)
	 * @param baseDelayMs Base delay in milliseconds (default: 1000ms)
	 * @returns Result of the operation
	 * @throws Last error if all retries fail
	 */
	protected async retryWithBackoff<T>(
		operation: () => Promise<T>,
		maxRetries: number = 3,
		baseDelayMs: number = 1000,
	): Promise<T> {
		let lastError: Error | undefined

		for (let attempt = 0; attempt < maxRetries; attempt++) {
			try {
				return await operation()
			} catch (error) {
				lastError = error as Error

				if (attempt < maxRetries - 1) {
					const delay = baseDelayMs * Math.pow(2, attempt)
					// Log retry attempt (can be overridden by subclasses)
					console.warn(`Retry ${attempt + 1}/${maxRetries} after ${delay}ms delay`, {
						error: lastError.message,
					})
					await new Promise((resolve) => setTimeout(resolve, delay))
				}
			}
		}

		throw lastError
	}
}
