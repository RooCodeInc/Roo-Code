import { APIError } from "openai"

export function checkContextWindowExceededError(error: unknown): boolean {
	return (
		checkIsOpenAIContextWindowError(error) ||
		checkIsOpenRouterContextWindowError(error) ||
		checkIsAnthropicContextWindowError(error) ||
		checkIsCerebrasContextWindowError(error) ||
		checkIsLiteLLMContextWindowError(error) ||
		checkIsGenericContextWindowError(error)
	)
}

function checkIsOpenRouterContextWindowError(error: unknown): boolean {
	try {
		if (!error || typeof error !== "object") {
			return false
		}

		// Use Record<string, any> for proper type narrowing
		const err = error as Record<string, any>
		const status = err.status ?? err.code ?? err.error?.status ?? err.response?.status
		const message: string = String(err.message || err.error?.message || "")

		// Known OpenAI/OpenRouter-style signal (code 400 and message includes "context length")
		const CONTEXT_ERROR_PATTERNS = [
			/\bcontext\s*(?:length|window)\b/i,
			/\bmaximum\s*context\b/i,
			/\b(?:input\s*)?tokens?\s*exceed/i,
			/\btoo\s*many\s*tokens?\b/i,
		] as const

		return String(status) === "400" && CONTEXT_ERROR_PATTERNS.some((pattern) => pattern.test(message))
	} catch {
		return false
	}
}

// Docs: https://platform.openai.com/docs/guides/error-codes/api-errors
function checkIsOpenAIContextWindowError(error: unknown): boolean {
	try {
		// Check for LengthFinishReasonError
		if (error && typeof error === "object" && "name" in error && error.name === "LengthFinishReasonError") {
			return true
		}

		const KNOWN_CONTEXT_ERROR_SUBSTRINGS = ["token", "context length"] as const

		return (
			Boolean(error) &&
			error instanceof APIError &&
			error.code?.toString() === "400" &&
			KNOWN_CONTEXT_ERROR_SUBSTRINGS.some((substring) => error.message.includes(substring))
		)
	} catch {
		return false
	}
}

function checkIsAnthropicContextWindowError(response: unknown): boolean {
	try {
		// Type guard to safely access properties
		if (!response || typeof response !== "object") {
			return false
		}

		// Use type assertions with proper checks
		const res = response as Record<string, any>

		// Check for Anthropic-specific error structure with more specific validation
		if (res.error?.error?.type === "invalid_request_error") {
			const message: string = String(res.error?.error?.message || "")

			// More specific patterns for context window errors
			const contextWindowPatterns = [
				/prompt is too long/i,
				/maximum.*tokens/i,
				/context.*too.*long/i,
				/exceeds.*context/i,
				/token.*limit/i,
				/context_length_exceeded/i,
				/max_tokens_to_sample/i,
			]

			// Additional check for Anthropic-specific error codes
			const errorCode = res.error?.error?.code
			if (errorCode === "context_length_exceeded" || errorCode === "invalid_request_error") {
				return contextWindowPatterns.some((pattern) => pattern.test(message))
			}

			return contextWindowPatterns.some((pattern) => pattern.test(message))
		}

		return false
	} catch {
		return false
	}
}

function checkIsCerebrasContextWindowError(response: unknown): boolean {
	try {
		// Type guard to safely access properties
		if (!response || typeof response !== "object") {
			return false
		}

		// Use type assertions with proper checks
		const res = response as Record<string, any>
		const status = res.status ?? res.code ?? res.error?.status ?? res.response?.status
		const message: string = String(res.message || res.error?.message || "")

		return String(status) === "400" && message.includes("Please reduce the length of the messages or completion")
	} catch {
		return false
	}
}

/**
 * Check for LiteLLM and third-party proxy context window errors.
 * LiteLLM is commonly used as a proxy for various LLM providers and may return
 * different error formats than the original providers.
 */
function checkIsLiteLLMContextWindowError(error: unknown): boolean {
	try {
		if (!error || typeof error !== "object") {
			return false
		}

		const err = error as Record<string, any>

		// LiteLLM may wrap errors in different structures
		const message: string = String(
			err.message || err.error?.message || err.error?.error?.message || err.detail || "",
		)
		const status = err.status ?? err.code ?? err.error?.status ?? err.response?.status ?? err.statusCode

		// LiteLLM-specific error patterns for context window exceeded
		const LITELLM_CONTEXT_PATTERNS = [
			/\bcontext\s*(?:length|window)\s*(?:exceeded|too\s*long|limit)/i,
			/\bmax(?:imum)?\s*(?:context|token)\s*(?:length|limit|size)/i,
			/\btoo\s*(?:many|long)\s*(?:tokens?|input)/i,
			/\binput\s*(?:is\s*)?too\s*long/i,
			/\bexceeds?\s*(?:the\s*)?(?:max(?:imum)?|context)\s*(?:token|length|limit)/i,
			/\brequest\s*(?:is\s*)?too\s*large/i,
			/\bprompt\s*(?:is\s*)?too\s*long/i,
			// Chinese error messages (common in Chinese LLM proxies)
			/超长|超出.*(?:长度|限制|上下文)/,
			/(?:上下文|输入|请求).*(?:太长|过长|超出)/,
		] as const

		// Check if message matches any context window pattern
		if (LITELLM_CONTEXT_PATTERNS.some((pattern) => pattern.test(message))) {
			return true
		}

		// Also check for status 400 with context-related keywords
		if (String(status) === "400" && LITELLM_CONTEXT_PATTERNS.some((pattern) => pattern.test(message))) {
			return true
		}

		// Check for LiteLLM-specific error structure
		if (err.error?.type === "context_length_exceeded" || err.error?.code === "context_length_exceeded") {
			return true
		}

		return false
	} catch {
		return false
	}
}

/**
 * Check for generic context window errors that may come from various sources.
 * This is a catch-all for error messages that indicate context overflow but
 * don't match provider-specific patterns.
 *
 * This handles cases where:
 * - Third-party proxies return plain text errors
 * - Error messages are wrapped in unexpected structures
 * - JSON parsing fails and the raw error text contains context overflow info
 */
function checkIsGenericContextWindowError(error: unknown): boolean {
	try {
		// Handle string errors (e.g., from JSON parse failures)
		if (typeof error === "string") {
			return checkMessageForContextOverflow(error)
		}

		if (!error || typeof error !== "object") {
			return false
		}

		const err = error as Record<string, any>

		// Collect all possible message sources
		const messageSources = [
			err.message,
			err.error?.message,
			err.error?.error?.message,
			err.detail,
			err.body,
			err.text,
			err.data,
			// Handle cases where the error might be a stringified JSON
			typeof err.error === "string" ? err.error : null,
		]

		// Check each message source for context overflow patterns
		for (const source of messageSources) {
			if (source && typeof source === "string" && checkMessageForContextOverflow(source)) {
				return true
			}
		}

		// Check for cause chain (some errors wrap the original error)
		if (err.cause && checkIsGenericContextWindowError(err.cause)) {
			return true
		}

		return false
	} catch {
		return false
	}
}

/**
 * Helper function to check if a message string indicates context overflow.
 * Used by multiple error checking functions.
 */
function checkMessageForContextOverflow(message: string): boolean {
	// Comprehensive patterns for context window/length exceeded errors
	const GENERIC_CONTEXT_PATTERNS = [
		// English patterns
		/\bcontext\s*(?:length|window|size)\s*(?:exceeded|too\s*long|limit|overflow)/i,
		/\bmax(?:imum)?\s*(?:context|token|input)\s*(?:length|limit|size|count)/i,
		/\btoo\s*(?:many|long)\s*(?:tokens?|input|characters?)/i,
		/\binput\s*(?:is\s*)?too\s*(?:long|large)/i,
		/\bexceeds?\s*(?:the\s*)?(?:max(?:imum)?|context|token)\s*(?:length|limit|size)/i,
		/\brequest\s*(?:is\s*)?too\s*(?:large|long)/i,
		/\bprompt\s*(?:is\s*)?too\s*(?:long|large)/i,
		/\btoken\s*(?:count|limit)\s*exceeded/i,
		/\b(?:input|prompt|request)\s*(?:length|size)\s*(?:exceeded|too\s*(?:long|large))/i,
		/\breduce\s*(?:the\s*)?(?:length|size|tokens?)/i,
		// Chinese patterns (common in Chinese LLM services)
		/超长|超出.*(?:长度|限制|上下文|令牌)/,
		/(?:上下文|输入|请求|提示).*(?:太长|过长|超出|超过)/,
		/(?:长度|大小|令牌).*(?:超出|超过|限制)/,
		// Japanese patterns
		/(?:コンテキスト|入力|リクエスト).*(?:長すぎ|超過|制限)/,
		// Korean patterns
		/(?:컨텍스트|입력|요청).*(?:너무\s*길|초과|제한)/,
	] as const

	return GENERIC_CONTEXT_PATTERNS.some((pattern) => pattern.test(message))
}
