# ADR 001: Hook System Architecture

## Status

Accepted

## Context

The Roo Code extension needs a way to allow plugins and extensions to hook into the extension's lifecycle and events without modifying core extension code. This enables:

- Extensibility without core code changes
- Plugin-like architecture
- Separation of concerns
- Testability and maintainability

## Decision

We will implement a hook system that provides:

1. **Lifecycle Hooks**: Execute at specific extension lifecycle stages (before/after activate/deactivate)
2. **Event Hooks**: Execute in response to extension events (task created, completed, etc.)
3. **Priority System**: Control execution order of hooks
4. **Singleton Manager**: Centralized hook management

## Architecture Decision

### Singleton Pattern for HookManager

**Decision**: Use singleton pattern for HookManager

**Rationale**:

- Ensures single source of truth for hook management
- Prevents duplicate hook registrations
- Simplifies hook access across the extension

**Alternatives Considered**:

- Dependency injection: More complex, requires DI container
- Global instance: Less explicit than singleton

### Priority-Based Execution Order

**Decision**: Implement priority-based execution order

**Rationale**:

- Allows critical hooks to execute before others
- Provides flexibility for hook ordering
- Common pattern in plugin systems

**Priority Levels**:

- Critical: Highest priority (e.g., security checks)
- High: High priority (e.g., core initialization)
- Normal: Default priority
- Low: Lowest priority (e.g., logging, analytics)

### Asynchronous Hook Execution

**Decision**: Support both synchronous and asynchronous hooks

**Rationale**:

- Many hook operations are async (file I/O, network requests)
- Maintains consistency with extension patterns
- Allows sequential execution when needed

**Implementation**:

- All hooks return `Promise<void>` or `void`
- HookManager awaits all hooks
- Errors in one hook don't stop others

### Error Isolation

**Decision**: Isolate hook errors - one hook failure doesn't stop others

**Rationale**:

- Prevents cascading failures
- Improves reliability
- Allows partial functionality

**Implementation**:

- Each hook wrapped in try-catch
- Errors logged to output channel
- Execution continues to next hook

## Consequences

### Positive

- **Extensibility**: Easy to add new functionality via hooks
- **Maintainability**: Core code remains clean and focused
- **Testability**: Hooks can be tested independently
- **Flexibility**: Priority system allows fine-grained control

### Negative

- **Complexity**: Adds another layer of abstraction
- **Performance**: Hook execution adds overhead (minimal)
- **Debugging**: May be harder to trace hook execution

### Mitigations

- Comprehensive logging for hook execution
- Clear documentation and examples
- Type-safe hook interfaces
- Performance monitoring

## Implementation Details

### Hook Registration

```typescript
const hook = createHook()
const unregister = hook.onLifecycle(
	HookLifecycleStage.AfterActivate,
	async (context) => {
		// Hook implementation
	},
	{ priority: "high", name: "my-hook" },
)
```

### Hook Execution

```typescript
const hookManager = HookManager.getInstance()
await hookManager.executeLifecycleHook(HookLifecycleStage.AfterActivate)
```

### Integration Points

- Extension activation/deactivation
- Task lifecycle events
- Settings changes
- Workspace events

## References

- [Plugin Pattern](https://en.wikipedia.org/wiki/Plugin_pattern)
- [Observer Pattern](https://en.wikipedia.org/wiki/Observer_pattern)
- VS Code Extension API patterns
