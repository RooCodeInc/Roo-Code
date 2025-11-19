import type { ModelInfo } from "../model.js"

import { openAiModelInfoSaneDefaults } from "./openai.js"

export const dialDefaultModelId = "gpt-4o-mini-2024-07-18"

export const dialDefaultBaseUrl = "https://ai-proxy.lab.epam.com"

export const dialDefaultApiVersion = "2024-02-01"

export const dialDefaultModelInfo: ModelInfo = {
	...openAiModelInfoSaneDefaults,
	description: "GPT-4o mini deployment available through EPAM DIAL.",
}
