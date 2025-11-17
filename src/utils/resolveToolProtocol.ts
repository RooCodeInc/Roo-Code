import { ToolProtocol, TOOL_PROTOCOL, type Experiments } from "@roo-code/types"
import type { ProviderSettings, ProviderName, ModelInfo } from "@roo-code/types"
import { EXPERIMENT_IDS, experiments } from "../shared/experiments"

/**
 * Resolve the effective tool protocol based on the precedence hierarchy:
 * Support > Preference > Defaults
 *
 * 1. User Preference - Per-Profile (explicit profile setting)
 * 2. User Preference - Experimental Setting (nativeToolCalling experiment)
 * 3. Model Default (defaultToolProtocol in ModelInfo)
 * 4. Provider Default (XML by default, native for specific providers)
 * 5. XML Fallback (final fallback)
 *
 * Then check support: if protocol is "native" but model doesn't support it, use XML.
 *
 * @param providerSettings - The provider settings for the current profile
 * @param modelInfo - Optional model information containing capabilities
 * @param provider - Optional provider name for provider-specific defaults
 * @param experimentsConfig - Optional experiments configuration
 * @returns The resolved tool protocol (either "xml" or "native")
 */
export function resolveToolProtocol(
	providerSettings: ProviderSettings,
	modelInfo?: ModelInfo,
	provider?: ProviderName,
	experimentsConfig?: Experiments,
): ToolProtocol {
	let protocol: ToolProtocol

	// 1. User Preference - Per-Profile (explicit profile setting, highest priority)
	if (providerSettings.toolProtocol) {
		protocol = providerSettings.toolProtocol
	}
	// 2. User Preference - Experimental Setting (nativeToolCalling experiment)
	// Only treat as user preference if explicitly enabled
	else if (experiments.isEnabled(experimentsConfig ?? {}, EXPERIMENT_IDS.NATIVE_TOOL_CALLING)) {
		protocol = TOOL_PROTOCOL.NATIVE
	}
	// 3. Model Default - model's preferred protocol
	else if (modelInfo?.defaultToolProtocol) {
		protocol = modelInfo.defaultToolProtocol
	}
	// 4. Provider Default - XML by default, native for specific providers
	else if (provider) {
		protocol = getProviderDefaultProtocol(provider)
	}
	// 5. XML Fallback
	else {
		protocol = TOOL_PROTOCOL.XML
	}

	// Check support: if protocol is native but model doesn't support it, use XML
	// Treat undefined as unsupported (only allow native when explicitly true)
	if (protocol === TOOL_PROTOCOL.NATIVE && modelInfo?.supportsNativeTools !== true) {
		return TOOL_PROTOCOL.XML
	}

	return protocol
}

/**
 * Get the default tool protocol for a provider.
 * All providers default to XML unless explicitly listed as native-preferred.
 *
 * @param provider - The provider name
 * @returns The tool protocol for this provider (XML by default, or native if explicitly listed)
 */
function getProviderDefaultProtocol(provider: ProviderName): ToolProtocol {
	// Native tool providers - these providers support OpenAI-style function calling
	// and work better with the native protocol
	// You can empty this list to make all providers default to XML
	const nativePreferredProviders: ProviderName[] = []

	if (nativePreferredProviders.includes(provider)) {
		return TOOL_PROTOCOL.NATIVE
	}

	// All other providers default to XML
	return TOOL_PROTOCOL.XML
}
