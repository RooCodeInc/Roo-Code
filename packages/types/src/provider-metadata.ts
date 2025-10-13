/**
 * Provider metadata for enhanced categorization and user guidance
 */

export type ProviderCategory = "cloud" | "local" | "hybrid"

export type PricingModel = "free" | "paid" | "freemium" | "pay-per-use" | "subscription"

export type QualityTier = "premium" | "standard" | "experimental" | "deprecated"

export type AuthenticationMethod = "api-key" | "oauth" | "none" | "cloud-account"

export interface ProviderMetadata {
	/** Unique identifier for the provider */
	id: string

	/** Display name for the provider */
	label: string

	/** Category of the provider */
	category: ProviderCategory

	/** Pricing model */
	pricing: PricingModel

	/** Quality tier indicator */
	quality: QualityTier

	/** Authentication method required */
	authentication: AuthenticationMethod

	/** Whether this provider is recommended */
	recommended: boolean

	/** Whether this provider should be avoided */
	deprecated: boolean

	/** Short description of the provider */
	description?: string

	/** Setup difficulty level */
	setupDifficulty?: "easy" | "moderate" | "advanced"

	/** Link to documentation */
	documentationUrl?: string

	/** Specific features or capabilities */
	features?: {
		supportsStreaming?: boolean
		supportsImages?: boolean
		supportsTools?: boolean
		supportsPromptCaching?: boolean
		supportsFinetuning?: boolean
	}

	/** Performance characteristics */
	performance?: {
		speed: "fast" | "medium" | "slow"
		reliability: "high" | "medium" | "low"
		contextWindow?: number
	}

	/** Cost information for paid providers */
	costInfo?: {
		pricingUrl?: string
		estimatedCostPer1kTokens?: number
		freeTokensPerMonth?: number
	}

	/** Warning message if any */
	warning?: string

	/** Tags for additional categorization */
	tags?: string[]
}

export type ProviderMetadataMap = Record<string, ProviderMetadata>
