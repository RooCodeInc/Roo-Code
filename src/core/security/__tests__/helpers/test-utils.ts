import { vi } from "vitest"
import { SecurityGuard } from "../../SecurityGuard"

/**
 * Create SecurityGuard instance with hierarchical configuration for testing
 * Used by tests in SecurityGuard.spec.ts for complex configuration merging scenarios
 */
export function createHierarchicalTestGuard(globalConfig: any, projectConfig: any, customConfig?: any): SecurityGuard {
	// Clear any existing mocks
	vi.clearAllMocks()

	// Create a SecurityGuard instance with security disabled to avoid file system calls
	const guard = new SecurityGuard("/test/cwd", false)

	// Access private properties to inject our test data
	const guardAny = guard as any

	// Enable security after construction to avoid loadConfiguration() call
	guardAny.isEnabled = true

	// Merge configurations with BLOCK-always-wins logic using new format only
	// Order: global → project → custom (each level can override previous)
	const allBlockFiles = [
		...(globalConfig.block?.files || []),
		...(projectConfig.block?.files || []),
		...(customConfig?.block?.files || []),
	]

	const allBlockCommands = [
		...(globalConfig.block?.commands || []),
		...(projectConfig.block?.commands || []),
		...(customConfig?.block?.commands || []),
	]

	const allBlockEnvVars = [
		...(globalConfig.block?.env_vars || []),
		...(projectConfig.block?.env_vars || []),
		...(customConfig?.block?.env_vars || []),
	]

	const allAskFiles = [
		...(globalConfig.ask?.files || []),
		...(projectConfig.ask?.files || []),
		...(customConfig?.ask?.files || []),
	]

	const allAskCommands = [
		...(globalConfig.ask?.commands || []),
		...(projectConfig.ask?.commands || []),
		...(customConfig?.ask?.commands || []),
	]

	// Remove duplicates
	guardAny.confidentialFiles = [...new Set(allBlockFiles)]
	guardAny.confidentialCommands = [...new Set(allBlockCommands)]
	guardAny.confidentialEnvVars = [...new Set(allBlockEnvVars)]
	guardAny.sensitiveFiles = [...new Set(allAskFiles)]
	guardAny.sensitiveCommands = [...new Set(allAskCommands)]

	// CRITICAL: Remove any ASK patterns that are also in BLOCK (BLOCK always wins)
	guardAny.sensitiveFiles = guardAny.sensitiveFiles.filter(
		(pattern: string) => !guardAny.confidentialFiles.includes(pattern),
	)
	guardAny.sensitiveCommands = guardAny.sensitiveCommands.filter(
		(pattern: string) => !guardAny.confidentialCommands.includes(pattern),
	)

	// Build rule index for enhanced SecurityResult reporting
	guardAny.buildRuleIndex()

	return guard
}
