# Hook System Schema

## Type Definitions

### HookContext

```typescript
interface HookContext {
	extensionContext: vscode.ExtensionContext
	outputChannel: vscode.OutputChannel
}
```

**Description**: Context object passed to all hooks, providing access to extension context and output channel.

**Properties**:

- `extensionContext`: VS Code extension context
- `outputChannel`: Output channel for logging

### HookPriority

```typescript
enum HookPriority {
	Low = "low",
	Normal = "normal",
	High = "high",
	Critical = "critical",
}
```

**Description**: Priority levels for hook execution order.

**Values**:

- `Low`: Lowest priority (0)
- `Normal`: Default priority (1)
- `High`: High priority (2)
- `Critical`: Highest priority (3)

### HookLifecycleStage

```typescript
enum HookLifecycleStage {
	BeforeActivate = "before-activate",
	AfterActivate = "after-activate",
	BeforeDeactivate = "before-deactivate",
	AfterDeactivate = "after-deactivate",
}
```

**Description**: Extension lifecycle stages where hooks can be registered.

**Values**:

- `BeforeActivate`: Before extension activation
- `AfterActivate`: After extension activation
- `BeforeDeactivate`: Before extension deactivation
- `AfterDeactivate`: After extension deactivation

### HookEventType

```typescript
enum HookEventType {
	TaskCreated = "task-created",
	TaskStarted = "task-started",
	TaskCompleted = "task-completed",
	TaskAborted = "task-aborted",
	ProviderInitialized = "provider-initialized",
	SettingsChanged = "settings-changed",
	WorkspaceOpened = "workspace-opened",
	WorkspaceClosed = "workspace-closed",
}
```

**Description**: Extension events that can trigger hooks.

**Values**:

- `TaskCreated`: Task creation event
- `TaskStarted`: Task start event
- `TaskCompleted`: Task completion event
- `TaskAborted`: Task abortion event
- `ProviderInitialized`: Provider initialization event
- `SettingsChanged`: Settings change event
- `WorkspaceOpened`: Workspace open event
- `WorkspaceClosed`: Workspace close event

### HookOptions

```typescript
interface HookOptions {
	priority?: HookPriority
	name?: string
}
```

**Description**: Options for hook registration.

**Properties**:

- `priority`: Hook execution priority (default: `Normal`)
- `name`: Optional hook name for identification

### HookCallback

```typescript
type HookCallback<T = unknown> = (context: HookContext, data?: T) => void | Promise<void>
```

**Description**: Callback function type for hooks.

**Parameters**:

- `context`: Hook context object
- `data`: Optional event data

**Returns**: `void` or `Promise<void>`

### HookRegistration

```typescript
interface HookRegistration {
	id: string
	stage?: HookLifecycleStage
	event?: HookEventType
	callback: HookCallback
	options: HookOptions
}
```

**Description**: Internal representation of a registered hook.

**Properties**:

- `id`: Unique hook identifier
- `stage`: Lifecycle stage (if lifecycle hook)
- `event`: Event type (if event hook)
- `callback`: Hook callback function
- `options`: Hook options

### HookUnregister

```typescript
type HookUnregister = () => void
```

**Description**: Function type for unregistering a hook.

## HookManager API

### getInstance()

```typescript
static getInstance(): HookManager
```

**Description**: Get the singleton HookManager instance.

**Returns**: `HookManager` instance

### initialize()

```typescript
initialize(context: HookContext): void
```

**Description**: Initialize the hook manager with extension context.

**Parameters**:

- `context`: Hook context object

### registerLifecycleHook()

```typescript
registerLifecycleHook(
  stage: HookLifecycleStage,
  callback: HookCallback,
  options?: HookOptions
): HookUnregister
```

**Description**: Register a lifecycle hook.

**Parameters**:

- `stage`: Lifecycle stage
- `callback`: Hook callback
- `options`: Optional hook options

**Returns**: Unregister function

### registerEventHook()

```typescript
registerEventHook(
  event: HookEventType,
  callback: HookCallback,
  options?: HookOptions
): HookUnregister
```

**Description**: Register an event hook.

**Parameters**:

- `event`: Event type
- `callback`: Hook callback
- `options`: Optional hook options

**Returns**: Unregister function

### executeLifecycleHook()

```typescript
executeLifecycleHook(
  stage: HookLifecycleStage,
  data?: unknown
): Promise<void>
```

**Description**: Execute all hooks registered for a lifecycle stage.

**Parameters**:

- `stage`: Lifecycle stage
- `data`: Optional data to pass to hooks

**Returns**: `Promise<void>`

### executeEventHook()

```typescript
executeEventHook(
  event: HookEventType,
  data?: unknown
): Promise<void>
```

**Description**: Execute all hooks registered for an event type.

**Parameters**:

- `event`: Event type
- `data`: Optional data to pass to hooks

**Returns**: `Promise<void>`

### unregister()

```typescript
unregister(id: string): boolean
```

**Description**: Unregister a hook by ID.

**Parameters**:

- `id`: Hook identifier

**Returns**: `true` if hook was found and unregistered, `false` otherwise

### getRegisteredHooks()

```typescript
getRegisteredHooks(): HookRegistration[]
```

**Description**: Get all registered hooks.

**Returns**: Array of hook registrations

### clear()

```typescript
clear(): void
```

**Description**: Clear all registered hooks.

## Hook Factory API

### createHook()

```typescript
function createHook(): {
	onLifecycle: (stage: HookLifecycleStage, callback: HookCallback, options?: HookOptions) => HookUnregister
	onEvent: (event: HookEventType, callback: HookCallback, options?: HookOptions) => HookUnregister
	off: (id: string) => boolean
}
```

**Description**: Create a hook factory instance.

**Returns**: Hook factory object with methods:

- `onLifecycle`: Register a lifecycle hook
- `onEvent`: Register an event hook
- `off`: Unregister a hook

## Data Flow Schema

```
Hook Registration:
  HookConsumer → createHook() → HookManager.registerLifecycleHook()
                                HookManager.registerEventHook()

Hook Execution:
  Extension Event → HookManager.executeLifecycleHook()
                    HookManager.executeEventHook()
                    → Get Hooks → Sort by Priority → Execute Sequentially

Hook Unregistration:
  HookConsumer → HookUnregister() → HookManager.unregister()
```

## Priority Execution Schema

```
Priority Order (Descending):
  Critical (3) → High (2) → Normal (1) → Low (0)

Within Same Priority:
  Registration Order (FIFO)
```

## Error Handling Schema

```
Hook Execution:
  Try {
    Execute Hook Callback
  } Catch (Error) {
    Log Error to Output Channel
    Continue to Next Hook
  }
```
