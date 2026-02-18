# Architecture Notes - Roo Code Extension

## Overview

The Roo Code extension is a VS Code extension that provides AI-powered coding assistance. This document outlines the core architecture, design decisions, and the hook system implementation.

## Extension Architecture

### Core Components

1. **Extension Entry Point** (`src/extension.ts`)

    - Handles extension activation and deactivation
    - Initializes core services and providers
    - Manages extension lifecycle

2. **ClineProvider** (`src/core/webview/ClineProvider.ts`)

    - Manages the webview UI
    - Handles communication between extension and webview
    - Coordinates task execution

3. **Task System** (`src/core/task/Task.ts`)

    - Represents individual AI coding tasks
    - Manages task lifecycle and state
    - Emits events for task state changes

4. **Services Layer**

    - **CloudService**: Handles cloud integration and authentication
    - **McpServerManager**: Manages MCP (Model Context Protocol) servers
    - **CodeIndexManager**: Manages code indexing for context
    - **TelemetryService**: Handles telemetry and analytics

5. **Hook System** (`src/hooks/`)
    - Plugin-like architecture for extending functionality
    - Lifecycle hooks for extension stages
    - Event hooks for extension events

## Hook System Architecture

### Design Philosophy

The hook system provides a clean, extensible way to add functionality without modifying core extension code. It follows the plugin pattern, allowing:

- **Separation of Concerns**: Core functionality remains separate from extensions
- **Extensibility**: New features can be added without touching core code
- **Testability**: Hooks can be tested independently
- **Maintainability**: Clear contracts and interfaces

### Architecture Components

#### HookManager

Singleton manager that orchestrates all hook operations:

- **Registration**: Registers lifecycle and event hooks
- **Execution**: Executes hooks in priority order
- **Management**: Tracks and manages hook lifecycle

#### Hook Types

Defines the contract for hooks:

- **Lifecycle Hooks**: Execute at specific extension lifecycle stages
- **Event Hooks**: Execute in response to extension events
- **Priority System**: Controls execution order

#### Hook Factory

Convenience API for creating and registering hooks:

```typescript
const hook = createHook()
hook.onLifecycle(HookLifecycleStage.AfterActivate, callback)
hook.onEvent(HookEventType.TaskCreated, callback)
```

### Hook Lifecycle Stages

1. **BeforeActivate**: Executes before extension activation

    - Use case: Pre-initialization checks, configuration validation

2. **AfterActivate**: Executes after extension activation

    - Use case: Post-initialization setup, service registration

3. **BeforeDeactivate**: Executes before extension deactivation

    - Use case: Cleanup preparation, state saving

4. **AfterDeactivate**: Executes after extension deactivation
    - Use case: Final cleanup, resource release

### Hook Event Types

- **TaskCreated**: Triggered when a new task is created
- **TaskStarted**: Triggered when a task starts execution
- **TaskCompleted**: Triggered when a task completes successfully
- **TaskAborted**: Triggered when a task is aborted
- **ProviderInitialized**: Triggered when ClineProvider is initialized
- **SettingsChanged**: Triggered when extension settings change
- **WorkspaceOpened**: Triggered when a workspace is opened
- **WorkspaceClosed**: Triggered when a workspace is closed

### Priority System

Hooks execute in priority order:

- **Critical**: Highest priority, executes first
- **High**: High priority
- **Normal**: Default priority
- **Low**: Lowest priority, executes last

Within the same priority, hooks execute in registration order.

### Error Handling

The hook system implements robust error handling:

- Individual hook failures don't stop other hooks from executing
- Errors are logged to the output channel
- Hook execution continues even if one hook fails

## Integration Points

### Extension Activation

The hook system is initialized during extension activation:

```typescript
const hookManager = HookManager.getInstance()
hookManager.initialize({ extensionContext, outputChannel })

await hookManager.executeLifecycleHook(HookLifecycleStage.BeforeActivate)
// ... extension initialization ...
await hookManager.executeLifecycleHook(HookLifecycleStage.AfterActivate)
```

### Task Lifecycle

Hooks are integrated into the task system:

```typescript
// In Task.ts
await hookManager.executeEventHook(HookEventType.TaskCreated, { taskId })
await hookManager.executeEventHook(HookEventType.TaskStarted, { taskId })
```

### Extension Deactivation

Hooks are executed during deactivation:

```typescript
await hookManager.executeLifecycleHook(HookLifecycleStage.BeforeDeactivate)
// ... cleanup ...
await hookManager.executeLifecycleHook(HookLifecycleStage.AfterDeactivate)
```

## Design Patterns

### Singleton Pattern

HookManager uses the singleton pattern to ensure a single instance manages all hooks across the extension.

### Observer Pattern

The hook system implements the observer pattern, allowing multiple hooks to observe and react to the same events.

### Factory Pattern

The `createHook()` factory function provides a clean API for hook creation and registration.

## Extension Points

The hook system provides extension points for:

1. **Custom Initialization**: Add custom initialization logic
2. **Event Monitoring**: Monitor and react to extension events
3. **Task Interception**: Intercept and modify task behavior
4. **Settings Integration**: React to settings changes
5. **Workspace Management**: Handle workspace lifecycle events

## Future Enhancements

Potential enhancements to the hook system:

1. **Hook Dependencies**: Allow hooks to depend on other hooks
2. **Conditional Execution**: Execute hooks based on conditions
3. **Hook Middleware**: Transform data between hooks
4. **Hook Testing Utilities**: Utilities for testing hooks
5. **Hook Documentation Generation**: Auto-generate hook documentation

## Best Practices

1. **Idempotency**: Hooks should be idempotent when possible
2. **Error Handling**: Hooks should handle errors gracefully
3. **Performance**: Hooks should be fast and non-blocking
4. **Naming**: Use descriptive names for hooks
5. **Documentation**: Document hook behavior and side effects
