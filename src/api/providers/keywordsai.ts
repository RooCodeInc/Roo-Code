import type { ApiHandlerOptions } from "../../shared/api"
import { OpenAiHandler } from "./openai"

/**
 * Keywords AI gateway handler. Uses the OpenAI-compatible gateway;
 * only adds disable_log when logging is disabled (enable-logging option).
 */
export class KeywordsAiHandler extends OpenAiHandler {
	constructor(options: ApiHandlerOptions) {
		const baseUrl = options.keywordsaiBaseUrl || "https://api.keywordsai.co/api/"
		super({
			...options,
			openAiApiKey: options.keywordsaiApiKey ?? "not-provided",
			openAiBaseUrl: baseUrl,
			openAiModelId: options.apiModelId,
			openAiStreamingEnabled: true,
			openAiHeaders: {
				"X-KeywordsAI-Source": "RooCode-Extension",
				...(options.openAiHeaders || {}),
			},
		})
	}

	protected override getExtraRequestParams(): Record<string, unknown> {
		if (this.options.keywordsaiEnableLogging === false) {
			return { disable_log: true }
		}
		return {}
	}
}
