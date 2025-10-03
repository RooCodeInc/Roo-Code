# ADR 001: Registry Pattern Over Plugin System

**Status**: Accepted

**Date**: 2025-01-02

**Context**: Phase 1 Implementation

## Context

We needed a mechanism to manage multiple condensation providers in a way that is:

- Type-safe and discoverable at compile time
- Easy to configure (enable/disable, priority)
- Simple to understand and maintain
- Suitable for Phase 1 (MVP) scope

Two main approaches were considered:

1. **Registry Pattern**: Explicit registration with centralized management
2. **Plugin System**: Dynamic loading with file-system discovery

## Decision

We chose the **Registry Pattern** for Phase 1, implemented through the `ProviderRegistry` class.

### Registry Pattern Implementation

```typescript
class ProviderRegistry {
	private providers = new Map<string, ICondensationProvider>()
	private configs = new Map<string, ProviderConfig>()

	register(provider: ICondensationProvider, config?: Partial<ProviderConfig>): void {
		this.providers.set(provider.id, provider)
		this.configs.set(provider.id, { ...defaults, ...config })
	}

	getProvider(id: string): ICondensationProvider | undefined {
		return this.providers.get(id)
	}

	getEnabledProviders(): ICondensationProvider[] {
		return Array.from(this.providers.values())
			.filter((p) => this.configs.get(p.id)?.enabled)
			.sort((a, b) => {
				const aPrio = this.configs.get(a.id)?.priority || 0
				const bPrio = this.configs.get(b.id)?.priority || 0
				return bPrio - aPrio
			})
	}
}
```

## Rationale

### Advantages of Registry Pattern

1. **Type Safety**

    - All providers known at compile time
    - TypeScript can validate provider interfaces
    - No runtime type checking needed

2. **Simplicity**

    - Straightforward registration process
    - Easy to understand and debug
    - Minimal boilerplate

3. **Performance**

    - O(1) lookup by ID via Map
    - No file system scanning
    - Instant startup time

4. **Configuration**

    - Centralized config management
    - Easy to enable/disable providers
    - Priority-based selection

5. **Testing**

    - Easy to mock and test
    - No file system dependencies
    - Isolated unit tests possible

6. **Phase 1 Appropriate**
    - Simple enough for MVP
    - Can evolve into plugin system later
    - Meets immediate needs

### Disadvantages of Plugin System (Why Not Chosen for Phase 1)

1. **Complexity**

    - Requires dynamic import/require
    - File system scanning needed
    - More error-prone

2. **Type Safety Issues**

    - Providers loaded at runtime
    - TypeScript benefits reduced
    - Requires runtime validation

3. **Configuration Challenges**

    - Need convention for config files
    - Discovery mechanism required
    - More moving parts

4. **Testing Difficulties**

    - File system mocking needed
    - More integration test complexity
    - Harder to isolate

5. **Overkill for Phase 1**
    - Only 1 provider initially (Native)
    - Future providers will be built-in
    - External plugins not needed yet

## Consequences

### Positive

- ✅ **Fast development**: Simple API, quick to implement
- ✅ **Strong typing**: Full TypeScript support
- ✅ **Easy debugging**: Clear registration flow
- ✅ **Testability**: Simple mocking and isolation
- ✅ **Performance**: No runtime overhead

### Negative

- ❌ **Manual registration**: Providers must be explicitly registered
- ❌ **No hot-reload**: Changes require restart
- ❌ **Coupled to codebase**: All providers must be part of main repo

### Mitigation

The negative consequences are acceptable for Phase 1 because:

- Initial providers will be built-in (Native, future LLM-based)
- External plugin system can be added in Phase 3+ if needed
- Manual registration is explicit and predictable

## Implementation Example

```typescript
// CondensationManager.ts
class CondensationManager {
	private registerDefaultProviders(): void {
		const registry = getProviderRegistry()

		// Register Native provider
		const nativeProvider = new NativeCondensationProvider()
		registry.register(nativeProvider, {
			enabled: true,
			priority: 100,
		})

		// Future providers can be registered here
		// const llmProvider = new LLMCondensationProvider()
		// registry.register(llmProvider, { enabled: true, priority: 50 })
	}
}
```

## Future Evolution

The Registry Pattern provides a foundation that can evolve:

### Phase 2: Enhanced Registry

- Dynamic configuration persistence
- Runtime enable/disable without restart
- Advanced priority algorithms

### Phase 3: Plugin System (Optional)

If external providers become a requirement:

- Add plugin discovery layer on top of registry
- Maintain registry as core mechanism
- Plugins register themselves via registry API

### Phase 4: Marketplace (Future)

- Provider marketplace integration
- One-click installation
- Automatic updates

## Related

- [ADR 002: Singleton Pattern](./002-singleton-pattern.md) - Why registry is a singleton
- [Architecture Guide](../ARCHITECTURE.md) - System architecture overview

## References

- [Registry Pattern](https://martinfowler.com/eaaCatalog/registry.html) - Martin Fowler
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html) - Type safety benefits
