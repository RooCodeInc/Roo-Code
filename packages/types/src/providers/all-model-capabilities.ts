/**
 * Aggregated model capabilities from all providers.
 *
 * This map is used by the OpenAI Compatible provider to let users select
 * a known model's capabilities (context window, max tokens, image support,
 * prompt caching, etc.) so Roo can communicate optimally with local or
 * third-party endpoints that serve these models.
 */
import type { ModelInfo } from "../model.js"

import { anthropicModels } from "./anthropic.js"
import { deepSeekModels } from "./deepseek.js"
import { geminiModels } from "./gemini.js"
import { minimaxModels } from "./minimax.js"
import { mistralModels } from "./mistral.js"
import { moonshotModels } from "./moonshot.js"
import { openAiNativeModels } from "./openai.js"
import { sambaNovaModels } from "./sambanova.js"
import { xaiModels } from "./xai.js"
import { internationalZAiModels } from "./zai.js"
import { qwenCodeModels } from "./qwen-code.js"

/**
 * A single entry in the capability presets list.
 */
export interface ModelCapabilityPreset {
	/** The provider this model originally belongs to */
	provider: string
	/** The model ID as known by its native provider */
	modelId: string
	/** The model's capability info */
	info: ModelInfo
}

/**
 * Helper to build preset entries from a provider's model record.
 */
function buildPresets(provider: string, models: Record<string, ModelInfo>): ModelCapabilityPreset[] {
	return Object.entries(models).map(([modelId, info]) => ({
		provider,
		modelId,
		info,
	}))
}

/**
 * All known model capability presets, aggregated from every provider.
 *
 * We intentionally exclude cloud-only routing providers (OpenRouter, Requesty,
 * LiteLLM, Roo, Unbound, Vercel AI Gateway) and platform-locked providers
 * (Bedrock, Vertex, VSCode LM, OpenAI Codex, Baseten, Fireworks) since those
 * models are either duplicates of the originals or have platform-specific
 * model IDs that don't map to local inference.
 *
 * The user can always choose "Custom" and configure capabilities manually.
 */
export const modelCapabilityPresets: ModelCapabilityPreset[] = [
	...buildPresets("Anthropic", anthropicModels),
	...buildPresets("OpenAI", openAiNativeModels),
	...buildPresets("DeepSeek", deepSeekModels),
	...buildPresets("Gemini", geminiModels),
	...buildPresets("MiniMax", minimaxModels),
	...buildPresets("Mistral", mistralModels),
	...buildPresets("Moonshot (Kimi)", moonshotModels),
	...buildPresets("Qwen", qwenCodeModels),
	...buildPresets("SambaNova", sambaNovaModels),
	...buildPresets("xAI", xaiModels),
	...buildPresets("ZAi (GLM)", internationalZAiModels),
]
