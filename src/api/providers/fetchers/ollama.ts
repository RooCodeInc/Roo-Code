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

export const parseOllamaModel = (rawModel: OllamaModelInfoResponse): ModelInfo => {
	// Check for context window in model parameters first
	const contextLengthFromModelParameters = rawModel.parameters
		? parseInt(rawModel.parameters.match(/^num_ctx\s+(\d+)/m)?.[1] ?? "", 10) || undefined
		: undefined

	// Check for context window in model_info
	const contextKey = Object.keys(rawModel.model_info).find((k) => k.includes("context_length"))
	const contextLengthFromModelInfo =
		contextKey && typeof rawModel.model_info[contextKey] === "number" ? rawModel.model_info[contextKey] : undefined

	// Use environment variable as fallback
	const contextLengthFromEnvironment = parseInt(process.env.OLLAMA_NUM_CTX || "4096", 10)

	let contextWindow = contextLengthFromModelParameters ?? contextLengthFromModelInfo ?? contextLengthFromEnvironment

	// Handle Ollama's quirk of returning 40960 for undefined context
	if (contextWindow === 40960 && !contextLengthFromModelParameters) {
		contextWindow = 4096 // For some unknown reason, Ollama returns an undefined context as "40960" rather than 4096, which is what it actually enforces.
	}

	const modelInfo: ModelInfo = Object.assign({}, ollamaDefaultModelInfo, {
		description: `Family: ${rawModel.details.family}, Context: ${contextWindow}, Size: ${rawModel.details.parameter_size}`,
		contextWindow: contextWindow,
		supportsPromptCache: true,
		supportsImages: rawModel.capabilities?.includes("vision"),
		supportsComputerUse: false,
		maxTokens: contextWindow,
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
							models[ollamaModel.name] = parseOllamaModel(ollamaModelInfo.data)
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
