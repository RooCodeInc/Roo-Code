import type { ModelInfo } from "../model.js"

// DeepInfra models are fetched dynamically from their API
// This type represents the model IDs that will be available
export type DeepInfraModelId = string

// Default model to use when none is specified
export const deepInfraDefaultModelId: DeepInfraModelId = "meta-llama/Llama-3.3-70B-Instruct"

// DeepInfra models will be fetched dynamically, so we provide an empty object
// The actual models will be populated at runtime via the API
export const deepInfraModels = {} as const satisfies Record<string, ModelInfo>
