import axios from "axios"
import { z } from "zod"

import type { ModelInfo } from "@roo-code/types"

import { DEFAULT_HEADERS } from "../constants"

/**
 * CometAPI Models Response Schema
 * Be lenient: CometAPI returns { success: true, data: [...] } and may omit OpenAI's `object: "list"`.
 */
// Ignore patterns for non-chat or unsupported models

// this should be changed to accurately filter chat models based on server-side fields, and remove the local regex-based ignore list and loose parsing logic.

// TODO(CometAPI): After the official model list interface is upgraded (returning richer type/capability fields or stable OpenAI compatible format)
const COMETAPI_IGNORE_PATTERNS = [
	// Image generation models
	"dall-e",
	"dalle",
	"midjourney",
	"mj_",
	"stable-diffusion",
	"sd-",
	"flux-",
	"playground-v",
	"ideogram",
	"recraft-",
	"black-forest-labs",
	"/recraft-v3",
	"recraftv3",
	"stability-ai/",
	"sdxl",
	// Audio generation models
	"suno_",
	"tts",
	"whisper",
	// Video generation models
	"runway",
	"luma_",
	"luma-",
	"veo",
	"kling_",
	"minimax_video",
	"hunyuan-t1",
	// Utility models
	"embedding",
	"search-gpts",
	"files_retrieve",
	"moderation",
]

function escapeRegex(str: string) {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

const COMETAPI_IGNORE_REGEX = new RegExp(COMETAPI_IGNORE_PATTERNS.map((p) => escapeRegex(p)).join("|"), "i")

const cometApiModelSchema = z
	.object({
		id: z.string(),
		object: z.literal("model").optional(),
		created: z.number().optional(),
		owned_by: z.string().optional(),
		// Additional optional fields that CometAPI might provide in the future
		max_tokens: z.number().optional(),
		max_input_tokens: z.number().optional(),
		context_length: z.number().optional(),
	})
	.passthrough()

// Support both OpenAI-like and CometAPI's { success, data } shapes
const cometApiModelsResponseSchema = z.union([
	z.object({
		object: z.literal("list").optional(),
		data: z.array(cometApiModelSchema),
	}),
	z.object({
		success: z.boolean(),
		data: z.array(cometApiModelSchema),
	}),
])

type CometApiModel = z.infer<typeof cometApiModelSchema>
type CometApiModelsResponse = z.infer<typeof cometApiModelsResponseSchema>

/**
 * Fetch models from CometAPI
 */
export async function getCometApiModels(
	apiKey?: string,
	baseUrl: string = "https://api.cometapi.com/v1",
): Promise<Record<string, ModelInfo>> {
	const models: Record<string, ModelInfo> = {}

	if (!apiKey || apiKey === "not-provided") {
		console.warn("CometAPI: No valid API key provided, skipping model fetch")
		return models
	}

	if (!baseUrl) {
		console.error("CometAPI: No base URL provided")
		throw new Error("CometAPI: Base URL is required to fetch models")
	}

	try {
		const headers: Record<string, string> = {
			...DEFAULT_HEADERS,
			Authorization: `Bearer ${apiKey}`,
			Accept: "application/json",
		}

		const url = `${baseUrl.replace(/\/$/, "")}/models`

		const response = await axios.get(url, {
			headers,
			timeout: 15000, // Increased timeout for better reliability
		})

		const parsed = cometApiModelsResponseSchema.safeParse(response.data)
		const data = parsed.success ? (parsed.data as any).data : (response.data as any)?.data || []

		if (!parsed.success) {
			console.warn("CometAPI: Unexpected models response shape; proceeding with best-effort parsing.")
			console.warn("CometAPI: Zod error:", parsed.error?.format?.())
			console.warn("CometAPI: Raw response data:", response.data)
		}

		// Process the model info from the response - similar to DeepInfra/LiteLLM approach
		for (const model of data as Array<CometApiModel | any>) {
			if (!model || typeof model.id !== "string") continue

			// Filter out ignored patterns (non-chat models or unsupported utilities)
			if (COMETAPI_IGNORE_REGEX.test(model.id)) {
				continue
			}
			models[model.id] = {
				maxTokens: model.max_tokens || undefined,
				contextWindow: model.max_input_tokens || model.context_length || 200000,
				supportsImages: false, // Not specified in CometAPI models endpoint
				supportsPromptCache: false, // Not specified in CometAPI models endpoint
				// Intentionally not setting inputPrice/outputPrice as CometAPI doesn't provide this info
			}
		}
	} catch (error) {
		if (axios.isAxiosError(error)) {
			const status = error.response?.status
			const statusText = error.response?.statusText || ""
			const code = (error as any).code as string | undefined

			console.error(`CometAPI: API request failed`, {
				status,
				statusText,
				code,
				// Do not log headers or API keys
				url: error.config?.url,
				timeout: error.config?.timeout,
			})
			if (error.response) {
				console.error(`CometAPI: Response data:`, error.response.data)
			}

			let message: string
			if (typeof status === "number") {
				if (status === 401 || status === 403) {
					message = `CometAPI authentication failed (${status}). Please verify your API key and permissions.`
				} else if (status === 429) {
					message = `CometAPI rate limit exceeded (429). Please slow down or check your plan limits.`
				} else if (status >= 500) {
					message = `CometAPI server error (${status} ${statusText}). Please try again later.`
				} else {
					message = `CometAPI request failed (${status} ${statusText}).`
				}
			} else {
				// No HTTP response received: network, DNS, timeout, etc.
				if (code === "ECONNABORTED" || code === "ETIMEDOUT" || /timeout/i.test(error.message || "")) {
					message = `CometAPI request timed out. Please check your network and base URL (${baseUrl}).`
				} else if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
					message = `DNS lookup failed for ${baseUrl}. Please verify the domain and your DNS/network settings.`
				} else if (code === "ECONNREFUSED") {
					message = `Connection refused by ${baseUrl}. Is the service reachable from your network?`
				} else if (error.request) {
					message = `No response from CometAPI at ${baseUrl}. Please check your network connectivity.`
				} else {
					message = `Failed to initiate CometAPI request: ${error.message || "Unknown network error"}.`
				}
			}

			throw new Error(message)
		} else {
			console.error(`CometAPI: Error fetching models:`, error)
			throw new Error(
				`Failed to fetch CometAPI models: ${error instanceof Error ? error.message : "An unknown error occurred."}`,
			)
		}
	}

	return models
}
