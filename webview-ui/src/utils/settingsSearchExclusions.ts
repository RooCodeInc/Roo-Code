export interface ExclusionRule {
	/** Pattern to match against a parsed setting id */
	pattern: string | RegExp
	/** Human-readable reason for exclusion */
	reason: string
	/** Example ids matched by this rule */
	examples?: string[]
}

const SEARCH_EXCLUSIONS: ExclusionRule[] = [
	{
		pattern: /^modelInfo\./,
		reason: "Model information is display-only and not configurable",
		examples: ["modelInfo.inputPrice", "modelInfo.outputPrice", "modelInfo.contextWindow"],
	},
	{
		pattern: /^providers\.customModel\.pricing\./,
		reason: "Custom model pricing fields are display-focused and should not clutter search",
		examples: ["providers.customModel.pricing.input", "providers.customModel.pricing.output"],
	},
	{
		pattern: /^validation\./,
		reason: "Validation messages are error text, not settings",
		examples: ["validation.apiKey", "validation.modelId"],
	},
	{
		pattern: /^placeholders\./,
		reason: "Placeholder text is helper content, not a setting",
		examples: ["placeholders.apiKey", "placeholders.baseUrl"],
	},
	{
		pattern: /^defaults\./,
		reason: "Default value descriptions are informational only",
		examples: ["defaults.ollamaUrl", "defaults.lmStudioUrl"],
	},
	{
		pattern: /^labels\./,
		reason: "Generic labels are helper text, not settings",
		examples: ["labels.customArn", "labels.useCustomArn"],
	},
	{
		pattern: /^thinkingBudget\./,
		reason: "Thinking budget entries are display-only",
		examples: ["thinkingBudget.maxTokens", "thinkingBudget.maxThinkingTokens"],
	},
	{
		pattern: /^serviceTier\.columns\./,
		reason: "Service tier column headers are display-only",
		examples: ["serviceTier.columns.tier", "serviceTier.columns.input"],
	},
	{
		pattern: /^serviceTier\.pricingTableTitle$/,
		reason: "Service tier table title is display-only",
		examples: ["serviceTier.pricingTableTitle"],
	},
	{
		pattern: /^modelPicker\.simplifiedExplanation$/,
		reason: "Model picker helper text is informational",
		examples: ["modelPicker.simplifiedExplanation"],
	},
	{
		pattern: /^modelInfo\.gemini\.(freeRequests|pricingDetails|billingEstimate)$/,
		reason: "Gemini pricing notes are display-only",
		examples: ["modelInfo.gemini.freeRequests", "modelInfo.gemini.pricingDetails"],
	},
]

function matchesRule(settingId: string, rule: ExclusionRule): boolean {
	if (typeof rule.pattern === "string") {
		return settingId === rule.pattern
	}

	return rule.pattern.test(settingId)
}

export function shouldExcludeFromSearch(settingId: string): boolean {
	return SEARCH_EXCLUSIONS.some((rule) => matchesRule(settingId, rule))
}

export function getExclusionReason(settingId: string): string | undefined {
	const rule = SEARCH_EXCLUSIONS.find((candidate) => matchesRule(settingId, candidate))
	return rule?.reason
}

export { SEARCH_EXCLUSIONS }
