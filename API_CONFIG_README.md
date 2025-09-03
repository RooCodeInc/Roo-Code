# API Configuration Feature - Implementation Complete

This document describes the API configuration feature that automatically loads extension settings from an HTTP endpoint when the extension starts.

## Implementation Summary

✅ **Complete** - All planned features have been implemented successfully:

1. **ApiConfigService** - Fetches configuration from HTTP endpoint with retry logic and error handling
2. **ConfigMapper** - Transforms API JSON response to extension configuration format
3. **ConfigApplier** - Applies mapped configuration to extension state via ContextProxy
4. **Extension Integration** - Loads configuration during extension activation
5. **CodeIndexManager Integration** - Supports external configuration for code indexing settings

## Files Created/Modified

### New Files

- `src/services/api-config/types.ts` - TypeScript interfaces for API configuration
- `src/services/api-config/ApiConfigService.ts` - Service to fetch config from API endpoint
- `src/services/api-config/ConfigMapper.ts` - Maps API response to extension format
- `src/services/api-config/ConfigApplier.ts` - Applies configuration to extension state
- `src/services/api-config/index.ts` - Main API config manager and exports

### Modified Files

- `src/extension.ts` - Added API config loading during extension activation
- `src/services/code-index/config-manager.ts` - Added `applyExternalConfiguration()` method

### Test Files

- `test-api-config.json` - Example API response for testing
- `test-config-mapping.js` - Test script showing expected mappings
- `test-server.py` - Python HTTP server for testing

## API Endpoint Configuration

### Expected JSON Response Format

```json
{
	"systemPrompt": "Custom system prompt text",
	"apiProvider": "openai-native",
	"model": "gpt-4o-mini",
	"openAiNativeApiKey": "sk-proj-your-openai-key-here",
	"anthropicApiKey": "sk-ant-your-anthropic-key",
	"geminiApiKey": "your-gemini-key",
	"codeIndexing": {
		"embedderProvider": "openai",
		"qdrantUrl": "http://localhost:6333",
		"embeddingModel": "text-embedding-3-small",
		"providerApiKey": "embedding-provider-api-key",
		"qdrantApiKey": "qdrant-api-key"
	}
}
```

### Supported Configuration Fields

**Provider Settings:**

- `systemPrompt` → `globalSettings.customInstructions`
- `apiProvider` → `providerSettings.apiProvider`
- `model` → Provider-specific model field (see mapping below)

**Model Field Mapping by Provider:**

- `"openai"` → `providerSettings.openAiModelId`
- `"openai-native"` → `providerSettings.apiModelId`
- `"glama"` → `providerSettings.glamaModelId`
- `"openrouter"` → `providerSettings.openRouterModelId`
- `"ollama"` → `providerSettings.ollamaModelId`
- `"anthropic"`, `"gemini"`, `"mistral"`, etc. → `providerSettings.apiModelId`

**API Keys (stored in both secrets and provider settings):**

- `anthropicApiKey` → `secrets.anthropicApiKey` + `providerSettings.apiKey`
- `openAiApiKey` → `secrets.openAiApiKey` + `providerSettings.openAiApiKey`
- `openAiNativeApiKey` → `secrets.openAiNativeApiKey` + `providerSettings.openAiNativeApiKey`
- `claudeCodeApiKey` → `secrets.claudeCodeApiKey`
- `geminiApiKey` → `secrets.geminiApiKey` + `providerSettings.geminiApiKey`
- `mistralApiKey` → `secrets.mistralApiKey` + `providerSettings.mistralApiKey`
- And other provider keys...

**Code Indexing Settings:**

- `codeIndexing.embedderProvider` → `codeIndexSettings.codebaseIndexEmbedderProvider`
- `codeIndexing.qdrantUrl` → `codeIndexSettings.codebaseIndexQdrantUrl`
- `codeIndexing.embeddingModel` → `codeIndexSettings.codebaseIndexEmbedderModelId`
- `codeIndexing.providerApiKey` → Mapped to appropriate secret key based on provider
- `codeIndexing.qdrantApiKey` → `secrets.codeIndexQdrantApiKey`

### Important Provider Names

The extension uses specific provider names that map to different UI labels:

**For OpenAI:**

- Use `"openai-native"` → Displays as "OpenAI" in UI
- Use `"openai"` → Displays as "OpenAI Compatible" in UI

**Supported Provider Values:**

- `"anthropic"` → "Anthropic"
- `"claude-code"` → "Claude Code"
- `"openai-native"` → "OpenAI" (recommended for OpenAI API)
- `"openai"` → "OpenAI Compatible" (for OpenAI-compatible APIs)
- `"gemini"` → "Google Gemini"
- `"mistral"` → "Mistral"
- `"deepseek"` → "DeepSeek"
- `"groq"` → "Groq"
- `"bedrock"` → "Amazon Bedrock"
- And many others...

## Configuration & Usage

### Default Endpoint

- **URL:** `http://localhost:6123`
- **Method:** GET
- **Content-Type:** `application/json`

### Extension Behavior

1. **On Activation:** Extension attempts to load configuration from API endpoint
2. **Error Handling:** Network failures, timeouts, and invalid JSON are handled gracefully
3. **Logging:** All operations are logged to the extension output channel
4. **Fallback:** Extension continues normal operation if API config fails

## Testing Instructions

### Option 1: Using Python Test Server

1. Run the test server:

    ```bash
    python3 test-server.py
    ```

2. The server will run on `http://localhost:6123` and serve test configuration

3. Load/reload the extension in VS Code and check the output channel for logs

### Option 2: Using Your Own API

1. Implement an HTTP endpoint at `http://localhost:6123` that returns JSON in the expected format
2. Load/reload the extension and monitor the logs

## Monitoring & Debugging

### Extension Output Channel

All API configuration operations are logged to the extension output channel:

- Configuration fetch attempts and results
- Applied settings and their values
- Error messages and troubleshooting info

### Example Log Output

```
[ApiConfig] Loading configuration from API endpoint...
[ApiConfig] Successfully applied 10 settings from API
[ApiConfig] Applied settings: providerSettings.apiProvider, providerSettings.apiModelId, providerSettings.openAiNativeApiKey, globalSettings.customInstructions, secrets.openAiNativeApiKey, secrets.codeIndexOpenAiKey, codeIndexSettings.codebaseIndexEnabled, codeIndexSettings.codebaseIndexEmbedderProvider, codeIndexSettings.codebaseIndexQdrantUrl, codeIndexSettings.codebaseIndexEmbedderModelId
```

## Security Considerations

1. **API Keys:** All sensitive data (API keys) are stored securely using VS Code's secret storage
2. **Local Network:** Default endpoint uses localhost to prevent external exposure
3. **Error Handling:** API failures don't expose sensitive information in logs
4. **Timeout Protection:** Requests timeout after 10 seconds to prevent hanging

## Architecture Notes

- **Non-blocking:** API config loading doesn't block extension startup
- **Graceful Degradation:** Extension works normally if API config fails
- **Type Safety:** Full TypeScript support with proper type validation
- **Extensible:** Easy to add support for additional configuration fields
- **Clean Separation:** API config logic is isolated in dedicated service modules

## Status: Ready for Use

The implementation is complete and ready for production use. The extension will automatically attempt to load configuration from your API endpoint on startup while maintaining backward compatibility and graceful error handling.
