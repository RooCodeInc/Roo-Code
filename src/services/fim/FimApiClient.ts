/**
 * Lightweight API client for FIM (Fill-in-the-Middle) completion requests.
 *
 * Supports the `/v1/completions` endpoint used by OpenAI-compatible servers,
 * DeepSeek, Ollama, and similar providers. This is the legacy completions
 * endpoint (not chat completions), which is better suited for raw FIM prompts.
 */

import { formatFimPrompt } from "./FimTokenFormatter"

export interface FimRequestOptions {
	/** The FIM provider type */
	provider: "openai-compatible" | "deepseek" | "mistral" | "ollama"
	/** Base URL for the API endpoint */
	baseUrl: string
	/** API key for authentication */
	apiKey?: string
	/** Model ID to use */
	modelId: string
	/** Text before the cursor */
	prefix: string
	/** Text after the cursor */
	suffix: string
	/** Maximum tokens to generate */
	maxTokens: number
	/** Abort signal for cancellation */
	signal?: AbortSignal
}

export interface FimResponse {
	/** The generated completion text */
	completion: string
}

/**
 * Normalize a base URL by removing trailing slashes.
 */
function normalizeBaseUrl(url: string): string {
	return url.replace(/\/+$/, "")
}

/**
 * Build the API endpoint URL based on the provider type.
 */
function buildEndpointUrl(provider: string, baseUrl: string): string {
	const normalized = normalizeBaseUrl(baseUrl)

	switch (provider) {
		case "ollama":
			return `${normalized}/api/generate`
		case "mistral":
			return `${normalized}/v1/fim/completions`
		default:
			// openai-compatible and deepseek use /v1/completions
			return `${normalized}/v1/completions`
	}
}

/**
 * Build the request body based on the provider type.
 */
function buildRequestBody(options: FimRequestOptions): Record<string, unknown> {
	const { provider, modelId, prefix, suffix, maxTokens } = options

	switch (provider) {
		case "ollama":
			return {
				model: modelId,
				prompt: prefix,
				suffix: suffix,
				stream: false,
				options: {
					num_predict: maxTokens,
					temperature: 0.2,
					top_p: 0.9,
				},
			}
		case "mistral":
			return {
				model: modelId,
				prompt: prefix,
				suffix: suffix,
				max_tokens: maxTokens,
				temperature: 0.2,
				top_p: 0.9,
				stop: ["\n\n"],
			}
		default: {
			// openai-compatible and deepseek: format the FIM prompt with special tokens
			const prompt = formatFimPrompt(modelId, prefix, suffix)
			return {
				model: modelId,
				prompt,
				max_tokens: maxTokens,
				temperature: 0.2,
				top_p: 0.9,
				stop: ["\n\n", "<|fim", "<fim_", "[/MIDDLE]"],
			}
		}
	}
}

/**
 * Extract the completion text from the provider response.
 */
function extractCompletion(provider: string, data: Record<string, unknown>): string {
	switch (provider) {
		case "ollama": {
			return (data.response as string) ?? ""
		}
		default: {
			// OpenAI-compatible response format
			const choices = data.choices as Array<{ text?: string; message?: { content?: string } }> | undefined
			if (!choices || choices.length === 0) {
				return ""
			}
			return choices[0].text ?? choices[0].message?.content ?? ""
		}
	}
}

/**
 * Send a FIM completion request to the configured provider.
 */
export async function requestFimCompletion(options: FimRequestOptions): Promise<FimResponse> {
	const url = buildEndpointUrl(options.provider, options.baseUrl)
	const body = buildRequestBody(options)

	const headers: Record<string, string> = {
		"Content-Type": "application/json",
	}

	if (options.apiKey) {
		headers["Authorization"] = `Bearer ${options.apiKey}`
	}

	const response = await fetch(url, {
		method: "POST",
		headers,
		body: JSON.stringify(body),
		signal: options.signal,
	})

	if (!response.ok) {
		const errorText = await response.text().catch(() => "Unknown error")
		throw new Error(`FIM API request failed (${response.status}): ${errorText}`)
	}

	const data = (await response.json()) as Record<string, unknown>
	const completion = extractCompletion(options.provider, data)

	return { completion }
}
