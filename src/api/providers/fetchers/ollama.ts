import axios from "axios"
import { ModelInfo, ollamaDefaultModelInfo } from "@roo-code/types"
import { z } from "zod"

const OllamaModelDetailsSchema = z.object({
	family: z.string(),
	families: z.array(z.string()).nullable().optional(),
	format: z.string().optional(),
	parameter_size: z.string(),
	parent_model: z.string().optional(),
	quantization_level: z.string().optional(),
})

const OllamaModelSchema = z.object({
	details: OllamaModelDetailsSchema,
	digest: z.string().optional(),
	model: z.string(),
	modified_at: z.string().optional(),
	name: z.string(),
	size: z.number().optional(),
})

const OllamaModelInfoResponseSchema = z.object({
	modelfile: z.string().optional(),
	parameters: z.string().optional(),
	template: z.string().optional(),
	details: OllamaModelDetailsSchema,
	model_info: z.record(z.string(), z.any()),
	capabilities: z.array(z.string()).optional(),
})

const OllamaModelsResponseSchema = z.object({
	models: z.array(OllamaModelSchema),
})

type OllamaModelsResponse = z.infer<typeof OllamaModelsResponseSchema>

type OllamaModelInfoResponse = z.infer<typeof OllamaModelInfoResponseSchema>

/**
 * Known vision-related family names that appear in `details.families` for
 * multimodal models in Ollama.  When a model's `capabilities` array omits
 * "vision" (as happens with some third-party quants like unsloth), we fall
 * back to checking these families.
 */
const VISION_FAMILIES = new Set(["clip", "siglip", "mmproj", "mllama"])

/**
 * Regex patterns matched against `model_info` keys to detect a vision
 * encoder even when `capabilities` and `details.families` are both silent.
 */
const VISION_MODEL_INFO_PATTERN = /vision|clip|siglip|mmproj|image_encoder/i

/**
 * Determines whether the model supports images by checking:
 *   1. The authoritative `capabilities` array (preferred).
 *   2. `details.families` for known vision encoder families.
 *   3. `model_info` keys for vision-related architecture indicators.
 */
const detectVisionSupport = (rawModel: OllamaModelInfoResponse): boolean => {
	// 1. Authoritative check
	if (rawModel.capabilities?.includes("vision")) {
		return true
	}

	// 2. Families check
	const families = rawModel.details.families
	if (families?.some((f) => VISION_FAMILIES.has(f.toLowerCase()))) {
		return true
	}

	// 3. model_info key check
	if (Object.keys(rawModel.model_info).some((k) => VISION_MODEL_INFO_PATTERN.test(k))) {
		return true
	}

	return false
}

export const parseOllamaModel = (rawModel: OllamaModelInfoResponse): ModelInfo | null => {
	const contextKey = Object.keys(rawModel.model_info).find((k) => k.includes("context_length"))
	const contextWindow =
		contextKey && typeof rawModel.model_info[contextKey] === "number" ? rawModel.model_info[contextKey] : undefined

	// Filter out models that don't support tools. Models without tool capability won't work.
	const supportsTools = rawModel.capabilities?.includes("tools") ?? false
	if (!supportsTools) {
		return null
	}

	const modelInfo: ModelInfo = Object.assign({}, ollamaDefaultModelInfo, {
		description: `Family: ${rawModel.details.family}, Context: ${contextWindow}, Size: ${rawModel.details.parameter_size}`,
		contextWindow: contextWindow || ollamaDefaultModelInfo.contextWindow,
		supportsPromptCache: true,
		supportsImages: detectVisionSupport(rawModel),
		maxTokens: contextWindow || ollamaDefaultModelInfo.contextWindow,
	})

	return modelInfo
}

export async function getOllamaModels(
	baseUrl = "http://localhost:11434",
	apiKey?: string,
): Promise<Record<string, ModelInfo>> {
	const models: Record<string, ModelInfo> = {}

	// clearing the input can leave an empty string; use the default in that case
	baseUrl = baseUrl === "" ? "http://localhost:11434" : baseUrl

	try {
		if (!URL.canParse(baseUrl)) {
			return models
		}

		// Prepare headers with optional API key
		const headers: Record<string, string> = {}
		if (apiKey) {
			headers["Authorization"] = `Bearer ${apiKey}`
		}

		const response = await axios.get<OllamaModelsResponse>(`${baseUrl}/api/tags`, { headers })
		const parsedResponse = OllamaModelsResponseSchema.safeParse(response.data)
		let modelInfoPromises = []

		if (parsedResponse.success) {
			for (const ollamaModel of parsedResponse.data.models) {
				modelInfoPromises.push(
					axios
						.post<OllamaModelInfoResponse>(
							`${baseUrl}/api/show`,
							{
								model: ollamaModel.model,
							},
							{ headers },
						)
						.then((ollamaModelInfo) => {
							const modelInfo = parseOllamaModel(ollamaModelInfo.data)
							// Only include models that support native tools
							if (modelInfo) {
								models[ollamaModel.name] = modelInfo
							}
						}),
				)
			}

			await Promise.all(modelInfoPromises)
		} else {
			console.error(`Error parsing Ollama models response: ${JSON.stringify(parsedResponse.error, null, 2)}`)
		}
	} catch (error) {
		if (error.code === "ECONNREFUSED") {
			console.warn(`Failed connecting to Ollama at ${baseUrl}`)
		} else {
			console.error(
				`Error fetching Ollama models: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
			)
		}
	}

	return models
}
