# Contributing a Condensation Provider

This guide will walk you through the process of adding a new condensation provider to the Context Condensation Provider System.

## Overview

A condensation provider is a pluggable component that implements a specific strategy for condensing conversation context. The system uses the Provider pattern to make these strategies interchangeable.

## Prerequisites

- Understanding of TypeScript and async/await
- Familiarity with the Roo-Code codebase
- Knowledge of the system architecture (see [ARCHITECTURE.md](./ARCHITECTURE.md))

## Step-by-Step Guide

### 1. Create Your Provider Class

Create a new file in `src/core/condense/providers/`:

```typescript
// src/core/condense/providers/MyCustomProvider.ts
import { BaseCondensationProvider } from "../BaseProvider"
import type { CondensationContext, CondensationOptions, CondensationResult } from "../types"

export class MyCustomCondensationProvider extends BaseCondensationProvider {
	// Unique identifier for your provider
	readonly id = "my-custom"

	// Human-readable name (shown in UI)
	readonly name = "My Custom Provider"

	// Brief description (shown in UI)
	readonly description = "Uses a custom algorithm to condense conversation context"

	/**
	 * Core condensation logic - implement your strategy here
	 */
	protected async condenseInternal(
		context: CondensationContext,
		options: CondensationOptions,
	): Promise<CondensationResult> {
		const { messages, systemPrompt, taskId, prevContextTokens } = context
		const { apiHandler } = options

		// Your custom condensation logic here
		// Example: Simple truncation strategy
		const condensedMessages = messages.slice(-10) // Keep last 10 messages

		return {
			messages: condensedMessages,
			cost: 0, // No API cost for simple truncation
			newContextTokens: condensedMessages.length * 100, // Rough estimate
			summary: "Condensed to last 10 messages",
		}
	}

	/**
	 * Estimate the cost of running this provider
	 */
	async estimateCost(context: CondensationContext): Promise<number> {
		// Return estimated cost in dollars
		// For API-based providers, calculate based on token count
		// For local algorithms, return 0
		return 0
	}
}
```

### 2. Add Custom Validation (Optional)

If your provider has specific requirements, override the `validate` method:

```typescript
export class MyCustomCondensationProvider extends BaseCondensationProvider {
	// ... other code ...

	async validate(
		context: CondensationContext,
		options: CondensationOptions,
	): Promise<{ valid: boolean; error?: string }> {
		// Custom validation logic
		if (context.messages.length < 20) {
			return {
				valid: false,
				error: "My Custom Provider requires at least 20 messages",
			}
		}

		// Call parent validation for standard checks
		return super.validate(context, options)
	}
}
```

### 3. Write Tests

Create a test file alongside your provider:

```typescript
// src/core/condense/providers/__tests__/MyCustomProvider.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest"
import { MyCustomCondensationProvider } from "../MyCustomProvider"
import type { CondensationContext, CondensationOptions } from "../../types"

describe("MyCustomCondensationProvider", () => {
	let provider: MyCustomCondensationProvider
	let mockContext: CondensationContext
	let mockOptions: CondensationOptions

	beforeEach(() => {
		provider = new MyCustomCondensationProvider()

		mockContext = {
			messages: Array(15)
				.fill(null)
				.map((_, i) => ({
					role: i % 2 === 0 ? "user" : "assistant",
					content: `Message ${i}`,
					ts: Date.now() + i,
				})),
			systemPrompt: "You are helpful",
			taskId: "test-task",
			prevContextTokens: 5000,
		} as any

		mockOptions = {
			apiHandler: {} as any,
			isAutomaticTrigger: false,
		}
	})

	it("should have correct metadata", () => {
		expect(provider.id).toBe("my-custom")
		expect(provider.name).toBe("My Custom Provider")
		expect(provider.description).toBeTruthy()
	})

	it("should condense messages correctly", async () => {
		const result = await provider.condense(mockContext, mockOptions)

		expect(result.error).toBeUndefined()
		expect(result.messages.length).toBeLessThanOrEqual(10)
		expect(result.cost).toBe(0)
		expect(result.metrics).toBeDefined()
		expect(result.metrics?.providerId).toBe("my-custom")
	})

	it("should validate minimum message count", async () => {
		const shortContext = {
			...mockContext,
			messages: mockContext.messages.slice(0, 5),
		}

		const result = await provider.condense(shortContext, mockOptions)

		expect(result.error).toBeDefined()
		expect(result.messages).toEqual(shortContext.messages)
	})

	it("should estimate cost correctly", async () => {
		const cost = await provider.estimateCost(mockContext)
		expect(cost).toBe(0)
	})
})
```

### 4. Register Your Provider

Add your provider to the registry. You have two options:

#### Option A: Register as Default Provider

Modify `CondensationManager` to register your provider by default:

```typescript
// src/core/condense/CondensationManager.ts
private registerDefaultProviders(): void {
  const registry = getProviderRegistry()

  // Register Native provider
  const nativeProvider = new NativeCondensationProvider()
  registry.register(nativeProvider, {
    enabled: true,
    priority: 100,
  })

  // Register your custom provider
  const customProvider = new MyCustomCondensationProvider()
  registry.register(customProvider, {
    enabled: true,
    priority: 50, // Lower priority than native
  })
}
```

#### Option B: Manual Registration (Recommended for Testing)

Register programmatically when needed:

```typescript
import { getProviderRegistry } from "@/core/condense"
import { MyCustomCondensationProvider } from "@/core/condense/providers/MyCustomProvider"

const registry = getProviderRegistry()
const provider = new MyCustomCondensationProvider()

registry.register(provider, {
	enabled: true,
	priority: 75,
})
```

### 5. Export Your Provider

Add your provider to the module exports:

```typescript
// src/core/condense/index.ts
export { MyCustomCondensationProvider } from "./providers/MyCustomProvider"
```

### 6. Add UI Integration (Optional)

To make your provider selectable in the settings UI, it will automatically appear once registered. The UI reads from `CondensationManager.listProviders()`.

## Best Practices

### 1. Error Handling

Always handle errors gracefully and return meaningful error messages:

```typescript
protected async condenseInternal(
  context: CondensationContext,
  options: CondensationOptions
): Promise<CondensationResult> {
  try {
    // Your logic here
    return result
  } catch (error) {
    throw new Error(`MyCustomProvider failed: ${error.message}`)
  }
}
```

### 2. Cost Calculation

Be accurate with cost estimation to help users make informed decisions:

```typescript
async estimateCost(context: CondensationContext): Promise<number> {
  const inputTokens = await countTokens(context.messages)
  const outputTokens = inputTokens * 0.1 // Estimate 10% output

  // Example: $0.01 per 1K input tokens, $0.03 per 1K output tokens
  return (inputTokens / 1000) * 0.01 + (outputTokens / 1000) * 0.03
}
```

### 3. Metrics

Return comprehensive metrics for monitoring and debugging:

```typescript
return {
	messages: condensedMessages,
	cost: actualCost,
	newContextTokens: newTokenCount,
	summary: "Condensed using custom algorithm",
	metrics: {
		providerId: this.id,
		timeElapsed: executionTime,
		tokensSaved: context.prevContextTokens - newTokenCount,
		compressionRatio: newTokenCount / context.prevContextTokens,
		// Custom metrics
		messagesRemoved: context.messages.length - condensedMessages.length,
	},
}
```

### 4. Testing

Write comprehensive tests covering:

- ✅ Happy path scenarios
- ✅ Edge cases (empty input, single message, etc.)
- ✅ Error conditions
- ✅ Validation logic
- ✅ Cost estimation accuracy
- ✅ Metrics generation

### 5. Documentation

Document your provider's behavior, requirements, and limitations:

```typescript
/**
 * MyCustomCondensationProvider uses a hybrid approach combining
 * importance scoring and semantic clustering to intelligently
 * select which messages to keep.
 *
 * Requirements:
 * - Minimum 20 messages
 * - OpenAI API key (uses embeddings)
 *
 * Best for:
 * - Long conversations (100+ messages)
 * - Technical discussions
 *
 * Limitations:
 * - Higher cost due to embedding generation
 * - Slower than simple truncation
 */
export class MyCustomCondensationProvider extends BaseCondensationProvider {
	// ...
}
```

## Example: LLM-Based Provider

Here's a complete example of a more sophisticated provider using an LLM:

```typescript
import { BaseCondensationProvider } from "../BaseProvider"
import type { CondensationContext, CondensationOptions, CondensationResult } from "../types"

export class LLMCondensationProvider extends BaseCondensationProvider {
	readonly id = "llm-condense"
	readonly name = "LLM-Based Condenser"
	readonly description = "Uses an LLM to intelligently summarize conversation context"

	protected async condenseInternal(
		context: CondensationContext,
		options: CondensationOptions,
	): Promise<CondensationResult> {
		const { messages, systemPrompt } = context
		const { apiHandler } = options

		// Prepare condensation prompt
		const condensationPrompt = this.buildPrompt(messages, systemPrompt)

		// Call LLM
		let summary = ""
		let inputTokens = 0
		let outputTokens = 0

		const stream = apiHandler.createMessage(
			systemPrompt,
			[{ role: "user", content: condensationPrompt }],
			options.customCondensingPrompt,
		)

		for await (const chunk of stream) {
			if (chunk.type === "text") {
				summary += chunk.text
			} else if (chunk.type === "usage") {
				inputTokens = chunk.inputTokens
				outputTokens = chunk.outputTokens
			}
		}

		// Calculate cost
		const cost = this.calculateCost(inputTokens, outputTokens)

		// Create condensed message list
		const condensedMessages = [
			messages[0], // Keep first message
			{
				role: "assistant" as const,
				content: summary,
				isSummary: true,
				ts: Date.now(),
			},
			...messages.slice(-3), // Keep last 3 messages
		]

		return {
			messages: condensedMessages,
			summary,
			cost,
			newContextTokens: await apiHandler.countTokens(condensedMessages),
			metrics: {
				providerId: this.id,
				inputTokens,
				outputTokens,
				summaryLength: summary.length,
			},
		}
	}

	private buildPrompt(messages: any[], systemPrompt: string): string {
		return `Summarize this conversation concisely:\n\n${messages.map((m) => `${m.role}: ${m.content}`).join("\n")}`
	}

	private calculateCost(inputTokens: number, outputTokens: number): number {
		// Example pricing
		return (inputTokens / 1000) * 0.01 + (outputTokens / 1000) * 0.03
	}

	async estimateCost(context: CondensationContext): Promise<number> {
		const estimatedInputTokens = context.messages.length * 100
		const estimatedOutputTokens = 500
		return this.calculateCost(estimatedInputTokens, estimatedOutputTokens)
	}
}
```

## Testing Your Provider

### Unit Tests

Run unit tests for your provider:

```bash
cd src
npx vitest run core/condense/providers/__tests__/MyCustomProvider.test.ts
```

### Integration Tests

Test integration with the manager:

```typescript
// In integration.test.ts
it("should work with custom provider", async () => {
	const registry = getProviderRegistry()
	const customProvider = new MyCustomCondensationProvider()
	registry.register(customProvider)

	const manager = getCondensationManager()
	manager.setDefaultProvider("my-custom")

	const result = await manager.condense(messages, apiHandler)
	expect(result.error).toBeUndefined()
})
```

### End-to-End Tests

Test the complete flow including UI:

```bash
cd src
npx vitest run core/condense/__tests__/e2e.test.ts
```

## Troubleshooting

### Common Issues

1. **Provider not appearing in UI**

    - Ensure it's registered in `CondensationManager.registerDefaultProviders()`
    - Check that `enabled: true` in the config

2. **Tests failing**

    - Verify mock setup matches actual API structure
    - Check async/await usage
    - Ensure proper cleanup in `afterEach`

3. **TypeScript errors**
    - Implement all required methods from `ICondensationProvider`
    - Return correct types from methods
    - Use proper generic constraints

## Resources

- [Architecture Guide](./ARCHITECTURE.md) - Detailed system architecture
- [ADR 001](./adr/001-registry-pattern.md) - Registry Pattern rationale
- [ADR 004](./adr/004-template-method-pattern.md) - Template Method Pattern rationale
- [Main README](../README.md) - System overview

## Getting Help

- **Discord**: [Join the Roo-Code community](https://discord.gg/roocode)
- **GitHub Issues**: [Report bugs or request features](https://github.com/RooCodeInc/Roo-Code/issues)
- **Documentation**: [Official docs](https://docs.roocode.com)

## Checklist

Before submitting your provider:

- [ ] Provider class extends `BaseCondensationProvider`
- [ ] Unique `id`, descriptive `name` and `description`
- [ ] `condenseInternal` implemented with proper error handling
- [ ] `estimateCost` returns accurate cost estimate
- [ ] Custom validation added if needed
- [ ] Comprehensive unit tests written
- [ ] Integration tests pass
- [ ] Provider registered in manager
- [ ] Documentation updated
- [ ] Code follows project style guidelines
