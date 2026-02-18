# ADR 002: Hook Priority System

## Status

Accepted

## Context

When multiple hooks are registered for the same lifecycle stage or event, we need a way to control their execution order. Some hooks may need to execute before others (e.g., security checks before initialization).

## Decision

Implement a priority-based execution system with four priority levels:

1. **Critical**: Highest priority - executes first
2. **High**: High priority
3. **Normal**: Default priority
4. **Low**: Lowest priority - executes last

Within the same priority level, hooks execute in registration order.

## Rationale

### Priority Levels

**Critical Priority**:

- Security checks
- Critical initialization
- System-level validation

**High Priority**:

- Core service initialization
- Important setup tasks

**Normal Priority**:

- Default for most hooks
- Standard functionality

**Low Priority**:

- Logging and analytics
- Non-critical cleanup
- Optional features

### Execution Order

Hooks are sorted by priority (descending), then by registration order within the same priority. This ensures:

- Critical hooks always execute first
- Predictable execution order
- Flexibility for hook authors

## Alternatives Considered

### 1. Registration Order Only

**Rejected**: Too limiting, doesn't allow late-registered critical hooks to execute first.

### 2. Dependency Graph

**Rejected**: More complex, requires dependency resolution, overkill for current needs.

### 3. Weighted System

**Rejected**: Numeric weights are less intuitive than named priorities.

## Implementation

```typescript
const PRIORITY_ORDER: Record<HookPriority, number> = {
	low: 0,
	normal: 1,
	high: 2,
	critical: 3,
}

hooks.sort((a, b) => {
	const priorityA = PRIORITY_ORDER[a.options.priority || HookPriority.Normal]
	const priorityB = PRIORITY_ORDER[b.options.priority || HookPriority.Normal]
	return priorityB - priorityA
})
```

## Consequences

### Positive

- Clear execution order
- Flexible priority assignment
- Intuitive priority names
- Predictable behavior

### Negative

- Requires hook authors to understand priorities
- Potential for priority conflicts

### Mitigations

- Clear documentation on priority usage
- Default to "normal" priority
- Examples showing priority usage

## Examples

### Critical Hook

```typescript
hook.onLifecycle(
	HookLifecycleStage.BeforeActivate,
	async (context) => {
		// Security check - must run first
	},
	{ priority: "critical" },
)
```

### Low Priority Hook

```typescript
hook.onEvent(
	HookEventType.TaskCompleted,
	async (context, data) => {
		// Analytics - can run last
	},
	{ priority: "low" },
)
```
