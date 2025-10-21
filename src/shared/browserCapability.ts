import type { ModelInfo } from "@roo-code/types"
import type { ProviderSettings } from "@roo-code/types"

/**
 * Temporary compatibility helper for determining whether the browser tool
 * should be considered supported by a model.
 *
 * During the transition away from supportsComputerUse, we treat models as
 * browser-capable if either:
 * - supportsImages === true (new behavior), OR
 * - supportsComputerUse === true (legacy behavior present in some providers)
 *
 * TODO(techdebt): Remove legacy supportsComputerUse path by 2025-12-31.
 *  - Follow-up: purge provider tables and type usages, then delete this fallback.
 */
export function modelSupportsBrowserCapability(model: ModelInfo, _settings?: ProviderSettings): boolean {
	const supportsImages = (model as any)?.supportsImages === true
	// Legacy flag may still exist in some model tables or be read from older code paths
	const legacyComputerUse = (model as any)?.supportsComputerUse === true
	return supportsImages || legacyComputerUse
}

/**
 * Compute whether browser tools should be enabled given model capability,
 * mode support, and user settings.
 */
export function computeCanUseBrowserTool(
	model: ModelInfo,
	modeSupportsBrowser: boolean,
	browserToolEnabled?: boolean,
	settings?: ProviderSettings,
): boolean {
	return modelSupportsBrowserCapability(model, settings) && modeSupportsBrowser && (browserToolEnabled ?? true)
}
