# Mistral Devstral 2 Performance and Thinking Tokens

## Overview

This document explains how Roo Code handles Mistral Devstral 2 models, including thinking token support and performance considerations.

## Thinking Token Support

### What are Thinking Tokens?

Mistral Devstral 2 models support a "thinking" mode where the model's reasoning process is streamed separately from the final response. This allows users to see the model's thought process in real-time, similar to how the Mistral Vibe CLI displays "thinking" indicators.

### Implementation Status

**✅ Thinking tokens are fully supported** in Roo Code's Mistral handler.

The implementation is located in [`src/api/providers/mistral.ts`](../src/api/providers/mistral.ts):

```typescript
// Lines 122-129
if (chunk.type === "thinking" && chunk.thinking) {
    // Handle thinking content as reasoning chunks
    for (const thinkingPart of chunk.thinking) {
        if (thinkingPart.type === "text" && thinkingPart.text) {
            yield { type: "reasoning", text: thinkingPart.text }
        }
    }
}
```

### How It Works

1. **Streaming**: When Devstral 2 generates a response, it streams two types of content:

    - `"thinking"` chunks: The model's reasoning process
    - `"text"` chunks: The final response

2. **Display**: Thinking chunks are yielded as `{ type: "reasoning", text: ... }` which the UI displays separately from the final response, allowing users to see the model's thought process.

3. **SDK Support**: The Mistral SDK v1.9.18+ includes `ThinkChunk` support for handling thinking tokens.

## Performance Considerations

### Current Performance

The user reported that "performance is suboptimal" when using Devstral 2 models. Here are the key factors:

1. **Thinking Tokens Add Latency**: When the model generates thinking tokens, it takes additional time before the final response begins. This is expected behavior and shows the model is working through the problem.

2. **Streaming is Enabled**: The handler properly streams both thinking and text tokens, so users see progress in real-time rather than waiting for the complete response.

3. **Temperature Setting**: PR #9957 set the default temperature to 0.2 based on Mistral's recommendations for optimal performance.

### Prompt Caching

**Current Status**: Mistral models currently have `supportsPromptCache: false` in the model definitions.

**Investigation Needed**:

- The Mistral API documentation does not clearly indicate whether prompt caching is supported for Devstral 2 models
- Unlike Anthropic or OpenAI, Mistral's API documentation doesn't provide explicit caching endpoints or parameters
- Further investigation with Mistral's API team would be needed to determine if caching is available

### Recommendations for Users

1. **Expect Thinking Time**: When using Devstral 2, the "thinking" phase is normal and indicates the model is reasoning through the problem. This is a feature, not a bug.

2. **Temperature**: The default temperature of 0.2 is optimized for code generation tasks. Users can adjust this in settings if needed.

3. **Model Selection**:

    - Use `devstral-latest` or `devstral-2512` for complex reasoning tasks where thinking tokens are valuable
    - Use `devstral-small-latest` or `labs-devstral-small-2512` for faster responses on simpler tasks

4. **Monitor the UI**: The thinking tokens should be visible in the UI, showing the model's reasoning process. If they're not appearing, this may indicate a UI rendering issue rather than an API issue.

## Technical Details

### Mistral SDK Version

Roo Code uses `@mistralai/mistralai` version `^1.9.18`, which includes support for thinking chunks.

### Content Chunk Types

The Mistral API returns content in different formats:

```typescript
type ContentChunkWithThinking = {
	type: string // "thinking" or "text"
	text?: string // For text chunks
	thinking?: Array<{
		// For thinking chunks
		type: string
		text?: string
	}>
}
```

### Streaming Flow

1. API request is made with streaming enabled
2. Server streams back chunks as they're generated
3. Thinking chunks are processed and yielded as `reasoning` type
4. Text chunks are processed and yielded as `text` type
5. UI displays both types appropriately

## Future Improvements

### Potential Optimizations

1. **Prompt Caching**: If Mistral adds prompt caching support, we can:

    - Cache system prompts across requests
    - Cache conversation history
    - Reduce latency for follow-up requests

2. **Batch Processing**: For multiple requests, investigate if Mistral supports batch APIs

3. **Connection Pooling**: Ensure HTTP connections are properly pooled and reused

### Monitoring

To help users understand performance:

1. **Token Metrics**: Display thinking token count vs. response token count
2. **Timing Metrics**: Show time spent in thinking phase vs. response phase
3. **Progress Indicators**: Enhance UI to better show when model is thinking

## References

- [Mistral Devstral 2 Documentation](https://docs.mistral.ai/models/devstral-2-25-12)
- [Mistral Vibe CLI](https://github.com/mistralai/mistral-vibe)
- [Mistral SDK](https://github.com/mistralai/client-ts)
- [Issue #9951](https://github.com/RooCodeInc/Roo-Code/issues/9951)
- [PR #9957](https://github.com/RooCodeInc/Roo-Code/pull/9957)

## Questions for Mistral Team

To further optimize performance, we need clarification from Mistral on:

1. Does the Mistral API support prompt caching for Devstral 2 models?
2. Are there any API parameters to control thinking token generation?
3. What are the recommended best practices for minimizing latency?
4. Are there any batch or concurrent request optimizations available?
