import axios from "axios"
import type { ModelInfo, ModelRecord } from "@roo-code/types"
import { openAiModelInfoSaneDefaults } from "@roo-code/types"

/**
 * Fetches model IDs from Atomic Chat's OpenAI-compatible API.
 * @see https://github.com/AtomicBot-ai/Atomic-Chat
 */
export async function getAtomicChatModels(baseUrl = "http://127.0.0.1:1337", apiKey?: string): Promise<ModelRecord> {
	const models: ModelRecord = {}
	const root = baseUrl === "" ? "http://127.0.0.1:1337" : baseUrl.replace(/\/+$/, "")

	try {
		if (!URL.canParse(root)) {
			return models
		}

		const headers: Record<string, string> = {}
		if (apiKey?.trim()) {
			headers.Authorization = `Bearer ${apiKey.trim()}`
		}

		const response = await axios.get<{ data?: Array<{ id: string }> }>(`${root}/v1/models`, {
			headers,
			timeout: 10_000,
		})

		const list = response.data?.data ?? []
		for (const entry of list) {
			if (entry?.id) {
				models[entry.id] = { ...openAiModelInfoSaneDefaults }
			}
		}

		return models
	} catch {
		return models
	}
}
