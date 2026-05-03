/**
 * FIM (Fill-in-the-Middle) token formatting for different model families.
 *
 * Each model family uses different special tokens to delimit the prefix,
 * suffix, and middle sections of a FIM prompt. This module maps model
 * families to their respective token formats.
 */

export interface FimTokens {
	prefix: string
	suffix: string
	middle: string
}

/**
 * Known FIM token formats by model family.
 */
const FIM_TOKEN_FORMATS: Record<string, FimTokens> = {
	// DeepSeek Coder / CodeLlama / StarCoder2
	deepseek: {
		prefix: "<|fim▁begin|>",
		suffix: "<|fim▁hole|>",
		middle: "<|fim▁end|>",
	},
	// CodeLlama
	codellama: {
		prefix: "<PRE> ",
		suffix: " <SUF>",
		middle: " <MID>",
	},
	// StarCoder
	starcoder: {
		prefix: "<fim_prefix>",
		suffix: "<fim_suffix>",
		middle: "<fim_middle>",
	},
	// Mistral / Codestral
	mistral: {
		prefix: "[PREFIX]",
		suffix: "[SUFFIX]",
		middle: "[MIDDLE]",
	},
	// Qwen2.5-Coder
	qwen: {
		prefix: "<|fim_prefix|>",
		suffix: "<|fim_suffix|>",
		middle: "<|fim_middle|>",
	},
	// Generic fallback (OpenAI-compatible FIM)
	generic: {
		prefix: "<|fim_prefix|>",
		suffix: "<|fim_suffix|>",
		middle: "<|fim_middle|>",
	},
}

/**
 * Model ID patterns mapped to their token format keys.
 */
const MODEL_FAMILY_PATTERNS: Array<{ pattern: RegExp; family: string }> = [
	{ pattern: /deepseek/i, family: "deepseek" },
	{ pattern: /codellama/i, family: "codellama" },
	{ pattern: /starcoder/i, family: "starcoder" },
	{ pattern: /mistral|codestral/i, family: "mistral" },
	{ pattern: /qwen/i, family: "qwen" },
]

/**
 * Detect the FIM token format based on the model ID.
 */
export function detectFimTokens(modelId: string): FimTokens {
	for (const { pattern, family } of MODEL_FAMILY_PATTERNS) {
		if (pattern.test(modelId)) {
			return FIM_TOKEN_FORMATS[family]
		}
	}
	return FIM_TOKEN_FORMATS.generic
}

/**
 * Format a FIM prompt using the appropriate tokens for the given model.
 */
export function formatFimPrompt(modelId: string, prefix: string, suffix: string): string {
	const tokens = detectFimTokens(modelId)
	return `${tokens.prefix}${prefix}${tokens.suffix}${suffix}${tokens.middle}`
}

/**
 * Get the FIM tokens for a given model family name.
 * Falls back to generic tokens if the family is not recognized.
 */
export function getFimTokensByFamily(family: string): FimTokens {
	return FIM_TOKEN_FORMATS[family] ?? FIM_TOKEN_FORMATS.generic
}
