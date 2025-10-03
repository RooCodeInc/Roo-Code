# ADR 002: Singleton Pattern for Manager and Registry

**Status**: Accepted

**Date**: 2025-01-02

**Context**: Phase 1 Implementation

## Context

The `CondensationManager` and `ProviderRegistry` classes need to coordinate provider registration, configuration, and execution across the entire application. Multiple instances would create problems:

- **Configuration inconsistency**: Different instances with different provider configs
- **Provider duplication**: Same providers registered multiple times
- **State fragmentation**: Split configuration state across instances
- **Memory waste**: Unnecessary object duplication

## Decision

We implemented both `CondensationManager` and `ProviderRegistry` as **Singletons** with lazy initialization.

### Implementation

```typescript
// ProviderRegistry.ts
export class ProviderRegistry {
	private static instance: ProviderRegistry | null = null
	private providers = new Map<string, ICondensationProvider>()
	private configs = new Map<string, ProviderConfig>()

	private constructor() {}

	static getInstance(): ProviderRegistry {
		if (!ProviderRegistry.instance) {
			ProviderRegistry.instance = new ProviderRegistry()
		}
		return ProviderRegistry.instance
	}
}

// CondensationManager.ts
export class CondensationManager {
	private static instance: CondensationManager | null = null
	private defaultProviderId = "native"

	private constructor() {
		this.registerDefaultProviders()
	}

	static getInstance(): CondensationManager {
		if (!CondensationManager.instance) {
			CondensationManager.instance = new CondensationManager()
		}
		return CondensationManager.instance
	}
}

// Convenience functions
export function getProviderRegistry(): ProviderRegistry {
	return ProviderRegistry.getInstance()
}

export function getCondensationManager(): CondensationManager {
	return CondensationManager.getInstance()
}
```

## Rationale

### Why Singleton?

1. **Single Source of Truth**

    - One registry for all providers
    - One manager for all condensation operations
    - Consistent configuration across application

2. **Global Access Point**

    - Available from anywhere in codebase
    - No dependency injection needed
    - Simple to use

3. **Lazy Initialization**

    - Created only when first needed
    - Reduces startup time
    - Memory efficient

4. **State Consistency**

    - Provider configurations centralized
    - Default provider setting shared
    - No configuration drift

5. **VSCode Extension Pattern**
    - Common pattern in VSCode extensions
    - Fits well with extension lifecycle
    - Easy integration with webview

### Alternative Considered: Dependency Injection

**Why Not DI?**

```typescript
// Hypothetical DI approach
class CondensationManager {
	constructor(private registry: ProviderRegistry) {}
}

// Would require passing instances everywhere
function summarizeConversation(...args: any[], registry: ProviderRegistry) {
	const manager = new CondensationManager(registry)
	// ...
}
```

**Problems:**

- ❌ Complex setup and wiring
- ❌ Breaks backward compatibility (new parameters)
- ❌ Overkill for single instance need
- ❌ More boilerplate code

## Consequences

### Positive

- ✅ **Simple API**: `getCondensationManager()` from anywhere
- ✅ **Consistent state**: Single configuration source
- ✅ **Backward compatible**: No changes to existing APIs
- ✅ **Memory efficient**: One instance shared globally
- ✅ **Easy testing**: Clear reset mechanism via `clear()`

### Negative

- ❌ **Global state**: Can make testing harder
- ❌ **Hidden dependencies**: Not obvious from function signatures
- ❌ **Tight coupling**: Hard to swap implementations

### Mitigation Strategies

**1. Testing Support**

Provide explicit reset methods for tests:

```typescript
// ProviderRegistry.ts
export class ProviderRegistry {
	clear(): void {
		this.providers.clear()
		this.configs.clear()
	}
}

// In tests
afterEach(() => {
	getProviderRegistry().clear()
})
```

**2. Isolation in Tests**

Tests are isolated by clearing state between runs:

```typescript
describe("CondensationManager", () => {
	let manager: CondensationManager

	beforeEach(() => {
		const registry = getProviderRegistry()
		registry.clear()

		manager = CondensationManager.getInstance()

		// Re-register providers
		const provider = new NativeCondensationProvider()
		registry.register(provider, { enabled: true, priority: 100 })
	})

	afterEach(() => {
		getProviderRegistry().clear()
	})
})
```

**3. Documentation**

Clearly document the singleton nature in API docs:

```typescript
/**
 * Get the global CondensationManager instance.
 * This is a singleton - the same instance is returned on every call.
 *
 * @returns The global CondensationManager instance
 */
export function getCondensationManager(): CondensationManager
```

## Implementation Details

### Lifecycle

```
Application Start
    ↓
First call to getCondensationManager()
    ↓
CondensationManager constructor
    ↓
registerDefaultProviders()
    ↓
getProviderRegistry() (creates registry if needed)
    ↓
register(NativeProvider)
    ↓
Ready for use
```

### Thread Safety

Not applicable - JavaScript is single-threaded. No race conditions possible.

### Memory Management

- **Creation**: Lazy (on first access)
- **Lifetime**: Application lifetime
- **Cleanup**: Handled by garbage collector on extension deactivation

## Usage Examples

### Application Code

```typescript
import { summarizeConversation } from '@/core/condense'

// No need to manage instances
const result = await summarizeConversation(messages, apiHandler, ...)
```

### Direct Manager Access

```typescript
import { getCondensationManager } from "@/core/condense"

const manager = getCondensationManager()
manager.setDefaultProvider("custom-provider")
const result = await manager.condense(messages, apiHandler)
```

### Registry Access

```typescript
import { getProviderRegistry } from "@/core/condense"

const registry = getProviderRegistry()
const providers = registry.getEnabledProviders()
```

## Testing Strategy

### Unit Tests

```typescript
describe("ProviderRegistry", () => {
	let registry: ProviderRegistry

	beforeEach(() => {
		registry = getProviderRegistry()
		registry.clear() // Reset state
	})

	it("should register providers", () => {
		const provider = new TestProvider()
		registry.register(provider)
		expect(registry.getProvider(provider.id)).toBe(provider)
	})
})
```

### Integration Tests

```typescript
describe("Manager + Registry integration", () => {
	beforeEach(() => {
		const registry = getProviderRegistry()
		registry.clear()

		// Setup providers
		registry.register(new NativeProvider(), { enabled: true })
	})

	it("should use registered providers", async () => {
		const manager = getCondensationManager()
		const result = await manager.condense(messages, apiHandler)
		expect(result.error).toBeUndefined()
	})
})
```

## Future Considerations

### Potential Issues

If the application needs multiple isolated contexts (unlikely):

**Option 1: Scoped Instances**

```typescript
class CondensationManager {
	static createScope(): CondensationManager {
		return new CondensationManager() // Non-singleton
	}
}
```

**Option 2: Context Parameter**

```typescript
interface CondensationContext {
	manager: CondensationManager
	registry: ProviderRegistry
}

function summarizeConversation(messages: ApiMessage[], context: CondensationContext): Promise<Result>
```

However, these are not needed for Phase 1 and would add unnecessary complexity.

## Related

- [ADR 001: Registry Pattern](./001-registry-pattern.md) - Why registry is needed
- [ADR 003: Backward Compatibility](./003-backward-compatibility.md) - How singleton helps compatibility

## References

- [Singleton Pattern](https://refactoring.guru/design-patterns/singleton) - Design pattern explanation
- [JavaScript Closures](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures) - Closure-based singleton alternative
- [Testing Singletons](https://enterprisecraftsmanship.com/posts/singleton-pattern/) - Testing strategies
