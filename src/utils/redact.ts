/**
 * Redacts sensitive information from diagnostic output to prevent accidental
 * disclosure of API keys, tokens, passwords, and other secrets.
 *
 * This module is used by the diagnostics handler to sanitize conversation
 * history before it is written to a file that users may share with support.
 */

/**
 * Patterns that match common API key and secret formats.
 * Each entry has a regex and a label used in the redacted replacement.
 */
const SENSITIVE_PATTERNS: { pattern: RegExp; label: string }[] = [
	// Anthropic API keys: sk-ant-api03-...
	{ pattern: /\bsk-ant-[\w-]{20,}\b/g, label: "ANTHROPIC_API_KEY" },

	// OpenRouter API keys: sk-or-v1-... (must come before generic OpenAI pattern)
	{ pattern: /\bsk-or-v1-[\w]{20,}\b/g, label: "OPENROUTER_API_KEY" },

	// OpenAI API keys: sk-... (but not sk-ant or sk-or which are other providers)
	{ pattern: /\bsk-(?!ant|or-)[\w-]{20,}\b/g, label: "OPENAI_API_KEY" },

	// Generic secret key patterns: key-..., api-key-...
	{ pattern: /\bkey-[\w-]{20,}\b/g, label: "API_KEY" },

	// AWS access keys
	{ pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, label: "AWS_ACCESS_KEY" },

	// AWS secret keys (40 char base64-like)
	{ pattern: /\b[A-Za-z0-9/+=]{40}\b(?=.*(?:aws|secret|access))/gi, label: "AWS_SECRET_KEY" },

	// Google API keys
	{ pattern: /\bAIza[A-Za-z0-9_-]{35}\b/g, label: "GOOGLE_API_KEY" },

	// GitHub tokens: ghp_, gho_, ghu_, ghs_, ghr_
	{ pattern: /\bgh[pousr]_[A-Za-z0-9_]{36,}\b/g, label: "GITHUB_TOKEN" },

	// Generic Bearer tokens in authorization headers
	{ pattern: /Bearer\s+[A-Za-z0-9._~+/=-]{20,}/gi, label: "BEARER_TOKEN" },

	// Generic base64-encoded long tokens (likely secrets) after common key names
	{
		pattern:
			/(?<="(?:api[_-]?key|apikey|api[_-]?secret|secret[_-]?key|access[_-]?token|auth[_-]?token|token|password|passwd|secret|credential|private[_-]?key|authorization)":\s*")[^"]{20,}/gi,
		label: "REDACTED_SECRET",
	},

	// Azure keys (32 hex chars)
	{ pattern: /\b[a-f0-9]{32}\b(?=.*(?:azure|endpoint|cognitive))/gi, label: "AZURE_KEY" },

	// Generic hex tokens that appear after key-like field names (in JSON context)
	{
		pattern: /(?<="(?:api[_-]?key|apikey|secret|token|password|credential)":\s*")[a-f0-9-]{32,}(?=")/gi,
		label: "REDACTED_SECRET",
	},
]

/**
 * Patterns for environment variable assignments containing secrets.
 * Matches patterns like: SOME_API_KEY=value or export SOME_SECRET="value"
 */
const ENV_VAR_PATTERNS: RegExp[] = [
	// KEY=value patterns (unquoted)
	/\b([A-Z_]*(?:KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL|AUTH)[A-Z_]*)=([^\s"']{8,})\b/gi,
	// KEY="value" or KEY='value' patterns (quoted)
	/\b([A-Z_]*(?:KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL|AUTH)[A-Z_]*)=["']([^"']{8,})["']/gi,
	// export KEY=value
	/\bexport\s+([A-Z_]*(?:KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL|AUTH)[A-Z_]*)=["']?([^\s"']{8,})["']?/gi,
]

/**
 * Redacts sensitive information from a string.
 *
 * Applies pattern-based redaction to remove API keys, tokens, passwords,
 * and other secrets that may appear in conversation history or error details.
 *
 * @param input - The string to redact sensitive information from
 * @returns The input string with sensitive values replaced by redaction markers
 */
export function redactSensitiveInfo(input: string): string {
	if (!input || typeof input !== "string") {
		return input
	}

	let result = input

	// Apply sensitive patterns
	for (const { pattern, label } of SENSITIVE_PATTERNS) {
		// Reset lastIndex for global regexes
		pattern.lastIndex = 0
		result = result.replace(pattern, `[${label}]`)
	}

	// Redact environment variable assignments with secret-like names
	for (const pattern of ENV_VAR_PATTERNS) {
		pattern.lastIndex = 0
		result = result.replace(pattern, (_match, name) => `${name}=[REDACTED]`)
	}

	return result
}

/**
 * Recursively redacts sensitive information from an object structure.
 *
 * Walks through objects and arrays, applying string redaction to all
 * string values. This is used to redact the full diagnostics payload
 * (including nested conversation history) before writing to a file.
 *
 * @param data - The data structure to redact (object, array, or primitive)
 * @returns A new data structure with sensitive string values redacted
 */
export function redactDiagnosticsData(data: unknown): unknown {
	if (data === null || data === undefined) {
		return data
	}

	if (typeof data === "string") {
		return redactSensitiveInfo(data)
	}

	if (Array.isArray(data)) {
		return data.map((item) => redactDiagnosticsData(item))
	}

	if (typeof data === "object") {
		const result: Record<string, unknown> = {}
		for (const [key, value] of Object.entries(data)) {
			// For keys that are known to hold secrets, redact the entire value
			const lowerKey = key.toLowerCase()
			if (
				(lowerKey.includes("apikey") ||
					lowerKey.includes("api_key") ||
					lowerKey === "password" ||
					lowerKey === "secret" ||
					lowerKey === "token" ||
					lowerKey === "authorization" ||
					lowerKey === "credential" ||
					lowerKey === "private_key" ||
					lowerKey === "privatekey") &&
				typeof value === "string" &&
				value.length > 0
			) {
				result[key] = "[REDACTED]"
			} else {
				result[key] = redactDiagnosticsData(value)
			}
		}
		return result
	}

	// Numbers, booleans, etc. pass through unchanged
	return data
}
