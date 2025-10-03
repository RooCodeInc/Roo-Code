# Context Condensation Provider System

> Extensible architecture for intelligent conversation context condensation

## Overview

The Context Condensation Provider System is a modular architecture that enables Roo-Code to intelligently condense conversation history when context grows too large. This system replaces the monolithic `summarizeConversation` function with a flexible, provider-based approach while maintaining 100% backward compatibility.

## Key Features

- **🔌 Provider-Based Architecture**: Pluggable condensation strategies
- **🔄 100% Backward Compatible**: Existing code works unchanged
- **⚙️ Configurable**: Enable/disable providers, set priorities
- **🎨 UI Integration**: Settings panel for provider management
- **✅ Fully Tested**: 125+ tests with complete coverage
- **📊 Metrics & Cost Tracking**: Built-in performance monitoring

## Quick Start

### Using the Default Provider

```typescript
import { summarizeConversation } from "@/core/condense"

// Works exactly as before - backward compatible
const result = await summarizeConversation(messages, apiHandler, systemPrompt, taskId, prevContextTokens)
```

### Using a Specific Provider

```typescript
import { getCondensationManager } from "@/core/condense"

const manager = getCondensationManager()
const result = await manager.condense(messages, apiHandler, {
	providerId: "native", // or any registered provider
	systemPrompt,
	taskId,
	prevContextTokens,
})
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│          Application Layer                          │
│  (summarizeConversation, Task, sliding-window)      │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│        CondensationManager (Singleton)              │
│  - Provider selection & orchestration               │
│  - Configuration management                         │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│       ProviderRegistry (Singleton)                  │
│  - Provider registration & lifecycle                │
│  - Enable/disable, priority management              │
└──────────────────┬──────────────────────────────────┘
                   │
        ┌──────────┴──────────┬──────────┐
        │                     │          │
┌───────▼────────┐  ┌────────▼──────┐  ...
│ NativeProvider │  │ Future Provider│
│  (Default)     │  │                │
└────────────────┘  └────────────────┘
```

## Design Patterns

| Pattern                 | Component                                 | Purpose                                    |
| ----------------------- | ----------------------------------------- | ------------------------------------------ |
| **Provider (Strategy)** | `ICondensationProvider`                   | Interchangeable condensation algorithms    |
| **Template Method**     | `BaseCondensationProvider`                | Shared validation, metrics, error handling |
| **Singleton**           | `CondensationManager`, `ProviderRegistry` | Single source of truth                     |
| **Registry**            | `ProviderRegistry`                        | Centralized provider management            |

## Documentation

- **[Architecture Guide](./docs/ARCHITECTURE.md)** - Detailed system architecture with diagrams
- **[Contributing Guide](./docs/CONTRIBUTING.md)** - How to add a new provider
- **[ADRs](./docs/adr/)** - Architecture Decision Records

### Architecture Decision Records

1. [Registry Pattern Over Plugin System](./docs/adr/001-registry-pattern.md)
2. [Singleton Pattern for Manager & Registry](./docs/adr/002-singleton-pattern.md)
3. [Backward Compatibility Strategy](./docs/adr/003-backward-compatibility.md)
4. [Template Method Pattern in Base Provider](./docs/adr/004-template-method-pattern.md)

## Current Status

### ✅ Phase 1 Complete (Commits 1-8)

- Core types & interfaces
- Base provider abstract class
- Provider registry
- Native provider (backward compatible)
- Condensation manager
- Integration with sliding-window
- Settings UI
- E2E tests

**Quality Metrics:**

- ✅ 125 tests passing (100%)
- ✅ Zero build errors
- ✅ 100% backward compatibility
- ✅ Full TypeScript type safety

### 🔮 Future Phases

- **Phase 2**: Performance optimizations & advanced metrics
- **Phase 3**: Additional provider implementations (LLM-based, hybrid)
- **Phase 4**: Advanced configuration & provider chaining

## API Reference

### Main Functions

```typescript
// Backward-compatible function
function summarizeConversation(
	messages: ApiMessage[],
	apiHandler: ApiHandler,
	systemPrompt: string,
	taskId: string,
	prevContextTokens: number,
	isAutomaticTrigger?: boolean,
	customCondensingPrompt?: string,
	condensingApiHandler?: ApiHandler,
): Promise<CondensationResult>

// Get the manager instance
function getCondensationManager(): CondensationManager

// Get the registry instance
function getProviderRegistry(): ProviderRegistry
```

### Core Types

```typescript
interface ICondensationProvider {
	readonly id: string
	readonly name: string
	readonly description: string

	condense(context: CondensationContext, options: CondensationOptions): Promise<CondensationResult>
	estimateCost(context: CondensationContext): Promise<number>
	validate(context: CondensationContext, options: CondensationOptions): Promise<ValidationResult>
}

interface CondensationResult {
	messages: ApiMessage[]
	summary?: string
	cost: number
	newContextTokens?: number
	error?: string
	metrics?: ProviderMetrics
}
```

## License

This project is part of Roo-Code and is licensed under the Apache License 2.0.

## Links

- [Main Repository](https://github.com/RooCodeInc/Roo-Code)
- [Documentation](https://docs.roocode.com)
- [Discord Community](https://discord.gg/roocode)
