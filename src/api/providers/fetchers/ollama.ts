import axios from "axios"
import { ModelInfo, ollamaDefaultModelInfo } from "@roo-code/types"
import { z } from "zod"

// 10-second timeout for Ollama HTTP requests. This prevents indefinite hangs
// when connecting to unreachable external servers (TCP default is ~30s).
const OLLAMA_REQUEST_TIMEOUT_MS = 10_000

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
		supportsImages: rawModel.capabilities?.includes("vision"),
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

	if (!URL.canParse(baseUrl)) {
		throw new Error(`Invalid Ollama URL: ${baseUrl}`)
	}

	// Prepare headers with optional API key
	const headers: Record<string, string> = {}
	if (apiKey) {
		headers["Authorization"] = `Bearer ${apiKey}`
	}

	try {
		const response = await axios.get<OllamaModelsResponse>(`${baseUrl}/api/tags`, {
			headers,
			timeout: OLLAMA_REQUEST_TIMEOUT_MS,
		})
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
							{ headers, timeout: OLLAMA_REQUEST_TIMEOUT_MS },
						)
						.then((ollamaModelInfo: { data: OllamaModelInfoResponse }) => {
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
	} catch (error: any) {
		// Build a user-friendly error message based on the failure type
		const code = error?.code
		const status = error?.response?.status

		if (code === "ECONNREFUSED") {
			throw new Error(`Connection refused by Ollama at ${baseUrl}. Is the server running and accessible?`)
		} else if (code === "ECONNABORTED" || code === "ETIMEDOUT" || error?.message?.includes("timeout")) {
			throw new Error(
				`Connection to Ollama at ${baseUrl} timed out after ${OLLAMA_REQUEST_TIMEOUT_MS / 1000}s. The server may be unreachable (check firewall settings).`,
			)
		} else if (code === "ENOTFOUND") {
			throw new Error(`Could not resolve hostname for Ollama at ${baseUrl}. Check the URL.`)
		} else if (status) {
			throw new Error(`Ollama at ${baseUrl} returned HTTP ${status}.`)
		} else {
			throw new Error(`Failed to connect to Ollama at ${baseUrl}: ${error?.message || String(error)}`)
		}
	}

	return models
}
