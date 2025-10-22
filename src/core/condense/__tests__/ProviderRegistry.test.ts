import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { ProviderRegistry, getProviderRegistry } from "../ProviderRegistry"
import { BaseCondensationProvider } from "../BaseProvider"
import type { CondensationContext, CondensationOptions, CondensationResult } from "../types"

// Test provider implementations
class TestProviderA extends BaseCondensationProvider {
	readonly id = "provider-a"
	readonly name = "Provider A"
	readonly description = "Test A"

	protected async condenseInternal(): Promise<CondensationResult> {
		return { messages: [], cost: 0 }
	}

	async estimateCost(): Promise<number> {
		return 0
	}
}

class TestProviderB extends BaseCondensationProvider {
	readonly id = "provider-b"
	readonly name = "Provider B"
	readonly description = "Test B"

	protected async condenseInternal(): Promise<CondensationResult> {
		return { messages: [], cost: 0 }
	}

	async estimateCost(): Promise<number> {
		return 0
	}
}

describe("ProviderRegistry", () => {
	let registry: ProviderRegistry

	beforeEach(() => {
		registry = ProviderRegistry.getInstance()
		registry.clear()
	})

	afterEach(() => {
		registry.clear()
	})

	it("should be a singleton", () => {
		const instance1 = ProviderRegistry.getInstance()
		const instance2 = ProviderRegistry.getInstance()

		expect(instance1).toBe(instance2)
	})

	it("should register and retrieve providers", () => {
		const provider = new TestProviderA()

		registry.register(provider)

		const retrieved = registry.getProvider("provider-a")
		expect(retrieved).toBe(provider)
	})

	it("should unregister providers", () => {
		const provider = new TestProviderA()

		registry.register(provider)
		const unregistered = registry.unregister("provider-a")

		expect(unregistered).toBe(true)
		expect(registry.getProvider("provider-a")).toBeUndefined()
	})

	it("should return all providers", () => {
		const providerA = new TestProviderA()
		const providerB = new TestProviderB()

		registry.register(providerA)
		registry.register(providerB)

		const all = registry.getAllProviders()
		expect(all).toHaveLength(2)
		expect(all).toContain(providerA)
		expect(all).toContain(providerB)
	})

	it("should filter enabled providers", () => {
		const providerA = new TestProviderA()
		const providerB = new TestProviderB()

		registry.register(providerA, { enabled: true })
		registry.register(providerB, { enabled: false })

		const enabled = registry.getEnabledProviders()
		expect(enabled).toHaveLength(1)
		expect(enabled[0]).toBe(providerA)
	})

	it("should sort providers by priority", () => {
		const providerA = new TestProviderA()
		const providerB = new TestProviderB()

		registry.register(providerA, { priority: 200 })
		registry.register(providerB, { priority: 50 })

		const enabled = registry.getEnabledProviders()
		expect(enabled[0]).toBe(providerB) // Lower priority first
		expect(enabled[1]).toBe(providerA)
	})

	it("should update provider config", () => {
		const provider = new TestProviderA()

		registry.register(provider, { enabled: true, priority: 100 })

		const updated = registry.updateConfig("provider-a", { priority: 50 })
		expect(updated).toBe(true)

		const config = registry.getConfig("provider-a")
		expect(config?.priority).toBe(50)
		expect(config?.enabled).toBe(true)
	})

	it("should return false when updating non-existent provider", () => {
		const updated = registry.updateConfig("non-existent", { priority: 50 })
		expect(updated).toBe(false)
	})

	it("should work with convenience function", () => {
		const registry1 = getProviderRegistry()
		const registry2 = getProviderRegistry()

		expect(registry1).toBe(registry2)
	})

	it("should clear all providers and configs", () => {
		const providerA = new TestProviderA()
		const providerB = new TestProviderB()

		// Register providers
		registry.register(providerA, { enabled: true, priority: 100 })
		registry.register(providerB, { enabled: false, priority: 200 })

		// Verify they are registered
		expect(registry.getAllProviders()).toHaveLength(2)
		expect(registry.getProvider("provider-a")).toBe(providerA)
		expect(registry.getProvider("provider-b")).toBe(providerB)
		expect(registry.getConfig("provider-a")).toBeDefined()
		expect(registry.getConfig("provider-b")).toBeDefined()

		// Clear the registry
		registry.clear()

		// Verify everything is cleared
		expect(registry.getAllProviders()).toHaveLength(0)
		expect(registry.getProvider("provider-a")).toBeUndefined()
		expect(registry.getProvider("provider-b")).toBeUndefined()
		expect(registry.getConfig("provider-a")).toBeUndefined()
		expect(registry.getConfig("provider-b")).toBeUndefined()
	})
})