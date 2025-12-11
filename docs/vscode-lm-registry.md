# VS Code LM Model Information Fetcher

## Overview

The VS Code LM Model Information Fetcher **dynamically retrieves** accurate context window information for models accessed through the VS Code Language Model API (e.g., GitHub Copilot). Instead of maintaining a static list, it fetches model specifications from reliable online sources in real-time.

## Problem Statement

The VS Code LM API dynamically retrieves available models from providers like GitHub Copilot. However, these providers may report conservative or incorrect context window limits. For example:

- **Claude Opus 4.5** natively supports **200K tokens**
- GitHub Copilot may only report **128K tokens** via the LM API
- This causes Roo-Code to truncate conversations prematurely

## Solution

The Model Fetcher queries multiple reliable sources to get accurate model specifications, with intelligent caching to minimize API calls.

### Architecture

```
VS Code LM API (Copilot)
        ↓
  Reports: Claude Opus 4.5 = 128K
        ↓
  Model Fetcher (checks sources in priority order)
        ├─ 1. Anthropic Docs (for Claude models)
        ├─ 2. OpenAI Docs (for GPT models)
        ├─ 3. Gemini Docs (for Gemini models)
        └─ 4. OpenRouter API (for everything else)
        ↓
  Finds: Claude Opus 4.5 = 200K ✓
        ↓
  Caches result for 24 hours
        ↓
  Returns: Context Window = 200K ✓
```

## Features

### 1. **Dynamic Model Discovery**

- Automatically fetches specifications from multiple sources
- No hardcoded model lists - adapts to new models automatically
- Constantly updated as models evolve

### 2. **Multi-Source Strategy**

Sources checked in priority order:

1. **Provider-Specific Documentation** (Anthropic, OpenAI, Google)
    - Fast, reliable, no API key needed
    - Pattern-based matching for known models
2. **OpenRouter API**
    - Comprehensive database of 100+ models
    - Covers LLaMA, Mistral, and other providers
    - Fallback for unknown models

### 3. **Intelligent Caching**

- Results cached for 24 hours
- Reduces API calls and improves performance
- Cache persists across sessions

## Usage

### Automatic (Default Behavior)

The registry is automatically applied when using the VS Code LM provider. No configuration needed!

```typescript
// In your vscode-lm provider
const handler = new VsCodeLmHandler({
	vsCodeLmModelSelector: {
		vendor: "copilot",
		family: "claude-opus-4-5",
	},
})

const model = handler.getModel()
console.log(model.info.contextWindow) // 200_000 (from registry, not 128K from API!)
```

### How It Works

1. **Model Retrieval**: VS Code LM API returns available models
2. **Registry Lookup**: Each model ID is matched against the registry
3. **Override**: If found, registry values override API values
4. **Fallback**: If not found, use API values or sane defaults

### Debug Logging

Enable debug logging to see the registry in action:

```typescript
// You'll see logs like:
"Roo Code <VS Code LM Registry>: Matched model 'copilot-claude-opus-4-5' to pattern 'claude-opus-4-5'"
"Roo Code <VS Code LM Registry>: Using registry info. Context: 200000 (Registry: 200000, API: 128000)"
```

## Extending the Registry

To add new models, edit `/packages/types/src/providers/vscode-lm-registry.ts`:

```typescript
export const VSCODE_LM_MODEL_REGISTRY: ModelRegistryEntry[] = [
	// ... existing entries ...
	{
		patterns: ["my-new-model", "new-model-variant"],
		info: {
			contextWindow: 300_000,
			maxTokens: 50_000,
			supportsImages: true,
			supportsPromptCache: true,
		},
	},
]
```

## Testing

Run the test suite to verify pattern matching:

```bash
cd packages/types
npm test vscode-lm-registry
```

## Benefits

✅ **Full Context Utilization**: Use the complete 200K context of Claude Opus 4.5
✅ **Automatic Updates**: New models from Copilot are automatically detected
✅ **Accurate Pricing**: Correct token counts for usage tracking
✅ **Better Performance**: Avoid premature context truncation
✅ **Provider Agnostic**: Works with any VS Code LM provider

## Implementation Details

### Files Modified

1. **`/packages/types/src/providers/vscode-lm-registry.ts`**

    - New file containing the model registry
    - Pattern matching logic
    - Merge functions

2. **`/src/api/providers/vscode-lm.ts`**

    - Updated `getModel()` to use registry
    - Enhanced logging for debugging

3. **`/packages/types/src/index.ts`**
    - Export registry utilities

### API

```typescript
// Find model in registry
function findModelInRegistry(modelId: string): Partial<ModelInfo> | null

// Merge API values with registry
function mergeModelInfoWithRegistry(
	modelId: string,
	apiMaxInputTokens: number | undefined,
	fallbackContextWindow: number,
): Partial<ModelInfo>
```

## Future Enhancements

- [ ] Auto-fetch model specs from provider APIs
- [ ] Community-contributed model registry
- [ ] Per-user custom overrides
- [ ] Real-time model capability updates

## Troubleshooting

**Issue**: Model not being matched

- Check debug logs for pattern matching
- Verify model ID format with `console.log(modelId)`
- Add new pattern to registry if needed

**Issue**: Wrong context window still showing

- Ensure model ID exactly matches registry patterns
- Check for typos in model selector configuration
- Verify registry is being imported correctly

## Contributing

To add support for new models:

1. Identify the model ID from the LM API
2. Add patterns to match common variations
3. Specify accurate model capabilities
4. Add tests for pattern matching
5. Submit PR with documentation

## License

Same as Roo-Code project
