---
sidebar_label: OpenAI Compatible
description: Use Roo Code with any OpenAI-compatible API provider including Perplexity, Together AI, Anyscale, and custom endpoints.
keywords:
    - OpenAI compatible
    - Roo Code
    - API integration
    - custom endpoints
    - Together AI
    - Perplexity
    - Anyscale
    - model configuration
---

# Using OpenAI Compatible Providers With Roo Code

Roo Code supports a wide range of AI model providers that offer APIs compatible with the OpenAI API standard. This means you can use models from providers _other than_ OpenAI, while still using a familiar API interface. This includes providers like:

- **Local models** running through tools like Ollama and LM Studio (covered in separate sections).
- **Cloud providers** like Perplexity, Together AI, Anyscale, and others.
- **Any other provider** offering an OpenAI-compatible API endpoint.

This document focuses on setting up providers _other than_ the official OpenAI API (which has its own [dedicated configuration page](/providers/openai)).

---

## General Configuration

The key to using an OpenAI-compatible provider is to configure two main settings:

1.  **Base URL:** This is the API endpoint for the provider. It will _not_ be `https://api.openai.com/v1` (that's for the official OpenAI API).
2.  **API Key:** This is the secret key you obtain from the provider.
3.  **Model ID:** This is the model name of the specific model.

You'll find these settings in the Roo Code settings panel (click the <Codicon name="gear" /> icon):

- **API Provider:** Select "OpenAI Compatible".
- **Base URL:** Enter the base URL provided by your chosen provider. **This is crucial.**
- **API Key:** Enter your API key.
- **Model:** Choose a model.
- **Model Configuration:** This lets you customize advanced configuration for the model
    - Max Output Tokens
    - Context Window
    - Image Support
    - Computer Use
    - Input Price
    - Output Price

---

## Native Tool Calling (OpenAI-Native Endpoint)

When you connect this provider directly to the official OpenAI API (or an endpoint that mirrors it exactly), Roo Code can use OpenAI's **native tool-calling** protocol instead of the XML-based tool format.

At a high level:

- **Tool definitions** are sent to the model using OpenAI's native tools schema.
- **Tool calls** stream back as dedicated tool events, including the tool name, arguments, and metadata.
- **Tool arguments** are streamed incrementally, which reduces latency between the model deciding to use a tool and Roo Code executing it.

### When native tools are used

Roo Code uses native tool calling when **all** of the following are true:

1. The selected provider is configured for the OpenAI-native protocol (OpenAI or an OpenAI-compatible endpoint that fully supports native tools).
2. The active profile's tool protocol is set to allow native tools (or left at its default, which prefers native tools when supported).
3. The selected model supports native tool calling.

If any of these conditions aren't met, Roo Code falls back to its XML-based tool protocol instead.

### Example: simple native tool flow

Here's a simplified example of how a file-reading tool might be exposed when using an OpenAI-native endpoint:

```json
{
	"tools": [
		{
			"type": "function",
			"function": {
				"name": "read_file",
				"description": "Read a file from the workspace with line numbers.",
				"parameters": {
					"type": "object",
					"properties": {
						"path": { "type": "string", "description": "Relative file path" },
						"start_line": { "type": "integer", "nullable": true },
						"end_line": { "type": "integer", "nullable": true }
					},
					"required": ["path"]
				}
			}
		}
	]
}
```

When the model decides to use `read_file`, Roo Code surfaces **streamed tool events** in the task timeline:

- A native _tool call_ event with the tool name and arguments as they're being generated
- The corresponding _tool result_ event showing the file contents and any truncation or line-range information

This gives you lower-latency feedback on which tools are being used and with what arguments.

### Settings and limitations

- **Tool protocol selector:** In advanced settings, you can choose which tool protocol Roo Code should prefer (XML vs native). If you disable native tools here, Roo Code will always use XML even if the provider supports native tools.
- **Model support:** Not all OpenAI-native or compatible models support tools. If a model doesn't support tools, Roo Code will not attempt to send tool definitions for it.
- **Provider quirks:** Some OpenAI-compatible providers only partially implement the native tools API. If Roo Code detects protocol errors, it may fall back to XML tools automatically.

For a deeper overview of how tools work in Roo Code in general, see the [Tool Use Overview](/advanced-usage/available-tools/tool-use-overview).

---

## Troubleshooting

- **"Invalid API Key":** Double-check that you've entered the API key correctly.
- **"Model Not Found":** Make sure you're using a valid model ID for your chosen provider.
- **Connection Errors:** Verify the Base URL is correct and that your provider's API is accessible.
- **Unexpected Results:** If you're getting unexpected results, try a different model.

By using an OpenAI-compatible provider, you can leverage the flexibility of Roo Code with a wider range of AI models. Remember to always consult your provider's documentation for the most accurate and up-to-date information.
