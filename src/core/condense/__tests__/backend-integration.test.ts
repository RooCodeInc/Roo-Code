/**
 * Backend Integration Tests for Condensation Provider Settings
 * Tests the full flow: UI → Handler → Manager → Provider
 */

import { describe, it, expect } from "vitest"
import { CondensationManager } from "../CondensationManager"
import { getProviderRegistry } from "../ProviderRegistry"
import { SmartCondensationProvider } from "../providers/smart"
import { BALANCED_CONFIG, CONSERVATIVE_CONFIG, AGGRESSIVE_CONFIG } from "../providers/smart/configs"

describe("Condensation Backend Integration", () => {
	it("should register all 4 providers including Smart Provider", () => {
		const manager = CondensationManager.getInstance()
		const providers = manager.listProviders()

		expect(providers.length).toBeGreaterThanOrEqual(4)
		expect(providers.map((p) => p.id)).toContain("native")
		expect(providers.map((p) => p.id)).toContain("lossless")
		expect(providers.map((p) => p.id)).toContain("truncation")
		expect(providers.map((p) => p.id)).toContain("smart")
	})

	it("should have Smart Provider registered with correct priority", () => {
		const manager = CondensationManager.getInstance()
		const providers = manager.listProviders()

		const smartProvider = providers.find((p) => p.id === "smart")
		expect(smartProvider).toBeDefined()
		expect(smartProvider?.enabled).toBe(true)
		expect(smartProvider?.priority).toBe(95)
	})

	it("should allow re-registering Smart Provider with conservative config", () => {
		const registry = getProviderRegistry()

		// Get current smart provider to verify it exists
		const existingProvider = registry.getProvider("smart")
		expect(existingProvider).toBeDefined()

		// Re-register with conservative config
		registry.unregister("smart")
		const smartProvider = new SmartCondensationProvider(CONSERVATIVE_CONFIG)
		registry.register(smartProvider, {
			enabled: true,
			priority: 95,
		})

		const provider = registry.getProvider("smart")
		expect(provider).toBeDefined()
		expect(provider?.id).toBe("smart")
	})

	it("should allow re-registering Smart Provider with aggressive config", () => {
		const registry = getProviderRegistry()

		// Re-register with aggressive config
		registry.unregister("smart")
		const smartProvider = new SmartCondensationProvider(AGGRESSIVE_CONFIG)
		registry.register(smartProvider, {
			enabled: true,
			priority: 95,
		})

		const provider = registry.getProvider("smart")
		expect(provider).toBeDefined()
		expect(provider?.id).toBe("smart")
	})

	it("should maintain provider after re-registration", () => {
		const registry = getProviderRegistry()
		const manager = CondensationManager.getInstance()

		// Re-register with new config
		registry.unregister("smart")
		const smartProvider = new SmartCondensationProvider(BALANCED_CONFIG)
		registry.register(smartProvider, {
			enabled: true,
			priority: 95,
		})

		// Verify still registered
		const providers = manager.listProviders()
		const smart = providers.find((p) => p.id === "smart")
		expect(smart).toBeDefined()
		expect(smart?.enabled).toBe(true)
		expect(smart?.priority).toBe(95)
	})

	it("should set Smart as default provider", () => {
		const manager = CondensationManager.getInstance()

		// Ensure smart is registered first
		const providers = manager.listProviders()
		const smartExists = providers.some((p) => p.id === "smart")
		expect(smartExists).toBe(true)

		// Set as default
		manager.setDefaultProvider("smart")
		expect(manager.getDefaultProvider()).toBe("smart")
	})

	it("should throw error when setting non-existent provider as default", () => {
		const manager = CondensationManager.getInstance()

		expect(() => {
			manager.setDefaultProvider("non-existent-provider-xyz")
		}).toThrow("Provider 'non-existent-provider-xyz' not found")
	})
})
