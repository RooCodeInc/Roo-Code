import { ToolProtocol, TOOL_PROTOCOL } from "@roo-code/types"
import type { ProviderSettings, ProviderName, ModelInfo } from "@roo-code/types"
import { getToolProtocolFromSettings } from "./toolProtocol"

/**
 * Resolve the effective tool protocol based on the precedence hierarchy:
 * Support > Preference > Defaults
 *
 * 1. User Preference - Per-Profile (explicit profile setting)
 * 2. User Preference - Global (VSCode setting)
 * 3. Model Default (defaultToolProtocol in ModelInfo)
 * 4. Provider Default (XML by default, native for specific providers)
 * 5. XML Fallback (final fallback)
 *
 * Then check support: if protocol is "native" but model doesn't support it, use XML.
 *
 * @param providerSettings - The provider settings for the current profile
 * @param modelInfo - Optional model information containing capabilities
 * @param provider - Optional provider name for provider-specific defaults
 * @returns The resolved tool protocol (either "xml" or "native")
 */
export function resolveToolProtocol(
	providerSettings: ProviderSettings,
	modelInfo?: ModelInfo,
	provider?: ProviderName,
): ToolProtocol {
	let protocol: ToolProtocol

	// 1. User Preference - Per-Profile (explicit profile setting, highest priority)
	if (providerSettings.toolProtocol) {
		protocol = providerSettings.toolProtocol
	}
	// 2. User Preference - Global (VSCode global setting)
	// Only treat as user preference if explicitly set to native (non-default value)
	else if (getToolProtocolFromSettings() === TOOL_PROTOCOL.NATIVE) {
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
