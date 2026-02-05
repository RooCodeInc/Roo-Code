import { SECRET_STATE_KEYS, GLOBAL_SECRET_KEYS, ProviderSettings } from "@roo-code/types"

export function checkExistKey(config: ProviderSettings | undefined) {
	if (!config) {
		return false
	}

	// Special case for providers which don't need standard API key configuration.
	if (config.apiProvider && ["fake-ai", "openai-codex", "qwen-code", "roo"].includes(config.apiProvider)) {
		return true
	}

	// Azure supports managed identity / Entra ID auth (no API key needed).
	// Consider it configured if resource name or deployment name is set.
	if (config.apiProvider === "azure") {
		return !!(config.azureResourceName || config.azureDeploymentName || config.azureApiKey)
	}

	// Check all secret keys from the centralized SECRET_STATE_KEYS array.
	// Filter out keys that are not part of ProviderSettings (global secrets are stored separately)
	const providerSecretKeys = SECRET_STATE_KEYS.filter((key) => !GLOBAL_SECRET_KEYS.includes(key as any))
	const hasSecretKey = providerSecretKeys.some((key) => config[key as keyof ProviderSettings] !== undefined)

	// Check additional non-secret configuration properties
	const hasOtherConfig = [
		config.awsRegion,
		config.vertexProjectId,
		config.ollamaModelId,
		config.lmStudioModelId,
		config.vsCodeLmModelSelector,
	].some((value) => value !== undefined)

	return hasSecretKey || hasOtherConfig
}
